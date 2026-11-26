"use client";

import { TabBar, type TabBarItem } from "../TabBar";
import { portalCopy } from "../copy/portal";
import { PORTAL_TAB_ICONS, panelId, tabId, type PortalTab } from "./portal-state";

/** The My Portal tab bar: the shared TabBar with the portal labels, icons, chip and id contract. */
export function PortalTabs({
  tabs,
  active,
  onSelect,
}: {
  tabs: readonly PortalTab[];
  active: PortalTab;
  onSelect: (tab: PortalTab) => void;
}) {
  const items: TabBarItem<PortalTab>[] = tabs.map((t) => ({
    id: t,
    label: portalCopy.tabs[t],
    icon: PORTAL_TAB_ICONS[t],
    chip: portalCopy.tabChips[t],
  }));
  return (
    <TabBar
      tabs={items}
      active={active}
      onSelect={onSelect}
      ariaLabel={portalCopy.tablistLabel}
      tabIdOf={tabId}
      panelIdOf={panelId}
    />
  );
}
