import { useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { Profile } from "@/types/profile";
import { INPUT_CLASS } from "@components/Form/fieldStyles";
import { useModalStore } from "@stores/useModalStore";
import { useProfileStore } from "@stores/useProfileStore";
import type { ProfileDraft } from "@stores/useProfileStore";
import { Modal } from "./Modal";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "./buttonStyles";

export interface ProfileFormProps {
  mode: "add" | "edit";
  profile?: Profile;
}

const EMPTY_DRAFT: ProfileDraft = { name: "", username: "" };

export function ProfileFormModal({ mode, profile }: Readonly<ProfileFormProps>) {
  const { t } = useTranslation();
  const close = useModalStore((s) => s.close);
  const create = useProfileStore((s) => s.create);
  const update = useProfileStore((s) => s.update);

  const formId = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<ProfileDraft>(() =>
    profile ? { name: profile.name, username: profile.username } : EMPTY_DRAFT,
  );
  const [password, setPassword] = useState("");
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = draft.name.trim() !== "" && draft.username.trim() !== "";

  const submit = async () => {
    if (!isValid) return;
    const clean: ProfileDraft = {
      name: draft.name.trim(),
      username: draft.username.trim(),
    };
    const secret = mode === "add" || passwordTouched ? password : null;
    try {
      if (mode === "edit" && profile) {
        await update(profile.id, clean, secret);
      } else {
        await create(clean, secret);
      }
      close();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("DUPLICATE_PROFILE_NAME")) {
        setError(t("modal.profile.duplicate"));
      } else if (message.includes("DUPLICATE_ENDPOINT")) {
        setError(t("modal.profile.usernameCollision"));
      } else {
        setError(message);
      }
    }
  };

  const passwordPlaceholder =
    mode === "edit" && profile?.hasPassword && !passwordTouched
      ? t("modal.profile.passwordUnchanged")
      : "";

  return (
    <Modal
      title={t(mode === "edit" ? "modal.profile.editTitle" : "modal.profile.addTitle")}
      onClose={close}
      initialFocusRef={nameRef}
      footer={
        <>
          <button type="button" onClick={close} className={SECONDARY_BUTTON}>
            {t("modal.cancel")}
          </button>
          <button type="submit" form={formId} disabled={!isValid} className={PRIMARY_BUTTON}>
            {t(mode === "edit" ? "modal.profile.save" : "modal.profile.create")}
          </button>
        </>
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
        <Field label={t("modal.profile.name")}>
          <input
            ref={nameRef}
            type="text"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder={t("modal.profile.namePlaceholder")}
            className={INPUT_CLASS}
          />
        </Field>

        <Field label={t("modal.profile.username")}>
          <input
            type="text"
            value={draft.username}
            onChange={(e) => setDraft((d) => ({ ...d, username: e.target.value }))}
            placeholder="root"
            autoComplete="off"
            className={INPUT_CLASS}
          />
          {mode === "edit" && (
            <span className="block text-xs text-faint">
              {t("modal.profile.usernameHint")}
            </span>
          )}
        </Field>

        <Field label={t("modal.profile.password")}>
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setPasswordTouched(true);
            }}
            placeholder={passwordPlaceholder}
            autoComplete="off"
            className={INPUT_CLASS}
          />
          <span className="block text-xs text-faint">
            {t("modal.profile.passwordHint")}
          </span>
        </Field>

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

function Field({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}
