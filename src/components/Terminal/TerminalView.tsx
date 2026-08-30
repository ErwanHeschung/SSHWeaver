import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { ClipboardAddon, type IClipboardProvider } from "@xterm/addon-clipboard";
import { SearchAddon } from "@xterm/addon-search";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { WebglAddon } from "@xterm/addon-webgl";
import { openUrl } from "@tauri-apps/plugin-opener";
import "@xterm/xterm/css/xterm.css";
import i18n from "@i18n/index";
import { ConnectionStatus } from "@/types/connection";
import { SessionStatus } from "@/types/session";
import type { TerminalSession } from "@/types/session";
import { useSessionStore } from "@stores/useSessionStore";
import { useTerminalSettingsStore } from "@stores/useTerminalSettingsStore";
import { setConnectionStatus } from "@stores/connectionStatus";
import { terminalRepository } from "@repositories/terminalRepository";
import { readTerminalTheme, roleColor } from "./terminalTheme";
import { TerminalContextMenu } from "./TerminalContextMenu";
import type { TerminalMenuItem } from "./TerminalContextMenu";
import { OutputHighlighter } from "./highlight";

interface TerminalViewProps {
  session: TerminalSession;
  active: boolean;
}

const DIM = "\x1b[90m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";

const clipboardProvider: IClipboardProvider = {
  readText: () => "",
  writeText: () => {},
};

// A terminal has no cut: the buffer is a program's output, not an editable
// document. Only the line being edited can be cut, by walking the shell's own
// cursor to the selection and erasing from there.
function inputSelection(term: Terminal) {
  const range = term.getSelectionPosition();
  const text = term.getSelection();
  const buffer = term.buffer.active;
  const row = buffer.baseY + buffer.cursorY;
  if (!range || !text || range.start.y !== row || range.end.y !== row) return null;
  return { text, steps: range.start.x + text.length - buffer.cursorX };
}

function cutInputSelection(term: Terminal, sessionId: string) {
  const selection = inputSelection(term);
  if (!selection) return;

  const { text, steps } = selection;
  // Erase only once the text is safely on the clipboard.
  void navigator.clipboard.writeText(text).then(() => {
    const move = (steps < 0 ? "\x1b[D" : "\x1b[C").repeat(Math.abs(steps));
    void terminalRepository.write(sessionId, move + "\x7f".repeat(text.length));
    term.clearSelection();
  });
}

function paste(term: Terminal) {
  void navigator.clipboard.readText().then((text) => {
    if (text) term.paste(text);
  });
}

