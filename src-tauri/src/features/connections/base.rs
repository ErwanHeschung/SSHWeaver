use rusqlite::{params, Connection, Row};
use serde::{Deserialize, Serialize};
use specta::Type;

/// What every saved connection carries, whatever transport it opens. SSH and
/// console connections share nothing else, so they live in separate tables.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionBase {
    pub id: String,
    pub name: String,
    pub is_favorite: bool,
    pub last_used_at: Option<String>,
}

pub const COLUMNS: &str = "id, name, is_favorite, last_used_at";

impl ConnectionBase {
    pub fn from_row(row: &Row) -> rusqlite::Result<Self> {
        Ok(Self {
            id: row.get("id")?,
            name: row.get("name")?,
            is_favorite: row.get("is_favorite")?,
            last_used_at: row.get("last_used_at")?,
        })
    }
}

pub fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

// `table` is always a literal from the calling store, never user input.
pub fn set_favorite(
    conn: &Connection,
    table: &str,
    id: &str,
    is_favorite: bool,
) -> rusqlite::Result<()> {
    conn.execute(
        &format!(
            "UPDATE {table}
             SET is_favorite = ?2, updated_at = datetime('now')
             WHERE id = ?1"
        ),
        params![id, is_favorite],
    )?;
    Ok(())
}

/// ISO-8601 UTC rather than `datetime('now')`: the value is read in JavaScript,
/// which parses a space-separated timestamp as local time.
pub fn touch(conn: &Connection, table: &str, id: &str) -> rusqlite::Result<()> {
    conn.execute(
        &format!(
            "UPDATE {table}
             SET last_used_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
             WHERE id = ?1"
        ),
        [id],
    )?;
    Ok(())
}

pub fn delete(conn: &Connection, table: &str, id: &str) -> rusqlite::Result<()> {
    conn.execute(&format!("DELETE FROM {table} WHERE id = ?1"), [id])?;
    Ok(())
}

#[cfg(test)]
mod tests;
