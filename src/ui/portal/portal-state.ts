import type { HandoffCountDto } from "@/lib/devices/types";
import type { Tier } from "@/lib/tier";
import { apiErrorMessage } from "../copy/api";
import { portalCopy } from "../copy/portal";
import type { DeviceRowHandlers } from "../devices/device-actions";
import type { PatchOutcome } from "../org/profile-form";

export const PORTAL_TABS = ["seat", "devices", "profile"] as const;
export type PortalTab = (typeof PORTAL_TABS)[number];
export const DEFAULT_PORTAL_TAB: PortalTab = PORTAL_TABS[0];

/** Exactly one known value is kept; anything else (none, unknown, duplicate) is the default tab. */
export function parsePortalTab(values: string[]): PortalTab {
  const [only] = values;
  return values.length === 1 && (PORTAL_TABS as readonly string[]).includes(only)
    ? (only as PortalTab)
    : DEFAULT_PORTAL_TAB;
}

/** The page URL for a tab; the default tab keeps the URL clean. */
export function portalTabHref(pathname: string, tab: PortalTab): string {
  return tab === DEFAULT_PORTAL_TAB ? pathname : `${pathname}?tab=${tab}`;
}

export const tabId = (tab: PortalTab) => `portal-tab-${tab}`;
export const panelId = (tab: PortalTab) => `portal-panel-${tab}`;

/** The tab index a key moves to (arrows wrap), or null for a key that does not move. */
export function nextTabIndex(key: string, current: number, count: number): number | null {
  if (key === "ArrowRight") return (current + 1) % count;
  if (key === "ArrowLeft") return (current - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}

/** The owner actions only: Edit, Delete, Take back, Assign and Edit holding stay on the Devices page. */
export const portalHandlers = (h: DeviceRowHandlers): DeviceRowHandlers => ({
  onPlace: h.onPlace,
  onTransfer: h.onTransfer,
  onReturn: h.onReturn,
  onExtend: h.onExtend,
  onCancelHandoff: h.onCancelHandoff,
});

/** The My Portal badge (OQ-59): transfers waiting for me plus my overdue devices. */
export const portalBadgeTotal = (c: HandoffCountDto): number => c.incoming + c.overdue;

/** Users have no Devices list; `/devices` sends them to My devices. */
export const devicesPageRedirect = (tier: Tier | undefined): string | null =>
  tier === "user" ? "/portal?tab=devices" : null;

export type ProfileOutcomeView = {
  notice: { tone: "status" | "error"; text: string } | null;
  fieldError: "invalid" | null;
};

/** What the Profile tab shows after the PATCH answered. */
export function profileOutcome(out: PatchOutcome): ProfileOutcomeView {
  switch (out.kind) {
    case "saved":
      return { notice: { tone: "status", text: portalCopy.profile.saved }, fieldError: null };
    case "invalid":
      return { notice: null, fieldError: "invalid" };
    case "retry":
      return { notice: { tone: "error", text: portalCopy.profile.errors.retry }, fieldError: null };
    case "access": {
      const code = (out.error as { code?: unknown } | null)?.code;
      return {
        notice: {
          tone: "error",
          text: apiErrorMessage(typeof code === "string" ? code : "internal"),
        },
        fieldError: null,
      };
    }
  }
}
