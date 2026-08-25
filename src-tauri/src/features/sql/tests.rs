use super::*;
use rusqlite::ffi::{Error as FfiError, SQLITE_CONSTRAINT};
use rusqlite::ErrorCode;

const SENTINEL: &str = "DUPLICATE_SOMETHING";

fn constraint_violation() -> rusqlite::Error {
    rusqlite::Error::SqliteFailure(
        FfiError::new(SQLITE_CONSTRAINT),
        Some("UNIQUE constraint failed: connections.host".to_string()),
    )
}

#[test]
fn tag_constraint_replaces_the_sqlite_message() {
    match tag_constraint(constraint_violation(), SENTINEL) {
        rusqlite::Error::SqliteFailure(_, Some(msg)) => assert_eq!(msg, SENTINEL),
        other => panic!("expected a tagged failure, got {other:?}"),
    }
}

#[test]
fn tag_constraint_leaves_other_failures_alone() {
    let err = tag_constraint(rusqlite::Error::QueryReturnedNoRows, SENTINEL);
    assert!(matches!(err, rusqlite::Error::QueryReturnedNoRows));
}

#[test]
fn db_error_forwards_declared_sentinels() {
    let err = tag_constraint(constraint_violation(), SENTINEL);
    assert_eq!(db_error(err, &[SENTINEL]), SENTINEL);
}

#[test]
fn db_error_hides_sentinels_the_caller_did_not_declare() {
    let err = tag_constraint(constraint_violation(), SENTINEL);
    assert_eq!(db_error(err, &["SOMETHING_ELSE"]), "database error");
}

#[test]
fn db_error_hides_raw_sqlite_messages() {
    assert_eq!(db_error(constraint_violation(), &[SENTINEL]), "database error");
    assert_eq!(
        db_error(rusqlite::Error::QueryReturnedNoRows, &[SENTINEL]),
        "database error"
    );
}

#[test]
fn constraint_violations_are_recognised_by_code() {
    let rusqlite::Error::SqliteFailure(inner, _) = constraint_violation() else {
        panic!("expected a SqliteFailure");
    };
    assert_eq!(inner.code, ErrorCode::ConstraintViolation);
}
