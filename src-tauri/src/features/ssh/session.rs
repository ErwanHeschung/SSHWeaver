use std::borrow::Cow;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use parking_lot::Mutex;
use russh::client::{self, AuthResult, Handle, KeyboardInteractiveAuthResponse};
use russh::keys::agent::client::AgentClient;
use russh::keys::known_hosts::{check_known_hosts, known_host_keys, learn_known_hosts};
use russh::keys::{
    load_secret_key, ssh_key, HashAlg, PrivateKey, PrivateKeyWithHashAlg,
    PublicKeyOrCertificate,
};
use russh::{cipher, kex, mac, Channel, ChannelMsg, MethodKind, Preferred};
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::{AppHandle, Manager};
use tauri_specta::Event;
use tokio::io::{AsyncRead, AsyncWrite};
use tokio::net::TcpStream;
use tokio::sync::{mpsc, oneshot};
use zeroize::Zeroizing;

use super::sftp::{SftpSessions, SftpSlot};
use super::{
    HostKeyPrompt, HostKeyPrompts, KeyPassphrasePrompt, KeyPassphrasePrompts,
    PassphraseAnswer, PendingConnections,
};
use crate::features::secrets::store::{self as secrets, Key};
use crate::features::terminal::{self, Control, TerminalSessions};

pub(super) type SessionHandle = Arc<Handle<ClientHandler>>;

#[derive(Debug, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ConnectParams {
    pub session_id: String,
    pub connection_id: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub profile_id: Option<String>,
    pub allow_legacy_algorithms: bool,
    pub cols: u32,
    pub rows: u32,
}

#[derive(Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ConnectOutcome {
    Connected,
    PasswordRequired,
}

#[derive(Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum PasswordOutcome {
    Authenticated,
    Failed(u32),
    LockedOut,
}

const MAX_PASSWORD_ATTEMPTS: u32 = 3;

pub struct Pending {
    handle: Handle<ClientHandler>,
    method: AuthMethod,
    secret: Key,
    username: String,
    cols: u32,
    rows: u32,
    attempts: u32,
}

pub(super) struct ClientHandler {
    app: AppHandle,
    session_id: String,
    host: String,
    port: u16,
    reject_reason: Arc<Mutex<Option<String>>>,
}

impl ClientHandler {
    async fn prompt_host_key(&self, fingerprint: String, changed: bool) -> bool {
        let (tx, rx) = oneshot::channel();
        self.app
            .state::<HostKeyPrompts>()
            .0
            .lock()
            .insert(self.session_id.clone(), tx);

        let event = HostKeyPrompt {
            session_id: self.session_id.clone(),
            host: self.host.clone(),
            port: self.port,
            fingerprint,
            changed,
        };
        if event.emit(&self.app).is_err() {
            return false;
        }
        rx.await.unwrap_or(false)
    }

    async fn handle_changed_host_key(
        &self,
        server_public_key: &ssh_key::PublicKey,
    ) -> Result<bool, russh::Error> {
        let fingerprint = server_public_key.fingerprint(HashAlg::Sha256).to_string();
        if !self.prompt_host_key(fingerprint.clone(), true).await {
            tracing::warn!(
                target: "ssh::audit",
                host = %self.host,
                port = self.port,
                %fingerprint,
                "changed host key rejected by user"
            );
            self.reject(format!(
                "host key for {}:{} has changed and was rejected",
                self.host, self.port
            ));
            return Ok(false);
        }

        tracing::warn!(
            target: "ssh::audit",
            host = %self.host,
            port = self.port,
            %fingerprint,
            "changed host key accepted by user; updating known_hosts"
        );
        let stale_lines: Vec<usize> = known_host_keys(&self.host, self.port)
            .unwrap_or_default()
            .into_iter()
            .filter(|(_, key)| {
                key.algorithm() == server_public_key.algorithm() && key != server_public_key
            })
            .map(|(line, _)| line)
            .collect();
        if let Err(e) = replace_known_host(&self.host, self.port, server_public_key, &stale_lines)
        {
            tracing::error!(
                target: "ssh::audit",
                host = %self.host,
                port = self.port,
                error = %e,
                "failed to update changed host key in known_hosts"
            );
        }
        Ok(true)
    }

