use super::*;

const ED25519_A: &str =
    "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJdD7y3aLq454yWBdwLWbieU1ebz9/cu7/QEXn9OIeZJ";
const ED25519_B: &str =
    "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILIG2T/B0l0gaqj3puu510tu9N1OkQ4znY3LYuEm5zCF";

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
fn line_carries_key_matches_only_the_recorded_key() {
    let key = ssh_key::PublicKey::from_openssh(ED25519_A).unwrap();
    let keys = [key];

    assert!(line_carries_key(&format!("example.com {ED25519_A}"), &keys));
    assert!(!line_carries_key(&format!("# example.com {ED25519_A}"), &keys));
    assert!(!line_carries_key("   ", &keys));
    assert!(!line_carries_key(&format!("example.com {ED25519_B}"), &keys));
    assert!(!line_carries_key("example.com ssh-ed25519", &keys));
}
