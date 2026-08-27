use super::store::{self, Key};

type CmdResult<T> = Result<T, String>;

fn keystore_error(err: keyring_core::Error, action: &str) -> String {
    tracing::error!(target: "ssh::audit", error = %err, "failed to {action}");
    "keystore error".to_string()
}

#[tauri::command]
#[specta::specta]
pub fn secret_has_password(connection_id: String) -> bool {
    store::has(&Key::Connection(connection_id))
}

#[tauri::command]
#[specta::specta]
pub fn secret_delete_password(connection_id: String) -> CmdResult<()> {
    store::delete(&Key::Connection(connection_id))
        .map_err(|e| keystore_error(e, "delete saved password"))
}
