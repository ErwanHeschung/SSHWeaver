pub mod commands;
mod session;
mod sftp;

pub use sftp::{SftpEntry, SftpSessions};

use std::collections::HashMap;

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri_specta::Event;
use tokio::sync::oneshot;

#[derive(Default)]
pub struct PendingConnections(pub Mutex<HashMap<String, session::Pending>>);

#[derive(Default)]
pub struct HostKeyPrompts(pub Mutex<HashMap<String, oneshot::Sender<bool>>>);

/// The answer carries the passphrase and whether to keep it; `None` is the
/// user declining to unlock that key.
pub type PassphraseAnswer = Option<(String, bool)>;

#[derive(Default)]
pub struct KeyPassphrasePrompts(
    pub Mutex<HashMap<String, oneshot::Sender<PassphraseAnswer>>>,
);

#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct HostKeyPrompt {
    pub session_id: String,
    pub host: String,
    pub port: u16,
    pub fingerprint: String,
    pub changed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct KeyPassphrasePrompt {
    pub session_id: String,
    pub path: String,
    pub retry: bool,
}
