import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { useModalStore } from "@stores/useModalStore";
import { Modal } from "./Modal";
import { DANGER_BUTTON, PRIMARY_BUTTON, SECONDARY_BUTTON } from "./buttonStyles";

export interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
}

export function ConfirmModal({
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger = false,
  onConfirm,
}: Readonly<ConfirmModalProps>) {
  const { t } = useTranslation();
  const close = useModalStore((s) => s.close);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const handleConfirm = () => {
    onConfirm();
    close();
  };

  return (
    <Modal
      title={title}
      onClose={close}
      size="sm"
      initialFocusRef={confirmRef}
      footer={
        <>
          <button type="button" onClick={close} className={SECONDARY_BUTTON}>
            {cancelLabel ?? t("modal.cancel")}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={handleConfirm}
            className={danger ? DANGER_BUTTON : PRIMARY_BUTTON}
          >
            {confirmLabel ?? t("modal.confirm")}
          </button>
        </>
      }
    >
      <p className="text-sm text-muted">{message}</p>
    </Modal>
  );
}
