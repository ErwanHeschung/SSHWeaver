CREATE UNIQUE INDEX idx_connections_endpoint
    ON connections (host, port, username);
