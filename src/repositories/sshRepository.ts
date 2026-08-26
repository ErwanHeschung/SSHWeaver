import { commands, events } from "@/bindings";
import type { ConnectParams, HostKeyPrompt } from "@/bindings";
import type { EventCallback } from "@tauri-apps/api/event";
import { unwrap } from "./result";

export const sshRepository = {
  connect: (params: ConnectParams) => unwrap(commands.sshConnect(params)),

  authenticatePassword: (sessionId: string, password: string, remember: boolean) =>
    unwrap(commands.sshAuthenticatePassword(sessionId, password, remember)),

  disconnect: (sessionId: string) => commands.sshDisconnect(sessionId),

  hostKeyDecision: (sessionId: string, accept: boolean) =>
    commands.sshHostKeyDecision(sessionId, accept),

  onHostKeyPrompt: (cb: EventCallback<HostKeyPrompt>) =>
    events.hostKeyPrompt.listen(cb),
};
