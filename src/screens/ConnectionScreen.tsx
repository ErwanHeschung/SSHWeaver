import { SidebarLayout } from "@layouts/SidebarLayout";
import { ConnectionList } from "@components/ConnectionList/ConnectionList";
import { ConnectionToolbar } from "@components/ConnectionList/ConnectionToolbar";
import { TerminalPane } from "@components/Terminal/TerminalPane";

export function ConnectionScreen() {
  return (
    <SidebarLayout
      sidebar={
        <div className="flex h-full min-h-0 flex-col">
          <ConnectionToolbar />
          <div className="min-h-0 flex-1">
            <ConnectionList />
          </div>
        </div>
      }
    >
      <TerminalPane />
    </SidebarLayout>
  );
}
