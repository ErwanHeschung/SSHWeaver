import { useTranslation } from "react-i18next";
import { ThemeMode, useTheme } from "@/theme/ThemeContext";
import { SettingField } from "./SettingField";
import { SettingOptions } from "./SettingOptions";

export function AppearanceSection() {
  const { t } = useTranslation();
  const { mode, setMode } = useTheme();

  const options = [
    { value: ThemeMode.System, label: t("settings.appearance.system") },
    { value: ThemeMode.Light, label: t("settings.appearance.light") },
    { value: ThemeMode.Dark, label: t("settings.appearance.dark") },
  ];

  return (
    <section>
      <h2 className="mb-6 text-lg font-semibold text-foreground">
        {t("settings.appearance.title")}
      </h2>

      <SettingField
        label={t("settings.appearance.themeLabel")}
        hint={t("settings.appearance.themeHint")}
      >
        <SettingOptions options={options} value={mode} onChange={setMode} />
      </SettingField>
    </section>
  );
}
