use super::*;

fn db() -> Connection {
    let mut conn = Connection::open_in_memory().unwrap();
    crate::db::migrations::runner().to_latest(&mut conn).unwrap();
    conn
}

fn draft(name: &str, host: &str, port: u16, username: &str) -> ConnectionDraft {
    ConnectionDraft {
        name: name.into(),
        host: host.into(),
        port,
        username: username.into(),
    }
}

#[test]
fn create_then_get_roundtrips_fields() {
    let conn = db();
    let created = create(&conn, &draft("prod", "example.com", 2222, "deploy")).unwrap();

    assert_eq!(created.name, "prod");
    assert_eq!(created.host, "example.com");
    assert_eq!(created.port, 2222);
    assert_eq!(created.username, "deploy");
    assert!(!created.is_favorite);

    let fetched = get(&conn, &created.id).unwrap();
    assert_eq!(fetched.id, created.id);
    assert_eq!(fetched.host, "example.com");
}

#[test]
fn list_is_ordered_by_name_case_insensitively() {
    let conn = db();
    create(&conn, &draft("banana", "h1", 22, "u")).unwrap();
    create(&conn, &draft("Apple", "h2", 22, "u")).unwrap();
    create(&conn, &draft("cherry", "h3", 22, "u")).unwrap();

    let names: Vec<String> = list(&conn).unwrap().into_iter().map(|c| c.name).collect();
    assert_eq!(names, ["Apple", "banana", "cherry"]);
}

#[test]
fn duplicate_endpoint_is_mapped_to_sentinel() {
    let conn = db();
    create(&conn, &draft("a", "example.com", 22, "root")).unwrap();

    let err = create(&conn, &draft("b", "example.com", 22, "root")).unwrap_err();
    match err {
        rusqlite::Error::SqliteFailure(_, Some(msg)) => assert_eq!(msg, DUPLICATE_ENDPOINT),
        other => panic!("expected DUPLICATE_ENDPOINT, got {other:?}"),
    }
}

#[test]
fn differing_endpoint_does_not_collide() {
    let conn = db();
    create(&conn, &draft("a", "example.com", 22, "root")).unwrap();
    create(&conn, &draft("b", "example.com", 2222, "root")).unwrap();
    assert_eq!(list(&conn).unwrap().len(), 2);
}

#[test]
fn update_changes_fields() {
    let conn = db();
    let created = create(&conn, &draft("old", "old.host", 22, "olduser")).unwrap();

    let updated = update(&conn, &created.id, &draft("new", "new.host", 2200, "newuser")).unwrap();
    assert_eq!(updated.id, created.id);
    assert_eq!(updated.host, "new.host");
    assert_eq!(updated.port, 2200);
    assert_eq!(updated.username, "newuser");
    assert_eq!(updated.name, "new");
}

#[test]
fn set_favorite_toggles() {
    let conn = db();
    let created = create(&conn, &draft("c", "h", 22, "u")).unwrap();
    assert!(!created.is_favorite);

    assert!(set_favorite(&conn, &created.id, true).unwrap().is_favorite);
    assert!(!set_favorite(&conn, &created.id, false).unwrap().is_favorite);
}

#[test]
fn delete_removes_row() {
    let conn = db();
    let created = create(&conn, &draft("c", "h", 22, "u")).unwrap();
    delete(&conn, &created.id).unwrap();

    assert!(list(&conn).unwrap().is_empty());
    assert!(get(&conn, &created.id).is_err());
}
