import type { ReactNode } from "react";
import { ThemeToggle } from "@components/ThemeToggle";
import { WindowControls } from "@components/WindowControls";

interface ShellProps {
  title?: ReactNode;
  children: ReactNode;
}

export function Shell({ title, children }: Readonly<ShellProps>) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <header
        data-tauri-drag-region
        className="flex h-8 flex-none items-center justify-between border-b border-border bg-surface select-none"
      >
        <div
          data-tauri-drag-region
          className="flex items-center gap-2 px-3 text-xs font-medium text-muted"
        >
          {title ?? "SSHWeaver"}
        </div>
        <div className="flex items-center gap-1 pl-2">
          <ThemeToggle />
          <WindowControls />
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-auto">{children}</main>
    </div>
  );
}
