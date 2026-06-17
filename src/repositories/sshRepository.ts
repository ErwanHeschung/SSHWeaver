import { commands, events } from "@/bindings";
import type {
  ConnectParams,
  HostKeyPrompt,
  SshClosed,
  SshOutput,
} from "@/bindings";
import type { EventCallback } from "@tauri-apps/api/event";
import { unwrap } from "./result";

export const sshRepository = {
  connect: (params: ConnectParams) => unwrap(commands.sshConnect(params)),

  authenticatePassword: (sessionId: string, password: string, remember: boolean) =>
    unwrap(commands.sshAuthenticatePassword(sessionId, password, remember)),

  write: (sessionId: string, data: string) => commands.sshWrite(sessionId, data),

  resize: (sessionId: string, cols: number, rows: number) =>
    commands.sshResize(sessionId, cols, rows),

  disconnect: (sessionId: string) => commands.sshDisconnect(sessionId),

  hostKeyDecision: (sessionId: string, accept: boolean) =>
    commands.sshHostKeyDecision(sessionId, accept),

  onHostKeyPrompt: (cb: EventCallback<HostKeyPrompt>) =>
    events.hostKeyPrompt.listen(cb),

  onOutput: (cb: EventCallback<SshOutput>) => events.sshOutput.listen(cb),

  onClosed: (cb: EventCallback<SshClosed>) => events.sshClosed.listen(cb),
};
