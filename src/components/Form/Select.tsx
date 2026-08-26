import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { POPUP_SURFACE } from "@components/Menu/popupStyles";
import { useAnchoredPopup } from "@components/Menu/useAnchoredPopup";
import { OptionList } from "./OptionList";
import { INPUT_CLASS } from "./fieldStyles";

export interface Option<T extends string> {
  value: T;
  label: string;
}

interface SelectProps<T extends string> {
  value: T;
  options: ReadonlyArray<Option<T>>;
  onChange: (value: T) => void;
  /** Accessible name when the control is not wrapped in a <label>. */
  label?: string;
}

/**
 * Themed replacement for `<select>`, whose popup WebView2 draws as unthemeable
 * OS chrome. Combobox pattern, not listbox: focus stays on the trigger, so
 * opening the list never moves focus into the portal.
 */
export function Select<T extends string>({
  value,
  options,
  onChange,
  label,
}: Readonly<SelectProps<T>>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const optionRefs = useRef<Array<HTMLDivElement | null>>([]);

  const close = useCallback(() => setOpen(false), []);

  const { triggerRef, popupRef, style, container } = useAnchoredPopup<
    HTMLButtonElement,
    HTMLDivElement
  >({ open, onClose: close, align: "start", matchWidth: true });

  const selected = options.findIndex((option) => option.value === value);
  const current = options[selected];

  const openAt = (index: number) => {
    setActive(Math.max(0, index));
    setOpen(true);
  };

  const commit = (index: number) => {
    const option = options[index];
    if (option) onChange(option.value);
    close();
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    optionRefs.current[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        openAt(selected);
      }
      return;
    }

    const move = (delta: number) =>
      setActive((index) => Math.min(options.length - 1, Math.max(0, index + delta)));

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        move(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        move(-1);
        break;
      case "Home":
        event.preventDefault();
        setActive(0);
        break;
      case "End":
        event.preventDefault();
        setActive(options.length - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        commit(active);
        break;
      case "Tab":
        close();
        break;
      default:
        break;
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        onClick={() => (open ? close() : openAt(selected))}
        onKeyDown={onKeyDown}
        className={`${INPUT_CLASS} flex items-center justify-between gap-2 text-left ${
          open ? "border-accent" : "hover:border-border-strong"
        }`}
      >
        <span className="truncate">{current?.label ?? value}</span>
        <ChevronDown
          aria-hidden
          className={`size-4 flex-none text-faint transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open &&
        container &&
        createPortal(
          <div
            ref={popupRef}
            role="listbox"
            id={listId}
            aria-label={label}
            style={style}
            className={`${POPUP_SURFACE} max-h-64 overflow-y-auto py-1`}
          >
            <OptionList
              options={options}
              listId={listId}
              activeIndex={active}
              selectedValue={value}
              optionRefs={optionRefs}
              onHover={setActive}
              onPick={commit}
            />
          </div>,
          container,
        )}
    </>
  );
}
