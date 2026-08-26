import { create } from "zustand";
import { ConnectionStatus } from "@/types/connection";
import { consoleTitle } from "@/types/console";
import type { ConsoleConnection, ConsoleConnectionDraft } from "@/types/console";
import { describeSerial } from "@/types/serial";
import { SessionKind, SessionStatus } from "@/types/session";
import { useSessionStore } from "@stores/useSessionStore";
import { consoleRepository } from "@repositories/consoleRepository";
import { terminalRepository } from "@repositories/terminalRepository";
import { UNLOADED, createListLoader } from "./loadable";
import type { LoadState } from "./loadable";

const withStatus = (
  connections: ConsoleConnection[],
  id: string,
  status: ConnectionStatus,
) => connections.map((c) => (c.id === id ? { ...c, status } : c));

interface ConsoleState extends LoadState {
  connections: ConsoleConnection[];
  selectedId?: string;
  query: string;

  load: () => Promise<void>;
  ensureLoaded: () => Promise<void>;
  select: (id: string) => void;
  setQuery: (query: string) => void;
  setStatus: (id: string, status: ConnectionStatus) => void;
  create: (draft: ConsoleConnectionDraft) => Promise<ConsoleConnection>;
  update: (id: string, draft: ConsoleConnectionDraft) => Promise<void>;
  connect: (connection: ConsoleConnection) => Promise<ConsoleConnectResult>;
  abort: (sessionId: string) => void;
  remove: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
}

export interface ConsoleConnectResult {
  outcome: "connected" | "failed";
  sessionId: string;
  error?: string;
}

export const useConsoleStore = create<ConsoleState>((set, get) => {
  const loader = createListLoader({
    fetch: () => consoleRepository.list(),
    commit: (connections: ConsoleConnection[]) => set({ connections }),
    patch: set,
    isLoaded: () => get().loaded,
  });

  return {
    connections: [],
    selectedId: undefined,
    query: "",
    ...UNLOADED,

    load: loader.load,
    ensureLoaded: loader.ensureLoaded,

    select: (id) => set({ selectedId: id }),
    setQuery: (query) => set({ query }),

    setStatus: (id, status) =>
      set((state) => ({
        connections: withStatus(state.connections, id, status),
      })),

    create: async (draft) => {
      const created = await consoleRepository.create(draft);
      set((state) => ({ connections: [...state.connections, created] }));
      return created;
    },

    update: async (id, draft) => {
      const updated = await consoleRepository.update(id, draft);
      set((state) => ({
        connections: state.connections.map((c) =>
          c.id === id ? { ...updated, status: c.status } : c,
        ),
      }));
    },

    // A serial line has no authentication step: it either opens or it does not.
    connect: async (connection) => {
      const sessions = useSessionStore.getState();
      const existing = sessions.sessions.find((s) => s.connectionId === connection.id);
      if (existing && existing.status !== SessionStatus.Closed) {
        sessions.setActive(existing.id);
        return { outcome: "connected", sessionId: existing.id };
      }

      get().setStatus(connection.id, ConnectionStatus.Connecting);

      let sessionId: string;
      if (existing) {
        sessions.restart(existing.id);
        sessionId = existing.id;
      } else {
        sessionId = sessions.open({
          connectionId: connection.id,
          kind: SessionKind.Console,
          title: consoleTitle(connection),
          target: describeSerial(connection.settings),
        });
      }

      try {
        await consoleRepository.connect({ sessionId, settings: connection.settings });
        useSessionStore.getState().markConnected(sessionId);
        get().setStatus(connection.id, ConnectionStatus.Connected);
        return { outcome: "connected", sessionId };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        useSessionStore.getState().markClosed(sessionId, error);
        get().setStatus(connection.id, ConnectionStatus.Disconnected);
        return { outcome: "failed", sessionId, error };
      }
    },

    abort: (sessionId) => {
      const session = useSessionStore
        .getState()
        .sessions.find((s) => s.id === sessionId);
      useSessionStore.getState().close(sessionId);
      void terminalRepository.disconnect(SessionKind.Console, sessionId);
      if (session) {
        get().setStatus(session.connectionId, ConnectionStatus.Disconnected);
      }
    },

    remove: async (id) => {
      await consoleRepository.remove(id);
      set((state) => ({
        connections: state.connections.filter((c) => c.id !== id),
      }));
    },

    toggleFavorite: async (id) => {
      const current = get().connections.find((c) => c.id === id);
      if (!current) return;
      const stored = await consoleRepository.setFavorite(id, !current.isFavorite);
      set((state) => ({
        connections: state.connections.map((c) =>
          c.id === id ? { ...c, isFavorite: stored.isFavorite } : c,
        ),
      }));
    },
  };
});
