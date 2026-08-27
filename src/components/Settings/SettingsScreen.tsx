import { useEffect } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { AppearanceSection } from "./AppearanceSection";
import { LanguageSection } from "./LanguageSection";
import { TerminalSection } from "./TerminalSection";

export function SettingsScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const close = () => navigate("/");

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") navigate("/");
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  return (
    <div className="absolute inset-0 z-40 overflow-y-auto bg-background">
      <div className="relative mx-auto max-w-2xl px-8 py-10">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-foreground">
            {t("settings.open")}
          </h1>
          <button
            type="button"
            aria-label={t("settings.close")}
            title={t("settings.close")}
            onClick={close}
            className="flex size-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="divide-y divide-border">
          <div className="pb-8">
            <AppearanceSection />
          </div>
          <div className="py-8">
            <TerminalSection />
          </div>
          <div className="pt-8">
            <LanguageSection />
          </div>
        </div>
      </div>
    </div>
  );
}
