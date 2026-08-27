import { ConnectionStatus } from "@/types/connection";
import { SessionKind } from "@/types/session";
import { useConnectionStore } from "./useConnectionStore";
import { useConsoleStore } from "./useConsoleStore";

/** Routes to whichever list owns the connection behind a session. */
export function setConnectionStatus(
  kind: SessionKind,
  connectionId: string,
  status: ConnectionStatus,
) {
  const store = kind === SessionKind.Console ? useConsoleStore : useConnectionStore;
  store.getState().setStatus(connectionId, status);
}
