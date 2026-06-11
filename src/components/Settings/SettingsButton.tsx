import { Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";

export function SettingsButton() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const onSettings = useLocation().pathname === "/settings";

  return (
    <button
      type="button"
      aria-label={t("settings.open")}
      title={t("settings.open")}
      onClick={() => navigate(onSettings ? "/" : "/settings")}
      className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-surface-hover hover:text-foreground ${
        onSettings ? "text-foreground" : "text-muted"
      }`}
    >
      <Settings size={15} strokeWidth={1.5} />
    </button>
  );
}
