use rusqlite::{params, Connection, Row};
use serde::{Deserialize, Serialize};
use specta::Type;

use crate::features::sql;

#[derive(Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct StoredConnection {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub is_favorite: bool,
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

const SELECT_COLUMNS: &str = "id, name, host, port, username, is_favorite, profile_id";

pub const DUPLICATE_ENDPOINT: &str = "DUPLICATE_ENDPOINT";

fn map_write_error(err: rusqlite::Error) -> rusqlite::Error {
    sql::tag_constraint(err, DUPLICATE_ENDPOINT)
}

fn map_row(row: &Row) -> rusqlite::Result<StoredConnection> {
    Ok(StoredConnection {
        id: row.get("id")?,
        name: row.get("name")?,
        host: row.get("host")?,
        port: row.get("port")?,
        username: row.get("username")?,
        is_favorite: row.get("is_favorite")?,
        profile_id: row.get("profile_id")?,
    })
}

pub fn get(conn: &Connection, id: &str) -> rusqlite::Result<StoredConnection> {
    conn.query_row(
        &format!("SELECT {SELECT_COLUMNS} FROM connections WHERE id = ?1"),
        [id],
        map_row,
    )
}

pub fn list(conn: &Connection) -> rusqlite::Result<Vec<StoredConnection>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {SELECT_COLUMNS} FROM connections ORDER BY name COLLATE NOCASE"
    ))?;
    let rows = stmt.query_map([], map_row)?;
    rows.collect()
}

pub fn create(conn: &Connection, draft: &ConnectionDraft) -> rusqlite::Result<StoredConnection> {
    let id = uuid::Uuid::new_v4().to_string();
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
    conn.execute(
        "UPDATE connections
         SET is_favorite = ?2, updated_at = datetime('now')
         WHERE id = ?1",
        params![id, is_favorite],
    )?;
    get(conn, id)
}

pub fn delete(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM connections WHERE id = ?1", [id])?;
    Ok(())
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
