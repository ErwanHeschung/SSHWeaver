use std::io::{ErrorKind, Read, Write};
use std::time::Duration;

use serde::Deserialize;
use serialport::SerialPort;
use specta::Type;
use tauri::{AppHandle, Manager};
use tokio::sync::mpsc::{self, error::TryRecvError, UnboundedReceiver};

use super::settings::SerialSettings;
use crate::features::terminal::{self, Control, TerminalSessions};

#[derive(Debug, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ConsoleParams {
    pub session_id: String,
    pub settings: SerialSettings,
}

/// How long a read may block before the pump looks at the control channel.
const READ_TIMEOUT: Duration = Duration::from_millis(20);

const READ_BUFFER: usize = 4096;

pub async fn open(app: AppHandle, params: ConsoleParams) -> Result<(), String> {
    if app.state::<TerminalSessions>().contains(&params.session_id) {
        return Err("session id already in use".to_string());
    }

    let ConsoleParams {
        session_id,
        settings,
    } = params;

    // Opening a port talks to the driver and can block.
    let port = tokio::task::spawn_blocking(move || open_port(&settings))
        .await
        .map_err(|e| e.to_string())??;

    let (tx, rx) = mpsc::unbounded_channel::<Control>();
    app.state::<TerminalSessions>().insert(session_id.clone(), tx);

    // An OS thread, not a tokio task: the handle is blocking, and interleaving
    // reads with pending writes on one thread avoids sharing it across threads.
    std::thread::spawn(move || pump(app, session_id, port, rx));
    Ok(())
}

fn open_port(settings: &SerialSettings) -> Result<Box<dyn SerialPort>, String> {
    let name = settings.port_name.trim();
    let data_bits = settings.data_bits()?;
    ensure_known_port(name)?;
    serialport::new(name, settings.baud_rate)
        .data_bits(data_bits)
        .parity(settings.parity())
        .stop_bits(settings.stop_bits())
        .flow_control(settings.flow_control())
        // Console cables commonly expect DTR asserted, as PuTTY and friends do.
        .dtr_on_open(true)
        .timeout(READ_TIMEOUT)
        .open()
        .map_err(|e| format!("could not open {name}: {e}"))
}

// The port picker in the UI only ever offers what `available_ports` reports,
// so a `port_name` outside that list didn't come from a normal connect — this
// keeps `console_connect` from being usable to open an arbitrary OS path.
fn ensure_known_port(name: &str) -> Result<(), String> {
    let known = serialport::available_ports()
        .map_err(|e| format!("could not list serial ports: {e}"))?
        .into_iter()
        .any(|p| p.port_name.eq_ignore_ascii_case(name));
    if known {
        Ok(())
    } else {
        Err(format!("{name} is not a serial port this machine currently exposes"))
    }
}

pub fn disconnect(app: &AppHandle, session_id: &str) {
    app.state::<TerminalSessions>()
        .send(session_id, Control::Close);
}

fn pump(
    app: AppHandle,
    session_id: String,
    mut port: Box<dyn SerialPort>,
    mut rx: UnboundedReceiver<Control>,
) {
    let mut buffer = [0u8; READ_BUFFER];

    let message = 'session: loop {
        loop {
            match rx.next_control() {
                Some(Control::Data(bytes)) => {
                    if let Err(e) = port.write_all(&bytes) {
                        break 'session Some(write_error(&session_id, e));
                    }
                }
                // A serial line has no window size to negotiate.
                Some(Control::Resize { .. }) => {}
                Some(Control::Close) => break 'session None,
                None => break,
            }
        }

        match port.read(&mut buffer) {
            Ok(0) => {}
            Ok(read) => terminal::emit_output(&app, &session_id, &buffer[..read]),
            Err(e) if e.kind() == ErrorKind::TimedOut => {}
            Err(e) => break 'session Some(read_error(&session_id, e)),
        }
    };

    drop(port);
    app.state::<TerminalSessions>().remove(&session_id);
    terminal::emit_closed(&app, session_id, message);
}

trait NextControl {
    /// A closed channel reports [`Control::Close`], so the pump has one
    /// shutdown path.
    fn next_control(&mut self) -> Option<Control>;
}

impl NextControl for UnboundedReceiver<Control> {
    fn next_control(&mut self) -> Option<Control> {
        match self.try_recv() {
            Ok(control) => Some(control),
            Err(TryRecvError::Empty) => None,
            Err(TryRecvError::Disconnected) => Some(Control::Close),
        }
    }
}

fn write_error(session_id: &str, err: std::io::Error) -> String {
    tracing::warn!(target: "ssh::audit", session = %session_id, error = %err, "serial write failed");
    format!("serial write failed: {err}")
}

fn read_error(session_id: &str, err: std::io::Error) -> String {
    tracing::warn!(target: "ssh::audit", session = %session_id, error = %err, "serial read failed");
    format!("serial port disconnected: {err}")
}

#[cfg(test)]
mod tests;
