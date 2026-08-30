import { useTranslation } from "react-i18next";
import { RotateCcw } from "lucide-react";
import {
  DEFAULT_ROLE_COLORS,
  TERMINAL_FONT_SIZES,
  TERMINAL_ROLES,
  useTerminalSettingsStore,
} from "@stores/useTerminalSettingsStore";
import type { TerminalRole } from "@stores/useTerminalSettingsStore";
import { SettingField } from "./SettingField";
import { SettingOptions } from "./SettingOptions";

const ROLE_LABELS = {
  error: "settings.terminal.roles.error",
  success: "settings.terminal.roles.success",
  warning: "settings.terminal.roles.warning",
  info: "settings.terminal.roles.info",
} as const satisfies Record<TerminalRole, string>;

export function TerminalSection() {
  const { t } = useTranslation();
  const fontSize = useTerminalSettingsStore((s) => s.fontSize);
  const setFontSize = useTerminalSettingsStore((s) => s.setFontSize);
  const roleColors = useTerminalSettingsStore((s) => s.roleColors);
  const setRoleColor = useTerminalSettingsStore((s) => s.setRoleColor);
  const resetRoleColors = useTerminalSettingsStore((s) => s.resetRoleColors);
  const highlight = useTerminalSettingsStore((s) => s.highlight);
  const setHighlight = useTerminalSettingsStore((s) => s.setHighlight);

  const sizeOptions = TERMINAL_FONT_SIZES.map((size) => ({
    value: size,
    label: t("settings.terminal.fontSizeOption", { size }),
  }));

  const customised = TERMINAL_ROLES.some((role) => roleColors[role]);

  const highlightOptions = [
    { value: "on" as const, label: t("settings.terminal.highlightOn") },
    { value: "off" as const, label: t("settings.terminal.highlightOff") },
  ];

  return (
    <section>
      <h2 className="mb-6 text-lg font-semibold text-foreground">
        {t("settings.terminal.title")}
      </h2>

      <SettingField
        label={t("settings.terminal.fontSizeLabel")}
        hint={t("settings.terminal.fontSizeHint")}
      >
        <SettingOptions options={sizeOptions} value={fontSize} onChange={setFontSize} />
      </SettingField>

      <div className="pt-8">
        <SettingField
          label={t("settings.terminal.rolesLabel")}
          hint={t("settings.terminal.rolesHint")}
        >
          <div className="flex flex-wrap gap-2">
            {TERMINAL_ROLES.map((role) => (
              <label
                key={role}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm text-muted transition-colors hover:border-border-strong hover:text-foreground"
              >
                <input
                  type="color"
                  value={roleColors[role] ?? DEFAULT_ROLE_COLORS[role]}
                  onChange={(e) => setRoleColor(role, e.target.value)}
                  className="size-5 cursor-pointer rounded border border-border bg-transparent p-0"
                />
                {t(ROLE_LABELS[role])}
              </label>
            ))}
          </div>

          {customised && (
            <button
              type="button"
              onClick={resetRoleColors}
              className="mt-3 flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              <RotateCcw className="size-3.5" />
              {t("settings.terminal.rolesReset")}
            </button>
          )}
        </SettingField>
      </div>

      <div className="pt-8">
        <SettingField
          label={t("settings.terminal.highlightLabel")}
          hint={t("settings.terminal.highlightHint")}
        >
          <SettingOptions
            options={highlightOptions}
            value={highlight ? "on" : "off"}
            onChange={(value) => setHighlight(value === "on")}
          />
        </SettingField>
      </div>
    </section>
  );
}
