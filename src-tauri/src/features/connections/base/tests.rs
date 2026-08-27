use super::*;
use rusqlite::Connection;

fn db() -> Connection {
    let mut conn = Connection::open_in_memory().unwrap();
    conn.pragma_update(None, "foreign_keys", "ON").unwrap();
    crate::db::migrations::runner().to_latest(&mut conn).unwrap();
    conn
}

fn insert_ssh(conn: &Connection, id: &str) {
    conn.execute(
        "INSERT INTO connections (id, name, host, port, username) VALUES (?1, 'n', 'h', 22, 'u')",
        [id],
    )
    .unwrap();
}

fn insert_console(conn: &Connection, id: &str) {
    conn.execute(
        "INSERT INTO console_connections (id, name, port_name) VALUES (?1, 'n', 'COM1')",
        [id],
    )
    .unwrap();
}

fn base_of(conn: &Connection, table: &str, id: &str) -> ConnectionBase {
    conn.query_row(
        &format!("SELECT {COLUMNS} FROM {table} WHERE id = ?1"),
        [id],
        ConnectionBase::from_row,
    )
    .unwrap()
}

#[test]
fn from_row_reads_the_shared_columns() {
    let conn = db();
    insert_ssh(&conn, "id-1");

    let base = base_of(&conn, "connections", "id-1");

    assert_eq!(base.id, "id-1");
    assert_eq!(base.name, "n");
    assert!(!base.is_favorite);
}

#[test]
fn set_favorite_and_delete_work_the_same_on_both_tables() {
    let conn = db();
    insert_ssh(&conn, "ssh-1");
    insert_console(&conn, "console-1");

    for (table, id) in [("connections", "ssh-1"), ("console_connections", "console-1")] {
        set_favorite(&conn, table, id, true).unwrap();
        assert!(base_of(&conn, table, id).is_favorite, "{table} favourite");

        set_favorite(&conn, table, id, false).unwrap();
        assert!(!base_of(&conn, table, id).is_favorite, "{table} unfavourite");

        delete(&conn, table, id).unwrap();
        let count: i64 = conn
            .query_row(&format!("SELECT count(*) FROM {table}"), [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 0, "{table} delete");
    }
}

#[test]
fn set_favorite_bumps_updated_at() {
    let conn = db();
    insert_ssh(&conn, "id-1");
    conn.execute(
        "UPDATE connections SET updated_at = '2000-01-01 00:00:00' WHERE id = 'id-1'",
        [],
    )
    .unwrap();

    set_favorite(&conn, "connections", "id-1", true).unwrap();

    let updated_at: String = conn
        .query_row("SELECT updated_at FROM connections WHERE id = 'id-1'", [], |row| {
            row.get(0)
        })
        .unwrap();
    assert_ne!(updated_at, "2000-01-01 00:00:00");
}

#[test]
fn new_id_is_unique() {
    assert_ne!(new_id(), new_id());
}
