import type { IconName } from "./icons";
import { atLeastTier, type Tier } from "./tier";

export type NavId =
  | "dashboard"
  | "checkin"
  | "search"
  | "rooms"
  | "devices"
  | "members"
  | "portal"
  | "approvals"
  | "groups"
  | "audit"
  | "deviceTypes"
  | "mapItems"
  | "roomEditor";

export type NavItem = {
  id: NavId;
  href: string;
  icon: IconName;
  minTier: Tier;
  /** `rail`: shown in the nav rail / bottom bar. `room`: contextual action on Room detail. */
  placement: "rail" | "room";
};

export const CHECKIN_PATH = "/checkin";
export const DASHBOARD_PATH = "/dashboard";

const NAV_ITEMS: readonly NavItem[] = [
  { id: "dashboard", href: "/", icon: "space_dashboard", minTier: "user", placement: "rail" },
  { id: "checkin", href: CHECKIN_PATH, icon: "meeting_room", minTier: "user", placement: "rail" },
  { id: "search", href: "/search", icon: "search", minTier: "user", placement: "rail" },
  { id: "rooms", href: "/rooms", icon: "grid_view", minTier: "user", placement: "rail" },
  { id: "devices", href: "/devices", icon: "lan", minTier: "manager", placement: "rail" },
  { id: "members", href: "/members", icon: "group", minTier: "user", placement: "rail" },
  { id: "portal", href: "/portal", icon: "person", minTier: "user", placement: "rail" },
  {
    id: "approvals",
    href: "/approvals",
    icon: "fact_check",
    minTier: "manager",
    placement: "rail",
  },
  // "groups" (/groups) is hidden from the nav while Group/Project features are on hold (D65); the page stays.
  { id: "audit", href: "/audit", icon: "history", minTier: "admin", placement: "rail" },
  {
    id: "deviceTypes",
    href: "/device-types",
    icon: "category",
    minTier: "admin",
    placement: "rail",
  },
  { id: "mapItems", href: "/map-items", icon: "chair", minTier: "admin", placement: "rail" },
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
  const items = NAV_ITEMS.filter((item) => atLeastTier(tier, item.minTier));
  if (homeFor(tier) !== "checkin") return items;
  // A User's home is the check-in view at "/"; the Dashboard moves to its own path (PRE-01, D76).
  const mapped = items.map((item) =>
    item.id === "checkin"
      ? { ...item, href: "/" }
      : item.id === "dashboard"
        ? { ...item, href: DASHBOARD_PATH }
        : item,
  );
  return [...mapped.filter((i) => i.id === "checkin"), ...mapped.filter((i) => i.id !== "checkin")];
}

/** The view at "/": a User lands on check-in, Manager and Admin on the Dashboard (PRE-01, D76). */
export function homeFor(tier: Tier): "checkin" | "dashboard" {
  return atLeastTier(tier, "manager") ? "dashboard" : "checkin";
}

/** True where the check-in room view renders (it has its own room switcher). */
export function isCheckinView(pathname: string, tier: Tier): boolean {
  return pathname === CHECKIN_PATH || (pathname === "/" && homeFor(tier) === "checkin");
}

export function isActive(item: NavItem, pathname: string): boolean {
  if (item.href === "/") return pathname === "/";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function roomEditorHref(code: string): string {
  return `/rooms/${encodeURIComponent(code)}/edit`;
}

/** Link to the room detail page, or null for a dot segment a browser would collapse out of the URL. */
export function roomDetailHref(code: string): string | null {
  if (code === "." || code === "..") return null;
  return `/rooms/${encodeURIComponent(code)}`;
}

export function deviceDetailHref(id: string): string {
  return `/devices/${encodeURIComponent(id)}`;
}
