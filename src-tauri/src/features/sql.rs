use std::sync::MutexGuard;

use rusqlite::Connection;

use crate::db::Db;

pub type CmdResult<T> = Result<T, String>;

pub fn lock(db: &Db) -> CmdResult<MutexGuard<'_, Connection>> {
    db.0.lock().map_err(|e| {
        tracing::error!(target: "ssh::audit", error = %e, "database lock poisoned");
        "database error".to_string()
    })
}

pub fn tag_constraint(err: rusqlite::Error, sentinel: &str) -> rusqlite::Error {
    if let rusqlite::Error::SqliteFailure(ref inner, _) = err {
        if inner.code == rusqlite::ErrorCode::ConstraintViolation {
            return rusqlite::Error::SqliteFailure(*inner, Some(sentinel.to_string()));
        }
    }
    err
}

pub fn db_error(err: rusqlite::Error, sentinels: &[&str]) -> String {
    if let rusqlite::Error::SqliteFailure(_, Some(msg)) = &err {
        if let Some(sentinel) = sentinels.iter().find(|s| *s == msg) {
            return (*sentinel).to_string();
        }
    }
    tracing::error!(target: "ssh::audit", error = %err, "database operation failed");
    "database error".to_string()
}

#[cfg(test)]
mod tests;
