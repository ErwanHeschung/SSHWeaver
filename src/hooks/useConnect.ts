import { useCallback } from "react";
import type { Connection } from "@/types/connection";
import type { ConsoleConnection } from "@/types/console";
import { useConnectionStore } from "@stores/useConnectionStore";
import { useConsoleStore } from "@stores/useConsoleStore";
import { useModalStore } from "@stores/useModalStore";
import { ConnectionPasswordModal } from "@components/Modal/ConnectionPasswordModal";

export function useConnect() {
  const connectAction = useConnectionStore((s) => s.connect);
  const openModal = useModalStore((s) => s.open);

  return useCallback(
    async (connection: Connection) => {
      const { outcome, sessionId } = await connectAction(connection);
      if (outcome === "passwordRequired") {
        openModal(ConnectionPasswordModal, { connection, sessionId });
      }
    },
    [connectAction, openModal],
  );
}

/** A serial line never prompts for credentials; it opens or reports why not. */
export function useConnectConsole() {
  const connectAction = useConsoleStore((s) => s.connect);

  return useCallback(
    async (connection: ConsoleConnection) => {
      await connectAction(connection);
    },
    [connectAction],
  );
}
