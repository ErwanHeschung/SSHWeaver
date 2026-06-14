import { create } from "zustand";
import { SessionStatus } from "@/types/session";
import type { TerminalSession } from "@/types/session";
import type { Connection } from "@/types/connection";

function pickNeighbor(sessions: TerminalSession[], closingId: string): string | undefined {
  const index = sessions.findIndex((s) => s.id === closingId);
  if (index === -1) return undefined;
  const next = sessions[index + 1] ?? sessions[index - 1];
  return next?.id;
}

interface SessionState {
  sessions: TerminalSession[];
  activeId?: string;

  open: (connection: Connection) => string;
  close: (id: string) => void;
  setActive: (id: string) => void;
  markConnected: (id: string) => void;
  markClosed: (id: string, error?: string) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  activeId: undefined,

  open: (connection) => {
    const existing = get().sessions.find((s) => s.connectionId === connection.id);
    if (existing) {
      set({ activeId: existing.id });
      return existing.id;
    }

    const session: TerminalSession = {
      id: crypto.randomUUID(),
      connectionId: connection.id,
      title: connection.name,
      username: connection.username,
      host: connection.host,
      port: connection.port,
      status: SessionStatus.Connecting,
    };

    set((state) => ({
      sessions: [...state.sessions, session],
      activeId: session.id,
    }));
    return session.id;
  },

  close: (id) =>
    set((state) => {
      const activeId =
        state.activeId === id ? pickNeighbor(state.sessions, id) : state.activeId;
      return {
        sessions: state.sessions.filter((s) => s.id !== id),
        activeId,
      };
    }),

  setActive: (id) => set({ activeId: id }),

  markConnected: (id) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, status: SessionStatus.Connected } : s,
      ),
    })),

  markClosed: (id, error) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, status: SessionStatus.Closed, error } : s,
      ),
    })),
}));
