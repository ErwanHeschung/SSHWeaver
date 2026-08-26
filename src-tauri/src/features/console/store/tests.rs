use super::*;
use crate::features::console::settings::{FlowControl, Parity, StopBits};

fn db() -> Connection {
    let mut conn = Connection::open_in_memory().unwrap();
    conn.pragma_update(None, "foreign_keys", "ON").unwrap();
    crate::db::migrations::runner().to_latest(&mut conn).unwrap();
    conn
}

fn draft(name: &str, port_name: &str) -> ConsoleConnectionDraft {
    ConsoleConnectionDraft {
        name: name.into(),
        settings: SerialSettings {
            port_name: port_name.into(),
            ..SerialSettings::default()
        },
    }
}

#[test]
fn create_then_get_roundtrips_every_line_setting() {
    let conn = db();
    let created = create(
        &conn,
        &ConsoleConnectionDraft {
            name: "switch console".into(),
            settings: SerialSettings {
                port_name: "COM7".into(),
                baud_rate: 115_200,
                data_bits: 7,
                parity: Parity::Even,
                stop_bits: StopBits::Two,
                flow_control: FlowControl::Hardware,
            },
        },
    )
    .unwrap();

    assert_eq!(created.base.name, "switch console");
    assert!(!created.base.is_favorite);

    let fetched = get(&conn, &created.base.id).unwrap();
    assert_eq!(fetched.settings.port_name, "COM7");
    assert_eq!(fetched.settings.baud_rate, 115_200);
    assert_eq!(fetched.settings.data_bits, 7);
    assert_eq!(fetched.settings.parity, Parity::Even);
    assert_eq!(fetched.settings.stop_bits, StopBits::Two);
    assert_eq!(fetched.settings.flow_control, FlowControl::Hardware);
}

#[test]
fn parities_the_backend_cannot_drive_are_refused_by_the_schema() {
    let conn = db();
    let err = conn.execute(
        "INSERT INTO console_connections (id, name, port_name, parity)
         VALUES ('x', 'n', 'COM1', 'mark')",
        [],
    );
    assert!(err.is_err(), "mark parity should violate the CHECK");

    let err = conn.execute(
        "INSERT INTO console_connections (id, name, port_name, stop_bits)
         VALUES ('y', 'n', 'COM1', '1.5')",
        [],
    );
    assert!(err.is_err(), "1.5 stop bits should violate the CHECK");
}

#[test]
fn defaults_are_applied_by_the_schema() {
    let conn = db();
    let created = create(&conn, &draft("plain", "COM1")).unwrap();

    assert_eq!(created.settings.baud_rate, 9600);
    assert_eq!(created.settings.data_bits, 8);
    assert_eq!(created.settings.parity, Parity::None);
    assert_eq!(created.settings.stop_bits, StopBits::One);
    assert_eq!(created.settings.flow_control, FlowControl::None);
}

#[test]
fn list_is_ordered_by_name_case_insensitively() {
    let conn = db();
    create(&conn, &draft("banana", "COM1")).unwrap();
    create(&conn, &draft("Apple", "COM2")).unwrap();
    create(&conn, &draft("cherry", "COM3")).unwrap();

    let names: Vec<String> = list(&conn)
        .unwrap()
        .into_iter()
        .map(|c| c.base.name)
        .collect();
    assert_eq!(names, ["Apple", "banana", "cherry"]);
}

#[test]
fn an_identical_line_is_mapped_to_the_duplicate_sentinel() {
    let conn = db();
    create(&conn, &draft("a", "COM3")).unwrap();

    let err = create(&conn, &draft("b", "COM3")).unwrap_err();
    match err {
        rusqlite::Error::SqliteFailure(_, Some(msg)) => assert_eq!(msg, DUPLICATE_LINE),
        other => panic!("expected DUPLICATE_LINE, got {other:?}"),
    }
}

#[test]
fn port_names_collide_case_insensitively() {
    let conn = db();
    create(&conn, &draft("a", "COM3")).unwrap();

    let err = create(&conn, &draft("b", "com3")).unwrap_err();
    assert!(matches!(err, rusqlite::Error::SqliteFailure(_, Some(msg)) if msg == DUPLICATE_LINE));
}

#[test]
fn the_same_port_at_another_baud_rate_is_a_separate_entry() {
    let conn = db();
    create(&conn, &draft("slow", "COM3")).unwrap();
    create(
        &conn,
        &ConsoleConnectionDraft {
            name: "fast".into(),
            settings: SerialSettings {
                port_name: "COM3".into(),
                baud_rate: 115_200,
                ..SerialSettings::default()
            },
        },
    )
    .unwrap();

    assert_eq!(list(&conn).unwrap().len(), 2);
}

#[test]
fn a_blank_port_name_is_refused() {
    let conn = db();
    assert!(create(&conn, &draft("nameless", "   ")).is_err());
}

#[test]
fn update_changes_the_name_and_the_line() {
    let conn = db();
    let created = create(&conn, &draft("old", "COM1")).unwrap();

    let updated = update(
        &conn,
        &created.base.id,
        &ConsoleConnectionDraft {
            name: "new".into(),
            settings: SerialSettings {
                port_name: "COM9".into(),
                baud_rate: 19_200,
                ..SerialSettings::default()
            },
        },
    )
    .unwrap();

    assert_eq!(updated.base.id, created.base.id);
    assert_eq!(updated.base.name, "new");
    assert_eq!(updated.settings.port_name, "COM9");
    assert_eq!(updated.settings.baud_rate, 19_200);
}

#[test]
fn update_onto_an_existing_line_is_mapped_to_the_duplicate_sentinel() {
    let conn = db();
    create(&conn, &draft("taken", "COM1")).unwrap();
    let created = create(&conn, &draft("other", "COM2")).unwrap();

    let err = update(&conn, &created.base.id, &draft("other", "COM1")).unwrap_err();
    assert!(matches!(err, rusqlite::Error::SqliteFailure(_, Some(msg)) if msg == DUPLICATE_LINE));
}

#[test]
fn set_favorite_toggles() {
    let conn = db();
    let created = create(&conn, &draft("c", "COM1")).unwrap();
    assert!(!created.base.is_favorite);

    assert!(set_favorite(&conn, &created.base.id, true).unwrap().base.is_favorite);
    assert!(!set_favorite(&conn, &created.base.id, false).unwrap().base.is_favorite);
}

#[test]
fn delete_removes_row() {
    let conn = db();
    let created = create(&conn, &draft("c", "COM1")).unwrap();

    delete(&conn, &created.base.id).unwrap();

    assert!(list(&conn).unwrap().is_empty());
    assert!(get(&conn, &created.base.id).is_err());
}

#[test]
fn console_and_ssh_connections_are_stored_independently() {
    let conn = db();
    let console = create(&conn, &draft("console", "COM1")).unwrap();
    let ssh = crate::features::connections::store::create(
        &conn,
        &crate::features::connections::store::ConnectionDraft {
            name: "ssh".into(),
            host: "example.com".into(),
            port: 22,
            username: "root".into(),
            profile_id: None,
        },
    )
    .unwrap();

    delete(&conn, &console.base.id).unwrap();

    assert!(list(&conn).unwrap().is_empty());
    assert!(crate::features::connections::store::get(&conn, &ssh.base.id).is_ok());
}
