use std::sync::MutexGuard;

use rusqlite::Connection;
use tauri::State;

use super::store::{self, ConnectionDraft, StoredConnection};
use crate::db::Db;
use crate::features::secrets::store as secrets;

type CmdResult<T> = Result<T, String>;

fn lock(db: &Db) -> CmdResult<MutexGuard<'_, Connection>> {
    db.0.lock().map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn connections_list(db: State<Db>) -> CmdResult<Vec<StoredConnection>> {
    let conn = lock(&db)?;
    store::list(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn connection_create(db: State<Db>, draft: ConnectionDraft) -> CmdResult<StoredConnection> {
    let conn = lock(&db)?;
    store::create(&conn, &draft).map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn connection_update(
    db: State<Db>,
    id: String,
    draft: ConnectionDraft,
) -> CmdResult<StoredConnection> {
    let conn = lock(&db)?;
    store::update(&conn, &id, &draft).map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn connection_set_favorite(
    db: State<Db>,
    id: String,
    is_favorite: bool,
) -> CmdResult<StoredConnection> {
    let conn = lock(&db)?;
    store::set_favorite(&conn, &id, is_favorite).map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn connection_delete(db: State<Db>, id: String) -> CmdResult<()> {
    let conn = lock(&db)?;
    store::delete(&conn, &id).map_err(|e| e.to_string())?;
    if let Err(e) = secrets::delete(&id) {
        tracing::warn!(target: "ssh::audit", error = %e, "failed to remove saved password on delete");
    }
    Ok(())
}
