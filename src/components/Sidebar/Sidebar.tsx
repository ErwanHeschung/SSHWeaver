import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { useConnectionStore } from "@stores/useConnectionStore";
import { useConsoleStore } from "@stores/useConsoleStore";
import { useProfileStore } from "@stores/useProfileStore";
import { ConnectionList } from "@components/ConnectionList/ConnectionList";
import { ConnectionToolbar } from "@components/ConnectionList/ConnectionToolbar";
import { ConsoleList } from "@components/ConsoleList/ConsoleList";
import { ConsoleToolbar } from "@components/ConsoleList/ConsoleToolbar";
import { ProfileList } from "@components/ProfileList/ProfileList";
import { ProfileToolbar } from "@components/ProfileList/ProfileToolbar";
import { SidebarTabs } from "./SidebarTabs";

export type SidebarTab = "connections" | "console" | "profiles";

const PANES: Record<SidebarTab, { toolbar: ComponentType; list: ComponentType }> = {
  connections: { toolbar: ConnectionToolbar, list: ConnectionList },
  console: { toolbar: ConsoleToolbar, list: ConsoleList },
  profiles: { toolbar: ProfileToolbar, list: ProfileList },
};

export function Sidebar() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<SidebarTab>("connections");

  const connectionCount = useConnectionStore((s) => s.connections.length);
  const connectionsLoaded = useConnectionStore((s) => s.loaded);
  const consoleCount = useConsoleStore((s) => s.connections.length);
  const consoleLoaded = useConsoleStore((s) => s.loaded);
  const profileCount = useProfileStore((s) => s.profiles.length);
  const profilesLoaded = useProfileStore((s) => s.loaded);

  useEffect(() => {
    const ensureLoaded = {
      connections: useConnectionStore.getState().ensureLoaded,
      console: useConsoleStore.getState().ensureLoaded,
      profiles: useProfileStore.getState().ensureLoaded,
    }[tab];
    void ensureLoaded();
  }, [tab]);

  const badge = (loaded: boolean, count: number) =>
    loaded && count > 0 ? count : undefined;

  const tabs = [
    {
      value: "connections" as const,
      label: t("sidebar.connections"),
      count: badge(connectionsLoaded, connectionCount),
    },
    {
      value: "console" as const,
      label: t("sidebar.console"),
      count: badge(consoleLoaded, consoleCount),
    },
    {
      value: "profiles" as const,
      label: t("sidebar.profiles"),
      count: badge(profilesLoaded, profileCount),
    },
  ];

  const { toolbar: Toolbar, list: List } = PANES[tab];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SidebarTabs tabs={tabs} value={tab} onChange={setTab} />
      <div
        role="tabpanel"
        id={`${tab}-panel`}
        aria-labelledby={`${tab}-tab`}
        className="flex min-h-0 flex-1 flex-col"
      >
        <Toolbar />
        <div className="min-h-0 flex-1">
          <List />
        </div>
      </div>
    </div>
  );
}
