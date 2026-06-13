import { create } from "zustand";
import { ConnectionStatus } from "@/types/connection";
import type { Connection } from "@/types/connection";
import { useSessionStore } from "@stores/useSessionStore";
import { connectionRepository } from "@repositories/connectionRepository";

export type ConnectionDraft = Pick<
  Connection,
  "name" | "host" | "port" | "username"
>;

interface ConnectionState {
  connections: Connection[];
  selectedId?: string;
  query: string;
  loaded: boolean;

  load: () => Promise<void>;
  select: (id: string) => void;
  setQuery: (query: string) => void;
  setStatus: (id: string, status: ConnectionStatus) => void;
  create: (draft: ConnectionDraft) => Promise<void>;
  update: (id: string, draft: ConnectionDraft) => Promise<void>;
  connect: (connection: Connection) => void;
  remove: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  connections: [],
  selectedId: undefined,
  query: "",
  loaded: false,

  load: async () => {
    const connections = await connectionRepository.list();
    set({ connections, loaded: true });
  },

  select: (id) => set({ selectedId: id }),
  setQuery: (query) => set({ query }),

  setStatus: (id, status) =>
    set((state) => ({
      connections: state.connections.map((c) =>
        c.id === id ? { ...c, status } : c,
      ),
    })),

  create: async (draft) => {
    const created = await connectionRepository.create(draft);
    set((state) => ({
      connections: [...state.connections, created],
    }));
  },

  update: async (id, draft) => {
    const updated = await connectionRepository.update(id, draft);
    // Take the persisted fields as the source of truth, but keep the live status.
    set((state) => ({
      connections: state.connections.map((c) =>
        c.id === id ? { ...updated, status: c.status } : c,
      ),
    }));
  },

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

  remove: async (id) => {
    await connectionRepository.remove(id);
    set((state) => ({
      connections: state.connections.filter((c) => c.id !== id),
    }));
  },

  toggleFavorite: async (id) => {
    const current = get().connections.find((c) => c.id === id);
    if (!current) return;
    const stored = await connectionRepository.setFavorite(id, !current.isFavorite);
    set((state) => ({
      connections: state.connections.map((c) =>
        c.id === id ? { ...c, isFavorite: stored.isFavorite } : c,
      ),
    }));
  },
}));