export function TerminalView({ session, active }: Readonly<TerminalViewProps>) {
  const { t } = useTranslation();
  const fontSize = useTerminalSettingsStore((s) => s.fontSize);
  const roleColors = useTerminalSettingsStore((s) => s.roleColors);
  const highlight = useTerminalSettingsStore((s) => s.highlight);
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const searchRef = useRef<SearchAddon | null>(null);
  const highlighterRef = useRef<OutputHighlighter | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);
  const closeMenu = useCallback(() => setMenuAt(null), []);

  const menuItems = (term: Terminal): TerminalMenuItem[] => [
    {
      label: t("terminal.menu.copy"),
      disabled: !term.hasSelection(),
      run: () => {
        void navigator.clipboard.writeText(term.getSelection());
        term.focus();
      },
    },
    {
      label: t("terminal.menu.cut"),
      disabled: !inputSelection(term),
      run: () => {
        cutInputSelection(term, session.id);
        term.focus();
      },
    },
    {
      label: t("terminal.menu.paste"),
      run: () => {
        paste(term);
        term.focus();
      },
    },
  ];

  const findNext = (query: string) => {
    if (query) searchRef.current?.findNext(query);
  };
  const findPrevious = (query: string) => {
    if (query) searchRef.current?.findPrevious(query);
  };
  const closeSearch = () => {
    setSearchOpen(false);
    termRef.current?.clearSelection();
    termRef.current?.focus();
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      fontFamily:
        getComputedStyle(document.documentElement).getPropertyValue("--font-mono") ||
        "monospace",
      fontSize: useTerminalSettingsStore.getState().fontSize,
      cursorBlink: true,
      theme: readTerminalTheme(),
      // registerDecoration, which the output highlighter runs on, throws without this.
      allowProposedApi: true,
    });
    termRef.current = term;
    const fit = new FitAddon();
    fitRef.current = fit;
    term.loadAddon(fit);
    term.loadAddon(new ClipboardAddon(undefined, clipboardProvider));
    term.loadAddon(new WebLinksAddon((_event, uri) => void openUrl(uri)));
    const search = new SearchAddon();
    term.loadAddon(search);
    searchRef.current = search;

    term.open(container);

    try {
      const webgl = new WebglAddon();
      webgl.onContextLoss(() => webgl.dispose());
      term.loadAddon(webgl);
    } catch {
      // WebGL not available — xterm keeps its default renderer.
    }

    fit.fit();

    const highlighter = new OutputHighlighter(term, roleColor);
    highlighterRef.current = highlighter;
    highlighter.setEnabled(useTerminalSettingsStore.getState().highlight);

    term.attachCustomKeyEventHandler((e) => {
      if (e.type !== "keydown") return true;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return true;

      // Ctrl+F / Cmd+F: open the in-terminal search bar.
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        setSearchOpen(true);
        return false;
      }

      if ((e.shiftKey || e.metaKey) && (e.key === "c" || e.key === "C")) {
        if (!term.hasSelection()) return true;
        e.preventDefault();
        const selection = term.getSelection();
        if (selection) void navigator.clipboard.writeText(selection);
        return false;
      }

      if ((e.shiftKey || e.metaKey) && (e.key === "x" || e.key === "X")) {
        if (!term.hasSelection()) return true;
        e.preventDefault();
        cutInputSelection(term, session.id);
        return false;
      }

      if ((e.shiftKey || e.metaKey) && (e.key === "v" || e.key === "V")) {
        e.preventDefault();
        paste(term);
        return false;
      }

      return true;
    });

    term.writeln(
      `${DIM}${i18n.t("terminal.connecting", { target: session.target })}${RESET}`,
    );

    const isConnected = () =>
      useSessionStore.getState().sessions.find((s) => s.id === session.id)
        ?.status === SessionStatus.Connected;

    const onData = term.onData((data) => {
      if (isConnected()) void terminalRepository.write(session.id, data);
    });
    const onResize = term.onResize(({ cols, rows }) => {
      if (isConnected()) void terminalRepository.resize(session.id, cols, rows);
    });

    let disposed = false;
    let unlistenOutput: (() => void) | undefined;
    let unlistenClosed: (() => void) | undefined;

    void (async () => {
      const offOutput = await terminalRepository.onOutput((e) => {
        if (e.payload.sessionId === session.id) {
          term.write(new Uint8Array(e.payload.data));
        }
      });
      const offClosed = await terminalRepository.onClosed((e) => {
        if (e.payload.sessionId !== session.id) return;
        term.writeln(
          e.payload.message
            ? `\r\n${RED}${i18n.t("terminal.connectFailed", { error: e.payload.message })}${RESET}`
            : `\r\n${DIM}${i18n.t("terminal.sessionClosed")}${RESET}`,
        );
        useSessionStore.getState().markClosed(session.id);
        setConnectionStatus(session.kind, session.connectionId, ConnectionStatus.Disconnected);
      });

      if (disposed) {
        offOutput();
        offClosed();
        return;
      }
      unlistenOutput = offOutput;
      unlistenClosed = offClosed;
    })();

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
      disposed = true;
      onData.dispose();
      onResize.dispose();
      unlistenOutput?.();
      unlistenClosed?.();
      resizeObserver.disconnect();
      themeObserver.disconnect();
      highlighter.dispose();
      highlighterRef.current = null;
      term.dispose();
      termRef.current = null;

      const stillOpen = useSessionStore
        .getState()
        .sessions.some((s) => s.id === session.id);
      if (!stillOpen) {
        void terminalRepository.disconnect(session.kind, session.id);
        setConnectionStatus(session.kind, session.connectionId, ConnectionStatus.Disconnected);
      }
    };
  }, [session.id]);

  const prevStatusRef = useRef(session.status);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = session.status;
    if (prev === SessionStatus.Closed && session.status === SessionStatus.Connecting) {
      const term = termRef.current;
      if (!term) return;
      term.reset();
      term.writeln(
        `${DIM}${i18n.t("terminal.connecting", { target: session.target })}${RESET}`,
      );
    }
  }, [session.status, session.target]);

  useEffect(() => {
    if (session.status !== SessionStatus.Connected) return;
    const term = termRef.current;
    if (!term) return;
    void terminalRepository.resize(session.id, term.cols, term.rows);
    if (activeRef.current) term.focus();
  }, [session.status, session.id]);

  useEffect(() => {
    if (session.status === SessionStatus.Closed && session.error) {
      termRef.current?.writeln(
        `\r\n${RED}${i18n.t("terminal.connectFailed", { error: session.error })}${RESET}`,
      );
    }
  }, [session.status, session.error]);

  useEffect(() => {
    if (!active) return;
    const id = requestAnimationFrame(() => fitRef.current?.fit());
    return () => cancelAnimationFrame(id);
  }, [active]);

  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.fontSize = fontSize;
    fitRef.current?.fit();
  }, [fontSize]);

  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.theme = readTerminalTheme();
    highlighterRef.current?.refresh();
  }, [roleColors]);

  useEffect(() => {
    highlighterRef.current?.setEnabled(highlight);
  }, [highlight]);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.select();
  }, [searchOpen]);

  return (
    <div className={`absolute inset-0 p-2 ${active ? "" : "invisible"}`}>
      <div
        ref={containerRef}
        className="isolate h-full w-full"
        onContextMenu={(e) => {
          e.preventDefault();
          setMenuAt({ x: e.clientX, y: e.clientY });
        }}
      />
      {menuAt && termRef.current && (
        <TerminalContextMenu
          x={menuAt.x}
          y={menuAt.y}
          items={menuItems(termRef.current)}
          onClose={closeMenu}
        />
      )}
      {searchOpen && (
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-1 shadow-md">
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              findNext(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (e.shiftKey) findPrevious(searchQuery);
                else findNext(searchQuery);
              } else if (e.key === "Escape") {
                e.preventDefault();
                closeSearch();
              }
            }}
            placeholder={t("terminal.search.placeholder")}
            className="h-7 w-44 rounded bg-transparent px-2 text-sm text-foreground placeholder:text-faint focus:outline-none"
          />
          <button
            type="button"
            onClick={() => findPrevious(searchQuery)}
            title={t("terminal.search.previous")}
            className="cursor-pointer rounded px-1.5 py-0.5 text-muted hover:bg-muted/20 hover:text-foreground"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => findNext(searchQuery)}
            title={t("terminal.search.next")}
            className="cursor-pointer rounded px-1.5 py-0.5 text-muted hover:bg-muted/20 hover:text-foreground"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={closeSearch}
            title={t("terminal.search.close")}
            className="cursor-pointer rounded px-1.5 py-0.5 text-muted hover:bg-muted/20 hover:text-foreground"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
