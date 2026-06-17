use super::*;
use crate::features::connections::store::ConnectionDraft;
use rusqlite::Connection;

fn db() -> Connection {
    let mut conn = Connection::open_in_memory().unwrap();
    crate::db::migrations::runner().to_latest(&mut conn).unwrap();
    conn
}

fn draft() -> ConnectionDraft {
    ConnectionDraft {
        name: "a".into(),
        host: "example.com".into(),
        port: 22,
        username: "root".into(),
    }
}

#[test]
fn db_error_preserves_duplicate_sentinel() {
    let conn = db();
    store::create(&conn, &draft()).unwrap();
    let err = store::create(&conn, &draft()).unwrap_err();
    assert_eq!(db_error(err), store::DUPLICATE_ENDPOINT);
}

#[test]
fn db_error_hides_internal_details() {
    let conn = Connection::open_in_memory().unwrap();
    let err = store::list(&conn).unwrap_err();
    assert_eq!(db_error(err), "database error");
}
