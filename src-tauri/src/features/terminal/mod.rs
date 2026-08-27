//! Transport-agnostic terminal plumbing.
//!
//! An SSH channel and a serial port open differently but are the same thing
//! once open: a byte stream keyed by session id. Both register a [`Control`]
//! sender here, so writes, resizes and events need one implementation.

pub mod commands;

use std::collections::HashMap;

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::AppHandle;
use tauri_specta::Event;
use tokio::sync::mpsc;

pub enum Control {
    Data(Vec<u8>),
    Resize { cols: u32, rows: u32 },
    Close,
}

#[derive(Default)]
pub struct TerminalSessions(pub Mutex<HashMap<String, mpsc::UnboundedSender<Control>>>);

impl TerminalSessions {
    pub fn insert(&self, session_id: String, tx: mpsc::UnboundedSender<Control>) {
        self.0.lock().insert(session_id, tx);
    }

    pub fn contains(&self, session_id: &str) -> bool {
        self.0.lock().contains_key(session_id)
    }

    pub fn remove(&self, session_id: &str) {
        self.0.lock().remove(session_id);
    }

    /// Dropped silently when the session is already gone: the UI can ask to
    /// write or close a session the transport has just torn down.
    pub fn send(&self, session_id: &str, control: Control) {
        if let Some(tx) = self.0.lock().get(session_id) {
            let _ = tx.send(control);
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct TerminalOutput {
    pub session_id: String,
    pub data: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct TerminalClosed {
    pub session_id: String,
    pub message: Option<String>,
}

pub fn emit_output(app: &AppHandle, session_id: &str, data: &[u8]) {
    let _ = TerminalOutput {
        session_id: session_id.to_string(),
        data: data.to_vec(),
    }
    .emit(app);
}

pub fn emit_closed(app: &AppHandle, session_id: String, message: Option<String>) {
    let _ = TerminalClosed {
        session_id,
        message,
    }
    .emit(app);
}
