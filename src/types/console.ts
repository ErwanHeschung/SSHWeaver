import type { ConnectionStatus } from "@/types/connection";
import type { SerialSettings } from "@/types/serial";

export interface ConsoleConnection {
  id: string;
  name: string;
  settings: SerialSettings;
  status: ConnectionStatus;
  isFavorite: boolean;
}

export type ConsoleConnectionDraft = Pick<ConsoleConnection, "name" | "settings">;

export const consoleTitle = (connection: ConsoleConnection) =>
  connection.name.trim() || connection.settings.portName;
