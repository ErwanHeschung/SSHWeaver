import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useOverlayScrollbars } from "overlayscrollbars-react";
import { ConnectionStatus } from "@/types/connection";
import type { ConsoleConnection } from "@/types/console";
import { useConsoleStore } from "@stores/useConsoleStore";
import { compareLastUsed } from "@utils/lastUsed";
import { ListError, ListMessage } from "@components/Sidebar/ListMessage";
import { ConsoleItem } from "./ConsoleItem";
import { filterConsoleConnections } from "./search";

const ROW_HEIGHT = 56;
const OVERSCAN = 6;

const STATUS_RANK: Record<ConnectionStatus, number> = {
  [ConnectionStatus.Connected]: 0,
  [ConnectionStatus.Connecting]: 1,
  [ConnectionStatus.Disconnected]: 2,
};

function compareConnections(a: ConsoleConnection, b: ConsoleConnection): number {
  const byStatus = STATUS_RANK[a.status] - STATUS_RANK[b.status];
  if (byStatus !== 0) return byStatus;
  const byFavorite = Number(b.isFavorite) - Number(a.isFavorite);
  if (byFavorite !== 0) return byFavorite;
  return compareLastUsed(a, b);
}

export function ConsoleList() {
  const { t } = useTranslation();
  const connections = useConsoleStore((s) => s.connections);
  const query = useConsoleStore((s) => s.query);
  const loaded = useConsoleStore((s) => s.loaded);
  const error = useConsoleStore((s) => s.error);
  const reload = useConsoleStore((s) => s.load);
  const rootRef = useRef<HTMLDivElement>(null);
  const [scroller, setScroller] = useState<HTMLElement | null>(null);

  const [initialize, getInstance] = useOverlayScrollbars({
    defer: true,
    options: {
      scrollbars: { theme: "os-theme-accent", autoHide: "leave", autoHideDelay: 600 },
    },
  });

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    setScroller(root);
    initialize({ target: root, elements: { viewport: root } });
    return () => getInstance()?.destroy();
  }, [initialize, getInstance]);

  const sorted = useMemo(
    () => [...filterConsoleConnections(connections, query)].sort(compareConnections),
    [connections, query],
  );

  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => scroller,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
    getItemKey: (index) => sorted[index]!.id,
  });

  // Inside the scroll container so the ref stays attached; see ConnectionList.
  const placeholder = error ? (
    <ListError message={error} onRetry={() => void reload()} />
  ) : !loaded ? (
    <ListMessage>{t("list.loading")}</ListMessage>
  ) : sorted.length === 0 ? (
    <ListMessage>
      {connections.length === 0 ? t("console.empty") : t("console.search.empty", { query })}
    </ListMessage>
  ) : null;

  return (
    <div ref={rootRef} className="h-full overflow-y-auto">
      {placeholder ?? (
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const connection = sorted[virtualRow.index]!;
            return (
              <ConsoleItem
                key={virtualRow.key}
                connection={connection}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: virtualRow.size,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
