import type { FlowControl, Parity, SerialSettings, StopBits } from "@/bindings";

export type { FlowControl, Parity, SerialSettings, StopBits };

/** The standard rates offered in the picker; any other value can be typed in. */
export const BAUD_RATES = [
  110, 300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200,
] as const;

export const DATA_BITS = [5, 6, 7, 8] as const;

export const PARITIES: readonly Parity[] = ["none", "odd", "even"];

export const STOP_BITS: readonly StopBits[] = ["one", "two"];

export const FLOW_CONTROLS: readonly FlowControl[] = ["none", "hardware", "software"];

export const DEFAULT_SERIAL_SETTINGS: SerialSettings = {
  portName: "",
  baudRate: 9600,
  dataBits: 8,
  parity: "none",
  stopBits: "one",
  flowControl: "none",
};

const PARITY_LETTER: Record<Parity, string> = {
  none: "N",
  odd: "O",
  even: "E",
};

const STOP_BITS_LABEL: Record<StopBits, string> = {
  one: "1",
  two: "2",
};

export const stopBitsLabel = (stopBits: StopBits) => STOP_BITS_LABEL[stopBits];

/** `COM3 · 9600 8-N-1` — the shorthand every serial console tool prints. */
export function describeSerial(settings: SerialSettings): string {
  const frame = `${settings.dataBits}-${PARITY_LETTER[settings.parity]}-${stopBitsLabel(
    settings.stopBits,
  )}`;
  return `${settings.portName} · ${settings.baudRate} ${frame}`;
}
