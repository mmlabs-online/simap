import { decodeMemberCursor, type MemberCursor } from "@/lib/members/cursor";
import { MEMBER_LIMITS, type MemberStatusFilter } from "@/lib/members/types";

export type MemberFilter = {
  q?: string;
  status: MemberStatusFilter;
  limit: number;
  cursor?: MemberCursor;
};

export type MemberQueryResult = { ok: true; value: MemberFilter } | { ok: false; field: string };

const LIMIT_RE = /^[1-9]\d{0,2}$/;
const STATUSES: readonly string[] = ["active", "deactivated", "all"];

export function parseMemberQuery(params: URLSearchParams): MemberQueryResult {
  /** undefined = absent (or blank); "dup" = repeated param. */
  const get = (k: string): string | undefined | "dup" => {
    const all = params.getAll(k);
    if (all.length > 1) return "dup";
    return all[0] === "" ? undefined : all[0];
  };
  const value: MemberFilter = { status: "active", limit: MEMBER_LIMITS.defaultLimit };

  const q = get("q");
  if (q === "dup") return { ok: false, field: "q" };
  if (q !== undefined) {
    const clean = q.normalize("NFC").replace(/\s+/gu, " ").trim();
    if ([...clean].length > MEMBER_LIMITS.q) return { ok: false, field: "q" };
    if (clean !== "") value.q = clean;
  }

  const status = get("status");
  if (status === "dup" || (status !== undefined && !STATUSES.includes(status))) {
    return { ok: false, field: "status" };
  }
  if (status !== undefined) value.status = status as MemberStatusFilter;

  const limit = get("limit");
  if (limit === "dup" || (limit !== undefined && !LIMIT_RE.test(limit))) {
    return { ok: false, field: "limit" };
  }
  if (limit !== undefined) {
    const n = Number(limit);
    if (n > MEMBER_LIMITS.maxLimit) return { ok: false, field: "limit" };
    value.limit = n;
  }

  const cursor = get("cursor");
  if (cursor === "dup") return { ok: false, field: "cursor" };
  if (cursor !== undefined) {
    const c = decodeMemberCursor(cursor);
    if (c === null) return { ok: false, field: "cursor" };
    value.cursor = c;
  }
  return { ok: true, value };
}
