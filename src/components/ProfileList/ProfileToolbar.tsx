import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useModalStore } from "@stores/useModalStore";
import { ProfileFormModal } from "@components/Modal/ProfileFormModal";

export function ProfileToolbar() {
  const { t } = useTranslation();
  const openModal = useModalStore((s) => s.open);

  return (
    <div className="flex flex-none items-center gap-2 border-b border-border px-2 py-2">
      <p className="min-w-0 flex-1 truncate px-1 text-xs text-muted">
        {t("profiles.subtitle")}
      </p>
      <button
        type="button"
        aria-label={t("profiles.add")}
        title={t("profiles.add")}
        onClick={() => openModal(ProfileFormModal, { mode: "add" })}
        className="flex size-8 flex-none items-center justify-center rounded-md bg-accent text-accent-foreground transition-colors hover:bg-accent-hover"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
