use super::*;
use serialport::UsbPortInfo;

fn usb(manufacturer: Option<&str>, product: Option<&str>) -> SerialPortType {
    SerialPortType::UsbPort(UsbPortInfo {
        vid: 0x0403,
        pid: 0x6001,
        serial_number: None,
        manufacturer: manufacturer.map(str::to_string),
        product: product.map(str::to_string),
    })
}

#[test]
fn a_usb_port_is_described_by_its_manufacturer_and_product() {
    assert_eq!(
        describe(&usb(Some("FTDI"), Some("USB Serial"))),
        Some("FTDI USB Serial".to_string())
    );
}

#[test]
fn a_usb_port_falls_back_to_whichever_half_the_os_knows() {
    assert_eq!(describe(&usb(Some("FTDI"), None)), Some("FTDI".to_string()));
    assert_eq!(
        describe(&usb(None, Some("USB Serial"))),
        Some("USB Serial".to_string())
    );
}

#[test]
fn a_usb_port_with_nothing_useful_is_left_undescribed() {
    assert_eq!(describe(&usb(None, None)), None);
    assert_eq!(describe(&usb(Some("  "), Some(""))), None);
}

#[test]
fn other_port_types_are_named_by_their_bus() {
    assert_eq!(
        describe(&SerialPortType::BluetoothPort),
        Some("Bluetooth".to_string())
    );
    assert_eq!(describe(&SerialPortType::PciPort), Some("PCI".to_string()));
    assert_eq!(describe(&SerialPortType::Unknown), None);
}

#[test]
fn listing_ports_never_fails_on_a_machine_without_any() {
    // Contents are hardware-dependent; only the empty-not-error case is fixed.
    assert!(list().is_ok());
}

#[test]
#[ignore = "temporary: prints what the machine exposes"]
fn dump_ports() {
    match list() {
        Ok(ports) if ports.is_empty() => println!("PORTS: none detected"),
        Ok(ports) => {
            for p in ports {
                println!("PORTS: {} | {}", p.name, p.description.unwrap_or_else(|| "-".into()));
            }
        }
        Err(e) => println!("PORTS: error {e}"),
    }
}
