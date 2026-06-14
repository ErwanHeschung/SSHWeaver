import { useEffect } from "react";
import { useModalStore } from "@stores/useModalStore";
import { sshRepository } from "@repositories/sshRepository";
import { HostKeyModal } from "@components/Modal/HostKeyModal";

export function useHostKeyPrompts() {
  const openModal = useModalStore((s) => s.open);

  useEffect(() => {
    let disposed = false;
    let off: (() => void) | undefined;

    void (async () => {
      const unlisten = await sshRepository.onHostKeyPrompt((e) => {
        openModal(HostKeyModal, { ...e.payload });
      });
      if (disposed) unlisten();
      else off = unlisten;
    })();

    return () => {
      disposed = true;
      off?.();
    };
  }, [openModal]);
}