    fn reject(&self, reason: impl Into<String>) {
        *self.reject_reason.lock() = Some(reason.into());
    }
}

impl client::Handler for ClientHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        server_public_key: &PublicKeyOrCertificate,
    ) -> Result<bool, Self::Error> {
        // Host certificates aren't supported yet (no CA trust store, no UI for
        // it): fail closed rather than silently falling back to some partial
        // check.
        let server_public_key = match server_public_key {
            PublicKeyOrCertificate::PublicKey { key, .. } => key,
            PublicKeyOrCertificate::Certificate(_) => {
                tracing::warn!(
                    target: "ssh::audit",
                    host = %self.host,
                    port = self.port,
                    "server offered a host certificate; certificates are not supported, rejecting"
                );
                self.reject(format!(
                    "{}:{} offered a host certificate, which is not supported yet",
                    self.host, self.port
                ));
                return Ok(false);
            }
        };

        match check_known_hosts(&self.host, self.port, server_public_key) {
            Ok(true) => return Ok(true),
            Ok(false) => {
                let known = !known_host_keys(&self.host, self.port)
                    .unwrap_or_default()
                    .is_empty();
                if known {
                    return self.handle_changed_host_key(server_public_key).await;
                }
            }
            Err(russh::keys::Error::KeyChanged { .. }) => {
                return self.handle_changed_host_key(server_public_key).await;
            }
            Err(e) => {
                tracing::error!(
                    target: "ssh::audit",
                    host = %self.host,
                    port = self.port,
                    error = %e,
                    "could not verify host key against known_hosts; rejecting connection"
                );
                self.reject(format!(
                    "could not verify the host key for {}:{} ({e}); check ~/.ssh/known_hosts",
                    self.host, self.port
                ));
                return Ok(false);
            }
        }

        let fingerprint = server_public_key.fingerprint(HashAlg::Sha256).to_string();
        if !self.prompt_host_key(fingerprint.clone(), false).await {
            tracing::warn!(
                target: "ssh::audit",
                host = %self.host,
                port = self.port,
                %fingerprint,
                "unknown host key rejected by user"
            );
            self.reject("host key rejected");
            return Ok(false);
        }
        tracing::info!(
            target: "ssh::audit",
            host = %self.host,
            port = self.port,
            %fingerprint,
            "new host key accepted by user (trust on first use)"
        );
        if let Err(e) = learn_known_hosts(&self.host, self.port, server_public_key) {
            tracing::error!(
                target: "ssh::audit",
                host = %self.host,
                port = self.port,
                error = %e,
                "failed to record accepted host key in known_hosts"
            );
        }
        Ok(true)
    }
}

fn accepts(result: &AuthResult, method: MethodKind) -> bool {
    matches!(
        result,
        AuthResult::Failure { remaining_methods, .. } if remaining_methods.contains(&method)
    )
}

const CONNECT_TIMEOUT: Duration = Duration::from_secs(20);

