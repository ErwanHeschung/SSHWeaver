import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import { KeyRound, MoreVertical, Pencil, PlugZap, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Connection } from "@/types/connection";
import { useConnectionStore } from "@stores/useConnectionStore";
import { useModalStore } from "@stores/useModalStore";
import { useConnect } from "@/hooks/useConnect";
import { secretsRepository } from "@repositories/secretsRepository";
import { ConfirmModal } from "@components/Modal/ConfirmModal";
import { ConnectionFormModal } from "@components/Modal/ConnectionFormModal";

interface ConnectionActionsProps {
  connection: Connection;
}

export function ConnectionActions({ connection }: Readonly<ConnectionActionsProps>) {
  const { t } = useTranslation();
  const remove = useConnectionStore((s) => s.remove);
  const openModal = useModalStore((s) => s.open);
  const connectTo = useConnect();

  const connect = () => connectTo(connection);

  const edit = () =>
    openModal(ConnectionFormModal, { mode: "edit", connection });

  const confirmDelete = () =>
    openModal(ConfirmModal, {
      title: t("modal.delete.title"),
      message: t("modal.delete.message", { name: connection.name }),
      confirmLabel: t("actions.delete"),
      danger: true,
      onConfirm: () => remove(connection.id),
    });

  const [hasPassword, setHasPassword] = useState(false);

  const forgetPassword = () =>
    openModal(ConfirmModal, {
      title: t("modal.forgetPassword.title"),
      message: t("modal.forgetPassword.message", { name: connection.name }),
      confirmLabel: t("actions.forgetPassword"),
      danger: true,
      onConfirm: async () => {
        await secretsRepository.deletePassword(connection.id);
        setHasPassword(false);
      },
    });

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

  useEffect(() => {
    if (!open) return;
    let active = true;
    void secretsRepository.hasPassword(connection.id).then((has) => {
      if (active) setHasPassword(has);
    });
    return () => {
      active = false;
    };
  }, [open, connection.id]);

  // Position the menu against the trigger, flipping up / clamping so it never
  // runs off-screen. Re-runs when `hasPassword` toggles a row in or out, which
  // changes the menu's height. useLayoutEffect measures before paint (no flash).
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current?.getBoundingClientRect();
    const menu = menuRef.current?.getBoundingClientRect();
    if (!trigger || !menu) return;

    const margin = 8;
    let top = trigger.bottom + 4;
    if (top + menu.height + margin > globalThis.innerHeight) {
      // Not enough room below — flip above the trigger.
      top = trigger.top - menu.height - 4;
    }
    top = Math.max(margin, Math.min(top, globalThis.innerHeight - menu.height - margin));

    // Right-aligned to the trigger; grows leftward.
    let left = trigger.right - menu.width;
    left = Math.max(margin, Math.min(left, globalThis.innerWidth - menu.width - margin));

    setCoords({ top, left });
  }, [open, hasPassword]);

  const toggle = (e: MouseEvent) => {
    e.stopPropagation();
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
        aria-label={t("actions.label")}
        aria-haspopup="menu"
        aria-expanded={open}
        title={t("actions.label")}
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
              visibility: coords.top === 0 ? "hidden" : "visible",
            }}
            className="z-50 min-w-40 overflow-hidden rounded-md border border-border bg-surface-elevated py-1 shadow-md"
          >
            <MenuItem onClick={run(connect)}>
              <PlugZap className="size-4" />
              {t("actions.connect")}
            </MenuItem>
            <MenuItem onClick={run(edit)}>
              <Pencil className="size-3.5" />
              {t("actions.edit")}
            </MenuItem>
            {hasPassword && (
              <MenuItem onClick={run(forgetPassword)}>
                <KeyRound className="size-3.5" />
                {t("actions.forgetPassword")}
              </MenuItem>
            )}
            <MenuItem onClick={run(confirmDelete)} danger>
              <Trash2 className="size-3.5" />
              {t("actions.delete")}
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
