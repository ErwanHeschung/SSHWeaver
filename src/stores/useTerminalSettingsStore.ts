import { create } from "zustand";
import { storage } from "@services/storage";

export const TERMINAL_FONT_SIZES = [14, 16, 18, 20, 24] as const;

export type TerminalFontSize = (typeof TERMINAL_FONT_SIZES)[number];

export const DEFAULT_TERMINAL_FONT_SIZE: TerminalFontSize = 14;

export const TERMINAL_ROLES = ["error", "success", "warning", "info"] as const;

export type TerminalRole = (typeof TERMINAL_ROLES)[number];

export const DEFAULT_ROLE_COLORS: Record<TerminalRole, string> = {
  error: "#ef4444",
  success: "#22c55e",
  warning: "#f59e0b",
  info: "#60a5fa",
};

export type TerminalRoleColors = Partial<Record<TerminalRole, string>>;

const FONT_SIZE_KEY = "sshweaver-terminal-font-size";
const ROLE_COLORS_KEY = "sshweaver-terminal-role-colors";
const HIGHLIGHT_KEY = "sshweaver-terminal-highlight";

interface TerminalSettingsState {
  fontSize: TerminalFontSize;
  roleColors: TerminalRoleColors;
  highlight: boolean;
  setFontSize: (fontSize: TerminalFontSize) => void;
  setRoleColor: (role: TerminalRole, color: string) => void;
  resetRoleColors: () => void;
  setHighlight: (highlight: boolean) => void;
}

function isFontSize(value: number): value is TerminalFontSize {
  return (TERMINAL_FONT_SIZES as ReadonlyArray<number>).includes(value);
}

function storedFontSize(): TerminalFontSize {
  const stored = storage.getItem<number>(FONT_SIZE_KEY, DEFAULT_TERMINAL_FONT_SIZE);
  return isFontSize(stored) ? stored : DEFAULT_TERMINAL_FONT_SIZE;
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function storedRoleColors(): TerminalRoleColors {
  const stored = storage.getItem<Record<string, string>>(ROLE_COLORS_KEY, {});
  const roles = TERMINAL_ROLES as ReadonlyArray<string>;
  return Object.fromEntries(
    Object.entries(stored).filter(
      ([role, color]) => roles.includes(role) && HEX_COLOR.test(color),
    ),
  );
}

export const useTerminalSettingsStore = create<TerminalSettingsState>((set) => ({
  fontSize: storedFontSize(),
  roleColors: storedRoleColors(),
  highlight: storage.getItem<boolean>(HIGHLIGHT_KEY, true),

  setFontSize: (fontSize) => {
    storage.setItem(FONT_SIZE_KEY, fontSize);
    set({ fontSize });
  },

  setRoleColor: (role, color) =>
    set((state) => {
      const roleColors = { ...state.roleColors, [role]: color };
      storage.setItem(ROLE_COLORS_KEY, roleColors);
      return { roleColors };
    }),

  resetRoleColors: () => {
    storage.removeItem(ROLE_COLORS_KEY);
    set({ roleColors: {} });
  },

  setHighlight: (highlight) => {
    storage.setItem(HIGHLIGHT_KEY, highlight);
    set({ highlight });
  },
}));
