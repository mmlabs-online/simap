import type { NavId } from "@/lib/nav";
import type { Tier } from "@/lib/tier";

/** English strings for the app shell and the route skeletons (D36). */
export const shellCopy = {
  brand: "simap",
  navLabel: "Main navigation",
  skipLink: "Skip to main content",
  nav: {
    dashboard: "Dashboard",
    rooms: "Rooms",
    devices: "Devices",
    members: "Members",
    myRequests: "My requests",
    approvals: "Approvals",
    groups: "Groups",
    audit: "Audit log",
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
    newDecisions: (n: number) => (n === 1 ? "1 new decision" : `${n} new decisions`),
    overflow: "9+",
  },
  pages: {
    dashboard: { title: "Dashboard", empty: "No data yet." },
    rooms: { title: "Rooms", empty: "No rooms yet." },
    roomDetail: { title: "Room details", empty: "No data yet." },
    roomEditor: { title: "Edit room layout", empty: "No data yet." },
    members: { title: "Members", empty: "No members yet." },
    devices: { title: "Devices", empty: "No devices yet." },
    myRequests: { title: "My requests", empty: "You have no seat requests yet." },
    approvals: { title: "Approvals", empty: "No pending requests." },
    groups: { title: "Groups and projects", empty: "No groups or projects yet." },
    audit: { title: "Audit log", empty: "No audit entries yet." },
  },
} as const;
