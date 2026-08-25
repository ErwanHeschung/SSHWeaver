import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";

interface ActionMenuProps {
  label: string;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

const CloseContext = createContext<() => void>(() => {});

export function ActionMenu({ label, onOpenChange, children }: Readonly<ActionMenuProps>) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const change = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) {
        return;
      }
      change(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") change(false);
    };
    const close = () => change(false);

    globalThis.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    globalThis.addEventListener("resize", close);
    globalThis.addEventListener("scroll", close, true);
    return () => {
      globalThis.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
      globalThis.removeEventListener("resize", close);
      globalThis.removeEventListener("scroll", close, true);
    };
  }, [open]);

  // Position against the trigger, flipping up / clamping so the menu never runs
  // off-screen. Re-measured on resize because items can appear conditionally.
  useLayoutEffect(() => {
    if (!open) return;
    const menu = menuRef.current;
    if (!menu) return;

    const place = () => {
      const trigger = triggerRef.current?.getBoundingClientRect();
      const box = menu.getBoundingClientRect();
      if (!trigger) return;

      const margin = 8;
      let top = trigger.bottom + 4;
      if (top + box.height + margin > globalThis.innerHeight) {
        top = trigger.top - box.height - 4;
      }
      top = Math.max(margin, Math.min(top, globalThis.innerHeight - box.height - margin));

      let left = trigger.right - box.width;
      left = Math.max(margin, Math.min(left, globalThis.innerWidth - box.width - margin));

      setCoords({ top, left });
    };

    place();
    const observer = new ResizeObserver(place);
    observer.observe(menu);
    return () => observer.disconnect();
  }, [open]);

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
        createPortal(
          <CloseContext.Provider value={() => change(false)}>
            <div
              ref={menuRef}
              role="menu"
              style={{
                position: "fixed",
                top: coords.top,
                left: coords.left,
                visibility: coords.top === 0 ? "hidden" : "visible",
              }}
              className="z-50 min-w-40 overflow-hidden rounded-md border border-border bg-surface-elevated py-1 shadow-md"
            >
              {children}
            </div>
          </CloseContext.Provider>,
          document.body,
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
