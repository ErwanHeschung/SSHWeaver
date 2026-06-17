use super::join_remote;

#[test]
fn join_remote_inserts_single_separator() {
    assert_eq!(join_remote("/home/user", "file.txt"), "/home/user/file.txt");
    assert_eq!(join_remote("/home/user/", "file.txt"), "/home/user/file.txt");
}

#[test]
fn join_remote_handles_root() {
    assert_eq!(join_remote("/", "file.txt"), "/file.txt");
}
