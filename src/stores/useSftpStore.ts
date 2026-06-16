import { create } from "zustand";
import type { SftpEntry } from "@/bindings";
import { sftpRepository } from "@repositories/sftpRepository";

export type SftpViewMode = "terminal" | "files";

export interface SftpNode {
  id: string;
  name: string;
  kind: SftpEntry["kind"];
  size: number;
  modified: number | null;
  mode: number | null;
  children: SftpNode[] | null;
}

interface SftpTree {
  root?: string;
  nodes: SftpNode[];
  loading: boolean;
  error?: string;
  loaded: Set<string>;
}

interface SftpState {
  modes: Record<string, SftpViewMode>;
  trees: Record<string, SftpTree>;

  setMode: (sessionId: string, mode: SftpViewMode) => void;

  ensureLoaded: (sessionId: string) => Promise<void>;
  loadChildren: (sessionId: string, path: string) => Promise<void>;
  reload: (sessionId: string, path: string) => Promise<void>;
  refresh: (sessionId: string) => Promise<void>;
  reset: (sessionId: string) => void;
}

function entryToNode(entry: SftpEntry): SftpNode {
  return {
    id: entry.path,
    name: entry.name,
    kind: entry.kind,
    size: entry.size ?? 0,
    modified: entry.modified,
    mode: entry.mode,
    children: entry.kind === "dir" || entry.kind === "symlink" ? [] : null,
  };
}

function sortNodes(a: SftpNode, b: SftpNode): number {
  const aDir = a.children !== null;
  const bDir = b.children !== null;
  if (aDir !== bDir) return aDir ? -1 : 1;
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

function toNodes(entries: SftpEntry[]): SftpNode[] {
  return entries.map(entryToNode).sort(sortNodes);
}

function setChildrenAt(nodes: SftpNode[], path: string, children: SftpNode[]): SftpNode[] {
  return nodes.map((node) => {
    if (node.id === path) return { ...node, children };
    if (node.children) return { ...node, children: setChildrenAt(node.children, path, children) };
    return node;
  });
}

export const useSftpStore = create<SftpState>((set, get) => ({
  modes: {},
  trees: {},

  setMode: (sessionId, mode) =>
    set((state) => ({ modes: { ...state.modes, [sessionId]: mode } })),

  ensureLoaded: async (sessionId) => {
    if (get().trees[sessionId]) return;
    set((state) => ({
      trees: { ...state.trees, [sessionId]: { nodes: [], loading: true, loaded: new Set() } },
    }));
    try {
      const root = await sftpRepository.homeDir(sessionId);
      const entries = await sftpRepository.readDir(sessionId, root);
      set((state) => ({
        trees: {
          ...state.trees,
          [sessionId]: { root, nodes: toNodes(entries), loading: false, loaded: new Set([root]) },
        },
      }));
    } catch (e) {
      set((state) => ({
        trees: {
          ...state.trees,
          [sessionId]: { nodes: [], loading: false, error: String(e), loaded: new Set() },
        },
      }));
    }
  },

  loadChildren: async (sessionId, path) => {
    const tree = get().trees[sessionId];
    if (!tree || tree.loaded.has(path)) return;
    try {
      const entries = await sftpRepository.readDir(sessionId, path);
      set((state) => {
        const current = state.trees[sessionId];
        if (!current) return state;
        const loaded = new Set(current.loaded);
        loaded.add(path);
        return {
          trees: {
            ...state.trees,
            [sessionId]: {
              ...current,
              nodes: setChildrenAt(current.nodes, path, toNodes(entries)),
              loaded,
            },
          },
        };
      });
    } catch (e) {
      set((state) => {
        const current = state.trees[sessionId];
        if (!current) return state;
        return { trees: { ...state.trees, [sessionId]: { ...current, error: String(e) } } };
      });
    }
  },

  reload: async (sessionId, path) => {
    const tree = get().trees[sessionId];
    if (!tree) return;
    if (path === tree.root) {
      await get().refresh(sessionId);
      return;
    }
    set((state) => {
      const current = state.trees[sessionId];
      if (!current) return state;
      const loaded = new Set(current.loaded);
      loaded.delete(path);
      return { trees: { ...state.trees, [sessionId]: { ...current, loaded } } };
    });
    await get().loadChildren(sessionId, path);
  },

  refresh: async (sessionId) => {
    set((state) => {
      const { [sessionId]: _, ...rest } = state.trees;
      return { trees: rest };
    });
    await get().ensureLoaded(sessionId);
  },

  reset: (sessionId) =>
    set((state) => {
      const { [sessionId]: _t, ...trees } = state.trees;
      const { [sessionId]: _m, ...modes } = state.modes;
      return { trees, modes };
    }),
}));
