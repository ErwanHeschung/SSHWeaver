import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { POPUP_SURFACE } from "@components/Menu/popupStyles";

export interface TerminalMenuItem {
  label: string;
  disabled?: boolean;
  run: () => void;
}

interface TerminalContextMenuProps {
  x: number;
  y: number;
  items: readonly TerminalMenuItem[];
  onClose: () => void;
}

const MARGIN = 4;

export function TerminalContextMenu({
  x,
  y,
  items,
  onClose,
}: Readonly<TerminalContextMenuProps>) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const menu = ref.current;
    if (!menu) return;
    const { width, height } = menu.getBoundingClientRect();
    setPosition({
      left: Math.min(x, globalThis.innerWidth - width - MARGIN),
      top: Math.min(y, globalThis.innerHeight - height - MARGIN),
    });
  }, [x, y]);

  useEffect(() => {
    const dismiss = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    globalThis.addEventListener("pointerdown", dismiss, true);
    document.addEventListener("keydown", dismiss);
    globalThis.addEventListener("blur", onClose);
    return () => {
      globalThis.removeEventListener("pointerdown", dismiss, true);
      document.removeEventListener("keydown", dismiss);
      globalThis.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      role="menu"
      style={{ position: "fixed", ...position }}
      className={`${POPUP_SURFACE} min-w-36 py-1`}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          // Taking focus would drop the terminal selection the item acts on.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            onClose();
            item.run();
          }}
          className="flex w-full cursor-pointer items-center px-3 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-surface-hover disabled:cursor-default disabled:text-faint disabled:hover:bg-transparent"
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}
