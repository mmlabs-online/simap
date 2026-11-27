"use client";

import { useRef } from "react";
import type { IconName } from "@/lib/icons";
import { Icon } from "./Icon";
import { Pill } from "./Chip";
import { nextTabIndex } from "./tab-keys";

export type TabBarItem<T extends string> = {
  id: T;
  label: string;
  icon?: IconName;
  chip?: string;
  count?: number;
};

/** WAI-ARIA tabs with automatic activation, a roving tabIndex and an accent underline (or pills). Copy-free. */
export function TabBar<T extends string>({
  tabs,
  active,
  onSelect,
  ariaLabel,
  tabIdOf,
  panelIdOf,
  variant = "underline",
}: {
  variant?: "underline" | "pill";
  tabs: readonly TabBarItem<T>[];
  active: T;
  onSelect: (id: T) => void;
  ariaLabel: string;
  tabIdOf: (id: T) => string;
  panelIdOf: (id: T) => string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const pill = variant === "pill";
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={
        pill
          ? "flex min-w-0 gap-2 overflow-x-auto"
          : "flex w-full overflow-x-auto border-b border-divider"
      }
    >
      {tabs.map((tab, i) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={tabIdOf(tab.id)}
            aria-selected={selected}
            aria-controls={panelIdOf(tab.id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(tab.id)}
            onKeyDown={(e) => {
              const next = nextTabIndex(e.key, i, tabs.length);
              if (next === null) return;
              e.preventDefault();
              onSelect(tabs[next].id);
              refs.current[next]?.focus();
            }}
            className={
              pill
                ? [
                    "state-layer min-h-control shrink-0 rounded-lg px-4 whitespace-nowrap",
                    "inline-flex items-center justify-center gap-2 text-label cursor-pointer",
                    selected
                      ? "bg-pixel-primary text-on-action font-semibold"
                      : "text-text-secondary",
                  ].join(" ")
                : [
                    "state-layer -mb-px border-b-2 min-h-control px-3 whitespace-nowrap flex-1 sm:flex-none",
                    "inline-flex items-center justify-center gap-2 text-label cursor-pointer",
                    selected
                      ? "border-workspace-primary text-text-primary font-semibold"
                      : "border-transparent text-text-secondary",
                  ].join(" ")
            }
          >
            {tab.icon && <Icon name={tab.icon} size={18} />}
            {tab.label}
            {tab.count !== undefined && <span className="font-mono text-caption">{tab.count}</span>}
            {tab.chip && <Pill tone="accent" decorative label={tab.chip} />}
          </button>
        );
      })}
    </div>
  );
}
