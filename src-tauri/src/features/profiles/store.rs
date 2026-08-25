use rusqlite::{params, Connection, Row};
use serde::{Deserialize, Serialize};
use specta::Type;

use crate::features::sql;

#[derive(Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct StoredProfile {
    pub id: String,
    pub name: String,
    pub username: String,
}

#[derive(Debug, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ProfileDraft {
    pub name: String,
    pub username: String,
}

const SELECT_COLUMNS: &str = "id, name, username";

pub const DUPLICATE_NAME: &str = "DUPLICATE_PROFILE_NAME";

fn map_write_error(err: rusqlite::Error) -> rusqlite::Error {
    sql::tag_constraint(err, DUPLICATE_NAME)
}

fn map_row(row: &Row) -> rusqlite::Result<StoredProfile> {
    Ok(StoredProfile {
        id: row.get("id")?,
        name: row.get("name")?,
        username: row.get("username")?,
    })
}

pub fn get(conn: &Connection, id: &str) -> rusqlite::Result<StoredProfile> {
    conn.query_row(
        &format!("SELECT {SELECT_COLUMNS} FROM profiles WHERE id = ?1"),
        [id],
        map_row,
    )
}

pub fn list(conn: &Connection) -> rusqlite::Result<Vec<StoredProfile>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {SELECT_COLUMNS} FROM profiles ORDER BY name COLLATE NOCASE"
    ))?;
    let rows = stmt.query_map([], map_row)?;
    rows.collect()
}

pub fn create(conn: &Connection, draft: &ProfileDraft) -> rusqlite::Result<StoredProfile> {
    let id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO profiles (id, name, username) VALUES (?1, ?2, ?3)",
        params![id, draft.name, draft.username],
    )
    .map_err(map_write_error)?;
    get(conn, &id)
}

pub fn update(
    conn: &Connection,
    id: &str,
    draft: &ProfileDraft,
) -> rusqlite::Result<StoredProfile> {
    conn.execute(
        "UPDATE profiles
         SET name = ?2, username = ?3, updated_at = datetime('now')
         WHERE id = ?1",
        params![id, draft.name, draft.username],
    )
    .map_err(map_write_error)?;
    get(conn, id)
}

pub fn delete(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM profiles WHERE id = ?1", [id])?;
    Ok(())
}

#[cfg(test)]
mod tests;
