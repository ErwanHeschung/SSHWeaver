import type { CSSProperties, MouseEvent } from "react";
import { Heart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ConnectionStatus } from "@/types/connection";
import type { Connection } from "@/types/connection";
import { useConnectionStore } from "@stores/useConnectionStore";
import { useConnect } from "@/hooks/useConnect";
import { useIsTruncated } from "@/hooks/useIsTruncated";
import { ConnectionActions } from "./ConnectionActions";

interface ConnectionItemProps {
  connection: Connection;
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

const ENDPOINT_ONLY = "wrap-anywhere line-clamp-2";

export function ConnectionItem({ connection, style }: Readonly<ConnectionItemProps>) {
  const { t } = useTranslation();
  const { id, name, host, port, username, status, isFavorite } = connection;
  const endpoint = `${username}@${host}:${port}`;
  const title = name.trim() || endpoint;
  const statusStyle = STATUS_STYLE[status];
  const favoriteLabel = isFavorite
    ? t("connection.removeFavorite")
    : t("connection.addFavorite");

  const [titleRef, titleClipped] = useIsTruncated<HTMLSpanElement>(title);
  const [endpointRef, endpointClipped] = useIsTruncated<HTMLSpanElement>(endpoint);
  const tooltip =
    [titleClipped ? title : "", endpointClipped ? endpoint : ""]
      .filter(Boolean)
      .join("\n") || undefined;

  const selected = useConnectionStore((s) => s.selectedId === id);
  const select = useConnectionStore((s) => s.select);
  const toggleFavoriteAction = useConnectionStore((s) => s.toggleFavorite);
  const connectTo = useConnect();

  const glow: CSSProperties = statusStyle.glow
    ? {
        boxShadow: `0 0 5px color-mix(in srgb, ${statusStyle.glow} 45%, transparent)`,
      }
    : {};

  const toggleFavorite = (e: MouseEvent) => {
    e.stopPropagation();
    toggleFavoriteAction(id);
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
        title={tooltip}
        onClick={() => select(id)}
        onDoubleClick={() => {
          select(id);
          void connectTo(connection);
        }}
        className="absolute inset-0 focus-visible:-outline-offset-2"
      />

      <span className="pointer-events-none relative min-w-0 flex-1">
        <span
          ref={titleRef}
          className={`text-foreground ${name.trim() ? "block truncate" : ENDPOINT_ONLY}`}
        >
          {title}
        </span>
        {name.trim() && (
          <span ref={endpointRef} className="block truncate text-xs text-muted">
            {endpoint}
          </span>
        )}
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

      <span className={`status-dot relative pointer-events-none ${statusStyle.dot}`} style={glow} aria-hidden />

      <ConnectionActions connection={connection} />
    </div>
  );
}
