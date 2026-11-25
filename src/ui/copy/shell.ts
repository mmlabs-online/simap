import type { HandoffCountDto } from "@/lib/devices/types";
import type { NavId } from "@/lib/nav";
import type { Tier } from "@/lib/tier";

const newDecisions = (n: number) => (n === 1 ? "1 new decision" : `${n} new decisions`);
const incomingTransfers = (n: number) =>
  n === 1 ? "1 incoming transfer" : `${n} incoming transfers`;
const pendingReturns = (n: number) => (n === 1 ? "1 pending return" : `${n} pending returns`);
const overdueDevices = (n: number) => (n === 1 ? "1 overdue device" : `${n} overdue devices`);
/** The Devices badge text: incoming transfers, pending returns and overdue devices, zero parts left out. */
const devicesBreakdown = (c: HandoffCountDto) => {
  const parts: [number, string][] = [
    [c.incoming, incomingTransfers(c.incoming)],
    [c.returns, pendingReturns(c.returns)],
    [c.overdue, overdueDevices(c.overdue)],
  ];
  const shown = parts.filter(([n]) => n > 0);
  if (shown.length === 0) return incomingTransfers(0);
  if (shown.length === 1) return shown[0][1];
  const total = shown.reduce((sum, [n]) => sum + n, 0);
  return `${total} pending items: ${shown.map(([, text]) => text).join(", ")}`;
};

/** English strings for the app shell and the route skeletons (D36). */
export const shellCopy = {
  brand: "simap",
  version: {
    label: (v: string) => v,
    title: (v: string) =>
      v === "dev" ? "Development build (no release tag)" : `simap release ${v}`,
  },
  navLabel: "Main navigation",
  skipLink: "Skip to main content",
  nav: {
    dashboard: "Dashboard",
    search: "Search",
    rooms: "Rooms",
    devices: "Devices",
    members: "Members",
    myRequests: "My requests",
    approvals: "Approvals",
    groups: "Groups",
    audit: "Audit log",
    deviceTypes: "Device types",
    mapItems: "Map items",
    roomEditor: "Edit room layout",
  } satisfies Record<NavId, string>,
  tiers: {
    user: "User",
    manager: "Manager",
    admin: "Admin",
  } satisfies Record<Tier, string>,
  actions: {
    switchOrg: "Switch organization",
    refreshPermissions: "Refresh permissions",
    signOut: "Sign out",
    toggleTheme: "Toggle light/dark theme",
  },
  roomSwitcher: { label: "Room", placeholder: "Select a room", go: "Go" },
  signedOut: {
    title: "Signed out",
    body: "Sign in with your mmlabs account to continue.",
    signIn: "Sign in",
  },
  badge: {
    newDecisions,
    incomingTransfers,
    pendingReturns,
    overdueDevices,
    devicesBreakdown,
    /** Screen-reader text per nav entry; an entry not listed falls back to `newDecisions`. */
    byNav: { myRequests: newDecisions, devices: incomingTransfers } as Partial<
      Record<NavId, (n: number) => string>
    >,
    overflow: "9+",
  },
  pages: {
    dashboard: { title: "Dashboard", empty: "No data yet." },
    rooms: { title: "Rooms", empty: "No rooms yet." },
    roomDetail: { title: "Room details", empty: "No data yet." },
    deviceDetail: { title: "Device details", empty: "No data yet." },
    roomEditor: { title: "Edit room layout", empty: "No data yet." },
    members: { title: "Members", empty: "No members yet." },
    devices: { title: "Devices", empty: "No devices yet." },
    myRequests: { title: "My requests", empty: "You have no seat requests yet." },
    approvals: { title: "Approvals", empty: "No pending requests." },
    groups: { title: "Groups and projects", empty: "No groups or projects yet." },
    audit: { title: "Audit log", empty: "No audit entries yet." },
    deviceTypes: { title: "Device types", empty: "No device types yet." },
    mapItems: { title: "Map items", empty: "No map items yet." },
  },
} as const;
