import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { INPUT_CLASS } from "@components/Form/fieldStyles";
import { useModalStore } from "@stores/useModalStore";
import { sshRepository } from "@repositories/sshRepository";
import { Modal } from "./Modal";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "./buttonStyles";

export interface KeyPassphraseProps {
  sessionId: string;
  path: string;
  retry: boolean;
}

export function KeyPassphraseModal({
  sessionId,
  path,
  retry,
}: Readonly<KeyPassphraseProps>) {
  const { t } = useTranslation();
  const close = useModalStore((s) => s.close);
  const formId = useId();
  const passphraseRef = useRef<HTMLInputElement>(null);
  const [passphrase, setPassphrase] = useState("");
  const [remember, setRemember] = useState(true);

  const answer = (value: string | null) => {
    sshRepository.keyPassphrase(sessionId, value, remember);
    close();
  };

  return (
    <Modal
      title={t("modal.keyPassphrase.title")}
      onClose={() => answer(null)}
      size="sm"
      initialFocusRef={passphraseRef}
      footer={
        <>
          <button
            type="button"
            onClick={() => answer(null)}
            className={SECONDARY_BUTTON}
          >
            {t("modal.keyPassphrase.skip")}
          </button>
          <button type="submit" form={formId} className={PRIMARY_BUTTON}>
            {t("modal.keyPassphrase.unlock")}
          </button>
        </>
      }
    >
      <form
        id={formId}
        onSubmit={(e) => {
          e.preventDefault();
          answer(passphrase);
        }}
        className="space-y-3"
      >
        <p className="text-sm text-muted">{t("modal.keyPassphrase.message")}</p>
        <p className="break-all font-mono text-xs text-foreground">{path}</p>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted">
            {t("modal.keyPassphrase.label")}
          </span>
          <input
            ref={passphraseRef}
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            autoComplete="off"
            className={INPUT_CLASS}
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-border accent-accent"
          />
          {t("modal.keyPassphrase.remember")}
        </label>
        {retry && (
          <p className="text-xs text-danger">{t("modal.keyPassphrase.failed")}</p>
        )}
        <p className="text-xs text-faint">{t("modal.keyPassphrase.hint")}</p>
      </form>
    </Modal>
  );
}
