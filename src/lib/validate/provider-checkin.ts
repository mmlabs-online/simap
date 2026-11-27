import { ROOM_LIMITS } from "./room";
import { isCanonicalUuid } from "./uuid";

export type MemberRef = { kind: "email" | "sub"; value: string };
export type ProviderCheckInInput = { member: MemberRef; roomCode: string; at?: string };

export const MAX_PROVIDER_ITEMS = 1000;
const MAX_EMAIL = 320;

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** A member reference: `email` (trimmed, contains `@`) or `sub` (canonical uuid). No other normalisation. */
export function parseMemberRef(kind: unknown, value: unknown): MemberRef | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (kind === "sub") return isCanonicalUuid(v) ? { kind, value: v } : null;
  if (kind === "email") {
    return v.length >= 1 && v.length <= MAX_EMAIL && v.includes("@") ? { kind, value: v } : null;
  }
  return null;
}

/** Room codes are uppercase (Q2): trim and uppercase, then check the length. */
export function parseProviderRoomCode(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const c = v.trim().toUpperCase();
  return c.length >= 1 && c.length <= ROOM_LIMITS.code ? c : null;
}

function parseItem(raw: unknown): ProviderCheckInInput | null {
  if (!isPlainObject(raw) || !isPlainObject(raw.member)) return null;
  const member = parseMemberRef(raw.member.kind, raw.member.value);
  const roomCode = parseProviderRoomCode(raw.roomCode);
  if (!member || !roomCode) return null;
  if (raw.at === undefined) return { member, roomCode };
  return typeof raw.at === "string" ? { member, roomCode, at: raw.at } : null;
}

/**
 * Validates the raw payload of a provider pull: `{ checkIns: [{ member: { kind, value }, roomCode, at? }] }`.
 * Bad items are dropped and counted; a bad envelope or more than 1000 items is `null`.
 */
export function parseProviderPull(
  raw: unknown,
): { items: ProviderCheckInInput[]; dropped: number } | null {
  if (!isPlainObject(raw) || !Array.isArray(raw.checkIns)) return null;
  if (raw.checkIns.length > MAX_PROVIDER_ITEMS) return null;
  const items: ProviderCheckInInput[] = [];
  for (const r of raw.checkIns) {
    const item = parseItem(r);
    if (item) items.push(item);
  }
  return { items, dropped: raw.checkIns.length - items.length };
}
