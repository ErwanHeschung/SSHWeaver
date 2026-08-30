import { create } from "zustand";
import { ConnectionStatus } from "@/types/connection";
import { sshEndpoint } from "@/types/connection";
import type { Connection } from "@/types/connection";
import { SessionKind, SessionStatus } from "@/types/session";
import { useSessionStore } from "@stores/useSessionStore";
import { connectionRepository } from "@repositories/connectionRepository";
import { sshRepository } from "@repositories/sshRepository";
import { terminalRepository } from "@repositories/terminalRepository";
import { UNLOADED, createListLoader } from "./loadable";
import type { LoadState } from "./loadable";

export type ConnectionDraft = Pick<
  Connection,
  "name" | "host" | "port" | "username" | "profileId" | "allowLegacyAlgorithms"
>;

const withStatus = (
  connections: Connection[],
  id: string,
  status: ConnectionStatus,
) => connections.map((c) => (c.id === id ? { ...c, status } : c));

interface ConnectionState extends LoadState {
  connections: Connection[];
  selectedId?: string;
  query: string;

  load: () => Promise<void>;
  ensureLoaded: () => Promise<void>;
  select: (id: string) => void;
  setQuery: (query: string) => void;
  setStatus: (id: string, status: ConnectionStatus) => void;
  create: (draft: ConnectionDraft) => Promise<Connection>;
  update: (id: string, draft: ConnectionDraft) => Promise<void>;
  applyProfileUpdate: (profileId: string, username: string) => void;
  applyProfileRemoval: (profileId: string) => void;
  connect: (connection: Connection) => Promise<ConnectResult>;
  authenticatePassword: (
    connection: Connection,
    sessionId: string,
    password: string,
    remember: boolean,
  ) => Promise<PasswordAuthResult>;
  abort: (sessionId: string) => void;
  remove: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
}

export interface ConnectResult {
  outcome: "connected" | "passwordRequired" | "failed";
  sessionId: string;
}

export type PasswordAuthResult =
  | { status: "authenticated" }
  | { status: "failed"; attemptsRemaining: number }
  | { status: "lockedOut" }
  | { status: "error"; message: string };

export const useConnectionStore = create<ConnectionState>((set, get) => {
  const loader = createListLoader({
    fetch: () => connectionRepository.list(),
    commit: (connections: Connection[]) => set({ connections }),
    patch: set,
    isLoaded: () => get().loaded,
  });

  // Failing to stamp a usage must not sink a session that opened fine.
  const markUsed = (id: string) =>
    void connectionRepository
      .markUsed(id)
      .then((stored) =>
        set((state) => ({
          connections: state.connections.map((c) =>
            c.id === id ? { ...c, lastUsedAt: stored.lastUsedAt } : c,
          ),
        })),
      )
      .catch(() => {});

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
      const created = await connectionRepository.create(draft);
      set((state) => ({
        connections: [...state.connections, created],
      }));
      return created;
    },

    update: async (id, draft) => {
      const updated = await connectionRepository.update(id, draft);
      set((state) => ({
        connections: state.connections.map((c) =>
          c.id === id ? { ...updated, status: c.status } : c,
        ),
      }));
    },

    // Patched in place, not reloaded: load() would drop every session's status.
    applyProfileUpdate: (profileId, username) =>
      set((state) => ({
        connections: state.connections.map((c) =>
          c.profileId === profileId ? { ...c, username } : c,
        ),
      })),

    applyProfileRemoval: (profileId) =>
      set((state) => ({
        connections: state.connections.map((c) =>
          c.profileId === profileId ? { ...c, profileId: null } : c,
        ),
      })),

    connect: async (connection) => {
      const sessions = useSessionStore.getState();
      const existing = sessions.sessions.find(
        (s) => s.connectionId === connection.id,
      );
      if (existing && existing.status !== SessionStatus.Closed) {
        sessions.setActive(existing.id);
        return { outcome: "connected", sessionId: existing.id };
      }

      set((state) => ({
        connections: withStatus(
          state.connections,
          connection.id,
          ConnectionStatus.Connecting,
        ),
      }));
      let sessionId: string;
      if (existing) {
        sessions.restart(existing.id);
        sessionId = existing.id;
      } else {
        sessionId = sessions.open({
          connectionId: connection.id,
          kind: SessionKind.Ssh,
          title: connection.name.trim() || sshEndpoint(connection),
          target: sshEndpoint(connection),
        });
      }

      try {
        const outcome = await sshRepository.connect({
          sessionId,
          connectionId: connection.id,
          host: connection.host,
          port: connection.port,
          username: connection.username,
          profileId: connection.profileId,
          allowLegacyAlgorithms: connection.allowLegacyAlgorithms,
          cols: 80,
          rows: 24,
        });
        if (outcome === "connected") {
          useSessionStore.getState().markConnected(sessionId);
          get().setStatus(connection.id, ConnectionStatus.Connected);
          markUsed(connection.id);
          return { outcome: "connected", sessionId };
        }
        return { outcome: "passwordRequired", sessionId };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        useSessionStore.getState().markClosed(sessionId, message);
        get().setStatus(connection.id, ConnectionStatus.Disconnected);
        return { outcome: "failed", sessionId };
      }
    },

    authenticatePassword: async (connection, sessionId, password, remember) => {
      try {
        const outcome = await sshRepository.authenticatePassword(
          sessionId,
          password,
          remember,
        );
        if (outcome === "authenticated") {
          useSessionStore.getState().markConnected(sessionId);
          get().setStatus(connection.id, ConnectionStatus.Connected);
          markUsed(connection.id);
          return { status: "authenticated" };
        }
        if (outcome === "lockedOut") {
          // Backend already closed the connection; reflect it locally.
          useSessionStore.getState().markClosed(sessionId);
          get().setStatus(connection.id, ConnectionStatus.Disconnected);
          return { status: "lockedOut" };
        }
        // { failed: attemptsRemaining } — wrong password, retry still allowed.
        return { status: "failed", attemptsRemaining: outcome.failed };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        useSessionStore.getState().markClosed(sessionId, message);
        get().setStatus(connection.id, ConnectionStatus.Disconnected);
        return { status: "error", message };
      }
    },

    abort: (sessionId) => {
      const session = useSessionStore
        .getState()
        .sessions.find((s) => s.id === sessionId);
      useSessionStore.getState().close(sessionId);
      void terminalRepository.disconnect(SessionKind.Ssh, sessionId);
      if (session) {
        get().setStatus(session.connectionId, ConnectionStatus.Disconnected);
      }
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
  };
});
