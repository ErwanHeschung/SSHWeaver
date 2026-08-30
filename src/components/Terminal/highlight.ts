import type { IDecoration, IDisposable, IMarker, Terminal } from "@xterm/xterm";
import type { TerminalRole } from "@stores/useTerminalSettingsStore";

interface Rule {
  role: TerminalRole;
  pattern: RegExp;
}

interface Match {
  start: number;
  end: number;
  role: TerminalRole;
}

const OCTET = "(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";

// Order is precedence: a MAC address also matches the IPv6 shape.
const RULES: readonly Rule[] = [
  {
    role: "info",
    pattern: /\b(?:[0-9a-f]{2}:){5}[0-9a-f]{2}\b|\b[0-9a-f]{4}(?:\.[0-9a-f]{4}){2}\b/gi,
  },
  {
    role: "info",
    pattern: new RegExp(`\\b${OCTET}(?:\\.${OCTET}){3}(?:/\\d{1,2})?\\b`, "g"),
  },
  {
    role: "info",
    pattern:
      /(?:(?:[0-9a-f]{1,4}:){1,7}:(?:[0-9a-f]{1,4}(?::[0-9a-f]{1,4}){0,6})?|::(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4}|(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4})(?:\/\d{1,3})?/gi,
  },
  {
    role: "success",
    pattern:
      /\b(?:up|ok|active|established|connected|enabled|permit|permitted|success|succeeded|allowed|running|reachable|valid)\b/gi,
  },
  {
    role: "error",
    pattern:
      /\b(?:down|err|error|errors|fail|failed|failure|denied|deny|dropped|critical|crit|alert|unreachable|refused|timeout|invalid|notconnect|disconnected)\b/gi,
  },
  {
    role: "warning",
    pattern:
      /\b(?:warn|warning|notice|disabled|shutdown|degraded|partial|inactive|pending|deprecated)\b/gi,
  },
];

function scanLine(text: string): Match[] {
  const found: Match[] = [];
  for (const { role, pattern } of RULES) {
    pattern.lastIndex = 0;
    let match = pattern.exec(text);
    while (match) {
      const start = match.index;
      const end = start + match[0].length;
      const overlaps = found.some((other) => start < other.end && end > other.start);
      if (!overlaps) found.push({ start, end, role });
      match = pattern.exec(text);
    }
  }
  return found;
}

const MAX_SCAN_LINES = 400;
const MAX_DECORATIONS = 1500;

export class OutputHighlighter {
  readonly #term: Terminal;
  readonly #colorFor: (role: TerminalRole) => string;
  readonly #onWriteParsed: IDisposable;
  #decorations: IDecoration[] = [];
  // A marker, not a line number: once the scrollback is full, lines shift up
  // under a fixed `baseY`.
  #scanned: IMarker | undefined;
  #enabled = false;

  constructor(term: Terminal, colorFor: (role: TerminalRole) => string) {
    this.#term = term;
    this.#colorFor = colorFor;
    this.#onWriteParsed = term.onWriteParsed(() => this.#scan());
  }

  setEnabled(enabled: boolean) {
    if (enabled === this.#enabled) return;
    this.#enabled = enabled;
    if (enabled) this.#scan();
    else this.#reset();
  }

  refresh() {
    if (!this.#enabled) return;
    this.#reset();
    this.#scan();
  }

  dispose() {
    this.#onWriteParsed.dispose();
    this.#reset();
  }

  #reset() {
    for (const decoration of this.#decorations) decoration.dispose();
    this.#decorations = [];
    this.#scanned?.dispose();
    this.#scanned = undefined;
  }

  #scan() {
    const buffer = this.#term.buffer.active;
    // A full-screen program repaints in place, so decorations there go stale.
    if (!this.#enabled || buffer.type === "alternate") return;

    const cursor = buffer.baseY + buffer.cursorY;
    // A disposed marker reports line -1, same as never having scanned.
    const scanned = this.#scanned?.line ?? -1;

    let from: number;
    if (scanned >= cursor) {
      // The cursor went back up: those lines are about to be rewritten, and
      // the ones above are already decorated, so they must not be rescanned.
      this.#dropFrom(cursor);
      from = cursor;
    } else if (scanned >= 0) {
      from = scanned + 1;
    } else {
      from = cursor - MAX_SCAN_LINES;
    }

    for (let line = Math.max(0, from, cursor - MAX_SCAN_LINES); line < cursor; line++) {
      this.#decorateLine(line, cursor);
    }

    this.#scanned?.dispose();
    this.#scanned = cursor > 0 ? this.#term.registerMarker(-1) : undefined;
    this.#trim();
  }

  #decorateLine(line: number, cursor: number) {
    const text = this.#term.buffer.active.getLine(line)?.translateToString(true);
    if (!text) return;

    for (const { start, end, role } of scanLine(text)) {
      // Column and string index only line up for single-cell characters.
      const marker = this.#term.registerMarker(line - cursor);
      const decoration = this.#term.registerDecoration({
        marker,
        x: start,
        width: end - start,
        foregroundColor: this.#colorFor(role),
        layer: "bottom",
      });
      if (decoration) this.#decorations.push(decoration);
      else marker.dispose();
    }
  }

  #dropFrom(line: number) {
    this.#decorations = this.#decorations.filter((decoration) => {
      if (decoration.marker.line < line) return true;
      decoration.dispose();
      return false;
    });
  }

  #trim() {
    this.#decorations = this.#decorations.filter((decoration) => {
      if (decoration.marker.line >= 0) return true;
      decoration.dispose();
      return false;
    });
    const excess = this.#decorations.length - MAX_DECORATIONS;
    if (excess <= 0) return;
    for (const decoration of this.#decorations.splice(0, excess)) decoration.dispose();
  }
}
