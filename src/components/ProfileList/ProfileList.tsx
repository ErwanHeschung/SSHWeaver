import { useTranslation } from "react-i18next";
import { useProfileStore } from "@stores/useProfileStore";
import { ProfileItem } from "./ProfileItem";

export function ProfileList() {
  const { t } = useTranslation();
  const profiles = useProfileStore((s) => s.profiles);

  if (profiles.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted">
        {t("profiles.empty")}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      {profiles.map((profile) => (
        <ProfileItem key={profile.id} profile={profile} />
      ))}
    </div>
  );
}
