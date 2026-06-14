import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { useModalStore } from "@stores/useModalStore";
import { sshRepository } from "@repositories/sshRepository";
import { Modal } from "./Modal";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "./buttonStyles";

export interface HostKeyProps {
  sessionId: string;
  host: string;
  port: number;
  fingerprint: string;
  changed: boolean;
}

export function HostKeyModal({
  sessionId,
  host,
  port,
  fingerprint,
  changed,
}: Readonly<HostKeyProps>) {
  const { t } = useTranslation();
  const close = useModalStore((s) => s.close);
  const rejectRef = useRef<HTMLButtonElement>(null);

  const decide = (accept: boolean) => {
    sshRepository.hostKeyDecision(sessionId, accept);
    close();
  };

  return (
    <Modal
      title={t(changed ? "modal.hostKey.changedTitle" : "modal.hostKey.title")}
      onClose={() => decide(false)}
      size="sm"
      initialFocusRef={rejectRef}
      footer={
        <>
          <button
            ref={rejectRef}
            type="button"
            onClick={() => decide(false)}
            className={SECONDARY_BUTTON}
          >
            {t("modal.hostKey.reject")}
          </button>
          <button
            type="button"
            onClick={() => decide(true)}
            className={PRIMARY_BUTTON}
          >
            {t("modal.hostKey.accept")}
          </button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <p className="text-muted">
          {t(changed ? "modal.hostKey.changedMessage" : "modal.hostKey.message", {
            host,
            port,
          })}
        </p>
        {changed && (
          <p className="font-medium text-danger">
            {t("modal.hostKey.changedWarning")}
          </p>
        )}
        <div className="space-y-1">
          <span className="text-xs font-medium text-muted">
            {t("modal.hostKey.fingerprint")}
          </span>
          <code className="block break-all rounded-md border border-border bg-background px-2.5 py-2 text-xs text-foreground">
            {fingerprint}
          </code>
        </div>
        <p className="text-xs text-faint">
          {t(changed ? "modal.hostKey.changedHint" : "modal.hostKey.hint")}
        </p>
      </div>
    </Modal>
  );
}
