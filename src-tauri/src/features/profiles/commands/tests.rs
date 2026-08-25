use super::*;
use crate::features::connections::store::ConnectionDraft;

fn db() -> Connection {
    let mut conn = Connection::open_in_memory().unwrap();
    conn.pragma_update(None, "foreign_keys", "ON").unwrap();
    crate::db::migrations::runner().to_latest(&mut conn).unwrap();
    conn
}

fn draft(name: &str, username: &str) -> ProfileDraft {
    ProfileDraft {
        name: name.into(),
        username: username.into(),
    }
}

fn connection(conn: &Connection, host: &str, username: &str, profile_id: Option<&str>) -> String {
    connections::create(
        conn,
        &ConnectionDraft {
            name: host.into(),
            host: host.into(),
            port: 22,
            username: username.into(),
            profile_id: profile_id.map(str::to_string),
        },
    )
    .unwrap()
    .id
}

#[test]
fn renaming_the_account_reaches_every_linked_connection() {
    let mut conn = db();
    let profile = store::create(&conn, &draft("ops", "root")).unwrap();
    let linked = connection(&conn, "a.example.com", "root", Some(&profile.id));
    let other = connection(&conn, "b.example.com", "root", None);

    update_profile(&mut conn, &profile.id, &draft("ops", "admin")).unwrap();

    assert_eq!(connections::get(&conn, &linked).unwrap().username, "admin");
    assert_eq!(connections::get(&conn, &other).unwrap().username, "root");
}

#[test]
fn a_rename_that_would_collide_rolls_the_profile_back() {
    let mut conn = db();
    let profile = store::create(&conn, &draft("ops", "root")).unwrap();
    // Same host and port as the linked connection, already taken by `admin`.
    connection(&conn, "a.example.com", "admin", None);
    let linked = connection(&conn, "a.example.com", "root", Some(&profile.id));

    let err = update_profile(&mut conn, &profile.id, &draft("ops", "admin")).unwrap_err();

    assert_eq!(err, connections::DUPLICATE_ENDPOINT);
    assert_eq!(store::get(&conn, &profile.id).unwrap().username, "root");
    assert_eq!(connections::get(&conn, &linked).unwrap().username, "root");
}

#[test]
fn renaming_only_the_label_leaves_connections_untouched() {
    let mut conn = db();
    let profile = store::create(&conn, &draft("ops", "root")).unwrap();
    let linked = connection(&conn, "a.example.com", "root", Some(&profile.id));

    let updated = update_profile(&mut conn, &profile.id, &draft("operations", "root")).unwrap();

    assert_eq!(updated.name, "operations");
    assert_eq!(connections::get(&conn, &linked).unwrap().username, "root");
}

#[test]
fn deleting_a_profile_detaches_its_connections_but_keeps_them() {
    let conn = db();
    let profile = store::create(&conn, &draft("ops", "root")).unwrap();
    let linked = connection(&conn, "a.example.com", "root", Some(&profile.id));

    connections::clear_profile(&conn, &profile.id).unwrap();
    store::delete(&conn, &profile.id).unwrap();

    let detached = connections::get(&conn, &linked).unwrap();
    assert_eq!(detached.profile_id, None);
    assert_eq!(detached.username, "root");
}

#[test]
fn db_error_forwards_both_sentinels() {
    let conn = db();
    store::create(&conn, &draft("ops", "root")).unwrap();
    let err = store::create(&conn, &draft("ops", "other")).unwrap_err();
    assert_eq!(db_error(err), store::DUPLICATE_NAME);

    connection(&conn, "a.example.com", "root", None);
    let err = connections::create(
        &conn,
        &ConnectionDraft {
            name: "dup".into(),
            host: "a.example.com".into(),
            port: 22,
            username: "root".into(),
            profile_id: None,
        },
    )
    .unwrap_err();
    assert_eq!(db_error(err), connections::DUPLICATE_ENDPOINT);
}
