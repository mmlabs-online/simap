import { decodeSearchCursor, type SearchCursor } from "@/lib/search/cursor";
import { foldText } from "@/lib/search/fold";
import { SEARCH_LIMITS, type SearchKind } from "@/lib/search/types";

export type SearchFilter = {
  q: string;
  /** `foldText(q)`, never empty. */
  folded: string;
  kind: SearchKind | "all";
  limit: number;
  cursor?: SearchCursor;
};

export type SearchQueryResult = { ok: true; value: SearchFilter } | { ok: false; field: string };

const LIMIT_RE = /^[1-9]\d{0,2}$/;
const KINDS: readonly string[] = ["all", "seat", "device", "member"];

export function parseSearchQuery(params: URLSearchParams): SearchQueryResult {
  /** undefined = absent (or blank); "dup" = repeated param. */
  const get = (k: string): string | undefined | "dup" => {
    const all = params.getAll(k);
    if (all.length > 1) return "dup";
    return all[0] === "" ? undefined : all[0];
  };

  const rawQ = get("q");
  if (rawQ === undefined || rawQ === "dup") return { ok: false, field: "q" };
  const q = rawQ.normalize("NFC").replace(/\s+/gu, " ").trim();
  if (q === "" || [...q].length > SEARCH_LIMITS.q) return { ok: false, field: "q" };
  const folded = foldText(q);
  if (folded === "") return { ok: false, field: "q" };
  const value: SearchFilter = { q, folded, kind: "all", limit: SEARCH_LIMITS.defaultLimit };

  const kind = get("kind");
  if (kind === "dup" || (kind !== undefined && !KINDS.includes(kind))) {
    return { ok: false, field: "kind" };
  }
  if (kind !== undefined) value.kind = kind as SearchFilter["kind"];

  const limit = get("limit");
  if (limit === "dup" || (limit !== undefined && !LIMIT_RE.test(limit))) {
    return { ok: false, field: "limit" };
  }
  if (limit !== undefined) {
    const n = Number(limit);
    if (n > SEARCH_LIMITS.maxLimit) return { ok: false, field: "limit" };
    value.limit = n;
  }

  const cursor = get("cursor");
  if (cursor === "dup") return { ok: false, field: "cursor" };
  if (cursor !== undefined) {
    const c = decodeSearchCursor(cursor);
    if (c === null || value.kind === "all" || c.t !== value.kind) {
      return { ok: false, field: "cursor" };
    }
    value.cursor = c;
  }
  return { ok: true, value };
}
