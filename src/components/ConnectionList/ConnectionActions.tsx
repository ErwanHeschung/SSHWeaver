import { useEffect, useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import { MoreVertical, Pencil, PlugZap, Trash2 } from "lucide-react";
import type { Connection } from "@/types/connection";
import { useConnectionStore } from "@stores/useConnectionStore";

interface ConnectionActionsProps {
  connection: Connection;
}

export function ConnectionActions({ connection }: Readonly<ConnectionActionsProps>) {
  const connect = useConnectionStore((s) => s.connect);
  const edit = useConnectionStore((s) => s.edit);
  const remove = useConnectionStore((s) => s.remove);

  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const close = () => setOpen(false);

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

  const toggle = (e: MouseEvent) => {
    e.stopPropagation();
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setCoords({ top: rect.bottom + 4, left: rect.right });
    setOpen((prev) => !prev);
  };

  const run = (action: () => void) => (e: MouseEvent) => {
    e.stopPropagation();
    setOpen(false);
    action();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Actions"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Actions"
        onClick={toggle}
        className="relative flex-none rounded p-1 text-muted transition-colors hover:bg-surface-elevated hover:text-foreground"
      >
        <MoreVertical className="size-4" />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              transform: "translateX(-100%)",
            }}
            className="z-50 min-w-40 overflow-hidden rounded-md border border-border bg-surface-elevated py-1 shadow-md"
          >
            <MenuItem onClick={run(() => connect(connection))}>
              <PlugZap className="size-4" />
              Connect
            </MenuItem>
            <MenuItem onClick={run(() => edit(connection))}>
              <Pencil className="size-3.5" />
              Edit
            </MenuItem>
            <MenuItem onClick={run(() => remove(connection.id))} danger>
              <Trash2 className="size-3.5" />
              Delete
            </MenuItem>
          </div>,
          document.body,
        )}
    </>
  );
}

interface MenuItemProps {
  onClick: (e: MouseEvent) => void;
  danger?: boolean;
  children: ReactNode;
}

function MenuItem({ onClick, danger = false, children }: Readonly<MenuItemProps>) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-surface-hover ${
        danger ? "text-danger" : "text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
