pub mod commands;
mod session;
mod sftp;

pub use sftp::{SftpEntry, SftpSessions};

use std::collections::HashMap;

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri_specta::Event;
use tokio::sync::{mpsc, oneshot};

pub enum Control {
    Data(Vec<u8>),
    Resize { cols: u32, rows: u32 },
    Close,
}

#[derive(Default)]
pub struct SshSessions(pub Mutex<HashMap<String, mpsc::UnboundedSender<Control>>>);

#[derive(Default)]
pub struct PendingConnections(pub Mutex<HashMap<String, session::Pending>>);

#[derive(Default)]
pub struct HostKeyPrompts(pub Mutex<HashMap<String, oneshot::Sender<bool>>>);

#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct SshOutput {
    pub session_id: String,
    pub data: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct SshClosed {
    pub session_id: String,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct HostKeyPrompt {
    pub session_id: String,
    pub host: String,
    pub port: u16,
    pub fingerprint: String,
    pub changed: bool,
}
