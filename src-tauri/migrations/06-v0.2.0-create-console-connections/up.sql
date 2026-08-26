-- Its own table rather than nullable columns on `connections`: nothing about a
-- serial line maps onto a host/port/account.
CREATE TABLE console_connections (
    id           TEXT NOT NULL PRIMARY KEY,
    name         TEXT NOT NULL DEFAULT '',
    port_name    TEXT NOT NULL CHECK (length(trim(port_name)) > 0),
    baud_rate    INTEGER NOT NULL DEFAULT 9600 CHECK (baud_rate BETWEEN 1 AND 20000000),
    data_bits    INTEGER NOT NULL DEFAULT 8 CHECK (data_bits BETWEEN 5 AND 8),
    parity       TEXT NOT NULL DEFAULT 'none' CHECK (parity IN ('none', 'odd', 'even')),
    stop_bits    TEXT NOT NULL DEFAULT '1' CHECK (stop_bits IN ('1', '2')),
    flow_control TEXT NOT NULL DEFAULT 'none'
                 CHECK (flow_control IN ('none', 'hardware', 'software')),
    is_favorite  INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1)),
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
) STRICT;

-- The line configuration is the identity: one port at two baud rates is two
-- useful entries; the same port twice over is not.
CREATE UNIQUE INDEX idx_console_connections_line
    ON console_connections (
        port_name COLLATE NOCASE, baud_rate, data_bits, parity, stop_bits, flow_control
    );
