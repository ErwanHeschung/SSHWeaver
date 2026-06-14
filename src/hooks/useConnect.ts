import { useCallback } from "react";
import type { Connection } from "@/types/connection";
import { useConnectionStore } from "@stores/useConnectionStore";
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
