use tauri::{AppHandle, State};

use super::session::{self, ConnectOutcome, ConnectParams, PasswordOutcome};
use super::{Control, HostKeyPrompts, PendingConnections, SshSessions};

fn send(state: &SshSessions, session_id: &str, control: Control) {
    if let Some(tx) = state.0.lock().get(session_id) {
        let _ = tx.send(control);
    }
}

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
) -> Result<PasswordOutcome, String> {
    session::authenticate_password(app, session_id, password)
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
pub fn ssh_write(state: State<SshSessions>, session_id: String, data: String) {
    send(&state, &session_id, Control::Data(data.into_bytes()));
}

#[tauri::command]
#[specta::specta]
pub fn ssh_resize(state: State<SshSessions>, session_id: String, cols: u32, rows: u32) {
    send(&state, &session_id, Control::Resize { cols, rows });
}

#[tauri::command]
#[specta::specta]
pub fn ssh_disconnect(
    sessions: State<SshSessions>,
    pending: State<PendingConnections>,
    prompts: State<HostKeyPrompts>,
    session_id: String,
) {
    send(&sessions, &session_id, Control::Close);
    pending.0.lock().remove(&session_id);
    prompts.0.lock().remove(&session_id);
}