/// Modern algorithms only, unless the connection opted into the legacy tail.
///
/// The old names are what network gear (Arista EOS, classic IOS) offers instead
/// of anything current: SHA-1 key exchange, `ssh-rsa` and `ssh-dss` host keys,
/// CBC ciphers. Announcing them to every server would weaken the whole fleet
/// for the sake of a few devices, so they are opted into per connection.
fn preferred(allow_legacy: bool) -> Preferred {
    let mut kex = vec![
        kex::MLKEM768X25519_SHA256,
        kex::CURVE25519,
        kex::CURVE25519_PRE_RFC_8731,
        kex::DH_GEX_SHA256,
        kex::DH_G18_SHA512,
        kex::DH_G17_SHA512,
        kex::DH_G16_SHA512,
        kex::DH_G15_SHA512,
        kex::DH_G14_SHA256,
        kex::ECDH_SHA2_NISTP521,
        kex::ECDH_SHA2_NISTP384,
        kex::ECDH_SHA2_NISTP256,
    ];
    let mut key = vec![
        ssh_key::Algorithm::Ed25519,
        ssh_key::Algorithm::Ecdsa {
            curve: ssh_key::EcdsaCurve::NistP256,
        },
        ssh_key::Algorithm::Ecdsa {
            curve: ssh_key::EcdsaCurve::NistP384,
        },
        ssh_key::Algorithm::Ecdsa {
            curve: ssh_key::EcdsaCurve::NistP521,
        },
        ssh_key::Algorithm::Rsa {
            hash: Some(HashAlg::Sha512),
        },
        ssh_key::Algorithm::Rsa {
            hash: Some(HashAlg::Sha256),
        },
    ];
    let mut cipher = vec![
        cipher::CHACHA20_POLY1305,
        cipher::AES_256_GCM,
        cipher::AES_128_GCM,
        cipher::AES_256_CTR,
        cipher::AES_192_CTR,
        cipher::AES_128_CTR,
    ];
    let mut mac = vec![
        mac::HMAC_SHA512_ETM,
        mac::HMAC_SHA256_ETM,
        mac::HMAC_SHA512,
        mac::HMAC_SHA256,
    ];

    if allow_legacy {
        kex.extend_from_slice(&[kex::DH_G14_SHA1, kex::DH_GEX_SHA1, kex::DH_G1_SHA1]);
        key.extend_from_slice(&[
            ssh_key::Algorithm::Rsa { hash: None },
            ssh_key::Algorithm::Dsa,
        ]);
        cipher.extend_from_slice(&[
            cipher::AES_256_CBC,
            cipher::AES_192_CBC,
            cipher::AES_128_CBC,
            cipher::TRIPLE_DES_CBC,
        ]);
        mac.extend_from_slice(&[mac::HMAC_SHA1_ETM, mac::HMAC_SHA1]);
    }

    // OpenSSH puts the extension markers at the tail, after every real name.
    kex.extend_from_slice(&[
        kex::EXTENSION_SUPPORT_AS_CLIENT,
        kex::EXTENSION_SUPPORT_AS_SERVER,
        kex::EXTENSION_OPENSSH_STRICT_KEX_AS_CLIENT,
        kex::EXTENSION_OPENSSH_STRICT_KEX_AS_SERVER,
    ]);

    Preferred {
        kex: Cow::Owned(kex),
        key: Cow::Owned(key),
        cipher: Cow::Owned(cipher),
        mac: Cow::Owned(mac),
        ..Preferred::DEFAULT
    }
}

/// `keyboard-interactive` is one hidden password prompt from the user's side,
/// and all that many appliances offer, so it shares the password path.
#[derive(Debug, Clone, Copy)]
pub enum AuthMethod {
    Password,
    KeyboardInteractive,
}

fn password_method(result: &AuthResult) -> Option<AuthMethod> {
    if accepts(result, MethodKind::Password) {
        Some(AuthMethod::Password)
    } else if accepts(result, MethodKind::KeyboardInteractive) {
        Some(AuthMethod::KeyboardInteractive)
    } else {
        None
    }
}

const MAX_KEYBOARD_INTERACTIVE_ROUNDS: usize = 8;

