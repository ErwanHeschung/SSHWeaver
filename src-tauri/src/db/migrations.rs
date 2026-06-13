use rusqlite_migration::{Migrations, M};

pub fn runner() -> Migrations<'static> {
    Migrations::new(vec![
        M::up(
            "CREATE TABLE connections (
                id          TEXT NOT NULL PRIMARY KEY,
                name        TEXT NOT NULL CHECK (length(trim(name)) > 0),
                host        TEXT NOT NULL CHECK (length(trim(host)) > 0),
                port        INTEGER NOT NULL DEFAULT 22 CHECK (port BETWEEN 1 AND 65535),
                username    TEXT NOT NULL CHECK (length(trim(username)) > 0),
                is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1)),
                created_at  TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
            ) STRICT;",
        )
        .down("DROP TABLE connections;"),
    ])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrations_are_valid() {
        runner().validate().expect("migrations should be valid");
    }
}
