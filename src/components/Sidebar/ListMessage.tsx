import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

export function ListMessage({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted">
      {children}
    </div>
  );
}

interface ListErrorProps {
  message: string;
  onRetry: () => void;
}

export function ListError({ message, onRetry }: Readonly<ListErrorProps>) {
  const { t } = useTranslation();

  return (
    <ListMessage>
      <div className="space-y-2">
        <p className="text-danger">{t("list.error", { error: message })}</p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md border border-border px-2 py-1 text-xs text-foreground transition-colors hover:bg-surface-hover"
        >
          {t("list.retry")}
        </button>
      </div>
    </ListMessage>
  );
}
