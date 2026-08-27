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

#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct HostKeyPrompt {
    pub session_id: String,
    pub host: String,
    pub port: u16,
    pub fingerprint: String,
    pub changed: bool,
}
