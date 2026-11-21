import type { IconName } from "./icons";
import { atLeastTier, type Tier } from "./tier";

export type NavId =
  | "dashboard"
  | "rooms"
  | "devices"
  | "members"
  | "approvals"
  | "audit"
  | "roomEditor";

export type NavItem = {
  id: NavId;
  href: string;
  icon: IconName;
  minTier: Tier;
  /** `rail`: shown in the nav rail / bottom bar. `room`: contextual action on Room detail. */
  placement: "rail" | "room";
};

const NAV_ITEMS: readonly NavItem[] = [
  { id: "dashboard", href: "/", icon: "space_dashboard", minTier: "user", placement: "rail" },
  { id: "rooms", href: "/rooms", icon: "grid_view", minTier: "user", placement: "rail" },
  { id: "devices", href: "/devices", icon: "lan", minTier: "user", placement: "rail" },
  { id: "members", href: "/members", icon: "group", minTier: "user", placement: "rail" },
  {
    id: "approvals",
    href: "/approvals",
    icon: "fact_check",
    minTier: "manager",
    placement: "rail",
  },
  { id: "audit", href: "/audit", icon: "history", minTier: "admin", placement: "rail" },
  {
    id: "roomEditor",
    href: "/rooms/[roomCode]/edit",
    icon: "edit_square",
    minTier: "admin",
    placement: "room",
  },
];

/** Hiding is UX only; the API enforces permissions (spec SYS-01). */
export function navItemsFor(tier: Tier): NavItem[] {
  return NAV_ITEMS.filter((item) => atLeastTier(tier, item.minTier));
}

export function isActive(item: NavItem, pathname: string): boolean {
  if (item.href === "/") return pathname === "/";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function roomEditorHref(code: string): string {
  return `/rooms/${encodeURIComponent(code)}/edit`;
}
