import { isCanonicalUuid } from "@/lib/validate/uuid";

export type AuditCursor = { at: string; id: string };

const AT_RE = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/;

export function encodeCursor(c: AuditCursor): string {
  return Buffer.from(JSON.stringify({ at: c.at, id: c.id }), "utf8").toString("base64url");
}

/** Returns null for anything that is not exactly what `encodeCursor` produces. */
export function decodeCursor(s: string): AuditCursor | null {
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
  if (keys.length !== 2 || !keys.includes("at") || !keys.includes("id")) return null;
  if (typeof o.at !== "string" || !AT_RE.test(o.at) || Number.isNaN(Date.parse(o.at))) return null;
  if (!isCanonicalUuid(o.id)) return null;
  return { at: o.at, id: o.id };
}
