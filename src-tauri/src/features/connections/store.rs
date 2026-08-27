use rusqlite::{params, Connection, Row};
use serde::{Deserialize, Serialize};
use specta::Type;

use super::base::{self, ConnectionBase};
use crate::features::sql;

const TABLE: &str = "connections";

#[derive(Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct StoredConnection {
    #[serde(flatten)]
    pub base: ConnectionBase,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub profile_id: Option<String>,
}

#[derive(Debug, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionDraft {
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub profile_id: Option<String>,
}

pub const DUPLICATE_ENDPOINT: &str = "DUPLICATE_ENDPOINT";

fn map_write_error(err: rusqlite::Error) -> rusqlite::Error {
    sql::tag_constraint(err, DUPLICATE_ENDPOINT)
}

fn map_row(row: &Row) -> rusqlite::Result<StoredConnection> {
    Ok(StoredConnection {
        base: ConnectionBase::from_row(row)?,
        host: row.get("host")?,
        port: row.get("port")?,
        username: row.get("username")?,
        profile_id: row.get("profile_id")?,
    })
}

fn select_columns() -> String {
    format!("{}, host, port, username, profile_id", base::COLUMNS)
}

pub fn get(conn: &Connection, id: &str) -> rusqlite::Result<StoredConnection> {
    conn.query_row(
        &format!(
            "SELECT {} FROM {TABLE} WHERE id = ?1",
            select_columns()
        ),
        [id],
        map_row,
    )
}

pub fn list(conn: &Connection) -> rusqlite::Result<Vec<StoredConnection>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {} FROM {TABLE} ORDER BY name COLLATE NOCASE",
        select_columns()
    ))?;
    let rows = stmt.query_map([], map_row)?;
    rows.collect()
}

pub fn create(conn: &Connection, draft: &ConnectionDraft) -> rusqlite::Result<StoredConnection> {
    let id = base::new_id();
    conn.execute(
        "INSERT INTO connections (id, name, host, port, username, profile_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            id,
            draft.name,
            draft.host,
            draft.port,
            draft.username,
            draft.profile_id
        ],
    )
    .map_err(map_write_error)?;
    get(conn, &id)
}

pub fn update(
    conn: &Connection,
    id: &str,
    draft: &ConnectionDraft,
) -> rusqlite::Result<StoredConnection> {
    conn.execute(
        "UPDATE connections
         SET name = ?2, host = ?3, port = ?4, username = ?5, profile_id = ?6,
             updated_at = datetime('now')
         WHERE id = ?1",
        params![
            id,
            draft.name,
            draft.host,
            draft.port,
            draft.username,
            draft.profile_id
        ],
    )
    .map_err(map_write_error)?;
    get(conn, id)
}

pub fn set_favorite(
    conn: &Connection,
    id: &str,
    is_favorite: bool,
) -> rusqlite::Result<StoredConnection> {
    base::set_favorite(conn, TABLE, id, is_favorite)?;
    get(conn, id)
}

pub fn mark_used(conn: &Connection, id: &str) -> rusqlite::Result<StoredConnection> {
    base::touch(conn, TABLE, id)?;
    get(conn, id)
}

pub fn delete(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    base::delete(conn, TABLE, id)
}

pub fn set_username_for_profile(
    conn: &Connection,
    profile_id: &str,
    username: &str,
) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE connections
         SET username = ?2, updated_at = datetime('now')
         WHERE profile_id = ?1 AND username <> ?2",
        params![profile_id, username],
    )
    .map_err(map_write_error)?;
    Ok(())
}

pub fn clear_profile(conn: &Connection, profile_id: &str) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE connections
         SET profile_id = NULL, updated_at = datetime('now')
         WHERE profile_id = ?1",
        [profile_id],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests;
