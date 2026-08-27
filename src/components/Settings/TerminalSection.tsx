import { useTranslation } from "react-i18next";
import {
  TERMINAL_FONT_SIZES,
  useTerminalSettingsStore,
} from "@stores/useTerminalSettingsStore";
import { SettingField } from "./SettingField";
import { SettingOptions } from "./SettingOptions";

export function TerminalSection() {
  const { t } = useTranslation();
  const fontSize = useTerminalSettingsStore((s) => s.fontSize);
  const setFontSize = useTerminalSettingsStore((s) => s.setFontSize);

  const options = TERMINAL_FONT_SIZES.map((size) => ({
    value: size,
    label: t("settings.terminal.fontSizeOption", { size }),
  }));

  return (
    <section>
      <h2 className="mb-6 text-lg font-semibold text-foreground">
        {t("settings.terminal.title")}
      </h2>

      <SettingField
        label={t("settings.terminal.fontSizeLabel")}
        hint={t("settings.terminal.fontSizeHint")}
      >
        <SettingOptions options={options} value={fontSize} onChange={setFontSize} />
      </SettingField>
    </section>
  );
}
