import { SidebarLayout } from "@layouts/SidebarLayout";
import { Sidebar } from "@components/Sidebar/Sidebar";
import { TerminalPane } from "@components/Terminal/TerminalPane";

export function ConnectionScreen() {
  return (
    <SidebarLayout sidebar={<Sidebar />}>
      <TerminalPane />
    </SidebarLayout>
  );
}
