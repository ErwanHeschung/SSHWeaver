import { create } from "zustand";
import { SessionStatus } from "@/types/session";
import type { SessionKind, TerminalSession } from "@/types/session";

function pickNeighbor(sessions: TerminalSession[], closingId: string): string | undefined {
  const index = sessions.findIndex((s) => s.id === closingId);
  if (index === -1) return undefined;
  const next = sessions[index + 1] ?? sessions[index - 1];
  return next?.id;
}

export interface SessionRequest {
  connectionId: string;
  kind: SessionKind;
  title: string;
  target: string;
}

interface SessionState {
  sessions: TerminalSession[];
  activeId?: string;

  open: (request: SessionRequest) => string;
  close: (id: string) => void;
  restart: (id: string) => void;
  setActive: (id: string) => void;
  markConnected: (id: string) => void;
  markClosed: (id: string, error?: string) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  activeId: undefined,

  open: (request) => {
    const existing = get().sessions.find((s) => s.connectionId === request.connectionId);
    if (existing) {
      set({ activeId: existing.id });
      return existing.id;
    }

    const session: TerminalSession = {
      id: crypto.randomUUID(),
      status: SessionStatus.Connecting,
      ...request,
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

  restart: (id) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id
          ? { ...s, status: SessionStatus.Connecting, error: undefined }
          : s,
      ),
      activeId: id,
    })),

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
