use tauri::{AppHandle, State};

use super::ports::{self, AvailablePort};
use super::session::{self, ConsoleParams};
use super::store::{self, ConsoleConnectionDraft, StoredConsoleConnection};
use crate::db::Db;
use crate::features::sql::{self, CmdResult};

fn db_error(err: rusqlite::Error) -> String {
    sql::db_error(err, &[store::DUPLICATE_LINE])
}

// --- saved console connections ---

#[tauri::command]
#[specta::specta]
pub fn console_connections_list(db: State<Db>) -> CmdResult<Vec<StoredConsoleConnection>> {
    let conn = sql::lock(&db)?;
    store::list(&conn).map_err(db_error)
}

#[tauri::command]
#[specta::specta]
pub fn console_connection_create(
    db: State<Db>,
    draft: ConsoleConnectionDraft,
) -> CmdResult<StoredConsoleConnection> {
    let conn = sql::lock(&db)?;
    store::create(&conn, &draft).map_err(db_error)
}

#[tauri::command]
#[specta::specta]
pub fn console_connection_update(
    db: State<Db>,
    id: String,
    draft: ConsoleConnectionDraft,
) -> CmdResult<StoredConsoleConnection> {
    let conn = sql::lock(&db)?;
    store::update(&conn, &id, &draft).map_err(db_error)
}

#[tauri::command]
#[specta::specta]
pub fn console_connection_set_favorite(
    db: State<Db>,
    id: String,
    is_favorite: bool,
) -> CmdResult<StoredConsoleConnection> {
    let conn = sql::lock(&db)?;
    store::set_favorite(&conn, &id, is_favorite).map_err(db_error)
}

#[tauri::command]
#[specta::specta]
pub fn console_connection_delete(db: State<Db>, id: String) -> CmdResult<()> {
    let conn = sql::lock(&db)?;
    store::delete(&conn, &id).map_err(db_error)
}

// --- live console sessions ---

#[tauri::command]
#[specta::specta]
pub fn console_list_ports() -> CmdResult<Vec<AvailablePort>> {
    ports::list()
}

#[tauri::command]
#[specta::specta]
pub async fn console_connect(app: AppHandle, params: ConsoleParams) -> CmdResult<()> {
    session::open(app, params).await
}

#[tauri::command]
#[specta::specta]
pub fn console_disconnect(app: AppHandle, session_id: String) {
    session::disconnect(&app, &session_id);
}
