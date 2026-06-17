use std::sync::MutexGuard;

use rusqlite::Connection;
use tauri::State;

use super::store::{self, ConnectionDraft, StoredConnection};
use crate::db::Db;
use crate::features::secrets::store as secrets;

type CmdResult<T> = Result<T, String>;

fn db_error(err: rusqlite::Error) -> String {
    if let rusqlite::Error::SqliteFailure(_, Some(msg)) = &err {
        if msg == store::DUPLICATE_ENDPOINT {
            return store::DUPLICATE_ENDPOINT.to_string();
        }
    }
    tracing::error!(target: "ssh::audit", error = %err, "database operation failed");
    "database error".to_string()
}

fn lock(db: &Db) -> CmdResult<MutexGuard<'_, Connection>> {
    db.0.lock().map_err(|e| {
        tracing::error!(target: "ssh::audit", error = %e, "database lock poisoned");
        "database error".to_string()
    })
}

#[tauri::command]
#[specta::specta]
pub fn connections_list(db: State<Db>) -> CmdResult<Vec<StoredConnection>> {
    let conn = lock(&db)?;
    store::list(&conn).map_err(db_error)
}

#[tauri::command]
#[specta::specta]
pub fn connection_create(db: State<Db>, draft: ConnectionDraft) -> CmdResult<StoredConnection> {
    let conn = lock(&db)?;
    store::create(&conn, &draft).map_err(db_error)
}

#[tauri::command]
#[specta::specta]
pub fn connection_update(
    db: State<Db>,
    id: String,
    draft: ConnectionDraft,
) -> CmdResult<StoredConnection> {
    let conn = lock(&db)?;
    let previous = store::get(&conn, &id).map_err(db_error)?;
    let updated = store::update(&conn, &id, &draft).map_err(db_error)?;

    let endpoint_changed = previous.host != updated.host
        || previous.port != updated.port
        || previous.username != updated.username;
    if endpoint_changed {
        if let Err(e) = secrets::delete(&id) {
            tracing::warn!(
                target: "ssh::audit",
                error = %e,
                "failed to remove saved password after endpoint change"
            );
        }
    }

    Ok(updated)
}

#[tauri::command]
#[specta::specta]
pub fn connection_set_favorite(
    db: State<Db>,
    id: String,
    is_favorite: bool,
) -> CmdResult<StoredConnection> {
    let conn = lock(&db)?;
    store::set_favorite(&conn, &id, is_favorite).map_err(db_error)
}

#[tauri::command]
#[specta::specta]
pub fn connection_delete(db: State<Db>, id: String) -> CmdResult<()> {
    let conn = lock(&db)?;
    store::delete(&conn, &id).map_err(db_error)?;
    if let Err(e) = secrets::delete(&id) {
        tracing::warn!(target: "ssh::audit", error = %e, "failed to remove saved password on delete");
    }
    Ok(())
}
