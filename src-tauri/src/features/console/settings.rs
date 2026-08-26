use serde::{Deserialize, Serialize};
use specta::Type;

use crate::features::sql::sql_text_enum;

/// Line settings for a console (serial) connection.
///
/// Mark/space parity and 1.5 stop bits are absent on purpose: `serialport`
/// exposes neither on any platform, and macOS has no termios route to them at
/// all. Adding them needs a per-platform path plus a migration.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SerialSettings {
    pub port_name: String,
    pub baud_rate: u32,
    pub data_bits: u8,
    pub parity: Parity,
    pub stop_bits: StopBits,
    pub flow_control: FlowControl,
}

pub const DEFAULT_BAUD_RATE: u32 = 9600;
pub const DEFAULT_DATA_BITS: u8 = 8;

impl Default for SerialSettings {
    fn default() -> Self {
        Self {
            port_name: String::new(),
            baud_rate: DEFAULT_BAUD_RATE,
            data_bits: DEFAULT_DATA_BITS,
            parity: Parity::None,
            stop_bits: StopBits::One,
            flow_control: FlowControl::None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum Parity {
    None,
    Odd,
    Even,
}

impl Parity {
    pub fn as_str(&self) -> &'static str {
        match self {
            Parity::None => "none",
            Parity::Odd => "odd",
            Parity::Even => "even",
        }
    }

    pub fn parse(text: &str) -> Option<Self> {
        Some(match text {
            "none" => Parity::None,
            "odd" => Parity::Odd,
            "even" => Parity::Even,
            _ => return None,
        })
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum StopBits {
    One,
    Two,
}

impl StopBits {
    pub fn as_str(&self) -> &'static str {
        match self {
            StopBits::One => "1",
            StopBits::Two => "2",
        }
    }

    pub fn parse(text: &str) -> Option<Self> {
        Some(match text {
            "1" => StopBits::One,
            "2" => StopBits::Two,
            _ => return None,
        })
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum FlowControl {
    None,
    Hardware,
    Software,
}

impl FlowControl {
    pub fn as_str(&self) -> &'static str {
        match self {
            FlowControl::None => "none",
            FlowControl::Hardware => "hardware",
            FlowControl::Software => "software",
        }
    }

    pub fn parse(text: &str) -> Option<Self> {
        Some(match text {
            "none" => FlowControl::None,
            "hardware" => FlowControl::Hardware,
            "software" => FlowControl::Software,
            _ => return None,
        })
    }
}

sql_text_enum!(Parity);
sql_text_enum!(StopBits);
sql_text_enum!(FlowControl);

impl SerialSettings {
    /// The one setting still carried as a bare number: the schema constrains it
    /// to 5..=8, so an out-of-range value means a hand-edited database.
    pub fn data_bits(&self) -> Result<serialport::DataBits, String> {
        Ok(match self.data_bits {
            5 => serialport::DataBits::Five,
            6 => serialport::DataBits::Six,
            7 => serialport::DataBits::Seven,
            8 => serialport::DataBits::Eight,
            other => return Err(format!("unsupported data bits: {other}")),
        })
    }

    pub fn parity(&self) -> serialport::Parity {
        match self.parity {
            Parity::None => serialport::Parity::None,
            Parity::Odd => serialport::Parity::Odd,
            Parity::Even => serialport::Parity::Even,
        }
    }

    pub fn stop_bits(&self) -> serialport::StopBits {
        match self.stop_bits {
            StopBits::One => serialport::StopBits::One,
            StopBits::Two => serialport::StopBits::Two,
        }
    }

    pub fn flow_control(&self) -> serialport::FlowControl {
        match self.flow_control {
            FlowControl::None => serialport::FlowControl::None,
            FlowControl::Hardware => serialport::FlowControl::Hardware,
            FlowControl::Software => serialport::FlowControl::Software,
        }
    }
}

#[cfg(test)]
mod tests;
