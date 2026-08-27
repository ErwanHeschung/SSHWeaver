import { KeyRound, Pencil, Star, StarOff, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Profile } from "@/types/profile";
import { useModalStore } from "@stores/useModalStore";
import { useProfileStore } from "@stores/useProfileStore";
import { ActionMenu, MenuItem } from "@components/Menu/ActionMenu";
import { ConfirmModal } from "@components/Modal/ConfirmModal";
import { ProfileFormModal } from "@components/Modal/ProfileFormModal";

interface ProfileActionsProps {
  profile: Profile;
  usedBy: number;
}

export function ProfileActions({ profile, usedBy }: Readonly<ProfileActionsProps>) {
  const { t } = useTranslation();
  const remove = useProfileStore((s) => s.remove);
  const forget = useProfileStore((s) => s.forgetPassword);
  const setDefault = useProfileStore((s) => s.setDefault);
  const openModal = useModalStore((s) => s.open);

  const edit = () => openModal(ProfileFormModal, { mode: "edit", profile });

  const confirmForget = () =>
    openModal(ConfirmModal, {
      title: t("modal.profileForgetPassword.title"),
      message: t("modal.profileForgetPassword.message", { name: profile.name }),
      confirmLabel: t("actions.forgetPassword"),
      danger: true,
      onConfirm: () => void forget(profile.id),
    });

  const confirmDelete = () =>
    openModal(ConfirmModal, {
      title: t("modal.profileDelete.title"),
      message: t(
        usedBy > 0 ? "modal.profileDelete.messageInUse" : "modal.profileDelete.message",
        { name: profile.name, count: usedBy },
      ),
      confirmLabel: t("actions.delete"),
      danger: true,
      onConfirm: () => void remove(profile.id),
    });

  return (
    <ActionMenu label={t("actions.label")}>
      <MenuItem onClick={edit}>
        <Pencil className="size-3.5" />
        {t("actions.edit")}
      </MenuItem>
      <MenuItem onClick={() => void setDefault(profile.id, !profile.isDefault)}>
        {profile.isDefault ? (
          <StarOff className="size-3.5" />
        ) : (
          <Star className="size-3.5" />
        )}
        {t(profile.isDefault ? "actions.unsetDefault" : "actions.setDefault")}
      </MenuItem>
      {profile.hasPassword && (
        <MenuItem onClick={confirmForget}>
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
