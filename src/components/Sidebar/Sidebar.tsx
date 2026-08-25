import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useConnectionStore } from "@stores/useConnectionStore";
import { useProfileStore } from "@stores/useProfileStore";
import { ConnectionList } from "@components/ConnectionList/ConnectionList";
import { ConnectionToolbar } from "@components/ConnectionList/ConnectionToolbar";
import { ProfileList } from "@components/ProfileList/ProfileList";
import { ProfileToolbar } from "@components/ProfileList/ProfileToolbar";
import { SidebarTabs } from "./SidebarTabs";

export type SidebarTab = "connections" | "profiles";

export function Sidebar() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<SidebarTab>("connections");
  const connectionCount = useConnectionStore((s) => s.connections.length);
  const profileCount = useProfileStore((s) => s.profiles.length);

  const tabs = [
    { value: "connections" as const, label: t("sidebar.connections"), count: connectionCount },
    { value: "profiles" as const, label: t("sidebar.profiles"), count: profileCount },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SidebarTabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === "connections" ? <ConnectionToolbar /> : <ProfileToolbar />}
      <div className="min-h-0 flex-1">
        {tab === "connections" ? <ConnectionList /> : <ProfileList />}
      </div>
    </div>
  );
}
