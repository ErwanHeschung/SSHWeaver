use super::*;

#[test]
fn connection_entries_keep_the_bare_id() {
    assert_eq!(Key::connection("abc").entry_name(), "abc");
}

#[test]
fn profile_entries_are_namespaced() {
    assert_eq!(Key::profile("abc").entry_name(), "profile:abc");
}

#[test]
fn the_two_id_spaces_cannot_collide() {
    let shared_id = "1cb2f2ce-0f4a-4a5f-9b0e-2d0c0f6f0b1a";
    assert_ne!(
        Key::connection(shared_id).entry_name(),
        Key::profile(shared_id).entry_name()
    );
}

#[test]
fn only_connection_keys_are_owned_by_one_record() {
    assert!(Key::connection("abc").is_connection());
    assert!(!Key::profile("abc").is_connection());
}
