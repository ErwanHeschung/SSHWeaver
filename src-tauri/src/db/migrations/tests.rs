use super::*;
use rusqlite::Connection;

#[test]
fn migrations_are_valid() {
    runner().validate().expect("migrations should be valid");
}

#[test]
fn migrations_are_reversible() {
    let mut conn = Connection::open_in_memory().unwrap();
    let migrations = runner();

    migrations.to_latest(&mut conn).unwrap();
    migrations.to_version(&mut conn, 0).unwrap();
    migrations.to_latest(&mut conn).unwrap();
}
