use super::*;

fn db() -> Connection {
    let mut conn = Connection::open_in_memory().unwrap();
    conn.pragma_update(None, "foreign_keys", "ON").unwrap();
    crate::db::migrations::runner().to_latest(&mut conn).unwrap();
    conn
}

fn draft(name: &str, host: &str, port: u16, username: &str) -> ConnectionDraft {
    ConnectionDraft {
        name: name.into(),
        host: host.into(),
        port,
        username: username.into(),
        profile_id: None,
        allow_legacy_algorithms: false,
    }
}

fn profile(conn: &Connection, name: &str, username: &str) -> String {
    crate::features::profiles::store::create(
        conn,
        &crate::features::profiles::store::ProfileDraft {
            name: name.into(),
            username: username.into(),
        },
    )
    .unwrap()
    .id
}

#[test]
fn create_then_get_roundtrips_fields() {
    let conn = db();
    let created = create(&conn, &draft("prod", "example.com", 2222, "deploy")).unwrap();

    assert_eq!(created.base.name, "prod");
    assert_eq!(created.host, "example.com");
    assert_eq!(created.port, 2222);
    assert_eq!(created.username, "deploy");
    assert!(!created.base.is_favorite);
    assert_eq!(created.profile_id, None);

    let fetched = get(&conn, &created.base.id).unwrap();
    assert_eq!(fetched.base.id, created.base.id);
    assert_eq!(fetched.host, "example.com");
}

#[test]
fn list_is_ordered_by_name_case_insensitively() {
    let conn = db();
    create(&conn, &draft("banana", "h1", 22, "u")).unwrap();
    create(&conn, &draft("Apple", "h2", 22, "u")).unwrap();
    create(&conn, &draft("cherry", "h3", 22, "u")).unwrap();

    let names: Vec<String> = list(&conn).unwrap().into_iter().map(|c| c.base.name).collect();
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

    let updated = update(&conn, &created.base.id, &draft("new", "new.host", 2200, "newuser")).unwrap();
    assert_eq!(updated.base.id, created.base.id);
    assert_eq!(updated.host, "new.host");
    assert_eq!(updated.port, 2200);
    assert_eq!(updated.username, "newuser");
    assert_eq!(updated.base.name, "new");
}

#[test]
fn set_favorite_toggles() {
    let conn = db();
    let created = create(&conn, &draft("c", "h", 22, "u")).unwrap();
    assert!(!created.base.is_favorite);

    assert!(set_favorite(&conn, &created.base.id, true).unwrap().base.is_favorite);
    assert!(!set_favorite(&conn, &created.base.id, false).unwrap().base.is_favorite);
}

#[test]
fn mark_used_stamps_an_iso_utc_instant() {
    let conn = db();
    let created = create(&conn, &draft("c", "h", 22, "u")).unwrap();
    assert!(created.base.last_used_at.is_none());

    let used = mark_used(&conn, &created.base.id).unwrap();
    let stamp = used.base.last_used_at.unwrap();

    // The frontend reads this with `new Date(...)`, which only agrees with the
    // stored instant when it is ISO-8601 with an explicit zone.
    assert_eq!(stamp.len(), 20, "{stamp}");
    assert!(stamp.contains('T'), "{stamp}");
    assert!(stamp.ends_with('Z'), "{stamp}");
}

#[test]
fn delete_removes_row() {
    let conn = db();
    let created = create(&conn, &draft("c", "h", 22, "u")).unwrap();
    delete(&conn, &created.base.id).unwrap();

    assert!(list(&conn).unwrap().is_empty());
    assert!(get(&conn, &created.base.id).is_err());
}

#[test]
fn create_records_the_profile_link() {
    let conn = db();
    let profile_id = profile(&conn, "ops", "deploy");

    let created = create(
        &conn,
        &ConnectionDraft {
            profile_id: Some(profile_id.clone()),
            ..draft("prod", "example.com", 22, "deploy")
        },
    )
    .unwrap();

    assert_eq!(created.profile_id, Some(profile_id.clone()));
    assert_eq!(get(&conn, &created.base.id).unwrap().profile_id, Some(profile_id));
}

#[test]
fn update_can_attach_and_detach_a_profile() {
    let conn = db();
    let profile_id = profile(&conn, "ops", "deploy");
    let created = create(&conn, &draft("c", "h", 22, "root")).unwrap();

    let attached = update(
        &conn,
        &created.base.id,
        &ConnectionDraft {
            profile_id: Some(profile_id.clone()),
            ..draft("c", "h", 22, "deploy")
        },
    )
    .unwrap();
    assert_eq!(attached.profile_id, Some(profile_id));

    let detached = update(&conn, &created.base.id, &draft("c", "h", 22, "deploy")).unwrap();
    assert_eq!(detached.profile_id, None);
}

#[test]
fn set_username_for_profile_only_touches_linked_rows() {
    let conn = db();
    let profile_id = profile(&conn, "ops", "root");
    let linked = create(
        &conn,
        &ConnectionDraft {
            profile_id: Some(profile_id.clone()),
            ..draft("linked", "a.example.com", 22, "root")
        },
    )
    .unwrap();
    let standalone = create(&conn, &draft("standalone", "b.example.com", 22, "root")).unwrap();

    set_username_for_profile(&conn, &profile_id, "admin").unwrap();

    assert_eq!(get(&conn, &linked.base.id).unwrap().username, "admin");
    assert_eq!(get(&conn, &standalone.base.id).unwrap().username, "root");
}

#[test]
fn set_username_for_profile_reports_endpoint_collisions() {
    let conn = db();
    let profile_id = profile(&conn, "ops", "root");
    create(&conn, &draft("taken", "a.example.com", 22, "admin")).unwrap();
    create(
        &conn,
        &ConnectionDraft {
            profile_id: Some(profile_id.clone()),
            ..draft("linked", "a.example.com", 22, "root")
        },
    )
    .unwrap();

    let err = set_username_for_profile(&conn, &profile_id, "admin").unwrap_err();
    match err {
        rusqlite::Error::SqliteFailure(_, Some(msg)) => assert_eq!(msg, DUPLICATE_ENDPOINT),
        other => panic!("expected DUPLICATE_ENDPOINT, got {other:?}"),
    }
}

#[test]
fn clear_profile_detaches_without_deleting() {
    let conn = db();
    let profile_id = profile(&conn, "ops", "root");
    let linked = create(
        &conn,
        &ConnectionDraft {
            profile_id: Some(profile_id.clone()),
            ..draft("linked", "a.example.com", 22, "root")
        },
    )
    .unwrap();

    clear_profile(&conn, &profile_id).unwrap();

    let detached = get(&conn, &linked.base.id).unwrap();
    assert_eq!(detached.profile_id, None);
    assert_eq!(detached.username, "root");
}

#[test]
fn deleting_a_profile_nulls_the_link_through_the_foreign_key() {
    let conn = db();
    let profile_id = profile(&conn, "ops", "root");
    let linked = create(
        &conn,
        &ConnectionDraft {
            profile_id: Some(profile_id.clone()),
            ..draft("linked", "a.example.com", 22, "root")
        },
    )
    .unwrap();

    crate::features::profiles::store::delete(&conn, &profile_id).unwrap();

    assert_eq!(get(&conn, &linked.base.id).unwrap().profile_id, None);
}
