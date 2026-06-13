import { commands } from "@/bindings";
import type { StoredConnection } from "@/bindings";
import { ConnectionStatus } from "@/types/connection";
import type { Connection } from "@/types/connection";
import type { ConnectionDraft } from "@stores/useConnectionStore";

type CmdResult<T> =
  | { status: "ok"; data: T }
  | { status: "error"; error: string };

async function unwrap<T>(result: Promise<CmdResult<T>>): Promise<T> {
  const res = await result;
  if (res.status === "error") throw new Error(res.error);
  return res.data;
}

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

  remove: (id: string) => unwrap(commands.connectionDelete(id)),
};
