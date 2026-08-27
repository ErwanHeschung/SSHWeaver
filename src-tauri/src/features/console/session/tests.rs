use super::*;

fn channel() -> (
    mpsc::UnboundedSender<Control>,
    mpsc::UnboundedReceiver<Control>,
) {
    mpsc::unbounded_channel()
}

#[test]
fn an_empty_channel_yields_nothing_to_do() {
    let (_tx, mut rx) = channel();
    assert!(rx.next_control().is_none());
}

#[test]
fn queued_writes_are_drained_in_order() {
    let (tx, mut rx) = channel();
    tx.send(Control::Data(b"a".to_vec())).unwrap();
    tx.send(Control::Data(b"b".to_vec())).unwrap();

    let sent: Vec<Vec<u8>> = std::iter::from_fn(|| rx.next_control())
        .map_while(|control| match control {
            Control::Data(bytes) => Some(bytes),
            _ => None,
        })
        .collect();

    assert_eq!(sent, [b"a".to_vec(), b"b".to_vec()]);
}

#[test]
fn a_resize_is_accepted_and_ignored_by_the_pump() {
    let (tx, mut rx) = channel();
    tx.send(Control::Resize { cols: 80, rows: 24 }).unwrap();
    assert!(matches!(rx.next_control(), Some(Control::Resize { .. })));
}

#[test]
fn dropping_every_sender_reads_as_a_close() {
    let (tx, mut rx) = channel();
    drop(tx);
    assert!(matches!(rx.next_control(), Some(Control::Close)));
}

#[test]
fn a_pending_write_is_still_delivered_after_the_sender_is_dropped() {
    // The pump must flush what the UI already sent before it shuts down.
    let (tx, mut rx) = channel();
    tx.send(Control::Data(b"x".to_vec())).unwrap();
    drop(tx);

    assert!(matches!(rx.next_control(), Some(Control::Data(bytes)) if bytes == b"x"));
    assert!(matches!(rx.next_control(), Some(Control::Close)));
}

#[test]
fn an_unopenable_port_is_reported_with_its_name() {
    let settings = SerialSettings {
        port_name: "COM-does-not-exist".into(),
        ..SerialSettings::default()
    };

    let err = open_port(&settings).unwrap_err();
    assert!(err.contains("COM-does-not-exist"), "got {err}");
}

#[test]
fn an_unsupported_line_setting_is_reported_before_the_port_is_touched() {
    let settings = SerialSettings {
        port_name: "COM-does-not-exist".into(),
        data_bits: 9,
        ..SerialSettings::default()
    };

    let err = open_port(&settings).unwrap_err();
    assert!(err.contains("data bits"), "got {err}");
}
