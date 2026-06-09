export enum ConnectionStatus {
  Connected = "connected",
  Connecting = "connecting",
  Disconnected = "disconnected",
}

export interface Connection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  status: ConnectionStatus;
  isFavorite: boolean;
}
