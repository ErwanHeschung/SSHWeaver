import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { Tree } from "react-arborist";
import type { NodeApi, NodeRendererProps } from "react-arborist";
import {
  ChevronDown,
  ChevronRight,
  Download,
  File as FileIcon,
  Folder,
  FolderOpen,
  Link2,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { SessionStatus } from "@/types/session";
import type { TerminalSession } from "@/types/session";
import { ConfirmModal } from "@components/Modal/ConfirmModal";
import { useModalStore } from "@stores/useModalStore";
import { useSftpStore } from "@stores/useSftpStore";
import type { SftpNode } from "@stores/useSftpStore";
import { sftpRepository } from "@repositories/sftpRepository";
import { SftpPreviewModal } from "./SftpPreviewModal";
import { downloadEntry, uploadInto, uploadPaths } from "./transfer";
import type { TransferResult } from "./transfer";

interface SftpViewProps {
  session: TerminalSession;
  active: boolean;
}

interface Notice {
  kind: "info" | "error";
  text: string;
}

const ROW_HEIGHT = 28;

interface Selection {
  path: string;
  isDir: boolean;
}

function parentDir(path: string): string {
  const cut = path.lastIndexOf("/");
  return cut <= 0 ? "/" : path.slice(0, cut);
}

function uploadTargetDir(selection: Selection | null, root: string): string {
  if (!selection) return root;
  return selection.isDir ? selection.path : parentDir(selection.path);
}

export function SftpView({ session, active }: Readonly<SftpViewProps>) {
  const { t } = useTranslation();
  const tree = useSftpStore((s) => s.trees[session.id]);
  const ensureLoaded = useSftpStore((s) => s.ensureLoaded);
  const refresh = useSftpStore((s) => s.refresh);
  const reload = useSftpStore((s) => s.reload);

  const [containerRef, size] = useSize();
  const [notice, setNotice] = useState<Notice>();
  const [busy, setBusy] = useState(false);
  const selectionRef = useRef<Selection | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const dropHighlightRef = useRef<HTMLElement | null>(null);

  const connected = session.status === SessionStatus.Connected;

  useEffect(() => {
    if (active && connected) void ensureLoaded(session.id);
  }, [active, connected, session.id, ensureLoaded]);

  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  const flash = useCallback((next: Notice) => {
    setNotice(next);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(undefined), 4000);
  }, []);

  const reportTransfer = useCallback(
    (result: TransferResult, okText: string) => {
      if (result.status === "error") flash({ kind: "error", text: result.error });
      else if (result.status === "done") flash({ kind: "info", text: okText });
    },
    [flash],
  );

  const onUpload = async () => {
    const root = tree?.root;
    if (!root) return;
    const targetDir = uploadTargetDir(selectionRef.current, root);
    setBusy(true);
    const result = await uploadInto(session.id, targetDir);
    setBusy(false);
    reportTransfer(result, t("sftp.uploaded", { count: result.status === "done" ? result.count : 0 }));
    if (result.status === "done") void reload(session.id, targetDir);
  };

  useEffect(() => {
    if (!active || !connected) return;
    const root = tree?.root;
    if (!root) return;

    const setHighlight = (el: HTMLElement | null) => {
      if (dropHighlightRef.current === el) return;
      dropHighlightRef.current?.style.removeProperty("outline");
      dropHighlightRef.current?.style.removeProperty("outline-offset");
      if (el) {
        el.style.outline = "2px solid var(--color-accent)";
        el.style.outlineOffset = "-2px";
      }
      dropHighlightRef.current = el;
    };

    const hitTest = (pos: { x: number; y: number }) => {
      const container = containerRef.current;
      if (!container) return null;
      const dpr = window.devicePixelRatio || 1;
      const el = document.elementFromPoint(pos.x / dpr, pos.y / dpr);
      if (!el || !container.contains(el)) return null;
      const row = el.closest<HTMLElement>("[data-sftp-path]");
      const path = row?.dataset["sftpPath"];
      if (row && path) {
        const isDir = row.dataset["sftpDir"] === "1";
        return { dir: isDir ? path : parentDir(path), highlight: isDir ? row : container };
      }
      return { dir: root, highlight: container };
    };

    let disposed = false;
    let unlisten: (() => void) | undefined;

    void getCurrentWebview()
      .onDragDropEvent(async (event) => {
        const payload = event.payload;
        if (payload.type === "enter" || payload.type === "over") {
          setHighlight(hitTest(payload.position)?.highlight ?? null);
        } else if (payload.type === "leave") {
          setHighlight(null);
        } else if (payload.type === "drop") {
          const hit = hitTest(payload.position);
          setHighlight(null);
          if (!hit || payload.paths.length === 0) return;
          setBusy(true);
          const result = await uploadPaths(session.id, hit.dir, payload.paths);
          setBusy(false);
          reportTransfer(result, t("sftp.uploaded", { count: result.status === "done" ? result.count : 0 }));
          if (result.status === "done") void reload(session.id, hit.dir);
        }
      })
      .then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
      });

    return () => {
      disposed = true;
      unlisten?.();
      setHighlight(null);
    };
  }, [active, connected, session.id, tree?.root, containerRef, reload, reportTransfer, t]);

  // Stable per-session identities so react-arborist doesn't remount rows each render.
  const renderRow = useCallback(
    (props: NodeRendererProps<SftpNode>) => (
      <Row {...props} sessionId={session.id} onTransfer={reportTransfer} />
    ),
    [session.id, reportTransfer],
  );

  const onSelect = useCallback((nodes: NodeApi<SftpNode>[]) => {
    const node = nodes[0];
    selectionRef.current = node ? { path: node.data.id, isDir: !node.isLeaf } : null;
  }, []);

  const renderBody = () => {
    if (!connected) return <Centered>{t("sftp.notConnected")}</Centered>;
    if (tree?.error) {
      return (
        <Centered>
          <span className="text-danger">{t("sftp.error", { error: tree.error })}</span>
        </Centered>
      );
    }
    if (!tree || tree.loading) return <Centered>{t("sftp.loading")}</Centered>;
    if (tree.nodes.length === 0) return <Centered>{t("sftp.empty")}</Centered>;
    return (
      <Tree<SftpNode>
        data={tree.nodes}
        idAccessor="id"
        childrenAccessor="children"
        openByDefault={false}
        width={size.width}
        height={size.height}
        rowHeight={ROW_HEIGHT}
        indent={16}
        onSelect={onSelect}
        disableDrag
        disableEdit
      >
        {renderRow}
      </Tree>
    );
  };

  return (
    <div className={`absolute inset-0 flex flex-col bg-background ${active ? "" : "invisible"}`}>
      <div className="flex h-9 flex-none items-center gap-2 border-b border-border bg-surface px-3 text-sm">
        <Folder className="size-4 flex-none text-muted" strokeWidth={1.5} />
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted" title={tree?.root}>
          {tree?.root ?? "—"}
        </span>
        <button
          type="button"
          onClick={() => void onUpload()}
          disabled={!connected || busy || !tree?.root}
          title={t("sftp.upload")}
          aria-label={t("sftp.upload")}
          className="flex-none rounded p-1 text-muted hover:bg-muted/20 hover:text-foreground disabled:opacity-40"
        >
          <Upload className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => void refresh(session.id)}
          disabled={!connected}
          title={t("sftp.refresh")}
          aria-label={t("sftp.refresh")}
          className="flex-none rounded p-1 text-muted hover:bg-muted/20 hover:text-foreground disabled:opacity-40"
        >
          <RefreshCw className="size-3.5" />
        </button>
      </div>

      {notice && (
        <div
          className={`flex-none border-b border-border px-3 py-1 text-xs ${
            notice.kind === "error" ? "text-danger" : "text-muted"
          }`}
        >
          {notice.text}
        </div>
      )}

      <div ref={containerRef} className="relative min-h-0 flex-1">
        {renderBody()}
      </div>
    </div>
  );
}

