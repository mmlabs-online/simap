import { decodeCursor } from "@/lib/audit/cursor";
import { AUDIT_LIMITS, type AuditFilter } from "@/lib/audit/types";
import { isCanonicalUuid } from "./uuid";

export type AuditQueryResult = { ok: true; value: AuditFilter } | { ok: false; field: string };

const ENTITY_RE = /^[a-z][a-z0-9_]{0,63}$/;
const INSTANT_RE = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d{3})?Z$/;
const LIMIT_RE = /^[1-9]\d{0,2}$/;

/** Canonical ISO string when `s` is a real UTC instant, else null (rejects 2026-02-30). */
function instant(s: string): string | null {
  if (!INSTANT_RE.test(s)) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const iso = d.toISOString();
  return iso.slice(0, 19) === s.slice(0, 19) ? iso : null;
}

export function parseAuditQuery(params: URLSearchParams): AuditQueryResult {
  /** undefined = absent (or blank); "dup" = repeated param. */
  const get = (k: string): string | undefined | "dup" => {
    const all = params.getAll(k);
    if (all.length > 1) return "dup";
    return all[0] === "" ? undefined : all[0];
  };
  const value: AuditFilter = { limit: AUDIT_LIMITS.defaultLimit };

  const actor = get("actor");
  if (actor === "dup" || (actor !== undefined && !isCanonicalUuid(actor))) {
    return { ok: false, field: "actor" };
  }
  if (actor !== undefined) value.actor = actor;

  const entity = get("entity");
  if (entity === "dup" || (entity !== undefined && !ENTITY_RE.test(entity))) {
    return { ok: false, field: "entity" };
  }
  if (entity !== undefined) value.entity = entity;

  for (const k of ["from", "to"] as const) {
    const raw = get(k);
    if (raw === "dup") return { ok: false, field: k };
    if (raw === undefined) continue;
    const iso = instant(raw);
    if (iso === null) return { ok: false, field: k };
    value[k] = iso;
  }
  if (value.from !== undefined && value.to !== undefined && value.from >= value.to) {
    return { ok: false, field: "to" };
  }

  const limit = get("limit");
  if (limit === "dup" || (limit !== undefined && !LIMIT_RE.test(limit))) {
    return { ok: false, field: "limit" };
  }
  if (limit !== undefined) {
    const n = Number(limit);
    if (n > AUDIT_LIMITS.maxLimit) return { ok: false, field: "limit" };
    value.limit = n;
  }

  const cursor = get("cursor");
  if (cursor === "dup") return { ok: false, field: "cursor" };
  if (cursor !== undefined) {
    const c = decodeCursor(cursor);
    if (c === null) return { ok: false, field: "cursor" };
    value.cursor = c;
  }
  return { ok: true, value };
}
