import { useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { Connection } from "@/types/connection";
import { useModalStore } from "@stores/useModalStore";
import { useConnectionStore } from "@stores/useConnectionStore";
import type { ConnectionDraft } from "@stores/useConnectionStore";
import { Modal } from "./Modal";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "./buttonStyles";

export interface ConnectionFormProps {
  mode: "add" | "edit";
  connection?: Connection;
}

const EMPTY_DRAFT: ConnectionDraft = { name: "", host: "", port: 22, username: "" };

const INPUT_CLASS =
  "h-8 w-full rounded-md border border-border bg-background px-2.5 text-sm text-foreground transition-colors placeholder:text-faint focus:border-accent focus:outline-none";

export function ConnectionFormModal({ mode, connection }: Readonly<ConnectionFormProps>) {
  const { t } = useTranslation();
  const close = useModalStore((s) => s.close);
  const create = useConnectionStore((s) => s.create);
  const update = useConnectionStore((s) => s.update);

  const formId = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<ConnectionDraft>(() =>
    connection
      ? {
          name: connection.name,
          host: connection.host,
          port: connection.port,
          username: connection.username,
        }
      : EMPTY_DRAFT,
  );

  const isValid =
    draft.name.trim() !== "" &&
    draft.host.trim() !== "" &&
    draft.username.trim() !== "" &&
    Number.isInteger(draft.port) &&
    draft.port >= 1 &&
    draft.port <= 65535;

  const submit = () => {
    if (!isValid) return;
    const clean: ConnectionDraft = {
      name: draft.name.trim(),
      host: draft.host.trim(),
      username: draft.username.trim(),
      port: draft.port,
    };
    if (mode === "edit" && connection) update(connection.id, clean);
    else create(clean);
    close();
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
          submit();
        }}
        className="space-y-3"
      >
        <Field label={t("modal.connection.name")}>
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

        <Field label={t("modal.connection.username")}>
          <input
            type="text"
            value={draft.username}
            onChange={(e) => setDraft((d) => ({ ...d, username: e.target.value }))}
            placeholder="root"
            className={INPUT_CLASS}
          />
        </Field>
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
