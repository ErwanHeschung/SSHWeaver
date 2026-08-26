import type { CSSProperties, MouseEvent } from "react";
import { Heart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ConnectionStatus } from "@/types/connection";
import type { ConsoleConnection } from "@/types/console";
import { describeSerial } from "@/types/serial";
import { consoleTitle } from "@/types/console";
import { useConsoleStore } from "@stores/useConsoleStore";
import { useConnectConsole } from "@hooks/useConnect";
import { ConsoleActions } from "./ConsoleActions";

interface ConsoleItemProps {
  connection: ConsoleConnection;
  style: CSSProperties;
}

interface StatusStyle {
  dot: string;
  glow: string | null;
}

const STATUS_STYLE: Record<ConnectionStatus, StatusStyle> = {
  [ConnectionStatus.Connected]: { dot: "bg-success", glow: "var(--success)" },
  [ConnectionStatus.Connecting]: {
    dot: "bg-warning status-dot--pulse",
    glow: "var(--warning)",
  },
  [ConnectionStatus.Disconnected]: {
    dot: "bg-faint status-dot--idle",
    glow: null,
  },
};

export function ConsoleItem({ connection, style }: Readonly<ConsoleItemProps>) {
  const { t } = useTranslation();
  const { id, name, status, isFavorite } = connection;
  const line = describeSerial(connection.settings);
  const title = consoleTitle(connection);
  const statusStyle = STATUS_STYLE[status];
  const favoriteLabel = isFavorite
    ? t("connection.removeFavorite")
    : t("connection.addFavorite");

  const selected = useConsoleStore((s) => s.selectedId === id);
  const select = useConsoleStore((s) => s.select);
  const toggleFavoriteAction = useConsoleStore((s) => s.toggleFavorite);
  const connectTo = useConnectConsole();

  const glow: CSSProperties = statusStyle.glow
    ? {
        boxShadow: `0 0 5px color-mix(in srgb, ${statusStyle.glow} 45%, transparent)`,
      }
    : {};

  const toggleFavorite = (e: MouseEvent) => {
    e.stopPropagation();
    void toggleFavoriteAction(id);
  };

  return (
    <div
      style={style}
      className={`group relative flex items-center gap-2 pl-3 pr-3 transition-colors ${
        selected ? "bg-accent-subtle" : "hover:bg-surface-hover"
      }`}
    >
      <button
        type="button"
        aria-label={t("connection.select", { name: title })}
        aria-pressed={selected}
        onClick={() => select(id)}
        onDoubleClick={() => {
          select(id);
          void connectTo(connection);
        }}
        className="absolute inset-0 focus-visible:-outline-offset-2"
      />

      <span className="pointer-events-none relative min-w-0 flex-1">
        <span className="block truncate text-foreground">{title}</span>
        {name.trim() && <span className="block truncate text-xs text-muted">{line}</span>}
      </span>

      <button
        type="button"
        aria-label={favoriteLabel}
        title={favoriteLabel}
        onClick={toggleFavorite}
        className={`relative flex-none rounded p-1 transition-colors hover:bg-surface-elevated ${
          isFavorite ? "text-danger" : "text-faint hover:text-danger"
        }`}
      >
        <Heart className={`size-4 ${isFavorite ? "fill-danger" : ""}`} />
      </button>

      <span
        className={`status-dot relative pointer-events-none ${statusStyle.dot}`}
        style={glow}
        aria-hidden
      />

      <ConsoleActions connection={connection} />
    </div>
  );
}
