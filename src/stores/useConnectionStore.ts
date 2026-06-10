import { create } from "zustand";
import { ConnectionStatus } from "@/types/connection";
import type { Connection } from "@/types/connection";
import { useSessionStore } from "@stores/useSessionStore";

const STATUSES = Object.values(ConnectionStatus);

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
  add: () => void;
  connect: (connection: Connection) => void;
  edit: (connection: Connection) => void;
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

  // TODO: wire to the Tauri backend (invoke) once the SSH layer exists.
  add: () => console.log("add connection"),
  edit: (connection) => console.log("edit", connection.id),

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
