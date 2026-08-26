use serde::Serialize;
use serialport::SerialPortType;
use specta::Type;

/// A serial port the machine currently exposes.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AvailablePort {
    pub name: String,
    /// What the OS knows about the device, to tell several adapters apart.
    pub description: Option<String>,
}

pub fn list() -> Result<Vec<AvailablePort>, String> {
    let mut ports: Vec<AvailablePort> = serialport::available_ports()
        .map_err(|e| format!("could not list serial ports: {e}"))?
        .into_iter()
        .map(|port| AvailablePort {
            name: port.port_name,
            description: describe(&port.port_type),
        })
        .collect();

    ports.sort_by_key(|port| port.name.to_lowercase());
    Ok(ports)
}

fn describe(port_type: &SerialPortType) -> Option<String> {
    match port_type {
        SerialPortType::UsbPort(info) => {
            let label = [info.manufacturer.as_deref(), info.product.as_deref()]
                .into_iter()
                .flatten()
                .map(str::trim)
                .filter(|part| !part.is_empty())
                .collect::<Vec<_>>()
                .join(" ");
            (!label.is_empty()).then_some(label)
        }
        SerialPortType::BluetoothPort => Some("Bluetooth".to_string()),
        SerialPortType::PciPort => Some("PCI".to_string()),
        SerialPortType::Unknown => None,
    }
}

#[cfg(test)]
mod tests;
