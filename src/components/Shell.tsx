import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { SettingsButton } from "@components/Settings/SettingsButton";
import { WindowControls } from "@components/WindowControls";

interface ShellProps {
  title?: ReactNode;
  children: ReactNode;
}

export function Shell({ title, children }: Readonly<ShellProps>) {
  const navigate = useNavigate();

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <header
        data-tauri-drag-region
        className="flex h-8 flex-none items-center justify-between border-b border-border bg-surface select-none"
      >
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex items-center gap-2 px-3 text-xs font-medium text-muted transition-colors hover:text-foreground"
        >
          {title ?? "SSHWeaver"}
        </button>
        <div className="flex items-center gap-1 pl-2">
          <SettingsButton />
          <WindowControls />
        </div>
      </header>

      <main className="relative min-h-0 flex-1 overflow-auto">{children}</main>
    </div>
  );
}
