import { create } from "zustand";
import { storage } from "@services/storage";

export const TERMINAL_FONT_SIZES = [14, 16, 18, 20, 24] as const;

export type TerminalFontSize = (typeof TERMINAL_FONT_SIZES)[number];

export const DEFAULT_TERMINAL_FONT_SIZE: TerminalFontSize = 14;

const STORAGE_KEY = "sshweaver-terminal-font-size";

interface TerminalSettingsState {
  fontSize: TerminalFontSize;
  setFontSize: (fontSize: TerminalFontSize) => void;
}

function isFontSize(value: number): value is TerminalFontSize {
  return (TERMINAL_FONT_SIZES as ReadonlyArray<number>).includes(value);
}

function storedFontSize(): TerminalFontSize {
  const stored = storage.getItem<number>(STORAGE_KEY, DEFAULT_TERMINAL_FONT_SIZE);
  return isFontSize(stored) ? stored : DEFAULT_TERMINAL_FONT_SIZE;
}

export const useTerminalSettingsStore = create<TerminalSettingsState>((set) => ({
  fontSize: storedFontSize(),
  setFontSize: (fontSize) => {
    storage.setItem(STORAGE_KEY, fontSize);
    set({ fontSize });
  },
}));
