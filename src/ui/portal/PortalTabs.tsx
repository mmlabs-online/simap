"use client";

import { useRef } from "react";
import { portalCopy } from "../copy/portal";
import { nextTabIndex, panelId, tabId, type PortalTab } from "./portal-state";

/** WAI-ARIA tabs with automatic activation and a roving tabIndex. */
export function PortalTabs({
  tabs,
  active,
  onSelect,
}: {
  tabs: readonly PortalTab[];
  active: PortalTab;
  onSelect: (tab: PortalTab) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div
      role="tablist"
      aria-label={portalCopy.tablistLabel}
      className="flex border-b border-outline-variant"
    >
      {tabs.map((tab, i) => {
        const selected = tab === active;
        return (
          <button
            key={tab}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={tabId(tab)}
            aria-selected={selected}
            aria-controls={panelId(tab)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(tab)}
            onKeyDown={(e) => {
              const next = nextTabIndex(e.key, i, tabs.length);
              if (next === null) return;
              e.preventDefault();
              onSelect(tabs[next]);
              refs.current[next]?.focus();
            }}
            className={[
              "state-layer flex-1 min-h-11 px-3 py-2 text-sm font-semibold border-b-2",
              selected
                ? "border-primary text-on-surface"
                : "border-transparent text-on-surface-variant",
            ].join(" ")}
          >
            {portalCopy.tabs[tab]}
          </button>
        );
      })}
    </div>
  );
}
