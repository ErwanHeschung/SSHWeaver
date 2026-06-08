import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Copy, Minus, Square, X } from "lucide-react";

const inTauri = "__TAURI_INTERNALS__" in globalThis;

export function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!inTauri) return;
    const appWindow = getCurrentWindow();
    const sync = () => void appWindow.isMaximized().then(setIsMaximized);

    sync();
    const unlisten = appWindow.onResized(sync);
    return () => void unlisten.then((off) => off());
  }, []);

  return (
    <div className="flex items-center">
      <ControlButton
        label="Minimize"
        onClick={() => void getCurrentWindow().minimize()}
      >
        <Minus size={15} strokeWidth={1.5} />
      </ControlButton>

      <ControlButton
        label={isMaximized ? "Restore" : "Maximize"}
        onClick={() => void getCurrentWindow().toggleMaximize()}
      >
        {isMaximized ? (
          <Copy size={13} strokeWidth={1.5} />
        ) : (
          <Square size={13} strokeWidth={1.5} />
        )}
      </ControlButton>

      <ControlButton
        label="Close"
        danger
        onClick={() => void getCurrentWindow().close()}
      >
        <X size={15} strokeWidth={1.5} />
      </ControlButton>
    </div>
  );
}

interface ControlButtonProps {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}

function ControlButton({
  label,
  onClick,
  danger = false,
  children,
}: Readonly<ControlButtonProps>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-8 w-11 items-center justify-center text-muted transition-colors hover:text-foreground ${
        danger ? "hover:bg-danger hover:text-white" : "hover:bg-surface-hover"
      }`}
    >
      {children}
    </button>
  );
}
