import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, RefObject } from "react";

export interface AnchoredPopupOptions {
  open: boolean;
  onClose: () => void;
  /** Which trigger edge the popup lines its own matching edge up with. */
  align?: "start" | "end";
  /** Lock the popup to the trigger's width, the way a select behaves. */
  matchWidth?: boolean;
}

export interface AnchoredPopup<T extends HTMLElement, P extends HTMLElement> {
  triggerRef: RefObject<T | null>;
  popupRef: RefObject<P | null>;
  style: CSSProperties;
  container: HTMLElement | null;
}

const HIDDEN: CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  visibility: "hidden",
};

/**
 * Places a floating panel against a trigger — flipping up when it would run off
 * the bottom — and closes it on outside press, Escape, resize or scroll.
 */
export function useAnchoredPopup<T extends HTMLElement, P extends HTMLElement>({
  open,
  onClose,
  align = "end",
  matchWidth = false,
}: AnchoredPopupOptions): AnchoredPopup<T, P> {
  const triggerRef = useRef<T | null>(null);
  const popupRef = useRef<P | null>(null);
  const [style, setStyle] = useState<CSSProperties>(HIDDEN);
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (popupRef.current?.contains(target) || triggerRef.current?.contains(target)) {
        return;
      }
      onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    globalThis.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    globalThis.addEventListener("resize", onClose);
    globalThis.addEventListener("scroll", onClose, true);
    return () => {
      globalThis.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
      globalThis.removeEventListener("resize", onClose);
      globalThis.removeEventListener("scroll", onClose, true);
    };
  }, [open, onClose]);

  // A modal <dialog> paints in the top layer, so a popup portalled to <body>
  // would land behind its backdrop. Host it in the dialog instead; `position:
  // fixed` still escapes that dialog's `overflow: hidden`.
  useLayoutEffect(() => {
    if (!open) {
      setStyle(HIDDEN);
      return;
    }
    setContainer(triggerRef.current?.closest("dialog") ?? document.body);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !container) return;
    const popup = popupRef.current;
    if (!popup) return;

    const place = () => {
      const trigger = triggerRef.current?.getBoundingClientRect();
      if (!trigger) return;
      const box = popup.getBoundingClientRect();

      const margin = 8;
      const gap = 4;

      let top = trigger.bottom + gap;
      if (top + box.height + margin > globalThis.innerHeight) {
        top = trigger.top - box.height - gap;
      }
      top = Math.max(margin, Math.min(top, globalThis.innerHeight - box.height - margin));

      const width = matchWidth ? trigger.width : box.width;
      let left = align === "end" ? trigger.right - width : trigger.left;
      left = Math.max(margin, Math.min(left, globalThis.innerWidth - width - margin));

      setStyle({
        position: "fixed",
        top,
        left,
        ...(matchWidth ? { width } : {}),
        visibility: "visible",
      });
    };

    place();
    // Items can appear conditionally and fonts settle late.
    const observer = new ResizeObserver(place);
    observer.observe(popup);
    return () => observer.disconnect();
  }, [open, container, align, matchWidth]);

  return { triggerRef, popupRef, style, container };
}
