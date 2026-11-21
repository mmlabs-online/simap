import { dayRangeToInstants } from "@/lib/audit/day-range";
import { AUDIT_LIMITS, type AuditActor } from "@/lib/audit/types";
import { atLeastTier, type Tier } from "@/lib/tier";
import { auditCopy } from "../copy/audit";
import type { AuditQuery } from "./audit-api";

export type AuditFilterState = { actor: string; entity: string; fromDay: string; toDay: string };

export const EMPTY_FILTERS: AuditFilterState = { actor: "", entity: "", fromDay: "", toDay: "" };

const META_VALUE_MAX = 80;

/** Only Admins open the page (the API enforces it too). */
export function canViewAudit(tier: Tier | null | undefined): boolean {
  return tier ? atLeastTier(tier, "admin") : false;
}

/** The API query for the filter state, or null when the date range is invalid. */
export function toApiFilter(state: AuditFilterState): AuditQuery | null {
  const range = dayRangeToInstants(state.fromDay, state.toDay);
  if (range === null) return null;
  return {
    ...(state.actor ? { actor: state.actor } : {}),
    ...(state.entity ? { entity: state.entity } : {}),
    ...range,
    limit: AUDIT_LIMITS.defaultLimit,
  };
}

const TIME_FORMAT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Ho_Chi_Minh",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** A stored UTC instant shown in Asia/Ho_Chi_Minh (D35), e.g. `06 Mar 2026, 00:30`. */
export function formatAuditTime(at: string): string {
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? at : TIME_FORMAT.format(d);
}

/** Display name as is; a member without one shows "Unknown member" plus the first 8 chars of the sub. */
export function actorLabel(actor: AuditActor): string {
  return actor.displayName ?? `${auditCopy.unknownMember} ${actor.sub.slice(0, 8)}`;
}

function show(v: unknown): string {
  const s = typeof v === "string" ? v : (JSON.stringify(v) ?? String(v));
  return s.length > META_VALUE_MAX ? `${s.slice(0, META_VALUE_MAX - 1)}…` : s;
}

/** `meta` as text pairs for display; null or non-object -> none. */
export function metaEntries(meta: Record<string, unknown> | null): [string, string][] {
  if (meta === null || typeof meta !== "object") return [];
  return Object.entries(meta).map(([k, v]) => [k, show(v)]);
}
