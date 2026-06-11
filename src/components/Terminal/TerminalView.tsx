import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import i18n from "@i18n/index";
import { ConnectionStatus } from "@/types/connection";
import type { TerminalSession } from "@/types/session";
import { useConnectionStore } from "@stores/useConnectionStore";
import { useSessionStore } from "@stores/useSessionStore";
import { readTerminalTheme } from "./terminalTheme";

interface TerminalViewProps {
  session: TerminalSession;
  active: boolean;
}

const GREEN = "\x1b[32m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[90m";
const RESET = "\x1b[0m";

export function TerminalView({ session, active }: Readonly<TerminalViewProps>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      fontFamily:
        getComputedStyle(document.documentElement).getPropertyValue("--font-mono") ||
        "monospace",
      fontSize: 13,
      cursorBlink: true,
      theme: readTerminalTheme(),
    });
    const fit = new FitAddon();
    fitRef.current = fit;
    term.loadAddon(fit);
    term.open(container);
    fit.fit();

    const prompt = `${GREEN}${session.username}@${session.host}${RESET}:${CYAN}~${RESET}$ `;
    let line = "";
    let connected = false;

    const runCommand = (cmd: string) => {
      const command = cmd.trim();
      if (command === "clear") {
        term.clear();
        return;
      }
      if (command === "help") {
        term.write(`\r\n${i18n.t("terminal.available")}`);
      } else if (command === "whoami") {
        term.write(`\r\n${session.username}`);
      } else if (command === "hostname") {
        term.write(`\r\n${session.host}`);
      } else if (command === "exit") {
        useSessionStore.getState().close(session.id);
        return;
      } else if (command !== "") {
        term.write(`\r\n${i18n.t("terminal.notFound", { command })}`);
      }
      term.write(`\r\n${prompt}`);
    };

    const onData = term.onData((data) => {
      if (!connected) return;

      for (const ch of data) {
        if (ch === "\r") {
          runCommand(line);
          line = "";
        } else if (ch === "\x7f") {
          if (line.length > 0) {
            line = line.slice(0, -1);
            term.write("\b \b");
          }
        } else if (ch === "\x03") {
          term.write("^C");
          line = "";
          term.write(`\r\n${prompt}`);
        } else if (ch >= " ") {
          line += ch;
          term.write(ch);
        }
      }
    });

    term.writeln(
      `${DIM}${i18n.t("terminal.connecting", { host: session.host, port: session.port })}${RESET}`,
    );
    const handshake = globalThis.setTimeout(() => {
      term.writeln(`${GREEN}${i18n.t("terminal.connected")}${RESET}`);
      term.writeln(`${DIM}${i18n.t("terminal.helpHint")}${RESET}`);
      term.write(`\r\n${prompt}`);
      connected = true;
      useSessionStore.getState().markConnected(session.id);
      useConnectionStore
        .getState()
        .setStatus(session.connectionId, ConnectionStatus.Connected);
      if (activeRef.current) term.focus();
    }, 700);

    const resizeObserver = new ResizeObserver(() => {
      if (activeRef.current) fit.fit();
    });
    resizeObserver.observe(container);

    const themeObserver = new MutationObserver(() => {
      term.options.theme = readTerminalTheme();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => {
      globalThis.clearTimeout(handshake);
      onData.dispose();
      resizeObserver.disconnect();
      themeObserver.disconnect();
      term.dispose();
    };
  }, [session.id]);

  useEffect(() => {
    if (!active) return;
    const id = requestAnimationFrame(() => fitRef.current?.fit());
    return () => cancelAnimationFrame(id);
  }, [active]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 p-2 ${active ? "" : "invisible"}`}
    />
  );
}
