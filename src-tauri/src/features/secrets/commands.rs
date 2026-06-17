use super::store;

type CmdResult<T> = Result<T, String>;

#[tauri::command]
#[specta::specta]
pub fn secret_has_password(connection_id: String) -> bool {
    store::has(&connection_id)
}

#[tauri::command]
#[specta::specta]
pub fn secret_delete_password(connection_id: String) -> CmdResult<()> {
    store::delete(&connection_id).map_err(|e| {
        tracing::error!(target: "ssh::audit", error = %e, "failed to delete saved password");
        "keystore error".to_string()
    })
}
