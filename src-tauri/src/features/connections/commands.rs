use rusqlite::Connection;
use tauri::State;

use super::store::{self, ConnectionDraft, StoredConnection};
use crate::db::Db;
use crate::features::profiles::store as profiles;
use crate::features::secrets::store::{self as secrets, Key};
use crate::features::sql::{self, CmdResult};

pub const UNKNOWN_PROFILE: &str = "UNKNOWN_PROFILE";

fn db_error(err: rusqlite::Error) -> String {
    sql::db_error(err, &[store::DUPLICATE_ENDPOINT])
}

fn resolve(conn: &Connection, draft: ConnectionDraft) -> CmdResult<ConnectionDraft> {
    let Some(profile_id) = draft.profile_id.as_deref() else {
        return Ok(draft);
    };
    let profile = profiles::get(conn, profile_id).map_err(|err| match err {
        rusqlite::Error::QueryReturnedNoRows => UNKNOWN_PROFILE.to_string(),
        other => db_error(other),
    })?;
    Ok(ConnectionDraft {
        username: profile.username,
        ..draft
    })
}

#[tauri::command]
#[specta::specta]
pub fn connections_list(db: State<Db>) -> CmdResult<Vec<StoredConnection>> {
    let conn = sql::lock(&db)?;
    store::list(&conn).map_err(db_error)
}

#[tauri::command]
#[specta::specta]
pub fn connection_create(db: State<Db>, draft: ConnectionDraft) -> CmdResult<StoredConnection> {
    let conn = sql::lock(&db)?;
    let draft = resolve(&conn, draft)?;
    store::create(&conn, &draft).map_err(db_error)
}

#[tauri::command]
#[specta::specta]
pub fn connection_update(
    db: State<Db>,
    id: String,
    draft: ConnectionDraft,
) -> CmdResult<StoredConnection> {
    let conn = sql::lock(&db)?;
    let draft = resolve(&conn, draft)?;
    let previous = store::get(&conn, &id).map_err(db_error)?;
    let updated = store::update(&conn, &id, &draft).map_err(db_error)?;

    let endpoint_changed = previous.host != updated.host
        || previous.port != updated.port
        || previous.username != updated.username;
    // Either change leaves the connection's own entry stale and unreachable.
    if endpoint_changed || updated.profile_id.is_some() {
        if let Err(e) = secrets::delete(&Key::Connection(id)) {
            tracing::warn!(
                target: "ssh::audit",
                error = %e,
                "failed to remove saved password after connection change"
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
    let conn = sql::lock(&db)?;
    store::set_favorite(&conn, &id, is_favorite).map_err(db_error)
}

#[tauri::command]
#[specta::specta]
pub fn connection_delete(db: State<Db>, id: String) -> CmdResult<()> {
    let conn = sql::lock(&db)?;
    store::delete(&conn, &id).map_err(db_error)?;
    if let Err(e) = secrets::delete(&Key::Connection(id)) {
        tracing::warn!(target: "ssh::audit", error = %e, "failed to remove saved password on delete");
    }
    Ok(())
}

#[cfg(test)]
mod tests;
