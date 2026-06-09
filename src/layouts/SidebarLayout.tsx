import type { ReactNode } from "react";
import { OverlayScrollbarsComponent } from "overlayscrollbars-react";

interface SidebarLayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
}

export function SidebarLayout({ sidebar, children }: Readonly<SidebarLayoutProps>) {
  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Sidebar manages its own scroll (e.g. the virtualized list). */}
      <aside className="flex w-64 flex-none flex-col overflow-hidden border-r border-border bg-surface">
        {sidebar}
      </aside>

      <OverlayScrollbarsComponent
        element="section"
        defer
        options={{
          scrollbars: { theme: "os-theme-accent", autoHide: "leave", autoHideDelay: 600 },
        }}
        className="min-h-0 flex-1"
      >
        {children}
      </OverlayScrollbarsComponent>
    </div>
  );
}