type RowProps = NodeRendererProps<SftpNode> & {
  sessionId: string;
  onTransfer: (result: TransferResult, okText: string) => void;
};

function Row({ node, style, dragHandle, sessionId, onTransfer }: Readonly<RowProps>) {
  const { t } = useTranslation();
  const loadChildren = useSftpStore((s) => s.loadChildren);
  const reload = useSftpStore((s) => s.reload);
  const openModal = useModalStore((s) => s.open);
  const isDir = !node.isLeaf;
  const isSymlink = node.data.kind === "symlink";

  const onActivate = () => {
    if (isDir) {
      if (!node.isOpen) void loadChildren(sessionId, node.data.id);
      node.toggle();
    } else {
      openModal(SftpPreviewModal, { sessionId, path: node.data.id, name: node.data.name });
    }
  };

  const onDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const result = await downloadEntry(sessionId, node.data.id, node.data.name);
    onTransfer(result, t("sftp.downloaded", { name: node.data.name }));
  };

  const confirmDelete = async () => {
    try {
      await sftpRepository.remove(sessionId, node.data.id);
      onTransfer({ status: "done", count: 1 }, t("sftp.deleted", { name: node.data.name }));
      void reload(sessionId, parentDir(node.data.id));
    } catch (e) {
      onTransfer({ status: "error", error: String(e) }, "");
    }
  };

  const onDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    openModal(ConfirmModal, {
      title: t("sftp.delete.title"),
      message: t(isDir ? "sftp.delete.messageDir" : "sftp.delete.messageFile", {
        name: node.data.name,
      }),
      confirmLabel: t("sftp.delete.confirm"),
      danger: true,
      onConfirm: () => void confirmDelete(),
    });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onActivate();
    }
  };

  return (
    <div
      ref={dragHandle}
      style={style}
      role="treeitem"
      tabIndex={-1}
      aria-selected={node.isSelected}
      aria-expanded={isDir ? node.isOpen : undefined}
      onClick={onActivate}
      onKeyDown={onKeyDown}
      data-sftp-path={node.data.id}
      data-sftp-dir={isDir ? "1" : "0"}
      className={`group flex h-full items-center gap-1.5 pr-2 text-sm ${
        node.isSelected ? "bg-accent/15" : "hover:bg-surface-hover"
      } cursor-pointer`}
    >
      <span className="flex size-4 flex-none items-center justify-center text-faint">
        {isDir && (node.isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />)}
      </span>
      <span className="flex-none text-muted">
        <RowIcon isDir={isDir} isSymlink={isSymlink} isOpen={node.isOpen} />
      </span>
      <span className="min-w-0 flex-1 truncate text-foreground">{node.data.name}</span>
      {!isDir && (
        <button
          type="button"
          onClick={(e) => void onDownload(e)}
          title={t("sftp.download")}
          aria-label={t("sftp.download")}
          className="flex-none rounded p-0.5 text-faint opacity-0 hover:bg-muted/20 hover:text-foreground group-hover:opacity-100"
        >
          <Download className="size-3.5" />
        </button>
      )}
      <button
        type="button"
        onClick={onDelete}
        title={t("sftp.delete.action")}
        aria-label={t("sftp.delete.action")}
        className="flex-none rounded p-0.5 text-faint opacity-0 hover:bg-danger/15 hover:text-danger group-hover:opacity-100"
      >
        <Trash2 className="size-3.5" />
      </button>
      {!isDir && (
        <span className="flex-none text-xs tabular-nums text-faint">{formatSize(node.data.size)}</span>
      )}
      {node.data.modified != null && (
        <span className="flex-none text-xs tabular-nums text-faint" title={t("sftp.modified")}>
          {formatDate(node.data.modified)}
        </span>
      )}
    </div>
  );
}

function RowIcon({
  isDir,
  isSymlink,
  isOpen,
}: Readonly<{ isDir: boolean; isSymlink: boolean; isOpen: boolean }>) {
  if (isSymlink) return <Link2 className="size-4" strokeWidth={1.5} />;
  if (!isDir) return <FileIcon className="size-4" strokeWidth={1.5} />;
  return isOpen ? (
    <FolderOpen className="size-4" strokeWidth={1.5} />
  ) : (
    <Folder className="size-4" strokeWidth={1.5} />
  );
}

function Centered({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-muted">
      {children}
    </div>
  );
}

function useSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ width: Math.floor(width), height: Math.floor(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB", "PB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
