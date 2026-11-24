import type { SearchKind } from "@/lib/search/types";
import { isCanonicalUuid } from "@/lib/validate/uuid";

/** Keyset position of one result group: `t` its kind, `k` the DB-returned lower(sort text), `id` the row id. */
export type SearchCursor = { t: SearchKind; k: string; id: string };

const K_MAX = 320;
const KINDS: readonly string[] = ["seat", "device", "member"];

export function encodeSearchCursor(c: SearchCursor): string {
  return Buffer.from(JSON.stringify({ t: c.t, k: c.k, id: c.id }), "utf8").toString("base64url");
}

/** Returns null for anything that is not exactly what `encodeSearchCursor` produces. */
export function decodeSearchCursor(s: string): SearchCursor | null {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) return null;
  let v: unknown;
  try {
    v = JSON.parse(Buffer.from(s, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o);
  if (keys.length !== 3 || !["t", "k", "id"].every((k) => keys.includes(k))) return null;
  if (typeof o.t !== "string" || !KINDS.includes(o.t)) return null;
  if (typeof o.k !== "string" || [...o.k].length > K_MAX) return null;
  if (!isCanonicalUuid(o.id)) return null;
  return { t: o.t as SearchKind, k: o.k, id: o.id };
}