async fn try_password(
    handle: &mut Handle<ClientHandler>,
    method: AuthMethod,
    username: &str,
    password: &str,
) -> anyhow::Result<bool> {
    match method {
        AuthMethod::Password => Ok(handle
            .authenticate_password(username, password)
            .await?
            .success()),
        AuthMethod::KeyboardInteractive => {
            let mut response = handle
                .authenticate_keyboard_interactive_start(username, None::<String>)
                .await?;
            for _ in 0..MAX_KEYBOARD_INTERACTIVE_ROUNDS {
                match response {
                    KeyboardInteractiveAuthResponse::Success => return Ok(true),
                    KeyboardInteractiveAuthResponse::Failure { .. } => return Ok(false),
                    KeyboardInteractiveAuthResponse::InfoRequest { prompts, .. } => {
                        // An echoed prompt asks for something else, such as a
                        // second factor, that this client does not have.
                        let answers = prompts
                            .iter()
                            .map(|prompt| {
                                if prompt.echo {
                                    String::new()
                                } else {
                                    password.to_string()
                                }
                            })
                            .collect();
                        response = handle
                            .authenticate_keyboard_interactive_respond(answers)
                            .await?;
                    }
                }
            }
            Ok(false)
        }
    }
}

fn secret_key(params: &ConnectParams) -> Key {
    match &params.profile_id {
        Some(profile_id) => Key::profile(profile_id),
        None => Key::connection(&params.connection_id),
    }
}

pub async fn open(app: AppHandle, params: ConnectParams) -> anyhow::Result<ConnectOutcome> {
    {
        let sessions = app.state::<TerminalSessions>();
        let pending = app.state::<PendingConnections>();
        if sessions.contains(&params.session_id)
            || pending.0.lock().contains_key(&params.session_id)
        {
            anyhow::bail!("session id already in use");
        }
    }

    let config = Arc::new(client::Config {
        inactivity_timeout: Some(Duration::from_secs(3600)),
        keepalive_interval: Some(Duration::from_secs(30)),
        keepalive_max: 3,
        preferred: preferred(params.allow_legacy_algorithms),
        ..Default::default()
    });

    let reject_reason = Arc::new(Mutex::new(None));
    let handler = ClientHandler {
        app: app.clone(),
        session_id: params.session_id.clone(),
        host: params.host.clone(),
        port: params.port,
        reject_reason: reject_reason.clone(),
    };

    let stream = match tokio::time::timeout(
        CONNECT_TIMEOUT,
        TcpStream::connect((params.host.as_str(), params.port)),
    )
    .await
    {
        Ok(Ok(stream)) => stream,
        Ok(Err(err)) => return Err(err.into()),
        Err(_) => anyhow::bail!("connection timed out after {}s", CONNECT_TIMEOUT.as_secs()),
    };

    let mut handle = match client::connect_stream(config, stream, handler).await {
        Ok(handle) => handle,
        Err(err) => {
            if let Some(reason) = reject_reason.lock().take() {
                anyhow::bail!(reason);
            }
            return Err(err.into());
        }
    };

    let mut result = handle.authenticate_none(&params.username).await?;

    let mut note = "";
    if !result.success() && accepts(&result, MethodKind::PublicKey) {
        let agent = try_agent_auth(
            &mut handle,
            &params.username,
            params.allow_legacy_algorithms,
        )
        .await;
        match agent {
            Ok(Some(authed)) => result = authed,
            Ok(None) => note = "; ssh-agent offered no key the server accepted",
            Err(_) => note = "; ssh-agent is not available (is it running with a key loaded?)",
        }
    }

    if !result.success() && accepts(&result, MethodKind::PublicKey) {
        let authed = try_default_keys(
            &app,
            &mut handle,
            &params.username,
            &params.session_id,
            params.allow_legacy_algorithms,
            &mut note,
        )
        .await;
        if let Some(authed) = authed {
            result = authed;
        }
    }

    if result.success() {
        tracing::info!(
            target: "ssh::audit",
            host = %params.host,
            port = params.port,
            user = %params.username,
            "authenticated via key/agent"
        );
        start_session(app, params.session_id, handle, params.cols, params.rows).await?;
        return Ok(ConnectOutcome::Connected);
    }

    if let Some(method) = password_method(&result) {
        let secret = secret_key(&params);
        if let Ok(Some(saved)) = secrets::get(&secret) {
            if try_password(&mut handle, method, &params.username, saved.as_str()).await? {
                tracing::info!(
                    target: "ssh::audit",
                    host = %params.host,
                    port = params.port,
                    user = %params.username,
                    "authenticated via saved password"
                );
                start_session(app, params.session_id, handle, params.cols, params.rows).await?;
                return Ok(ConnectOutcome::Connected);
            }
            // A shared profile password being refused by one server is not
            // proof it is stale; leave it for the prompt to overwrite.
            if secret.is_connection() {
                let _ = secrets::delete(&secret);
            }
            tracing::warn!(
                target: "ssh::audit",
                host = %params.host,
                port = params.port,
                user = %params.username,
                shared = !secret.is_connection(),
                "saved password rejected"
            );
        }

        app.state::<PendingConnections>().0.lock().insert(
            params.session_id,
            Pending {
                handle,
                method,
                secret,
                username: params.username,
                cols: params.cols,
                rows: params.rows,
                attempts: 0,
            },
        );
        return Ok(ConnectOutcome::PasswordRequired);
    }

    tracing::warn!(
        target: "ssh::audit",
        host = %params.host,
        port = params.port,
        user = %params.username,
        "no supported authentication method"
    );
    anyhow::bail!("no supported authentication method{note}")
}

