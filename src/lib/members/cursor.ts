import { isCanonicalUuid } from "@/lib/validate/uuid";

/** Keyset position of the members list: `k` is the DB-returned lower(display_name), `id` the member id. */
export type MemberCursor = { k: string; id: string };

const K_MAX = 320;

export function encodeMemberCursor(c: MemberCursor): string {
  return Buffer.from(JSON.stringify({ k: c.k, id: c.id }), "utf8").toString("base64url");
}

/** Returns null for anything that is not exactly what `encodeMemberCursor` produces. */
export function decodeMemberCursor(s: string): MemberCursor | null {
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
  if (keys.length !== 2 || !keys.includes("k") || !keys.includes("id")) return null;
  if (typeof o.k !== "string" || [...o.k].length > K_MAX) return null;
  if (!isCanonicalUuid(o.id)) return null;
  return { k: o.k, id: o.id };
}
