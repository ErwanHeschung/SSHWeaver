import { SidebarLayout } from "@layouts/SidebarLayout";
import { ConnectionList } from "@components/ConnectionList/ConnectionList";
import { ConnectionToolbar } from "@components/ConnectionList/ConnectionToolbar";

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
      <div className="p-4">Main content</div>
    </SidebarLayout>
  );
}