pub async fn authenticate_password(
    app: AppHandle,
    session_id: String,
    password: String,
    remember: bool,
) -> anyhow::Result<PasswordOutcome> {
    let password = Zeroizing::new(password);

    let pending = app
        .state::<PendingConnections>()
        .0
        .lock()
        .remove(&session_id);
    let Some(mut pending) = pending else {
        anyhow::bail!("no pending connection");
    };

    let authenticated = try_password(
        &mut pending.handle,
        pending.method,
        &pending.username,
        password.as_str(),
    )
    .await?;

    if authenticated {
        tracing::info!(
            target: "ssh::audit",
            user = %pending.username,
            "authenticated via password"
        );
        if remember {
            if let Err(e) = secrets::set(&pending.secret, password.as_str()) {
                tracing::warn!(
                    target: "ssh::audit",
                    user = %pending.username,
                    error = %e,
                    "failed to save password to keystore"
                );
            }
        }
        start_session(app, session_id, pending.handle, pending.cols, pending.rows).await?;
        return Ok(PasswordOutcome::Authenticated);
    }

    pending.attempts += 1;
    if pending.attempts >= MAX_PASSWORD_ATTEMPTS {
        // Drop `pending` (closing the handle) instead of keeping a stale,
        // half-authenticated connection around for further guessing.
        tracing::warn!(
            target: "ssh::audit",
            user = %pending.username,
            attempts = pending.attempts,
            "password authentication failed; max attempts reached, connection closed"
        );
        return Ok(PasswordOutcome::LockedOut);
    }

    let attempts_remaining = MAX_PASSWORD_ATTEMPTS - pending.attempts;
    tracing::warn!(
        target: "ssh::audit",
        user = %pending.username,
        attempts = pending.attempts,
        attempts_remaining,
        "password authentication failed"
    );
    app.state::<PendingConnections>()
        .0
        .lock()
        .insert(session_id, pending);
    Ok(PasswordOutcome::Failed(attempts_remaining))
}

async fn try_agent_auth(
    handle: &mut Handle<ClientHandler>,
    user: &str,
    allow_legacy: bool,
) -> anyhow::Result<Option<AuthResult>> {
    #[cfg(windows)]
    let agent = AgentClient::connect_named_pipe(r"\\.\pipe\openssh-ssh-agent").await?;
    #[cfg(unix)]
    let agent = AgentClient::connect_env().await?;

    agent_auth(handle, user, agent, allow_legacy).await
}

