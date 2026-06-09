import { SidebarLayout } from "@layouts/SidebarLayout";
import { ConnectionList } from "@components/ConnectionList/ConnectionList";

export function ConnectionScreen() {
  return (
    <SidebarLayout sidebar={<ConnectionList />}>
      <div className="p-4">Main content</div>
    </SidebarLayout>
  );
}
