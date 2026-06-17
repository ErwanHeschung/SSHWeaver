use std::sync::Mutex;

use rusqlite::Connection;
use tauri::{AppHandle, Manager};

pub(crate) mod migrations;

pub struct Db(pub Mutex<Connection>);

pub fn init(app: &AppHandle) -> Result<Db, Box<dyn std::error::Error>> {
    let dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&dir)?;

    let mut conn = Connection::open(dir.join("sshweaver.db"))?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;

    migrations::runner().to_latest(&mut conn)?;

    Ok(Db(Mutex::new(conn)))
}