async fn agent_auth<S>(
    handle: &mut Handle<ClientHandler>,
    user: &str,
    mut agent: AgentClient<S>,
    allow_legacy: bool,
) -> anyhow::Result<Option<AuthResult>>
where
    S: AsyncRead + AsyncWrite + Unpin + Send,
{
    for identity in agent.request_identities().await? {
        let key = identity.public_key().into_owned();
        for hash_alg in hash_candidates(key.algorithm(), allow_legacy) {
            if let Ok(result) = handle
                .authenticate_publickey_with(user, key.clone(), hash_alg, &mut agent)
                .await
            {
                if result.success() {
                    return Ok(Some(result));
                }
            }
        }
    }
    Ok(None)
}

const DEFAULT_KEY_NAMES: [&str; 4] = ["id_ed25519", "id_ecdsa", "id_rsa", "id_dsa"];

const MAX_PASSPHRASE_ATTEMPTS: u32 = 3;

async fn prompt_passphrase(
    app: &AppHandle,
    session_id: &str,
    path: &Path,
    retry: bool,
) -> PassphraseAnswer {
    let (tx, rx) = oneshot::channel();
    app.state::<KeyPassphrasePrompts>()
        .0
        .lock()
        .insert(session_id.to_string(), tx);

    let event = KeyPassphrasePrompt {
        session_id: session_id.to_string(),
        path: path.display().to_string(),
        retry,
    };
    if event.emit(app).is_err() {
        return None;
    }
    rx.await.ok().flatten()
}

/// An encrypted key is unusable without its passphrase, so ask for it rather
/// than skip the key and fall through to password authentication.
async fn unlock_key(app: &AppHandle, session_id: &str, path: &Path) -> Option<PrivateKey> {
    let secret = Key::key_file(&path.display().to_string());
    if let Ok(Some(saved)) = secrets::get(&secret) {
        match load_secret_key(path, Some(saved.as_str())) {
            Ok(key) => return Some(key),
            // The key was replaced, or re-encrypted under another passphrase.
            Err(_) => {
                let _ = secrets::delete(&secret);
            }
        }
    }

    for attempt in 0..MAX_PASSPHRASE_ATTEMPTS {
        let (passphrase, remember) =
            prompt_passphrase(app, session_id, path, attempt > 0).await?;
        let passphrase = Zeroizing::new(passphrase);
        let Ok(key) = load_secret_key(path, Some(passphrase.as_str())) else {
            continue;
        };
        if remember {
            if let Err(e) = secrets::set(&secret, passphrase.as_str()) {
                tracing::warn!(
                    target: "ssh::audit",
                    path = %path.display(),
                    error = %e,
                    "failed to save key passphrase to keystore"
                );
            }
        }
        return Some(key);
    }
    None
}

async fn try_default_keys(
    app: &AppHandle,
    handle: &mut Handle<ClientHandler>,
    user: &str,
    session_id: &str,
    allow_legacy: bool,
    note: &mut &'static str,
) -> Option<AuthResult> {
    let ssh_dir = home_dir()?.join(".ssh");
    for name in DEFAULT_KEY_NAMES {
        let path = ssh_dir.join(name);
        if !path.exists() {
            continue;
        }
        let key = match load_secret_key(&path, None) {
            Ok(key) => Arc::new(key),
            Err(russh::keys::Error::KeyIsEncrypted) => {
                match unlock_key(app, session_id, &path).await {
                    Some(key) => Arc::new(key),
                    None => {
                        *note = "; a ~/.ssh key was left locked";
                        continue;
                    }
                }
            }
            Err(_) => continue,
        };

        for hash_alg in hash_candidates(key.algorithm(), allow_legacy) {
            let candidate = PrivateKeyWithHashAlg::new(key.clone(), hash_alg);
            if let Ok(result) = handle.authenticate_publickey(user, candidate).await {
                if result.success() {
                    return Some(result);
                }
            }
        }
    }
    None
}

/// `None` means "sign under the key's own algorithm name", which for RSA is
/// the SHA-1 `ssh-rsa` a server may accept when it rejects both SHA-2 names.
fn hash_candidates(algorithm: ssh_key::Algorithm, allow_legacy: bool) -> Vec<Option<HashAlg>> {
    if !algorithm.is_rsa() {
        return vec![None];
    }
    let mut candidates = vec![Some(HashAlg::Sha512), Some(HashAlg::Sha256)];
    if allow_legacy {
        candidates.push(None);
    }
    candidates
}

