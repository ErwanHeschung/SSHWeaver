import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useOverlayScrollbars } from "overlayscrollbars-react";
import { ConnectionStatus } from "@/types/connection";
import type { Connection } from "@/types/connection";
import { useConnectionStore } from "@stores/useConnectionStore";
import { ConnectionItem } from "./ConnectionItem";
import { filterConnections } from "./search";

const ROW_HEIGHT = 56;
const OVERSCAN = 6;

const STATUS_RANK: Record<ConnectionStatus, number> = {
  [ConnectionStatus.Connected]: 0,
  [ConnectionStatus.Connecting]: 1,
  [ConnectionStatus.Disconnected]: 2,
};

function compareConnections(a: Connection, b: Connection): number {
  const byStatus = STATUS_RANK[a.status] - STATUS_RANK[b.status];
  if (byStatus !== 0) return byStatus;
  return Number(b.isFavorite) - Number(a.isFavorite);
}

export function ConnectionList() {
  const { t } = useTranslation();
  const connections = useConnectionStore((s) => s.connections);
  const query = useConnectionStore((s) => s.query);
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
    () => [...filterConnections(connections, query)].sort(compareConnections),
    [connections, query],
  );

  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => scroller,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
    getItemKey: (index) => sorted[index]!.id,
  });

  return (
    <div ref={rootRef} className="h-full overflow-y-auto">
      {sorted.length === 0 ? (
        <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted">
          {t("search.empty", { query })}
        </div>
      ) : (
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const connection = sorted[virtualRow.index]!;
            return (
              <ConnectionItem
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
