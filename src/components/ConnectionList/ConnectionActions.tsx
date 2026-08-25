import { useEffect, useState } from "react";
import { KeyRound, Pencil, PlugZap, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Connection } from "@/types/connection";
import { useConnectionStore } from "@stores/useConnectionStore";
import { useModalStore } from "@stores/useModalStore";
import { useConnect } from "@/hooks/useConnect";
import { secretsRepository } from "@repositories/secretsRepository";
import { ActionMenu, MenuItem } from "@components/Menu/ActionMenu";
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

  const [open, setOpen] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);

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

  const edit = () => openModal(ConnectionFormModal, { mode: "edit", connection });

  const confirmDelete = () =>
    openModal(ConfirmModal, {
      title: t("modal.delete.title"),
      message: t("modal.delete.message", { name: connection.name }),
      confirmLabel: t("actions.delete"),
      danger: true,
      onConfirm: () => remove(connection.id),
    });

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

  return (
    <ActionMenu label={t("actions.label")} onOpenChange={setOpen}>
      <MenuItem onClick={() => void connectTo(connection)}>
        <PlugZap className="size-4" />
        {t("actions.connect")}
      </MenuItem>
      <MenuItem onClick={edit}>
        <Pencil className="size-3.5" />
        {t("actions.edit")}
      </MenuItem>
      {hasPassword && (
        <MenuItem onClick={forgetPassword}>
          <KeyRound className="size-3.5" />
          {t("actions.forgetPassword")}
        </MenuItem>
      )}
      <MenuItem onClick={confirmDelete} danger>
        <Trash2 className="size-3.5" />
        {t("actions.delete")}
      </MenuItem>
    </ActionMenu>
  );
}
