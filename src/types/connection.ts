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
  profileId: string | null;
  status: ConnectionStatus;
  isFavorite: boolean;
  lastUsedAt: string | null;
}

export const sshEndpoint = ({
  username,
  host,
  port,
}: Pick<Connection, "username" | "host" | "port">) => `${username}@${host}:${port}`;
