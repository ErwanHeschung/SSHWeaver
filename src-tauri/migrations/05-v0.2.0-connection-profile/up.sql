-- Optional link to a credential profile. NULL means the connection carries its
-- own username and its own keystore entry.
ALTER TABLE connections
    ADD COLUMN profile_id TEXT REFERENCES profiles (id) ON DELETE SET NULL;
