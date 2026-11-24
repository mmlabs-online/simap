import type { Validated } from "./room";
import { isCanonicalUuid } from "./uuid";

export type RequestCreateValue = { seatId: string };

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** D23: a request is always for the caller, so any key besides `seatId` (such as `subjectId`) is refused. */
export function validateRequestCreate(body: unknown): Validated<RequestCreateValue> {
  if (!isPlainObject(body)) return { ok: false, field: "body" };
  const extra = Object.keys(body).find((k) => k !== "seatId");
  if (extra !== undefined) return { ok: false, field: extra };
  if (!isCanonicalUuid(body.seatId)) return { ok: false, field: "seatId" };
  return { ok: true, value: { seatId: body.seatId } };
}

export type SeenBodyValue = { seenUpTo: string | null };

const MICRO_RE = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/;

/** A real UTC instant in the microsecond form of the API (rejects 2026-02-30). The string is kept so the microseconds survive. */
function isMicroInstant(s: string): boolean {
  if (!MICRO_RE.test(s)) return false;
  const d = new Date(s);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 19) === s.slice(0, 19);
}

/** `{}` or `{ seenUpTo }` with a microsecond ISO instant; any other key is refused. */
export function validateSeenBody(body: unknown): Validated<SeenBodyValue> {
  if (!isPlainObject(body)) return { ok: false, field: "body" };
  const extra = Object.keys(body).find((k) => k !== "seenUpTo");
  if (extra !== undefined) return { ok: false, field: extra };
  if (!("seenUpTo" in body)) return { ok: true, value: { seenUpTo: null } };
  const s = body.seenUpTo;
  if (typeof s !== "string" || !isMicroInstant(s)) return { ok: false, field: "seenUpTo" };
  return { ok: true, value: { seenUpTo: s } };
}
