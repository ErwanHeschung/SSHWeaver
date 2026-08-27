import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { Connection } from "@/types/connection";
import { Select } from "@components/Form/Select";
import { INPUT_CLASS } from "@components/Form/fieldStyles";
import { useModalStore } from "@stores/useModalStore";
import { useConnectionStore } from "@stores/useConnectionStore";
import type { ConnectionDraft } from "@stores/useConnectionStore";
import { useProfileStore } from "@stores/useProfileStore";
import { useConnect } from "@/hooks/useConnect";
import { Modal } from "./Modal";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "./buttonStyles";

export interface ConnectionFormProps {
  mode: "add" | "edit";
  connection?: Connection;
}

const EMPTY_DRAFT: ConnectionDraft = {
  name: "",
  host: "",
  port: 22,
  username: "",
  profileId: null,
};

const NO_PROFILE = "";

export function ConnectionFormModal({ mode, connection }: Readonly<ConnectionFormProps>) {
  const { t } = useTranslation();
  const close = useModalStore((s) => s.close);
  const create = useConnectionStore((s) => s.create);
  const update = useConnectionStore((s) => s.update);
  const connections = useConnectionStore((s) => s.connections);
  const profiles = useProfileStore((s) => s.profiles);
  const connectTo = useConnect();

  // The profile picker reads a list this tab never loads for itself.
  useEffect(() => {
    void useProfileStore.getState().ensureLoaded();
  }, []);

  const formId = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<ConnectionDraft>(() =>
    connection
      ? {
          name: connection.name,
          host: connection.host,
          port: connection.port,
          username: connection.username,
          profileId: connection.profileId,
        }
      : EMPTY_DRAFT,
  );
  const [connectAfter, setConnectAfter] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profilePicked, setProfilePicked] = useState(false);

  // A profile owns the account; the username field only appears without one.
  const selectedProfile = profiles.find((p) => p.id === draft.profileId) ?? null;
  const username = selectedProfile?.username ?? draft.username;

  const selectProfile = (profileId: string) => {
    setProfilePicked(true);
    setDraft((d) => {
      if (profileId === NO_PROFILE) {
        return { ...d, profileId: null, username };
      }
      const profile = profiles.find((p) => p.id === profileId);
      return { ...d, profileId, username: profile?.username ?? d.username };
    });
  };

  // Profiles load lazily, so the default usually arrives after the first
  // render. Applied only until the user picks for themselves — including when
  // they deliberately pick "None".
  useEffect(() => {
    if (mode !== "add" || profilePicked) return;
    const fallback = profiles.find((p) => p.isDefault);
    if (!fallback) return;
    setDraft((d) =>
      d.profileId
        ? d
        : { ...d, profileId: fallback.id, username: fallback.username },
    );
  }, [profiles, mode, profilePicked]);

  const isDuplicate = useMemo(() => {
    const host = draft.host.trim().toLowerCase();
    const account = username.trim();
    if (!host || !account) return false;
    return connections.some(
      (c) =>
        c.id !== connection?.id &&
        c.host.trim().toLowerCase() === host &&
        c.port === draft.port &&
        c.username.trim() === account,
    );
  }, [connections, draft, username, connection]);

  const isValid =
    draft.host.trim() !== "" &&
    username.trim() !== "" &&
    Number.isInteger(draft.port) &&
    draft.port >= 1 &&
    draft.port <= 65535 &&
    !isDuplicate;

  const errorMessage = error ?? (isDuplicate ? t("modal.connection.duplicate") : null);

  const submit = async () => {
    if (!isValid) return;
    const clean: ConnectionDraft = {
      name: draft.name.trim(),
      host: draft.host.trim(),
      username: username.trim(),
      port: draft.port,
      profileId: draft.profileId,
    };
    try {
      if (mode === "edit" && connection) {
        await update(connection.id, clean);
        close();
      } else {
        const created = await create(clean);
        close();
        if (connectAfter) await connectTo(created);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("DUPLICATE_ENDPOINT")) {
        setError(t("modal.connection.duplicate"));
      } else if (message.includes("UNKNOWN_PROFILE")) {
        setError(t("modal.connection.unknownProfile"));
      } else {
        setError(message);
      }
    }
  };

  return (
    <Modal
      title={t(mode === "edit" ? "modal.connection.editTitle" : "modal.connection.addTitle")}
      onClose={close}
      initialFocusRef={nameRef}
      footer={
        <>
          <button type="button" onClick={close} className={SECONDARY_BUTTON}>
            {t("modal.cancel")}
          </button>
          <button type="submit" form={formId} disabled={!isValid} className={PRIMARY_BUTTON}>
            {t(mode === "edit" ? "modal.connection.save" : "modal.connection.create")}
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
        <Field label={t("modal.connection.nameOptional")}>
          <input
            ref={nameRef}
            type="text"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="my-server"
            className={INPUT_CLASS}
          />
        </Field>

        <div className="flex gap-3">
          <div className="min-w-0 flex-1">
            <Field label={t("modal.connection.host")}>
              <input
                type="text"
                value={draft.host}
                onChange={(e) => setDraft((d) => ({ ...d, host: e.target.value }))}
                placeholder="10.0.0.1"
                className={INPUT_CLASS}
              />
            </Field>
          </div>
          <div className="w-20 flex-none">
            <Field label={t("modal.connection.port")}>
              <input
                type="number"
                min={1}
                max={65535}
                value={draft.port}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, port: e.target.valueAsNumber || 0 }))
                }
                className={INPUT_CLASS}
              />
            </Field>
          </div>
        </div>

        <Field label={t("modal.connection.profile")}>
          <Select
            value={draft.profileId ?? NO_PROFILE}
            options={[
              { value: NO_PROFILE, label: t("modal.connection.noProfile") },
              ...profiles.map((profile) => ({
                value: profile.id,
                label: `${profile.name} (${profile.username})`,
              })),
            ]}
            onChange={selectProfile}
            label={t("modal.connection.profile")}
          />
          {selectedProfile && (
            <span className="block text-xs text-faint">
              {t(
                selectedProfile.hasPassword
                  ? "modal.connection.profileHint"
                  : "modal.connection.profileNoPasswordHint",
                { username: selectedProfile.username },
              )}
            </span>
          )}
        </Field>

        {!selectedProfile && (
          <Field label={t("modal.connection.username")}>
            <input
              type="text"
              value={draft.username}
              onChange={(e) => setDraft((d) => ({ ...d, username: e.target.value }))}
              placeholder="root"
              className={INPUT_CLASS}
            />
          </Field>
        )}

        {mode === "add" && (
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={connectAfter}
              onChange={(e) => setConnectAfter(e.target.checked)}
              className="size-4 rounded border-border accent-accent"
            />
            {t("modal.connection.connectAfterCreate")}
          </label>
        )}

        {errorMessage && (
          <p role="alert" className="text-sm text-danger">
            {errorMessage}
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
