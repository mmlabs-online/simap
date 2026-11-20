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
    approvals: "Approvals",
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
  signedOut: {
    title: "Signed out",
    body: "Sign in with your mmlabs account to continue.",
    signIn: "Sign in",
  },
  pages: {
    dashboard: { title: "Dashboard", empty: "No data yet." },
    rooms: { title: "Rooms", empty: "No rooms yet." },
    roomDetail: { title: "Room details", empty: "No data yet." },
    roomEditor: { title: "Edit room layout", empty: "No data yet." },
    members: { title: "Members", empty: "No members yet." },
    devices: { title: "Devices", empty: "No devices yet." },
    approvals: { title: "Approvals", empty: "No pending requests." },
  },
} as const;
