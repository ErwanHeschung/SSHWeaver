use super::*;

#[test]
fn defaults_match_the_console_conventions() {
    let settings = SerialSettings::default();

    assert_eq!(settings.baud_rate, 9600);
    assert_eq!(settings.data_bits, 8);
    assert_eq!(settings.parity, Parity::None);
    assert_eq!(settings.stop_bits, StopBits::One);
    assert_eq!(settings.flow_control, FlowControl::None);
}

#[test]
fn every_parity_round_trips_through_its_stored_text() {
    for parity in [Parity::None, Parity::Odd, Parity::Even] {
        assert_eq!(Parity::parse(parity.as_str()), Some(parity));
    }
}

#[test]
fn every_stop_bits_round_trips_through_its_stored_text() {
    for stop_bits in [StopBits::One, StopBits::Two] {
        assert_eq!(StopBits::parse(stop_bits.as_str()), Some(stop_bits));
    }
}

#[test]
fn every_flow_control_round_trips_through_its_stored_text() {
    for flow in [FlowControl::None, FlowControl::Hardware, FlowControl::Software] {
        assert_eq!(FlowControl::parse(flow.as_str()), Some(flow));
    }
}

#[test]
fn unknown_stored_text_is_rejected() {
    assert_eq!(Parity::parse("Odd"), None);
    assert_eq!(StopBits::parse("1,5"), None);
    assert_eq!(FlowControl::parse("rts/cts"), None);
}

#[test]
fn parities_and_stop_bits_the_backend_cannot_drive_are_not_stored_values() {
    assert_eq!(Parity::parse("mark"), None);
    assert_eq!(Parity::parse("space"), None);
    assert_eq!(StopBits::parse("1.5"), None);
}

#[test]
fn line_settings_map_onto_the_serial_backend() {
    let settings = SerialSettings {
        data_bits: 7,
        parity: Parity::Even,
        stop_bits: StopBits::Two,
        flow_control: FlowControl::Hardware,
        ..SerialSettings::default()
    };

    assert_eq!(settings.data_bits().unwrap(), serialport::DataBits::Seven);
    assert_eq!(settings.parity(), serialport::Parity::Even);
    assert_eq!(settings.stop_bits(), serialport::StopBits::Two);
    assert_eq!(settings.flow_control(), serialport::FlowControl::Hardware);
}

#[test]
fn xon_xoff_maps_to_software_flow_control() {
    let settings = SerialSettings {
        flow_control: FlowControl::Software,
        ..SerialSettings::default()
    };
    assert_eq!(settings.flow_control(), serialport::FlowControl::Software);
}

#[test]
fn data_bits_outside_five_to_eight_are_reported_as_unsupported() {
    let settings = SerialSettings {
        data_bits: 9,
        ..SerialSettings::default()
    };
    let err = settings.data_bits().unwrap_err();
    assert!(err.contains('9'), "got {err}");
}
