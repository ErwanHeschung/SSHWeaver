import { useTranslation } from "react-i18next";
import type { SupportedLanguage } from "@i18n/index";
import { SettingField } from "./SettingField";
import { SettingOptions } from "./SettingOptions";

export function LanguageSection() {
  const { t, i18n } = useTranslation();

  const options = [
    { value: "en" as const, label: t("settings.language.english") },
    { value: "fr" as const, label: t("settings.language.french") },
  ];

  const current = (i18n.resolvedLanguage ?? "en") as SupportedLanguage;

  return (
    <section>
      <h2 className="mb-6 text-lg font-semibold text-foreground">
        {t("settings.language.title")}
      </h2>

      <SettingField
        label={t("settings.language.label")}
        hint={t("settings.language.hint")}
      >
        <SettingOptions
          options={options}
          value={current}
          onChange={(lng) => void i18n.changeLanguage(lng)}
        />
      </SettingField>
    </section>
  );
}
