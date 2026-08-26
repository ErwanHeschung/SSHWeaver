use super::*;

fn db() -> Connection {
    let mut conn = Connection::open_in_memory().unwrap();
    crate::db::migrations::runner().to_latest(&mut conn).unwrap();
    conn
}

fn draft(name: &str, username: &str) -> ProfileDraft {
    ProfileDraft {
        name: name.into(),
        username: username.into(),
    }
}

#[test]
fn create_then_get_roundtrips_fields() {
    let conn = db();
    let created = create(&conn, &draft("deploy bot", "deploy")).unwrap();

    assert_eq!(created.name, "deploy bot");
    assert_eq!(created.username, "deploy");

    let fetched = get(&conn, &created.id).unwrap();
    assert_eq!(fetched.id, created.id);
    assert_eq!(fetched.username, "deploy");
}

#[test]
fn list_is_ordered_by_name_case_insensitively() {
    let conn = db();
    create(&conn, &draft("banana", "u")).unwrap();
    create(&conn, &draft("Apple", "u")).unwrap();
    create(&conn, &draft("cherry", "u")).unwrap();

    let names: Vec<String> = list(&conn).unwrap().into_iter().map(|p| p.name).collect();
    assert_eq!(names, ["Apple", "banana", "cherry"]);
}

#[test]
fn duplicate_name_is_mapped_to_sentinel() {
    let conn = db();
    create(&conn, &draft("ops", "root")).unwrap();

    let err = create(&conn, &draft("OPS", "other")).unwrap_err();
    match err {
        rusqlite::Error::SqliteFailure(_, Some(msg)) => assert_eq!(msg, DUPLICATE_NAME),
        other => panic!("expected DUPLICATE_NAME, got {other:?}"),
    }
}

#[test]
fn the_same_username_may_back_several_profiles() {
    let conn = db();
    create(&conn, &draft("staging root", "root")).unwrap();
    create(&conn, &draft("prod root", "root")).unwrap();
    assert_eq!(list(&conn).unwrap().len(), 2);
}

#[test]
fn update_changes_fields() {
    let conn = db();
    let created = create(&conn, &draft("old", "olduser")).unwrap();

    let updated = update(&conn, &created.id, &draft("new", "newuser")).unwrap();
    assert_eq!(updated.id, created.id);
    assert_eq!(updated.name, "new");
    assert_eq!(updated.username, "newuser");
}

#[test]
fn renaming_onto_an_existing_name_is_rejected() {
    let conn = db();
    create(&conn, &draft("ops", "root")).unwrap();
    let other = create(&conn, &draft("dev", "dev")).unwrap();

    let err = update(&conn, &other.id, &draft("ops", "dev")).unwrap_err();
    match err {
        rusqlite::Error::SqliteFailure(_, Some(msg)) => assert_eq!(msg, DUPLICATE_NAME),
        other => panic!("expected DUPLICATE_NAME, got {other:?}"),
    }
}

#[test]
fn blank_fields_are_rejected() {
    let conn = db();
    assert!(create(&conn, &draft("  ", "root")).is_err());
    assert!(create(&conn, &draft("ops", "  ")).is_err());
}

#[test]
fn delete_removes_row() {
    let conn = db();
    let created = create(&conn, &draft("ops", "root")).unwrap();
    delete(&conn, &created.id).unwrap();

    assert!(list(&conn).unwrap().is_empty());
    assert!(get(&conn, &created.id).is_err());
}

#[test]
fn a_new_profile_is_not_the_default() {
    let conn = db();
    assert!(!create(&conn, &draft("ops", "deploy")).unwrap().is_default);
}

#[test]
fn promoting_a_profile_demotes_the_previous_default() {
    let mut conn = db();
    let first = create(&conn, &draft("first", "a")).unwrap();
    let second = create(&conn, &draft("second", "b")).unwrap();

    assert!(set_default(&mut conn, &first.id, true).unwrap().is_default);
    assert!(set_default(&mut conn, &second.id, true).unwrap().is_default);

    assert!(!get(&conn, &first.id).unwrap().is_default);
    assert!(get(&conn, &second.id).unwrap().is_default);
}

#[test]
fn a_default_can_be_cleared_leaving_none() {
    let mut conn = db();
    let profile = create(&conn, &draft("ops", "deploy")).unwrap();
    set_default(&mut conn, &profile.id, true).unwrap();

    assert!(!set_default(&mut conn, &profile.id, false).unwrap().is_default);
    assert!(list(&conn).unwrap().iter().all(|p| !p.is_default));
}

#[test]
fn deleting_the_default_leaves_no_default_behind() {
    let mut conn = db();
    let profile = create(&conn, &draft("ops", "deploy")).unwrap();
    set_default(&mut conn, &profile.id, true).unwrap();

    delete(&conn, &profile.id).unwrap();

    assert!(list(&conn).unwrap().iter().all(|p| !p.is_default));
}

#[test]
fn the_schema_refuses_two_defaults() {
    let conn = db();
    let first = create(&conn, &draft("first", "a")).unwrap();
    let second = create(&conn, &draft("second", "b")).unwrap();

    conn.execute("UPDATE profiles SET is_default = 1 WHERE id = ?1", [&first.id])
        .unwrap();
    let err = conn.execute("UPDATE profiles SET is_default = 1 WHERE id = ?1", [&second.id]);

    assert!(err.is_err(), "the partial unique index should reject a second default");
}
