import type { MouseEvent } from "react";
import { FolderTree, TerminalSquare, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SessionKind, SessionStatus } from "@/types/session";
import type { TerminalSession } from "@/types/session";
import { useSessionStore } from "@stores/useSessionStore";
import { useSftpStore } from "@stores/useSftpStore";
import { useIsTruncated } from "@/hooks/useIsTruncated";
import type { SftpViewMode } from "@stores/useSftpStore";

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
  // Only an SSH session has a file side; a serial line has nothing to browse.
  const activeSession = sessions.find((s) => s.id === activeId);

  return (
    <div className="flex h-9 flex-none items-stretch border-b border-border bg-surface">
      <div className="flex min-w-0 flex-1 items-stretch overflow-x-auto">
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
      {activeSession?.kind === SessionKind.Ssh && (
        <ViewToggle sessionId={activeSession.id} />
      )}
    </div>
  );
}

function ViewToggle({ sessionId }: Readonly<{ sessionId: string }>) {
  const { t } = useTranslation();
  const mode = useSftpStore((s) => s.modes[sessionId] ?? "terminal");
  const setMode = useSftpStore((s) => s.setMode);

  const options: { value: SftpViewMode; icon: typeof TerminalSquare; label: string }[] = [
    { value: "terminal", icon: TerminalSquare, label: t("sftp.toggle.terminal") },
    { value: "files", icon: FolderTree, label: t("sftp.toggle.files") },
  ];

  return (
    <div className="flex flex-none items-center gap-0.5 border-l border-border px-1.5">
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => setMode(sessionId, value)}
          aria-pressed={mode === value}
          title={label}
          aria-label={label}
          className={`rounded p-1 transition-colors ${
            mode === value
              ? "bg-surface-elevated text-foreground"
              : "text-faint hover:bg-surface-hover hover:text-foreground"
          }`}
        >
          <Icon className="size-4" strokeWidth={1.5} />
        </button>
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
  const { t } = useTranslation();
  const [titleRef, titleClipped] = useIsTruncated<HTMLSpanElement>(session.title);
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
      <span
        ref={titleRef}
        title={titleClipped ? session.title : undefined}
        className="min-w-0 flex-1 truncate"
      >
        {session.title}
      </span>
      <button
        type="button"
        aria-label={t("tabs.closeNamed", { title: session.title })}
        title={t("tabs.close")}
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
