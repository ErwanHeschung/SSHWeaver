import { Pencil, PlugZap, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ConsoleConnection } from "@/types/console";
import { consoleTitle } from "@/types/console";
import { useConsoleStore } from "@stores/useConsoleStore";
import { useModalStore } from "@stores/useModalStore";
import { useConnectConsole } from "@hooks/useConnect";
import { ActionMenu, MenuItem } from "@components/Menu/ActionMenu";
import { ConfirmModal } from "@components/Modal/ConfirmModal";
import { ConsoleFormModal } from "@components/Modal/ConsoleFormModal";

interface ConsoleActionsProps {
  connection: ConsoleConnection;
}

export function ConsoleActions({ connection }: Readonly<ConsoleActionsProps>) {
  const { t } = useTranslation();
  const remove = useConsoleStore((s) => s.remove);
  const openModal = useModalStore((s) => s.open);
  const connectTo = useConnectConsole();

  const confirmDelete = () =>
    openModal(ConfirmModal, {
      title: t("modal.consoleDelete.title"),
      message: t("modal.consoleDelete.message", { name: consoleTitle(connection) }),
      confirmLabel: t("actions.delete"),
      danger: true,
      onConfirm: () => remove(connection.id),
    });

  return (
    <ActionMenu label={t("actions.label")}>
      <MenuItem onClick={() => void connectTo(connection)}>
        <PlugZap className="size-4" />
        {t("actions.connect")}
      </MenuItem>
      <MenuItem onClick={() => openModal(ConsoleFormModal, { mode: "edit", connection })}>
        <Pencil className="size-3.5" />
        {t("actions.edit")}
      </MenuItem>
      <MenuItem onClick={confirmDelete} danger>
        <Trash2 className="size-3.5" />
        {t("actions.delete")}
      </MenuItem>
    </ActionMenu>
  );
}
