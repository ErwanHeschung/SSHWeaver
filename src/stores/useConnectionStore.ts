import { create } from "zustand";
import { ConnectionStatus } from "@/types/connection";
import type { Connection } from "@/types/connection";

const STATUSES = Object.values(ConnectionStatus);

// Placeholder seed until connections are loaded from storage / the backend.
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

  select: (id: string) => void;
  connect: (connection: Connection) => void;
  edit: (connection: Connection) => void;
  remove: (id: string) => void;
  toggleFavorite: (id: string) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  connections: SEED,
  selectedId: undefined,

  select: (id) => set({ selectedId: id }),

  // TODO: wire to the Tauri backend (invoke) once the SSH layer exists.
  connect: (connection) => console.log("connect", connection.id),
  edit: (connection) => console.log("edit", connection.id),

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
