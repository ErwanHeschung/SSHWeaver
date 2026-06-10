import type { ITheme } from "@xterm/xterm";

export function readTerminalTheme(): ITheme {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string) => cs.getPropertyValue(name).trim();

  return {
    background: v("--bg"),
    foreground: v("--fg"),
    cursor: v("--accent"),
    cursorAccent: v("--bg"),
    selectionBackground: v("--accent-subtle"),

    black: "#3b3b46",
    red: "#ef4444",
    green: "#22c55e",
    yellow: "#f59e0b",
    blue: "#60a5fa",
    magenta: "#a78bfa",
    cyan: "#22d3ee",
    white: "#e4e4e7",

    brightBlack: "#6b6b74",
    brightRed: "#f87171",
    brightGreen: "#4ade80",
    brightYellow: "#fbbf24",
    brightBlue: "#93c5fd",
    brightMagenta: "#c4b5fd",
    brightCyan: "#67e8f9",
    brightWhite: "#f4f4f5",
  };
}
