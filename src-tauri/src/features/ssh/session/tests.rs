use super::*;

fn scratch_dir() -> PathBuf {
    let dir = std::env::temp_dir().join(format!("sshweaver-test-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

#[test]
fn atomic_write_replaces_existing_file_without_leaving_temp() {
    let dir = scratch_dir();
    let path = dir.join("known_hosts");
    std::fs::write(&path, "old\n").unwrap();

    atomic_write(&path, "new contents\n").unwrap();

    assert_eq!(std::fs::read_to_string(&path).unwrap(), "new contents\n");
    let leftover = std::fs::read_dir(&dir)
        .unwrap()
        .filter_map(Result::ok)
        .any(|e| e.file_name().to_string_lossy().contains(".tmp"));
    assert!(!leftover, "a temp file was left behind");

    std::fs::remove_dir_all(&dir).ok();
}

#[test]
fn atomic_write_creates_missing_file() {
    let dir = scratch_dir();
    let path = dir.join("known_hosts");

    atomic_write(&path, "data").unwrap();

    assert_eq!(std::fs::read_to_string(&path).unwrap(), "data");
    std::fs::remove_dir_all(&dir).ok();
}

#[test]
fn drop_lines_removes_only_the_given_line_numbers() {
    let contents = "one\ntwo\nthree\nfour\n";

    assert_eq!(drop_lines(contents, &[2]), "one\nthree\nfour\n");
}

#[test]
fn drop_lines_with_no_stale_lines_is_unchanged_but_for_trailing_newline() {
    let contents = "one\ntwo\n";

    assert_eq!(drop_lines(contents, &[]), "one\ntwo\n");
}

#[test]
fn drop_lines_can_remove_several_lines_in_any_order() {
    let contents = "one\ntwo\nthree\nfour\n";

    assert_eq!(drop_lines(contents, &[3, 1]), "two\nfour\n");
}
