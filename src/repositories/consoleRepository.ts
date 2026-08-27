import { commands } from "@/bindings";
import type { ConsoleParams, StoredConsoleConnection } from "@/bindings";
import { ConnectionStatus } from "@/types/connection";
import type { ConsoleConnection, ConsoleConnectionDraft } from "@/types/console";
import { unwrap } from "./result";

const toConnection = (stored: StoredConsoleConnection): ConsoleConnection => ({
  ...stored,
  status: ConnectionStatus.Disconnected,
});

export const consoleRepository = {
  list: async () =>
    (await unwrap(commands.consoleConnectionsList())).map(toConnection),

  create: async (draft: ConsoleConnectionDraft) =>
    toConnection(await unwrap(commands.consoleConnectionCreate(draft))),

  update: async (id: string, draft: ConsoleConnectionDraft) =>
    toConnection(await unwrap(commands.consoleConnectionUpdate(id, draft))),

  setFavorite: async (id: string, isFavorite: boolean) =>
    toConnection(await unwrap(commands.consoleConnectionSetFavorite(id, isFavorite))),

  markUsed: async (id: string) =>
    toConnection(await unwrap(commands.consoleConnectionMarkUsed(id))),

  remove: (id: string) => unwrap(commands.consoleConnectionDelete(id)),

  listPorts: () => unwrap(commands.consoleListPorts()),

  connect: (params: ConsoleParams) => unwrap(commands.consoleConnect(params)),

  disconnect: (sessionId: string) => commands.consoleDisconnect(sessionId),
};
