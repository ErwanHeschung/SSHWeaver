use tauri::{AppHandle, State};

use super::session::{self, ConnectOutcome, ConnectParams, PasswordOutcome};
use super::{sftp, HostKeyPrompts, KeyPassphrasePrompts, PendingConnections, SftpEntry};
use crate::features::terminal::{Control, TerminalSessions};

#[tauri::command]
#[specta::specta]
pub async fn ssh_connect(app: AppHandle, params: ConnectParams) -> Result<ConnectOutcome, String> {
    session::open(app, params).await.map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn ssh_authenticate_password(
    app: AppHandle,
    session_id: String,
    password: String,
    remember: bool,
) -> Result<PasswordOutcome, String> {
    session::authenticate_password(app, session_id, password, remember)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn ssh_host_key_decision(prompts: State<HostKeyPrompts>, session_id: String, accept: bool) {
    if let Some(tx) = prompts.0.lock().remove(&session_id) {
        let _ = tx.send(accept);
    }
}

#[tauri::command]
#[specta::specta]
pub fn ssh_key_passphrase(
    prompts: State<KeyPassphrasePrompts>,
    session_id: String,
    passphrase: Option<String>,
    remember: bool,
) {
    if let Some(tx) = prompts.0.lock().remove(&session_id) {
        let _ = tx.send(passphrase.map(|value| (value, remember)));
    }
}

#[tauri::command]
#[specta::specta]
pub async fn sftp_read_dir(
    app: AppHandle,
    session_id: String,
    path: String,
) -> Result<Vec<SftpEntry>, String> {
    sftp::read_dir(app, session_id, path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn sftp_home_dir(app: AppHandle, session_id: String) -> Result<String, String> {
    sftp::home_dir(app, session_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn sftp_read_file(
    app: AppHandle,
    session_id: String,
    path: String,
) -> Result<Vec<u8>, String> {
    sftp::read_file(app, session_id, path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn sftp_download(
    app: AppHandle,
    session_id: String,
    remote_path: String,
    local_path: String,
) -> Result<(), String> {
    sftp::download(app, session_id, remote_path, local_path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn sftp_upload_path(
    app: AppHandle,
    session_id: String,
    local_path: String,
    remote_dir: String,
) -> Result<(), String> {
    sftp::upload_path(app, session_id, local_path, remote_dir)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn sftp_remove(app: AppHandle, session_id: String, path: String) -> Result<(), String> {
    sftp::remove(app, session_id, path)
        .await
        .map_err(|e| e.to_string())
}

/// Closing an SSH session also drops any half-finished authentication: the user
/// may be cancelling from the password prompt, before a session ever existed.
#[tauri::command]
#[specta::specta]
pub fn ssh_disconnect(
    sessions: State<TerminalSessions>,
    pending: State<PendingConnections>,
    prompts: State<HostKeyPrompts>,
    passphrases: State<KeyPassphrasePrompts>,
    session_id: String,
) {
    sessions.send(&session_id, Control::Close);
    pending.0.lock().remove(&session_id);
    prompts.0.lock().remove(&session_id);
    passphrases.0.lock().remove(&session_id);
}
