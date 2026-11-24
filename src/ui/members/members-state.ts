import { MEMBER_LIMITS, type MemberStatusFilter } from "@/lib/members/types";
import { membersCopy } from "../copy/members";
import { invitationsCopy } from "../copy/invitations";
import type { ChipOption } from "../Chip";

export type MemberQuery = { q: string; status: MemberStatusFilter; limit: number };

/** The API query for the search text and status filter; the text is trimmed. */
export function listQuery(q: string, status: MemberStatusFilter): MemberQuery {
  return { q: q.trim(), status, limit: MEMBER_LIMITS.defaultLimit };
}

/** Appends `next` to `prev`, dropping ids already present (a page may repeat after a concurrent change). */
export function appendUnique<T extends { id: string }>(prev: T[], next: T[]): T[] {
  const seen = new Set(prev.map((x) => x.id));
  return [...prev, ...next.filter((x) => !seen.has(x.id))];
}

/** How many refs the row does not show (the API caps the refs; the count is exact). */
export const moreCount = (count: number, shown: number): number => Math.max(0, count - shown);

export function invitationRoleLabel(role: string): string {
  const roles: Record<string, string> = invitationsCopy.roles;
  return roles[role] ?? role;
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Ho_Chi_Minh",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

/** A stored UTC instant as a date in Asia/Ho_Chi_Minh (D35), e.g. `06 Mar 2026`; null = no expiry. */
export function formatInviteDate(iso: string | null): string {
  if (iso === null) return membersCopy.invitations.noExpiry;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : DATE_FORMAT.format(d);
}

export const STATUS_FILTERS: ChipOption<MemberStatusFilter>[] = [
  { value: "active", label: membersCopy.statusFilters.active },
  { value: "deactivated", label: membersCopy.statusFilters.deactivated },
  { value: "all", label: membersCopy.statusFilters.all },
];
