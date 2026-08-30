-- Old network gear (Arista EOS, classic IOS) speaks only SHA-1 key exchange,
-- ssh-rsa or ssh-dss host keys and CBC ciphers. Announcing those to every
-- server would weaken the whole fleet for the sake of a few devices, so they
-- are opted into one connection at a time. Off by default, including for rows
-- that already exist.
ALTER TABLE connections ADD COLUMN allow_legacy_algorithms INTEGER NOT NULL DEFAULT 0;
