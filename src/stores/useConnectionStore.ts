import { create } from "zustand";
import { ConnectionStatus } from "@/types/connection";
import type { Connection } from "@/types/connection";
import { useSessionStore } from "@stores/useSessionStore";

const STATUSES = Object.values(ConnectionStatus);

export type ConnectionDraft = Pick<
  Connection,
  "name" | "host" | "port" | "username"
>;

const SEED: Connection[] = Array.from({ length: 500 }, (_, i) => ({
  id: String(i),
  name: `server-${i.toString().padStart(3, "0")}`,
  host: `10.0.${Math.floor(i / 256)}.${i % 256}`,
  port: 22,
  username: "root",
  status: STATUSES[i % STATUSES.length]!,
  isFavorite: i % 7 === 0,
}));

interface ConnectionState {
  connections: Connection[];
  selectedId?: string;
  query: string;

  select: (id: string) => void;
  setQuery: (query: string) => void;
  setStatus: (id: string, status: ConnectionStatus) => void;
  create: (draft: ConnectionDraft) => void;
  update: (id: string, draft: ConnectionDraft) => void;
  connect: (connection: Connection) => void;
  remove: (id: string) => void;
  toggleFavorite: (id: string) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  connections: SEED,
  selectedId: undefined,
  query: "",

  select: (id) => set({ selectedId: id }),
  setQuery: (query) => set({ query }),

  setStatus: (id, status) =>
    set((state) => ({
      connections: state.connections.map((c) =>
        c.id === id ? { ...c, status } : c,
      ),
    })),

  // TODO: persist create/update/remove via the Tauri backend once it exists.
  create: (draft) =>
    set((state) => ({
      connections: [
        ...state.connections,
        {
          ...draft,
          id: crypto.randomUUID(),
          status: ConnectionStatus.Disconnected,
          isFavorite: false,
        },
      ],
    })),

  update: (id, draft) =>
    set((state) => ({
      connections: state.connections.map((c) =>
        c.id === id ? { ...c, ...draft } : c,
      ),
    })),

  connect: (connection) => {
    set((state) => ({
      connections: state.connections.map((c) =>
        c.id === connection.id
          ? { ...c, status: ConnectionStatus.Connecting }
          : c,
      ),
    }));
    useSessionStore.getState().open(connection);
  },

  remove: (id) =>
    set((state) => ({
      connections: state.connections.filter((c) => c.id !== id),
    })),

  toggleFavorite: (id) =>
    set((state) => ({
      connections: state.connections.map((c) =>
        c.id === id ? { ...c, isFavorite: !c.isFavorite } : c,
      ),
    })),
}));
