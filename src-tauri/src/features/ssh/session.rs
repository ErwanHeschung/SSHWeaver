use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use parking_lot::Mutex;
use russh::client::{self, AuthResult, Handle};
use russh::keys::agent::client::AgentClient;
use russh::keys::known_hosts::{check_known_hosts, learn_known_hosts};
use russh::keys::{load_secret_key, ssh_key, HashAlg, PrivateKey, PrivateKeyWithHashAlg};
use russh::{Channel, ChannelMsg, MethodKind};
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::{AppHandle, Manager};
use tauri_specta::Event;
use tokio::io::{AsyncRead, AsyncWrite};
use tokio::sync::{mpsc, oneshot};
use zeroize::Zeroizing;

use super::{
    Control, HostKeyPrompt, HostKeyPrompts, PendingConnections, SshClosed, SshOutput, SshSessions,
};

#[derive(Debug, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ConnectParams {
    pub session_id: String,
    pub host: String,
    pub port: u16,
    pub username: String,
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
    username: String,
    cols: u32,
    rows: u32,
    attempts: u32,
}

struct ClientHandler {
    app: AppHandle,
    session_id: String,
    host: String,
    port: u16,
    reject_reason: Arc<Mutex<Option<String>>>,
}

impl ClientHandler {
    async fn prompt_host_key(&self, fingerprint: String) -> bool {
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
        };
        if event.emit(&self.app).is_err() {
            return false;
        }
        rx.await.unwrap_or(false)
    }

    fn reject(&self, reason: impl Into<String>) {
        *self.reject_reason.lock() = Some(reason.into());
    }
}

