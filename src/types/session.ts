export enum SessionStatus {
  Connecting = "connecting",
  Connected = "connected",
  Closed = "closed",
}

/** Transports close differently, and only SSH can browse files. */
export enum SessionKind {
  Ssh = "ssh",
  Console = "console",
}

export interface TerminalSession {
  id: string;
  connectionId: string;
  kind: SessionKind;
  title: string;
  /** What the session is attached to, as printed in the terminal banner. */
  target: string;
  status: SessionStatus;
  error?: string;
}
