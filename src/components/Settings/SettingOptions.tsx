export interface Option<T extends string> {
  value: T;
  label: string;
}

interface SettingOptionsProps<T extends string> {
  options: ReadonlyArray<Option<T>>;
  value: T;
  onChange: (value: T) => void;
}

export function SettingOptions<T extends string>({
  options,
  value,
  onChange,
}: Readonly<SettingOptionsProps<T>>) {
  return (
    <div role="radiogroup" className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`min-w-24 rounded-md border px-4 py-2 text-sm transition-colors ${
              active
                ? "border-accent bg-accent-subtle text-foreground"
                : "border-border bg-surface text-muted hover:border-border-strong hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
