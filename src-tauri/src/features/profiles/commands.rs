use rusqlite::Connection;
use serde::Serialize;
use specta::Type;
use tauri::State;
use zeroize::Zeroizing;

use super::store::{self, ProfileDraft, StoredProfile};
use crate::db::Db;
use crate::features::connections::store as connections;
use crate::features::secrets::store::{self as secrets, Key};
use crate::features::sql::{self, CmdResult};

#[derive(Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub id: String,
    pub name: String,
    pub username: String,
    pub has_password: bool,
}

impl From<StoredProfile> for Profile {
    fn from(stored: StoredProfile) -> Self {
        Profile {
            has_password: secrets::has(&Key::Profile(stored.id.clone())),
            id: stored.id,
            name: stored.name,
            username: stored.username,
        }
    }
}

fn db_error(err: rusqlite::Error) -> String {
    sql::db_error(
        err,
        &[store::DUPLICATE_NAME, connections::DUPLICATE_ENDPOINT],
    )
}

// `None` leaves the keystore alone, an empty string clears it.
fn store_password(id: &str, password: Option<String>) {
    let Some(password) = password.map(Zeroizing::new) else {
        return;
    };
    let key = Key::Profile(id.to_string());
    let result = if password.is_empty() {
        secrets::delete(&key)
    } else {
        secrets::set(&key, password.as_str())
    };
    if let Err(e) = result {
        tracing::warn!(
            target: "ssh::audit",
            error = %e,
            "failed to save profile password to keystore"
        );
    }
}

#[tauri::command]
#[specta::specta]
pub fn profiles_list(db: State<Db>) -> CmdResult<Vec<Profile>> {
    let conn = sql::lock(&db)?;
    let profiles = store::list(&conn).map_err(db_error)?;
    Ok(profiles.into_iter().map(Profile::from).collect())
}

#[tauri::command]
#[specta::specta]
pub fn profile_create(
    db: State<Db>,
    draft: ProfileDraft,
    password: Option<String>,
) -> CmdResult<Profile> {
    let conn = sql::lock(&db)?;
    let created = store::create(&conn, &draft).map_err(db_error)?;
    store_password(&created.id, password);
    Ok(created.into())
}

#[tauri::command]
#[specta::specta]
pub fn profile_update(
    db: State<Db>,
    id: String,
    draft: ProfileDraft,
    password: Option<String>,
) -> CmdResult<Profile> {
    let mut conn = sql::lock(&db)?;
    let updated = update_profile(&mut conn, &id, &draft)?;
    store_password(&id, password);
    Ok(updated.into())
}

// One transaction, so an endpoint collision rolls the rename back too.
fn update_profile(
    conn: &mut Connection,
    id: &str,
    draft: &ProfileDraft,
) -> CmdResult<StoredProfile> {
    let tx = conn.transaction().map_err(db_error)?;
    let updated = store::update(&tx, id, draft).map_err(db_error)?;
    connections::set_username_for_profile(&tx, id, &draft.username).map_err(db_error)?;
    tx.commit().map_err(db_error)?;
    Ok(updated)
}

#[tauri::command]
#[specta::specta]
pub fn profile_delete(db: State<Db>, id: String) -> CmdResult<()> {
    let mut conn = sql::lock(&db)?;
    let tx = conn.transaction().map_err(db_error)?;
    connections::clear_profile(&tx, &id).map_err(db_error)?;
    store::delete(&tx, &id).map_err(db_error)?;
    tx.commit().map_err(db_error)?;

    if let Err(e) = secrets::delete(&Key::Profile(id)) {
        tracing::warn!(
            target: "ssh::audit",
            error = %e,
            "failed to remove profile password on delete"
        );
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn profile_delete_password(id: String) -> CmdResult<()> {
    secrets::delete(&Key::Profile(id)).map_err(|e| {
        tracing::error!(target: "ssh::audit", error = %e, "failed to delete profile password");
        "keystore error".to_string()
    })
}

#[cfg(test)]
mod tests;
