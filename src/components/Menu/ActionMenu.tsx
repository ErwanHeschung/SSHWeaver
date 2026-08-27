import { createContext, useCallback, useContext, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";
import { POPUP_SURFACE } from "./popupStyles";
import { useAnchoredPopup } from "./useAnchoredPopup";

interface ActionMenuProps {
  label: string;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

const CloseContext = createContext<() => void>(() => {});

export function ActionMenu({ label, onOpenChange, children }: Readonly<ActionMenuProps>) {
  const [open, setOpen] = useState(false);

  const change = useCallback(
    (next: boolean) => {
      setOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  const close = useCallback(() => change(false), [change]);

  const { triggerRef, popupRef, style, container } = useAnchoredPopup<
    HTMLButtonElement,
    HTMLDivElement
  >({ open, onClose: close });

  const toggle = (e: MouseEvent) => {
    e.stopPropagation();
    change(!open);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        title={label}
        onClick={toggle}
        className="relative flex-none rounded p-1 text-muted transition-colors hover:bg-surface-elevated hover:text-foreground"
      >
        <MoreVertical className="size-4" />
      </button>

      {open &&
        container &&
        createPortal(
          <CloseContext.Provider value={close}>
            <div
              ref={popupRef}
              role="menu"
              style={style}
              className={`${POPUP_SURFACE} min-w-40 py-1`}
            >
              {children}
            </div>
          </CloseContext.Provider>,
          container,
        )}
    </>
  );
}

interface MenuItemProps {
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}

export function MenuItem({ onClick, danger = false, children }: Readonly<MenuItemProps>) {
  const close = useContext(CloseContext);
  return (
    <button
      type="button"
      role="menuitem"
      onClick={(e) => {
        e.stopPropagation();
        close();
        onClick();
      }}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-surface-hover ${
        danger ? "text-danger" : "text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
