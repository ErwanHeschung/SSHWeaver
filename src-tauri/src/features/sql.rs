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

/// Stores an enum as its `as_str()` text and reads it back through `parse()`,
/// so the SQL `CHECK (col IN (…))` lists and the Rust variants stay one
/// vocabulary.
macro_rules! sql_text_enum {
    ($ty:ty) => {
        impl rusqlite::ToSql for $ty {
            fn to_sql(&self) -> rusqlite::Result<rusqlite::types::ToSqlOutput<'_>> {
                Ok(rusqlite::types::ToSqlOutput::from(self.as_str()))
            }
        }

        impl rusqlite::types::FromSql for $ty {
            fn column_result(
                value: rusqlite::types::ValueRef<'_>,
            ) -> rusqlite::types::FromSqlResult<Self> {
                let text = value.as_str()?;
                Self::parse(text).ok_or_else(|| {
                    rusqlite::types::FromSqlError::Other(
                        format!("unknown {} value: {text}", stringify!($ty)).into(),
                    )
                })
            }
        }
    };
}

pub(crate) use sql_text_enum;

#[cfg(test)]
mod tests;
