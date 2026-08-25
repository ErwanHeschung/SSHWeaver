import type { SidebarTab } from "./Sidebar";

interface Tab {
  value: SidebarTab;
  label: string;
  count: number;
}

interface SidebarTabsProps {
  tabs: ReadonlyArray<Tab>;
  value: SidebarTab;
  onChange: (value: SidebarTab) => void;
}

export function SidebarTabs({ tabs, value, onChange }: Readonly<SidebarTabsProps>) {
  return (
    <div role="tablist" className="flex flex-none border-b border-border">
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 px-2 py-2 text-xs font-medium transition-colors ${
              active
                ? "border-accent text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
            <span
              className={`rounded px-1 text-[10px] tabular-nums ${
                active ? "bg-accent-subtle text-foreground" : "text-faint"
              }`}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
