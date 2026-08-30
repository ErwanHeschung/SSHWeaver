use keyring_core::{Entry, Error};
use zeroize::Zeroizing;

const SERVICE: &str = "SSHWeaver";

/// Picks the platform credential store and makes it `keyring_core`'s default,
/// once, at startup.
pub fn init() {
    if let Err(e) = try_init() {
        tracing::warn!(
            target: "ssh::audit",
            error = %e,
            "no platform credential store available; saved passwords will be unavailable"
        );
    }
}

#[cfg(target_os = "windows")]
fn try_init() -> keyring_core::Result<()> {
    keyring_core::set_default_store(windows_native_keyring_store::Store::new()?);
    Ok(())
}

#[cfg(target_os = "macos")]
fn try_init() -> keyring_core::Result<()> {
    keyring_core::set_default_store(apple_native_keyring_store::keychain::Store::new()?);
    Ok(())
}

#[cfg(all(unix, not(target_os = "macos")))]
fn try_init() -> keyring_core::Result<()> {
    keyring_core::set_default_store(dbus_secret_service_keyring_store::Store::new()?);
    Ok(())
}

// Connections keep the bare connection id as their entry name — that is how
// they were first written, and renaming would orphan existing passwords.
// Profiles are namespaced so the two id spaces cannot collide.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Key {
    Connection(String),
    Profile(String),
    KeyFile(String),
}

impl Key {
    pub fn connection(id: &str) -> Self {
        Key::Connection(id.to_string())
    }

    pub fn profile(id: &str) -> Self {
        Key::Profile(id.to_string())
    }

    pub fn key_file(path: &str) -> Self {
        Key::KeyFile(path.to_string())
    }

    pub fn is_connection(&self) -> bool {
        matches!(self, Key::Connection(_))
    }

    fn entry_name(&self) -> String {
        match self {
            Key::Connection(id) => id.clone(),
            Key::Profile(id) => format!("profile:{id}"),
            Key::KeyFile(path) => format!("keyfile:{path}"),
        }
    }
}

fn entry(key: &Key) -> keyring_core::Result<Entry> {
    Entry::new(SERVICE, &key.entry_name())
}

pub fn set(key: &Key, password: &str) -> keyring_core::Result<()> {
    entry(key)?.set_password(password)
}

pub fn get(key: &Key) -> keyring_core::Result<Option<Zeroizing<String>>> {
    match entry(key)?.get_password() {
        Ok(password) => Ok(Some(Zeroizing::new(password))),
        Err(Error::NoEntry) => Ok(None),
        Err(err) => Err(err),
    }
}

pub fn delete(key: &Key) -> keyring_core::Result<()> {
    match entry(key)?.delete_credential() {
        Ok(()) | Err(Error::NoEntry) => Ok(()),
        Err(err) => Err(err),
    }
}

pub fn has(key: &Key) -> bool {
    matches!(get(key), Ok(Some(_)))
}

#[cfg(test)]
mod tests;
