-- Reusable credentials: a named username whose password lives in the OS
-- keystore, so several connections sharing an account share one password.
CREATE TABLE profiles (
    id         TEXT NOT NULL PRIMARY KEY,
    name       TEXT NOT NULL CHECK (length(trim(name)) > 0),
    username   TEXT NOT NULL CHECK (length(trim(username)) > 0),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
) STRICT;

CREATE UNIQUE INDEX idx_profiles_name ON profiles (name COLLATE NOCASE);
