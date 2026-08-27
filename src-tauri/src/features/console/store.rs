use rusqlite::{params, Connection, Row};
use serde::{Deserialize, Serialize};
use specta::Type;

use super::settings::SerialSettings;
use crate::features::connections::base::{self, ConnectionBase};
use crate::features::sql;

const TABLE: &str = "console_connections";

#[derive(Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct StoredConsoleConnection {
    #[serde(flatten)]
    pub base: ConnectionBase,
    pub settings: SerialSettings,
}

#[derive(Debug, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ConsoleConnectionDraft {
    pub name: String,
    pub settings: SerialSettings,
}

pub const DUPLICATE_LINE: &str = "DUPLICATE_LINE";

fn map_write_error(err: rusqlite::Error) -> rusqlite::Error {
    sql::tag_constraint(err, DUPLICATE_LINE)
}

fn map_row(row: &Row) -> rusqlite::Result<StoredConsoleConnection> {
    Ok(StoredConsoleConnection {
        base: ConnectionBase::from_row(row)?,
        settings: SerialSettings {
            port_name: row.get("port_name")?,
            baud_rate: row.get("baud_rate")?,
            data_bits: row.get("data_bits")?,
            parity: row.get("parity")?,
            stop_bits: row.get("stop_bits")?,
            flow_control: row.get("flow_control")?,
        },
    })
}

fn select_columns() -> String {
    format!(
        "{}, port_name, baud_rate, data_bits, parity, stop_bits, flow_control",
        base::COLUMNS
    )
}

pub fn get(conn: &Connection, id: &str) -> rusqlite::Result<StoredConsoleConnection> {
    conn.query_row(
        &format!("SELECT {} FROM {TABLE} WHERE id = ?1", select_columns()),
        [id],
        map_row,
    )
}

pub fn list(conn: &Connection) -> rusqlite::Result<Vec<StoredConsoleConnection>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {} FROM {TABLE} ORDER BY name COLLATE NOCASE",
        select_columns()
    ))?;
    let rows = stmt.query_map([], map_row)?;
    rows.collect()
}

pub fn create(
    conn: &Connection,
    draft: &ConsoleConnectionDraft,
) -> rusqlite::Result<StoredConsoleConnection> {
    let id = base::new_id();
    let line = &draft.settings;
    conn.execute(
        "INSERT INTO console_connections
             (id, name, port_name, baud_rate, data_bits, parity, stop_bits, flow_control)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            id,
            draft.name,
            line.port_name,
            line.baud_rate,
            line.data_bits,
            line.parity,
            line.stop_bits,
            line.flow_control
        ],
    )
    .map_err(map_write_error)?;
    get(conn, &id)
}

pub fn update(
    conn: &Connection,
    id: &str,
    draft: &ConsoleConnectionDraft,
) -> rusqlite::Result<StoredConsoleConnection> {
    let line = &draft.settings;
    conn.execute(
        "UPDATE console_connections
         SET name = ?2, port_name = ?3, baud_rate = ?4, data_bits = ?5, parity = ?6,
             stop_bits = ?7, flow_control = ?8, updated_at = datetime('now')
         WHERE id = ?1",
        params![
            id,
            draft.name,
            line.port_name,
            line.baud_rate,
            line.data_bits,
            line.parity,
            line.stop_bits,
            line.flow_control
        ],
    )
    .map_err(map_write_error)?;
    get(conn, id)
}

pub fn set_favorite(
    conn: &Connection,
    id: &str,
    is_favorite: bool,
) -> rusqlite::Result<StoredConsoleConnection> {
    base::set_favorite(conn, TABLE, id, is_favorite)?;
    get(conn, id)
}

pub fn mark_used(conn: &Connection, id: &str) -> rusqlite::Result<StoredConsoleConnection> {
    base::touch(conn, TABLE, id)?;
    get(conn, id)
}

pub fn delete(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    base::delete(conn, TABLE, id)
}

#[cfg(test)]
mod tests;
