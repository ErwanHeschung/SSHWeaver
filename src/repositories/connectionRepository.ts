import { commands } from "@/bindings";
import type { StoredConnection } from "@/bindings";
import { ConnectionStatus } from "@/types/connection";
import type { Connection } from "@/types/connection";
import type { ConnectionDraft } from "@stores/useConnectionStore";
import { unwrap } from "./result";

const toConnection = (stored: StoredConnection): Connection => ({
  ...stored,
  status: ConnectionStatus.Disconnected,
});

export const connectionRepository = {
  list: async () =>
    (await unwrap(commands.connectionsList())).map((c) => toConnection(c)),

  create: async (draft: ConnectionDraft) =>
    toConnection(await unwrap(commands.connectionCreate(draft))),

  update: async (id: string, draft: ConnectionDraft) =>
    toConnection(await unwrap(commands.connectionUpdate(id, draft))),

  setFavorite: async (id: string, isFavorite: boolean) =>
    toConnection(await unwrap(commands.connectionSetFavorite(id, isFavorite))),

  markUsed: async (id: string) =>
    toConnection(await unwrap(commands.connectionMarkUsed(id))),

  remove: (id: string) => unwrap(commands.connectionDelete(id)),
};
