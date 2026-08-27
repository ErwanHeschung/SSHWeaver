import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useConnectionStore } from "@stores/useConnectionStore";
import { useProfileStore } from "@stores/useProfileStore";
import { ListError, ListMessage } from "@components/Sidebar/ListMessage";
import { ProfileItem } from "./ProfileItem";

export function ProfileList() {
  const { t } = useTranslation();
  const profiles = useProfileStore((s) => s.profiles);
  const loaded = useProfileStore((s) => s.loaded);
  const error = useProfileStore((s) => s.error);
  const reload = useProfileStore((s) => s.load);

  // Each row reports how many connections use its profile, so this tab needs
  // the connection list too — whether or not it has been visited.
  useEffect(() => {
    void useConnectionStore.getState().ensureLoaded();
  }, []);

  if (error) return <ListError message={error} onRetry={() => void reload()} />;
  if (!loaded) return <ListMessage>{t("list.loading")}</ListMessage>;
  if (profiles.length === 0) return <ListMessage>{t("profiles.empty")}</ListMessage>;

  return (
    <div className="h-full overflow-y-auto">
      {profiles.map((profile) => (
        <ProfileItem key={profile.id} profile={profile} />
      ))}
    </div>
  );
}
