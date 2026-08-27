import type { ITheme } from "@xterm/xterm";
import { DEFAULT_ROLE_COLORS, useTerminalSettingsStore } from "@stores/useTerminalSettingsStore";
import type { TerminalRole } from "@stores/useTerminalSettingsStore";

const BRIGHT_MIX = 0.25;

function brighten(hex: string): string {
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
  return channels.reduce((acc, channel) => {
    const lifted = Math.round(channel + (255 - channel) * BRIGHT_MIX);
    return acc + lifted.toString(16).padStart(2, "0");
  }, "#");
}

export function readTerminalTheme(): ITheme {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string) => cs.getPropertyValue(name).trim();

  const { roleColors } = useTerminalSettingsStore.getState();
  const role = (name: TerminalRole) => roleColors[name] ?? DEFAULT_ROLE_COLORS[name];

  return {
    background: v("--bg"),
    foreground: v("--fg"),
    cursor: v("--accent"),
    cursorAccent: v("--bg"),
    selectionBackground: v("--accent-subtle"),

    scrollbarSliderBackground: `${v("--accent")}99`,
    scrollbarSliderHoverBackground: v("--accent"),
    scrollbarSliderActiveBackground: v("--accent-hover"),

    black: "#3b3b46",
    red: role("error"),
    green: role("success"),
    yellow: role("warning"),
    blue: role("info"),
    magenta: "#a78bfa",
    cyan: "#22d3ee",
    white: "#e4e4e7",

    brightBlack: "#6b6b74",
    brightRed: brighten(role("error")),
    brightGreen: brighten(role("success")),
    brightYellow: brighten(role("warning")),
    brightBlue: brighten(role("info")),
    brightMagenta: "#c4b5fd",
    brightCyan: "#67e8f9",
    brightWhite: "#f4f4f5",
  };
}