impl client::Handler for ClientHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        server_public_key: &ssh_key::PublicKey,
    ) -> Result<bool, Self::Error> {
        match check_known_hosts(&self.host, self.port, server_public_key) {
            Ok(true) => return Ok(true),
            Err(russh::keys::Error::KeyChanged { .. }) => {
                tracing::warn!(
                    target: "ssh::audit",
                    host = %self.host,
                    port = self.port,
                    "host key CHANGED — connection refused (possible man-in-the-middle)"
                );
                self.reject(format!(
                    "host key for {}:{} has CHANGED — possible man-in-the-middle. \
                     If the change is expected, remove the old line from ~/.ssh/known_hosts.",
                    self.host, self.port
                ));
                return Ok(false);
            }
            Ok(false) | Err(_) => {}
        }

        let fingerprint = server_public_key.fingerprint(HashAlg::Sha256).to_string();
        if !self.prompt_host_key(fingerprint.clone()).await {
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

pub async fn open(app: AppHandle, params: ConnectParams) -> anyhow::Result<ConnectOutcome> {
    {
        let sessions = app.state::<SshSessions>();
        let pending = app.state::<PendingConnections>();
        if sessions.0.lock().contains_key(&params.session_id)
            || pending.0.lock().contains_key(&params.session_id)
        {
            anyhow::bail!("session id already in use");
        }
    }

    let config = Arc::new(client::Config {
        inactivity_timeout: Some(Duration::from_secs(3600)),
        keepalive_interval: Some(Duration::from_secs(30)),
        keepalive_max: 3,
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

    let connect =
        tokio::time::timeout(CONNECT_TIMEOUT, client::connect(config, (params.host.as_str(), params.port), handler));
    let mut handle = match connect.await {
        Ok(Ok(handle)) => handle,
        Ok(Err(err)) => {
            if let Some(reason) = reject_reason.lock().take() {
                anyhow::bail!(reason);
            }
            return Err(err.into());
        }
        Err(_) => anyhow::bail!("connection timed out after {}s", CONNECT_TIMEOUT.as_secs()),
    };

    let mut result = handle.authenticate_none(&params.username).await?;

    let mut note = "";
    if !result.success() && accepts(&result, MethodKind::PublicKey) {
        match try_agent_auth(&mut handle, &params.username).await {
            Ok(Some(authed)) => result = authed,
            Ok(None) => note = "; ssh-agent offered no key the server accepted",
            Err(_) => note = "; ssh-agent is not available (is it running with a key loaded?)",
        }
    }

    if !result.success() && accepts(&result, MethodKind::PublicKey) {
        if let Some(authed) = try_default_keys(&mut handle, &params.username, &mut note).await {
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

    if accepts(&result, MethodKind::Password) {
        app.state::<PendingConnections>().0.lock().insert(
            params.session_id,
            Pending {
                handle,
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

    let result = pending
        .handle
        .authenticate_password(&pending.username, password.as_str())
        .await?;

    if result.success() {
        tracing::info!(
            target: "ssh::audit",
            user = %pending.username,
            "authenticated via password"
        );
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
) -> anyhow::Result<Option<AuthResult>> {
    #[cfg(windows)]
    let agent = AgentClient::connect_named_pipe(r"\\.\pipe\openssh-ssh-agent").await?;
    #[cfg(unix)]
    let agent = AgentClient::connect_env().await?;

    agent_auth(handle, user, agent).await
}

async fn agent_auth<S>(
    handle: &mut Handle<ClientHandler>,
    user: &str,
    mut agent: AgentClient<S>,
) -> anyhow::Result<Option<AuthResult>>
where
    S: AsyncRead + AsyncWrite + Unpin + Send,
{
    for identity in agent.request_identities().await? {
        let key = identity.public_key().into_owned();
        if let Ok(result) = handle
            .authenticate_publickey_with(user, key, None, &mut agent)
            .await
        {
            if result.success() {
                return Ok(Some(result));
            }
        }
    }
    Ok(None)
}

const DEFAULT_KEY_NAMES: [&str; 3] = ["id_ed25519", "id_ecdsa", "id_rsa"];

async fn try_default_keys(
    handle: &mut Handle<ClientHandler>,
    user: &str,
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
                *note = "; a ~/.ssh key is passphrase-protected (not supported yet — use ssh-agent)";
                continue;
            }
            Err(_) => continue,
        };

        for hash_alg in hash_candidates(&key) {
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

fn hash_candidates(key: &PrivateKey) -> Vec<Option<HashAlg>> {
    if key.algorithm().is_rsa() {
        vec![Some(HashAlg::Sha512), Some(HashAlg::Sha256)]
    } else {
        vec![None]
    }
}

fn home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
}

async fn start_session(
    app: AppHandle,
    session_id: String,
    handle: Handle<ClientHandler>,
    cols: u32,
    rows: u32,
) -> anyhow::Result<()> {
    let channel = handle.channel_open_session().await?;
    channel
        .request_pty(false, "xterm-256color", cols, rows, 0, 0, &[])
        .await?;
    channel.request_shell(true).await?;

    let (tx, rx) = mpsc::unbounded_channel::<Control>();
    app.state::<SshSessions>()
        .0
        .lock()
        .insert(session_id.clone(), tx);

    tauri::async_runtime::spawn(run(app, session_id, handle, channel, rx));
    Ok(())
}

async fn run(
    app: AppHandle,
    session_id: String,
    handle: Handle<ClientHandler>,
    mut channel: Channel<client::Msg>,
    mut rx: mpsc::UnboundedReceiver<Control>,
) {
    let message = loop {
        tokio::select! {
            msg = channel.wait() => match msg {
                Some(ChannelMsg::Data { data }) => emit_output(&app, &session_id, &data),
                Some(ChannelMsg::ExtendedData { data, .. }) => emit_output(&app, &session_id, &data),
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
    drop(handle);
    app.state::<SshSessions>()
        .0
        .lock()
        .remove(&session_id);
    let _ = SshClosed { session_id, message }.emit(&app);
}

fn emit_output(app: &AppHandle, session_id: &str, data: &[u8]) {
    let _ = SshOutput {
        session_id: session_id.to_string(),
        data: data.to_vec(),
    }
    .emit(app);
}
