import type { Validated } from "./room";
import { isCanonicalUuid } from "./uuid";

const only = (body: unknown, key: string): Validated<string> => {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, field: "body" };
  }
  const o = body as Record<string, unknown>;
  const extra = Object.keys(o).find((k) => k !== key);
  if (extra !== undefined) return { ok: false, field: extra };
  const v = o[key];
  if (!isCanonicalUuid(v)) return { ok: false, field: key };
  return { ok: true, value: v };
};

/** PRE-03: `{ roomId }` only; the client never sends a time. */
export const validateCheckIn = (body: unknown): Validated<{ roomId: string }> => {
  const r = only(body, "roomId");
  return r.ok ? { ok: true, value: { roomId: r.value } } : r;
};

export const validateMove = (body: unknown): Validated<{ seatId: string }> => {
  const r = only(body, "seatId");
  return r.ok ? { ok: true, value: { seatId: r.value } } : r;
};
