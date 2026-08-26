import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Connection } from "@/types/connection";
import { INPUT_CLASS } from "@components/Form/fieldStyles";
import { useModalStore } from "@stores/useModalStore";
import { useConnectionStore } from "@stores/useConnectionStore";
import { useProfileStore } from "@stores/useProfileStore";
import { Modal } from "./Modal";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "./buttonStyles";

export interface ConnectionPasswordProps {
  connection: Connection;
  sessionId: string;
}

export function ConnectionPasswordModal({
  connection,
  sessionId,
}: Readonly<ConnectionPasswordProps>) {
  const { t } = useTranslation();
  const close = useModalStore((s) => s.close);
  const authenticatePassword = useConnectionStore((s) => s.authenticatePassword);
  const abort = useConnectionStore((s) => s.abort);
  const profile = useProfileStore((s) =>
    s.profiles.find((p) => p.id === connection.profileId),
  );

  // Names the profile the saved password belongs to; the list may not be loaded.
  useEffect(() => {
    if (connection.profileId) void useProfileStore.getState().ensureLoaded();
  }, [connection.profileId]);

  const formId = useId();
  const passwordRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [lockedOut, setLockedOut] = useState(false);

  const submit = async () => {
    if (submitting || lockedOut) return;
    setSubmitting(true);
    setFailed(false);
    const result = await authenticatePassword(
      connection,
      sessionId,
      password,
      remember,
    );

    if (result.status === "authenticated") {
      close();
      return;
    }

    setSubmitting(false);
    setPassword("");

    if (result.status === "lockedOut") {
      setLockedOut(true);
      return;
    }

    setFailed(true);
    setAttemptsRemaining(
      result.status === "failed" ? result.attemptsRemaining : null,
    );
    passwordRef.current?.focus();
  };

  const cancel = () => {
    abort(sessionId);
    close();
  };

  return (
    <Modal
      title={t("modal.password.title", { name: connection.name })}
      onClose={cancel}
      size="sm"
      initialFocusRef={passwordRef}
      footer={
        lockedOut ? (
          <button type="button" onClick={cancel} className={PRIMARY_BUTTON}>
            {t("modal.close")}
          </button>
        ) : (
          <>
            <button type="button" onClick={cancel} className={SECONDARY_BUTTON}>
              {t("modal.cancel")}
            </button>
            <button
              type="submit"
              form={formId}
              disabled={submitting}
              className={PRIMARY_BUTTON}
            >
              {submitting
                ? t("modal.password.authenticating")
                : t("modal.password.connect")}
            </button>
          </>
        )
      }
    >
      <form
        id={formId}
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="space-y-3"
      >
        <p className="text-xs text-muted">
          {connection.username}@{connection.host}:{connection.port}
        </p>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted">
            {t("modal.password.label")}
          </span>
          <input
            ref={passwordRef}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="off"
            disabled={lockedOut}
            className={INPUT_CLASS}
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            disabled={lockedOut}
            className="h-3.5 w-3.5 rounded border-border accent-accent"
          />
          {profile
            ? t("modal.password.rememberProfile", { name: profile.name })
            : t("modal.password.remember")}
        </label>
        {lockedOut ? (
          <p className="text-xs text-danger">
            {t("modal.password.lockedOut")}
          </p>
        ) : (
          failed && (
            <p className="text-xs text-danger">
              {typeof attemptsRemaining === "number"
                ? t("modal.password.failedRemaining", {
                    count: attemptsRemaining,
                  })
                : t("modal.password.failed")}
            </p>
          )
        )}
      </form>
    </Modal>
  );
}
