import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download } from "lucide-react";
import { Modal } from "@components/Modal/Modal";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "@components/Modal/buttonStyles";
import { useModalStore } from "@stores/useModalStore";
import { sftpRepository } from "@repositories/sftpRepository";
import { downloadEntry } from "./transfer";

interface SftpPreviewModalProps {
  sessionId: string;
  path: string;
  name: string;
}

type Content =
  | { kind: "loading" }
  | { kind: "text"; text: string }
  | { kind: "image"; url: string }
  | { kind: "binary" }
  | { kind: "error"; error: string };

const IMAGE_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  ico: "image/x-icon",
  svg: "image/svg+xml",
};

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

function looksBinary(bytes: Uint8Array): boolean {
  const limit = Math.min(bytes.length, 8000);
  for (let i = 0; i < limit; i += 1) {
    if (bytes[i] === 0) return true;
  }
  return false;
}

export function SftpPreviewModal({ sessionId, path, name }: Readonly<SftpPreviewModalProps>) {
  const { t } = useTranslation();
  const close = useModalStore((s) => s.close);
  const [content, setContent] = useState<Content>({ kind: "loading" });
  const [downloadError, setDownloadError] = useState<string>();

  useEffect(() => {
    let url: string | undefined;
    let cancelled = false;

    void (async () => {
      try {
        const bytes = await sftpRepository.readFile(sessionId, path);
        if (cancelled) return;
        const mime = IMAGE_MIME[extensionOf(name)];
        if (mime) {
          url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
          setContent({ kind: "image", url });
        } else if (looksBinary(bytes)) {
          setContent({ kind: "binary" });
        } else {
          setContent({ kind: "text", text: new TextDecoder().decode(bytes) });
        }
      } catch (e) {
        if (!cancelled) setContent({ kind: "error", error: String(e) });
      }
    })();

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [sessionId, path, name]);

  const onDownload = async () => {
    setDownloadError(undefined);
    const result = await downloadEntry(sessionId, path, name);
    if (result.status === "error") setDownloadError(result.error);
  };

  return (
    <Modal
      title={name}
      onClose={close}
      size="lg"
      footer={
        <>
          {downloadError && (
            <span className="mr-auto self-center text-xs text-danger">{downloadError}</span>
          )}
          <button type="button" onClick={close} className={SECONDARY_BUTTON}>
            {t("modal.close")}
          </button>
          <button type="button" onClick={() => void onDownload()} className={PRIMARY_BUTTON}>
            <Download className="mr-1.5 size-4" />
            {t("sftp.download")}
          </button>
        </>
      }
    >
      <div className="max-h-[60vh] min-h-32 overflow-auto rounded-md border border-border bg-background">
        <PreviewBody content={content} alt={name} />
      </div>
    </Modal>
  );
}

function PreviewBody({ content, alt }: Readonly<{ content: Content; alt: string }>) {
  const { t } = useTranslation();
  switch (content.kind) {
    case "loading":
      return <Centered>{t("sftp.loading")}</Centered>;
    case "error":
      return <Centered danger>{content.error}</Centered>;
    case "binary":
      return <Centered>{t("sftp.preview.binary")}</Centered>;
    case "image":
      return (
        <div className="flex items-center justify-center p-4">
          <img src={content.url} alt={alt} className="max-h-[55vh] max-w-full object-contain" />
        </div>
      );
    case "text":
      return (
        <pre className="whitespace-pre-wrap wrap-break-word p-3 font-mono text-xs text-foreground">
          {content.text}
        </pre>
      );
  }
}

function Centered({ children, danger }: Readonly<{ children: React.ReactNode; danger?: boolean }>) {
  return (
    <div
      className={`flex min-h-32 items-center justify-center p-4 text-center text-sm ${
        danger ? "text-danger" : "text-muted"
      }`}
    >
      {children}
    </div>
  );
}
