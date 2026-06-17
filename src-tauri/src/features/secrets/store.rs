use keyring::{Entry, Error};

const SERVICE: &str = "SSHWeaver";

fn entry(connection_id: &str) -> keyring::Result<Entry> {
    Entry::new(SERVICE, connection_id)
}

pub fn set(connection_id: &str, password: &str) -> keyring::Result<()> {
    entry(connection_id)?.set_password(password)
}

pub fn get(connection_id: &str) -> keyring::Result<Option<String>> {
    match entry(connection_id)?.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(Error::NoEntry) => Ok(None),
        Err(err) => Err(err),
    }
}

pub fn delete(connection_id: &str) -> keyring::Result<()> {
    match entry(connection_id)?.delete_credential() {
        Ok(()) | Err(Error::NoEntry) => Ok(()),
        Err(err) => Err(err),
    }
}

pub fn has(connection_id: &str) -> bool {
    matches!(get(connection_id), Ok(Some(_)))
}
