-- When the connection was last opened, so the lists can put recent work first.
-- NULL means never used. Stored as ISO-8601 UTC, unlike the datetime('now')
-- columns above: these values cross into JavaScript, where a space-separated
-- timestamp is read as local time and silently shifts by the UTC offset.
ALTER TABLE connections ADD COLUMN last_used_at TEXT;

ALTER TABLE console_connections ADD COLUMN last_used_at TEXT;
