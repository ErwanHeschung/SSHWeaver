import { useRef } from "react";
import type { ComponentType, KeyboardEvent } from "react";
import { Cable, KeyRound, Server } from "lucide-react";
import type { SidebarTab } from "./Sidebar";

interface Tab {
  value: SidebarTab;
  label: string;
  count?: number;
}

interface SidebarTabsProps {
  tabs: ReadonlyArray<Tab>;
  value: SidebarTab;
  onChange: (value: SidebarTab) => void;
}

const ICONS: Record<SidebarTab, ComponentType<{ className?: string; strokeWidth?: number }>> = {
  connections: Server,
  console: Cable,
  profiles: KeyRound,
};

export function SidebarTabs({ tabs, value, onChange }: Readonly<SidebarTabsProps>) {
  const buttons = useRef<Partial<Record<SidebarTab, HTMLButtonElement | null>>>({});

  const select = (tab: Tab | undefined) => {
    if (!tab) return;
    onChange(tab.value);
    buttons.current[tab.value]?.focus();
  };

  const step = (delta: number) => {
    const index = tabs.findIndex((tab) => tab.value === value);
    select(tabs[(index + delta + tabs.length) % tabs.length]);
  };

  // Lives on the tabs, not the list: with roving tabindex the list is never
  // focused.
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const move = {
      ArrowRight: () => step(1),
      ArrowLeft: () => step(-1),
      Home: () => select(tabs[0]),
      End: () => select(tabs[tabs.length - 1]),
    }[event.key];
    if (!move) return;
    event.preventDefault();
    move();
  };

  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className="flex flex-none items-stretch gap-1 border-b border-border px-2"
    >
      {tabs.map((tab) => {
        const Icon = ICONS[tab.value];
        const active = tab.value === value;

        return (
          <button
            key={tab.value}
            ref={(el) => {
              buttons.current[tab.value] = el;
            }}
            type="button"
            role="tab"
            id={`${tab.value}-tab`}
            aria-selected={active}
            aria-controls={`${tab.value}-panel`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.value)}
            onKeyDown={onKeyDown}
            className={`relative flex flex-1 flex-col items-center gap-1.5 rounded-t-md px-1 pb-2.5 pt-2 transition-colors ${
              active
                ? "text-foreground"
                : "text-muted hover:bg-surface-hover hover:text-foreground"
            }`}
          >
            {/* Out of flow, so the icon stays centred when a count appears. */}
            <span className="relative flex items-center justify-center">
              <Icon className="size-4" strokeWidth={1.5} />
              {tab.count !== undefined && (
                <span
                  className="absolute left-full top-1/2 ml-1 -translate-y-1/2 text-[10px] leading-none tabular-nums text-muted"
                >
                  {tab.count}
                </span>
              )}
            </span>
            <span className="text-[11px] font-medium leading-none">{tab.label}</span>
            {active && (
              <span
                aria-hidden
                className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-accent"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
