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

fn failure_offering(methods: &[MethodKind]) -> AuthResult {
    AuthResult::Failure {
        remaining_methods: methods.into(),
        partial_success: false,
    }
}

#[test]
fn password_is_preferred_over_keyboard_interactive() {
    let offered = failure_offering(&[MethodKind::KeyboardInteractive, MethodKind::Password]);

    assert!(matches!(
        password_method(&offered),
        Some(AuthMethod::Password)
    ));
}

#[test]
fn keyboard_interactive_stands_in_for_password() {
    let offered = failure_offering(&[MethodKind::KeyboardInteractive]);

    assert!(matches!(
        password_method(&offered),
        Some(AuthMethod::KeyboardInteractive)
    ));
}

#[test]
fn a_server_offering_neither_has_no_password_method() {
    let offered = failure_offering(&[MethodKind::PublicKey]);

    assert!(password_method(&offered).is_none());
}

#[test]
fn a_default_connection_offers_no_legacy_algorithm() {
    let preferred = preferred(false);

    assert!(!preferred
        .key
        .contains(&ssh_key::Algorithm::Rsa { hash: None }));
    assert!(!preferred.key.contains(&ssh_key::Algorithm::Dsa));
    assert!(!preferred.kex.contains(&kex::DH_G14_SHA1));
    assert!(!preferred.kex.contains(&kex::DH_GEX_SHA1));
    assert!(!preferred.kex.contains(&kex::DH_G1_SHA1));
    assert!(!preferred.cipher.contains(&cipher::AES_256_CBC));
    assert!(!preferred.cipher.contains(&cipher::TRIPLE_DES_CBC));
    assert!(!preferred.mac.contains(&mac::HMAC_SHA1));
    assert!(!preferred.mac.contains(&mac::HMAC_SHA1_ETM));
}

#[test]
fn opting_in_offers_every_algorithm_old_gear_speaks() {
    let preferred = preferred(true);

    for algorithm in [
        ssh_key::Algorithm::Rsa { hash: None },
        ssh_key::Algorithm::Dsa,
    ] {
        assert!(preferred.key.contains(&algorithm), "{algorithm} is missing");
    }
    assert!(preferred.kex.contains(&kex::DH_G14_SHA1));
    assert!(preferred.kex.contains(&kex::DH_GEX_SHA1));
    assert!(preferred.kex.contains(&kex::DH_G1_SHA1));
    assert!(preferred.cipher.contains(&cipher::AES_256_CBC));
    assert!(preferred.cipher.contains(&cipher::TRIPLE_DES_CBC));
    assert!(preferred.mac.contains(&mac::HMAC_SHA1));
}

#[test]
fn the_modern_algorithms_keep_their_rank_either_way() {
    let strict = preferred(false);
    let legacy = preferred(true);

    // Opting in appends, it never reorders, so a current server negotiates
    // exactly what it negotiated before.
    let modern_kex = &strict.kex[..strict.kex.len() - 4];
    assert_eq!(modern_kex, &legacy.kex[..modern_kex.len()]);
    assert_eq!(strict.key.as_ref(), &legacy.key[..strict.key.len()]);
    assert_eq!(strict.cipher.as_ref(), &legacy.cipher[..strict.cipher.len()]);
    assert_eq!(strict.mac.as_ref(), &legacy.mac[..strict.mac.len()]);
}

#[test]
fn the_kex_extension_markers_end_both_lists() {
    for preferred in [preferred(false), preferred(true)] {
        let tail = &preferred.kex[preferred.kex.len() - 4..];
        assert_eq!(
            tail,
            [
                kex::EXTENSION_SUPPORT_AS_CLIENT,
                kex::EXTENSION_SUPPORT_AS_SERVER,
                kex::EXTENSION_OPENSSH_STRICT_KEX_AS_CLIENT,
                kex::EXTENSION_OPENSSH_STRICT_KEX_AS_SERVER,
            ]
        );
    }
}

#[test]
fn an_rsa_key_only_falls_back_to_ssh_rsa_when_opted_in() {
    let rsa = ssh_key::Algorithm::Rsa {
        hash: Some(HashAlg::Sha512),
    };

    assert_eq!(
        hash_candidates(rsa.clone(), false),
        vec![Some(HashAlg::Sha512), Some(HashAlg::Sha256)]
    );
    assert_eq!(
        hash_candidates(rsa, true),
        vec![Some(HashAlg::Sha512), Some(HashAlg::Sha256), None]
    );
}

#[test]
fn a_non_rsa_key_signs_under_its_own_name_only() {
    for allow_legacy in [false, true] {
        assert_eq!(
            hash_candidates(ssh_key::Algorithm::Ed25519, allow_legacy),
            vec![None]
        );
        assert_eq!(
            hash_candidates(ssh_key::Algorithm::Dsa, allow_legacy),
            vec![None]
        );
    }
}

#[test]
fn the_default_key_files_cover_every_generation() {
    assert_eq!(
        DEFAULT_KEY_NAMES,
        ["id_ed25519", "id_ecdsa", "id_rsa", "id_dsa"]
    );
}
