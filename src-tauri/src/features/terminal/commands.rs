use tauri::State;

use super::{Control, TerminalSessions};

#[tauri::command]
#[specta::specta]
pub fn terminal_write(state: State<TerminalSessions>, session_id: String, data: String) {
    state.send(&session_id, Control::Data(data.into_bytes()));
}

#[tauri::command]
#[specta::specta]
pub fn terminal_resize(state: State<TerminalSessions>, session_id: String, cols: u32, rows: u32) {
    state.send(&session_id, Control::Resize { cols, rows });
}
