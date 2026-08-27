import { useCallback, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { POPUP_SURFACE } from "@components/Menu/popupStyles";
import { useAnchoredPopup } from "@components/Menu/useAnchoredPopup";
import { OptionList } from "./OptionList";
import type { ListOption } from "./OptionList";
import { INPUT_CLASS } from "./fieldStyles";

interface ComboboxProps {
  value: string;
  options: ReadonlyArray<ListOption>;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  inputMode?: "text" | "numeric";
}

/**
 * A Select the user can also type into, for fields where the suggestions are
 * useful but not exhaustive — a port that is not plugged in yet, a non-standard
 * baud rate. Replaces `<input list>` + `<datalist>`, which WebView2 draws as
 * unthemeable OS chrome.
 */
export function Combobox({
  value,
  options,
  onChange,
  label,
  placeholder,
  inputMode = "text",
}: Readonly<ComboboxProps>) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // What the user has typed since opening the list, or null when the list was
  // opened without typing. The field's own value must not act as a filter, or
  // a pre-filled valid entry narrows the list to just itself.
  const [typed, setTyped] = useState<string | null>(null);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLDivElement | null>>([]);

  const close = useCallback(() => {
    setOpen(false);
    setActive(-1);
    setTyped(null);
  }, []);

  const { triggerRef, popupRef, style, container } = useAnchoredPopup<
    HTMLDivElement,
    HTMLDivElement
  >({ open, onClose: close, align: "start", matchWidth: true });

  // Typing narrows the suggestions; it never restricts what can be submitted.
  const query = (typed ?? "").trim().toLowerCase();
  const visible = query
    ? options.filter(
        (option) =>
          option.label.toLowerCase().includes(query) ||
          option.hint?.toLowerCase().includes(query),
      )
    : options;

  const pick = (index: number) => {
    const option = visible[index];
    if (option) onChange(option.value);
    close();
    inputRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && !open) {
      event.preventDefault();
      setTyped(null);
      setOpen(true);
      return;
    }
    if (!open) return;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActive((i) => Math.min(visible.length - 1, i + 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActive((i) => Math.max(0, i - 1));
        break;
      case "Enter":
        // Only steal Enter when a suggestion is highlighted, so typing a value
        // and pressing Enter still submits the form.
        if (active >= 0) {
          event.preventDefault();
          pick(active);
        } else {
          close();
        }
        break;
      case "Escape":
        event.preventDefault();
        close();
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
      <div ref={triggerRef} className="relative">
        <input
          ref={inputRef}
          type="text"
          inputMode={inputMode}
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value);
            setTyped(e.target.value);
            setActive(-1);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className={`${INPUT_CLASS} pr-8`}
        />
        <button
          type="button"
          // Not a tab stop: the input already is one, and the list opens with
          // ArrowDown from there.
          tabIndex={-1}
          aria-label={t("form.showOptions", { field: label })}
          onClick={() => {
            setTyped(null);
            setOpen((wasOpen) => !wasOpen);
            inputRef.current?.focus();
          }}
          className="absolute right-0 top-0 flex h-8 w-8 items-center justify-center text-faint transition-colors hover:text-foreground"
        >
          <ChevronDown
            aria-hidden
            className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {open &&
        container &&
        visible.length > 0 &&
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
              options={visible}
              listId={listId}
              activeIndex={active}
              selectedValue={value}
              optionRefs={optionRefs}
              onHover={setActive}
              onPick={pick}
            />
          </div>,
          container,
        )}
    </>
  );
}
