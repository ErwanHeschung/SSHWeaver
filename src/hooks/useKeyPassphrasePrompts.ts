import { useEffect } from "react";
import { useModalStore } from "@stores/useModalStore";
import { sshRepository } from "@repositories/sshRepository";
import { KeyPassphraseModal } from "@components/Modal/KeyPassphraseModal";

export function useKeyPassphrasePrompts() {
  const openModal = useModalStore((s) => s.open);

  useEffect(() => {
    let disposed = false;
    let off: (() => void) | undefined;

    void (async () => {
      const unlisten = await sshRepository.onKeyPassphrasePrompt((e) => {
        openModal(KeyPassphraseModal, { ...e.payload });
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
