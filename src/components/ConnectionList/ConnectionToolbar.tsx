import { Plus, Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useConnectionStore } from "@stores/useConnectionStore";
import { useModalStore } from "@stores/useModalStore";
import { ConnectionFormModal } from "@components/Modal/ConnectionFormModal";

export function ConnectionToolbar() {
  const { t } = useTranslation();
  const query = useConnectionStore((s) => s.query);
  const setQuery = useConnectionStore((s) => s.setQuery);
  const openModal = useModalStore((s) => s.open);
  const add = () => openModal(ConnectionFormModal, { mode: "add" });

  return (
    <div className="flex flex-none items-center gap-2 border-b border-border px-2 py-2">
      <div className="relative min-w-0 flex-1">
        <Search
          className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-faint"
          aria-hidden
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setQuery("")}
          placeholder={t("search.placeholder")}
          aria-label={t("search.label")}
          className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-8 text-sm text-foreground transition-colors placeholder:text-faint focus:border-accent focus:outline-none"
        />
        {query && (
          <button
            type="button"
            aria-label={t("search.clear")}
            title={t("search.clear")}
            onClick={() => setQuery("")}
            className="absolute right-1.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-faint transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      <button
        type="button"
        aria-label={t("actions.add")}
        title={t("actions.add")}
        onClick={add}
        className="flex size-8 flex-none items-center justify-center rounded-md bg-accent text-accent-foreground transition-colors hover:bg-accent-hover"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
