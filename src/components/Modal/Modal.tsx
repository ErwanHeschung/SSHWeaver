import { useEffect, useId, useRef } from "react";
import type { ReactNode, RefObject } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ModalProps {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md";
  initialFocusRef?: RefObject<HTMLElement | null>;
}

const SIZE_CLASS = {
  sm: "w-[min(24rem,calc(100vw-2rem))]",
  md: "w-[min(28rem,calc(100vw-2rem))]",
} as const;

export function Modal({
  title,
  onClose,
  children,
  footer,
  size = "md",
  initialFocusRef,
}: Readonly<ModalProps>) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    initialFocusRef?.current?.focus();
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    const onClick = (e: MouseEvent) => {
      if (e.target === dialog) onClose();
    };
    dialog.addEventListener("cancel", onCancel);
    dialog.addEventListener("click", onClick);

    return () => {
      dialog.removeEventListener("cancel", onCancel);
      dialog.removeEventListener("click", onClick);
      dialog.close();
    };
  }, [onClose, initialFocusRef]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className={`m-auto ${SIZE_CLASS[size]} overflow-hidden rounded-lg border border-border bg-surface-elevated p-0 text-foreground shadow-lg backdrop:bg-black/50 backdrop:backdrop-blur-[1px]`}
    >
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <h2 id={titleId} className="text-sm font-semibold text-foreground">
          {title}
        </h2>
        <button
          type="button"
          aria-label={t("modal.close")}
          title={t("modal.close")}
          onClick={onClose}
          className="flex size-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="px-5 py-4">{children}</div>

      {footer && (
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3.5">
          {footer}
        </div>
      )}
    </dialog>
  );
}
