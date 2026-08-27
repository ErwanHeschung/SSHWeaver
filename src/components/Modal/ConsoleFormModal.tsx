import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { AvailablePort } from "@/bindings";
import type { ConsoleConnection, ConsoleConnectionDraft } from "@/types/console";
import {
  BAUD_RATES,
  DATA_BITS,
  DEFAULT_SERIAL_SETTINGS,
  FLOW_CONTROLS,
  PARITIES,
  STOP_BITS,
} from "@/types/serial";
import type { SerialSettings } from "@/types/serial";
import { Combobox } from "@components/Form/Combobox";
import { Select } from "@components/Form/Select";
import { INPUT_CLASS } from "@components/Form/fieldStyles";
import { useModalStore } from "@stores/useModalStore";
import { useConsoleStore } from "@stores/useConsoleStore";
import { consoleRepository } from "@repositories/consoleRepository";
import { useConnectConsole } from "@/hooks/useConnect";
import { Modal } from "./Modal";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "./buttonStyles";

export interface ConsoleFormProps {
  mode: "add" | "edit";
  connection?: ConsoleConnection;
}

const MAX_BAUD_RATE = 20_000_000;

export function ConsoleFormModal({ mode, connection }: Readonly<ConsoleFormProps>) {
  const { t } = useTranslation();
  const close = useModalStore((s) => s.close);
  const create = useConsoleStore((s) => s.create);
  const update = useConsoleStore((s) => s.update);
  const connections = useConsoleStore((s) => s.connections);
  const connectTo = useConnectConsole();

  const formId = useId();
  const nameRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(connection?.name ?? "");
  const [settings, setSettings] = useState<SerialSettings>(
    connection?.settings ?? DEFAULT_SERIAL_SETTINGS,
  );
  const [ports, setPorts] = useState<AvailablePort[]>([]);
  const [connectAfter, setConnectAfter] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const patch = (change: Partial<SerialSettings>) =>
    setSettings((current) => ({ ...current, ...change }));

  // A snapshot of what is plugged in right now. A port that is not listed can
  // still be typed in, for a device that is not connected yet.
  useEffect(() => {
    let active = true;
    void consoleRepository
      .listPorts()
      .then((available) => {
        if (active) setPorts(available);
      })
      .catch(() => {
        if (active) setPorts([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const isDuplicate = useMemo(() => {
    const portName = settings.portName.trim().toLowerCase();
    if (!portName) return false;
    return connections.some(
      (c) =>
        c.id !== connection?.id &&
        c.settings.portName.trim().toLowerCase() === portName &&
        c.settings.baudRate === settings.baudRate &&
        c.settings.dataBits === settings.dataBits &&
        c.settings.parity === settings.parity &&
        c.settings.stopBits === settings.stopBits &&
        c.settings.flowControl === settings.flowControl,
    );
  }, [connections, settings, connection]);

  const isValid =
    settings.portName.trim() !== "" &&
    Number.isInteger(settings.baudRate) &&
    settings.baudRate >= 1 &&
    settings.baudRate <= MAX_BAUD_RATE &&
    !isDuplicate;

  const errorMessage = error ?? (isDuplicate ? t("modal.console.duplicate") : null);

  const submit = async () => {
    if (!isValid) return;
    const draft: ConsoleConnectionDraft = {
      name: name.trim(),
      settings: { ...settings, portName: settings.portName.trim() },
    };
    try {
      if (mode === "edit" && connection) {
        await update(connection.id, draft);
        close();
      } else {
        const created = await create(draft);
        close();
        if (connectAfter) await connectTo(created);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message.includes("DUPLICATE_LINE") ? t("modal.console.duplicate") : message);
    }
  };

  return (
    <Modal
      title={t(mode === "edit" ? "modal.console.editTitle" : "modal.console.addTitle")}
      onClose={close}
      initialFocusRef={nameRef}
      footer={
        <>
          <button type="button" onClick={close} className={SECONDARY_BUTTON}>
            {t("modal.cancel")}
          </button>
          <button type="submit" form={formId} disabled={!isValid} className={PRIMARY_BUTTON}>
            {t(mode === "edit" ? "modal.console.save" : "modal.console.create")}
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
        <Field label={t("modal.console.nameOptional")}>
          <input
            ref={nameRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="switch console"
            className={INPUT_CLASS}
          />
        </Field>

        <Field label={t("modal.console.port")}>
          <Combobox
            value={settings.portName}
            options={ports.map((port) => ({
              value: port.name,
              label: port.name,
              ...(port.description ? { hint: port.description } : {}),
            }))}
            onChange={(portName) => patch({ portName })}
            label={t("modal.console.port")}
            placeholder={ports[0]?.name ?? "COM1"}
          />
          <span className="block text-xs text-faint">
            {ports.length === 0
              ? t("modal.console.portHintEmpty")
              : t("modal.console.portHint", { count: ports.length })}
          </span>
        </Field>

        <div className="flex gap-3">
          <div className="min-w-0 flex-1">
            <Field label={t("modal.console.baudRate")}>
              <Combobox
                value={settings.baudRate === 0 ? "" : String(settings.baudRate)}
                options={BAUD_RATES.map((rate) => ({
                  value: String(rate),
                  label: String(rate),
                }))}
                onChange={(text) => patch({ baudRate: Number(text.replace(/\D/g, "")) || 0 })}
                label={t("modal.console.baudRate")}
                inputMode="numeric"
              />
            </Field>
          </div>
          <div className="w-28 flex-none">
            <Field label={t("modal.console.dataBits")}>
              <Select
                value={String(settings.dataBits)}
                options={DATA_BITS.map((bits) => ({
                  value: String(bits),
                  label: String(bits),
                }))}
                onChange={(bits) => patch({ dataBits: Number(bits) })}
                label={t("modal.console.dataBits")}
              />
            </Field>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="min-w-0 flex-1">
            <Field label={t("modal.console.parity")}>
              <Select
                value={settings.parity}
                options={PARITIES.map((parity) => ({
                  value: parity,
                  label: t(`console.parity.${parity}`),
                }))}
                onChange={(parity) => patch({ parity })}
                label={t("modal.console.parity")}
              />
            </Field>
          </div>
          <div className="w-28 flex-none">
            <Field label={t("modal.console.stopBits")}>
              <Select
                value={settings.stopBits}
                options={STOP_BITS.map((stopBits) => ({
                  value: stopBits,
                  label: t(`console.stopBits.${stopBits}`),
                }))}
                onChange={(stopBits) => patch({ stopBits })}
                label={t("modal.console.stopBits")}
              />
            </Field>
          </div>
        </div>

        <Field label={t("modal.console.flowControl")}>
          <Select
            value={settings.flowControl}
            options={FLOW_CONTROLS.map((flow) => ({
              value: flow,
              label: t(`console.flowControl.${flow}`),
            }))}
            onChange={(flowControl) => patch({ flowControl })}
            label={t("modal.console.flowControl")}
          />
        </Field>

        {mode === "add" && (
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={connectAfter}
              onChange={(e) => setConnectAfter(e.target.checked)}
              className="size-4 rounded border-border accent-accent"
            />
            {t("modal.console.connectAfterCreate")}
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
