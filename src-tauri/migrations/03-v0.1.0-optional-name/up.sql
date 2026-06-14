-- Make `name` optional: rebuild the table without the non-empty CHECK.
CREATE TABLE connections_new (
    id          TEXT NOT NULL PRIMARY KEY,
    name        TEXT NOT NULL DEFAULT '',
    host        TEXT NOT NULL CHECK (length(trim(host)) > 0),
    port        INTEGER NOT NULL DEFAULT 22 CHECK (port BETWEEN 1 AND 65535),
    username    TEXT NOT NULL CHECK (length(trim(username)) > 0),
    is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1)),
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
) STRICT;

INSERT INTO connections_new
    SELECT id, name, host, port, username, is_favorite, created_at, updated_at
    FROM connections;

DROP TABLE connections;
ALTER TABLE connections_new RENAME TO connections;

CREATE UNIQUE INDEX idx_connections_endpoint
    ON connections (host, port, username);
