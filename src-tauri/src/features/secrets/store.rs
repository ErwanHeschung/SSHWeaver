use keyring::{Entry, Error};

const SERVICE: &str = "SSHWeaver";

// Connections keep the bare connection id as their entry name — that is how
// they were first written, and renaming would orphan existing passwords.
// Profiles are namespaced so the two id spaces cannot collide.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Key {
    Connection(String),
    Profile(String),
}

impl Key {
    pub fn connection(id: &str) -> Self {
        Key::Connection(id.to_string())
    }

    pub fn profile(id: &str) -> Self {
        Key::Profile(id.to_string())
    }

    pub fn is_connection(&self) -> bool {
        matches!(self, Key::Connection(_))
    }

    fn entry_name(&self) -> String {
        match self {
            Key::Connection(id) => id.clone(),
            Key::Profile(id) => format!("profile:{id}"),
        }
    }
}

fn entry(key: &Key) -> keyring::Result<Entry> {
    Entry::new(SERVICE, &key.entry_name())
}

pub fn set(key: &Key, password: &str) -> keyring::Result<()> {
    entry(key)?.set_password(password)
}

pub fn get(key: &Key) -> keyring::Result<Option<String>> {
    match entry(key)?.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(Error::NoEntry) => Ok(None),
        Err(err) => Err(err),
    }
}

pub fn delete(key: &Key) -> keyring::Result<()> {
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
