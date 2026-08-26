ALTER TABLE profiles
    ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1));

-- At most one default, enforced by the schema rather than by the caller
-- remembering to clear the previous one.
CREATE UNIQUE INDEX idx_profiles_default ON profiles (is_default) WHERE is_default = 1;
