import { KeyRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Profile } from "@/types/profile";
import { useConnectionStore } from "@stores/useConnectionStore";
import { useModalStore } from "@stores/useModalStore";
import { ProfileFormModal } from "@components/Modal/ProfileFormModal";
import { ProfileActions } from "./ProfileActions";

interface ProfileItemProps {
  profile: Profile;
}

export function ProfileItem({ profile }: Readonly<ProfileItemProps>) {
  const { t } = useTranslation();
  const openModal = useModalStore((s) => s.open);
  const usedBy = useConnectionStore(
    (s) => s.connections.filter((c) => c.profileId === profile.id).length,
  );

  const passwordLabel = profile.hasPassword
    ? t("profiles.passwordSaved")
    : t("profiles.noPassword");

  const meta = [
    profile.username,
    usedBy > 0 ? t("profiles.usedBy", { count: usedBy }) : t("profiles.unused"),
  ].join(" · ");

  return (
    <div className="group relative flex h-14 items-center gap-2 px-3 transition-colors hover:bg-surface-hover">
      <button
        type="button"
        aria-label={t("profiles.edit", { name: profile.name })}
        onClick={() => openModal(ProfileFormModal, { mode: "edit", profile })}
        className="absolute inset-0 focus-visible:-outline-offset-2"
      />

      <span className="pointer-events-none relative min-w-0 flex-1">
        <span className="block truncate text-foreground">{profile.name}</span>
        <span className="block truncate text-xs text-muted">{meta}</span>
      </span>

      <span
        role="img"
        aria-label={passwordLabel}
        title={passwordLabel}
        className="pointer-events-none relative flex-none"
      >
        <KeyRound
          className={`size-3.5 ${profile.hasPassword ? "text-success" : "text-faint"}`}
        />
      </span>

      <ProfileActions profile={profile} usedBy={usedBy} />
    </div>
  );
}
