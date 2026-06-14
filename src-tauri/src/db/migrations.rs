use include_dir::{include_dir, Dir};
use rusqlite_migration::Migrations;

/// One sub-directory per migration under `migrations/`, each holding `up.sql`
/// (and optionally `down.sql`). Naming convention: `NN-vX.Y.Z-description`,
/// e.g. `04-v0.2.0-add-tags`.
///
/// The loader derives the migration id from the text *before the first `-`*,
/// so it must be a plain integer, and ids must be consecutive starting at 1
/// (no gaps). The `vX.Y.Z` segment is just a human label tracking which app
/// version introduced the change — it does not affect ordering.
/// Add a migration = add a new folder with the next number.
static MIGRATIONS_DIR: Dir = include_dir!("$CARGO_MANIFEST_DIR/migrations");

pub fn runner() -> Migrations<'static> {
    Migrations::from_directory(&MIGRATIONS_DIR).expect("migrations directory should be valid")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrations_are_valid() {
        runner().validate().expect("migrations should be valid");
    }
}
