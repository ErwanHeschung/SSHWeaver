import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { storage } from "@services/storage";

export enum ThemeMode {
  Light = "light",
  Dark = "dark",
  System = "system",
}

export enum ResolvedTheme {
  Light = "light",
  Dark = "dark",
}

interface ThemeContextValue {
  mode: ThemeMode;
  theme: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = "sshweaver-theme";

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getSystemTheme(): ResolvedTheme {
  return globalThis.matchMedia("(prefers-color-scheme: dark)").matches
    ? ResolvedTheme.Dark
    : ResolvedTheme.Light;
}

function getStoredMode(): ThemeMode {
  const stored = storage.getItem<ThemeMode>(STORAGE_KEY, ThemeMode.System);
  if (
    stored === ThemeMode.Light ||
    stored === ThemeMode.Dark ||
    stored === ThemeMode.System
  ) {
    return stored;
  }
  return ThemeMode.System;
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === ThemeMode.System) return getSystemTheme();
  return mode === ThemeMode.Dark ? ResolvedTheme.Dark : ResolvedTheme.Light;
}

export function ThemeProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [mode, setMode] = useState<ThemeMode>(getStoredMode);
  const [theme, setTheme] = useState<ResolvedTheme>(() => resolveTheme(getStoredMode()));

  useEffect(() => {
    storage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    setTheme(resolveTheme(mode));

    if (mode !== ThemeMode.System) return;

    const media = globalThis.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setTheme(getSystemTheme());
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [mode]);

  useEffect(() => {
    document.documentElement.dataset["theme"] = theme;
  }, [theme]);

  const toggleTheme = useCallback(
    () =>
      setMode(theme === ResolvedTheme.Dark ? ThemeMode.Light : ThemeMode.Dark),
    [theme],
  );

  const value = useMemo(
    () => ({ mode, theme, setMode, toggleTheme }),
    [mode, theme, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
