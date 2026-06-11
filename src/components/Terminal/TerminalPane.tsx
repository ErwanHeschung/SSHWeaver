import { TerminalSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSessionStore } from "@stores/useSessionStore";
import { TerminalTabs } from "./TerminalTabs";
import { TerminalView } from "./TerminalView";

export function TerminalPane() {
  const { t } = useTranslation();
  const sessions = useSessionStore((s) => s.sessions);
  const activeId = useSessionStore((s) => s.activeId);

  if (sessions.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted">
        <TerminalSquare className="size-10 text-faint" strokeWidth={1.5} />
        <div>
          <p className="text-foreground">{t("terminal.empty")}</p>
          <p className="text-sm">{t("terminal.emptyHint")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <TerminalTabs />
      <div className="relative min-h-0 flex-1">
        {sessions.map((session) => (
          <TerminalView
            key={session.id}
            session={session}
            active={session.id === activeId}
          />
        ))}
      </div>
    </div>
  );
}
