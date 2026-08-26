import type { RefObject } from "react";
import { Check } from "lucide-react";

export interface ListOption {
  value: string;
  label: string;
  /** Secondary text, e.g. the device behind a serial port. */
  hint?: string;
}

interface OptionListProps {
  options: ReadonlyArray<ListOption>;
  listId: string;
  activeIndex: number;
  selectedValue: string;
  optionRefs: RefObject<Array<HTMLDivElement | null>>;
  onHover: (index: number) => void;
  onPick: (index: number) => void;
}

/** The rows inside a Select or Combobox popup. */
export function OptionList({
  options,
  listId,
  activeIndex,
  selectedValue,
  optionRefs,
  onHover,
  onPick,
}: Readonly<OptionListProps>) {
  return (
    <>
      {options.map((option, index) => {
        const selected = option.value === selectedValue;
        return (
          <div
            key={option.value}
            ref={(el) => {
              optionRefs.current[index] = el;
            }}
            role="option"
            id={`${listId}-${index}`}
            aria-selected={selected}
            onMouseEnter={() => onHover(index)}
            onClick={() => onPick(index)}
            className={`flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-sm ${
              index === activeIndex ? "bg-surface-hover text-foreground" : "text-muted"
            }`}
          >
            <Check
              aria-hidden
              className={`size-3.5 flex-none ${selected ? "text-accent" : "opacity-0"}`}
            />
            <span className="truncate">{option.label}</span>
            {option.hint && (
              <span className="ml-auto truncate pl-2 text-xs text-faint">{option.hint}</span>
            )}
          </div>
        );
      })}
    </>
  );
}
