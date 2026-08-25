use super::*;
use crate::features::connections::store::ConnectionDraft;
use crate::features::profiles::store::{self as profiles_store, ProfileDraft};
use rusqlite::Connection;

fn db() -> Connection {
    let mut conn = Connection::open_in_memory().unwrap();
    conn.pragma_update(None, "foreign_keys", "ON").unwrap();
    crate::db::migrations::runner().to_latest(&mut conn).unwrap();
    conn
}

fn draft() -> ConnectionDraft {
    ConnectionDraft {
        name: "a".into(),
        host: "example.com".into(),
        port: 22,
        username: "root".into(),
        profile_id: None,
    }
}

fn profile(conn: &Connection, name: &str, username: &str) -> String {
    profiles_store::create(
        conn,
        &ProfileDraft {
            name: name.into(),
            username: username.into(),
        },
    )
    .unwrap()
    .id
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

#[test]
fn resolve_leaves_a_profileless_draft_alone() {
    let conn = db();
    let resolved = resolve(&conn, draft()).unwrap();
    assert_eq!(resolved.username, "root");
    assert_eq!(resolved.profile_id, None);
}

#[test]
fn resolve_takes_the_username_from_the_profile() {
    let conn = db();
    let profile_id = profile(&conn, "ops", "deploy");

    let resolved = resolve(
        &conn,
        ConnectionDraft {
            // Whatever the form sent is overridden by the profile's account.
            username: "stale".into(),
            profile_id: Some(profile_id.clone()),
            ..draft()
        },
    )
    .unwrap();

    assert_eq!(resolved.username, "deploy");
    assert_eq!(resolved.profile_id, Some(profile_id));
}

#[test]
fn resolve_rejects_an_unknown_profile() {
    let conn = db();
    let err = resolve(
        &conn,
        ConnectionDraft {
            profile_id: Some("does-not-exist".into()),
            ..draft()
        },
    )
    .unwrap_err();
    assert_eq!(err, UNKNOWN_PROFILE);
}
