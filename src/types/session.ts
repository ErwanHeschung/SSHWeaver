export enum SessionStatus {
  Connecting = "connecting",
  Connected = "connected",
  Closed = "closed",
}

export interface TerminalSession {
  id: string;
  connectionId: string;
  title: string;
  username: string;
  host: string;
  port: number;
  status: SessionStatus;
  error?: string;
}