fn home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
}

fn replace_known_host(
    host: &str,
    port: u16,
    new_key: &ssh_key::PublicKey,
    stale_lines: &[usize],
) -> std::io::Result<()> {
    if !stale_lines.is_empty() {
        let path = home_dir()
            .map(|home| home.join(".ssh").join("known_hosts"))
            .ok_or_else(|| std::io::Error::other("no home directory"))?;
        if let Ok(contents) = std::fs::read_to_string(&path) {
            atomic_write(&path, &drop_lines(&contents, stale_lines))?;
        }
    }

    learn_known_hosts(host, port, new_key).map_err(std::io::Error::other)
}

fn drop_lines(contents: &str, stale_lines: &[usize]) -> String {
    let mut kept: Vec<&str> = contents
        .lines()
        .enumerate()
        .filter(|(i, _)| !stale_lines.contains(&(i + 1)))
        .map(|(_, line)| line)
        .collect();
    kept.push("");
    kept.join("\n")
}

fn atomic_write(path: &Path, contents: &str) -> std::io::Result<()> {
    let dir = path
        .parent()
        .ok_or_else(|| std::io::Error::other("invalid known_hosts path"))?;
    let tmp = dir.join(format!(".known_hosts.{}.tmp", uuid::Uuid::new_v4()));
    if let Err(e) = std::fs::write(&tmp, contents) {
        let _ = std::fs::remove_file(&tmp);
        return Err(e);
    }
    if let Err(e) = std::fs::rename(&tmp, path) {
        let _ = std::fs::remove_file(&tmp);
        return Err(e);
    }
    Ok(())
}

async fn start_session(
    app: AppHandle,
    session_id: String,
    handle: Handle<ClientHandler>,
    cols: u32,
    rows: u32,
) -> anyhow::Result<()> {
    let handle: SessionHandle = Arc::new(handle);
    let channel = handle.channel_open_session().await?;
    channel
        .request_pty(false, "xterm-256color", cols, rows, 0, 0, &[])
        .await?;
    channel.request_shell(true).await?;

    let (tx, rx) = mpsc::unbounded_channel::<Control>();
    app.state::<TerminalSessions>()
        .insert(session_id.clone(), tx);

    app.state::<SftpSessions>()
        .0
        .lock()
        .insert(session_id.clone(), Arc::new(SftpSlot::new(handle.clone())));

    tauri::async_runtime::spawn(run(app, session_id, handle, channel, rx));
    Ok(())
}

async fn run(
    app: AppHandle,
    session_id: String,
    handle: SessionHandle,
    mut channel: Channel<client::Msg>,
    mut rx: mpsc::UnboundedReceiver<Control>,
) {
    let message = loop {
        tokio::select! {
            msg = channel.wait() => match msg {
                Some(ChannelMsg::Data { data }) => terminal::emit_output(&app, &session_id, &data),
                Some(ChannelMsg::ExtendedData { data, .. }) => terminal::emit_output(&app, &session_id, &data),
                Some(ChannelMsg::Eof) | Some(ChannelMsg::Close) | None => break None,
                _ => {}
            },
            cmd = rx.recv() => match cmd {
                Some(Control::Data(bytes)) => {
                    let _ = channel.data(&bytes[..]).await;
                }
                Some(Control::Resize { cols, rows }) => {
                    let _ = channel.window_change(cols, rows, 0, 0).await;
                }
                Some(Control::Close) | None => break None,
            },
        }
    };

    let _ = channel.eof().await;
    app.state::<SftpSessions>()
        .0
        .lock()
        .remove(&session_id);
    drop(handle);
    app.state::<TerminalSessions>().remove(&session_id);
    terminal::emit_closed(&app, session_id, message);
}

#[cfg(test)]
mod tests;
