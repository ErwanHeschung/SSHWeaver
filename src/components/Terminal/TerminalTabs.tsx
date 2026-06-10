import type { MouseEvent } from "react";
import { X } from "lucide-react";
import { SessionStatus } from "@/types/session";
import type { TerminalSession } from "@/types/session";
import { useSessionStore } from "@stores/useSessionStore";

const STATUS_DOT: Record<SessionStatus, string> = {
  [SessionStatus.Connecting]: "bg-warning status-dot--pulse",
  [SessionStatus.Connected]: "bg-success",
  [SessionStatus.Closed]: "bg-faint status-dot--idle",
};

export function TerminalTabs() {
  const sessions = useSessionStore((s) => s.sessions);
  const activeId = useSessionStore((s) => s.activeId);
  const setActive = useSessionStore((s) => s.setActive);
  const close = useSessionStore((s) => s.close);

  return (
    <div className="flex h-9 flex-none items-stretch overflow-x-auto border-b border-border bg-surface">
      {sessions.map((session) => (
        <Tab
          key={session.id}
          session={session}
          active={session.id === activeId}
          onSelect={() => setActive(session.id)}
          onClose={() => close(session.id)}
        />
      ))}
    </div>
  );
}

interface TabProps {
  session: TerminalSession;
  active: boolean;
  onSelect: () => void;
  onClose: () => void;
}

function Tab({ session, active, onSelect, onClose }: Readonly<TabProps>) {
  const close = (e: MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  return (
    <div
      role="tab"
      aria-selected={active}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect()}
      className={`group flex min-w-0 max-w-48 cursor-pointer items-center gap-2 border-r border-border px-3 text-sm transition-colors ${
        active
          ? "bg-background text-foreground"
          : "text-muted hover:bg-surface-hover hover:text-foreground"
      }`}
    >
      <span className={`status-dot ${STATUS_DOT[session.status]}`} aria-hidden />
      <span className="min-w-0 flex-1 truncate">{session.title}</span>
      <button
        type="button"
        aria-label={`Close ${session.title}`}
        title="Close"
        onClick={close}
        className={`flex-none rounded p-0.5 text-faint transition-opacity hover:bg-surface-elevated hover:text-foreground group-hover:opacity-100 ${
          active ? "opacity-100" : "opacity-0"
        }`}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
