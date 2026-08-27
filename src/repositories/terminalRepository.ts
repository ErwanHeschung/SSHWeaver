import { commands, events } from "@/bindings";
import type { TerminalClosed, TerminalOutput } from "@/bindings";
import type { EventCallback } from "@tauri-apps/api/event";
import { SessionKind } from "@/types/session";

export const terminalRepository = {
  write: (sessionId: string, data: string) => commands.terminalWrite(sessionId, data),

  resize: (sessionId: string, cols: number, rows: number) =>
    commands.terminalResize(sessionId, cols, rows),

  onOutput: (cb: EventCallback<TerminalOutput>) => events.terminalOutput.listen(cb),

  onClosed: (cb: EventCallback<TerminalClosed>) => events.terminalClosed.listen(cb),

  // Closing is transport-specific: an SSH session may also have a
  // half-finished authentication to abandon.
  disconnect: (kind: SessionKind, sessionId: string) =>
    kind === SessionKind.Ssh
      ? commands.sshDisconnect(sessionId)
      : commands.consoleDisconnect(sessionId),
};
