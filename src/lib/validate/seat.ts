import { SEAT_LIMITS } from "@/lib/seats/types";
import type { Validated } from "./room";
import { isCanonicalUuid } from "./uuid";

export type SeatAddValue = { count: number };
export type OccupantPutValue = { memberId: string | null; expectedOccupantId: string | null };
export type CannotSeatValue = { cannotSeat: true; reason: string } | { cannotSeat: false };

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const unknownKey = (body: Record<string, unknown>, keys: string[]) =>
  Object.keys(body).find((k) => !keys.includes(k));

export function validateSeatAdd(body: unknown): Validated<SeatAddValue> {
  if (!isPlainObject(body)) return { ok: false, field: "body" };
  const extra = unknownKey(body, ["count"]);
  if (extra !== undefined) return { ok: false, field: extra };
  const n = body.count;
  if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > SEAT_LIMITS.addMax) {
    return { ok: false, field: "count" };
  }
  return { ok: true, value: { count: n } };
}

const uuidOrNull = (v: unknown): v is string | null => v === null || isCanonicalUuid(v);

export function validateOccupantPut(body: unknown): Validated<OccupantPutValue> {
  if (!isPlainObject(body)) return { ok: false, field: "body" };
  const extra = unknownKey(body, ["memberId", "expectedOccupantId"]);
  if (extra !== undefined) return { ok: false, field: extra };
  if (!("memberId" in body) || !uuidOrNull(body.memberId)) return { ok: false, field: "memberId" };
  if (!("expectedOccupantId" in body) || !uuidOrNull(body.expectedOccupantId)) {
    return { ok: false, field: "expectedOccupantId" };
  }
  return {
    ok: true,
    value: { memberId: body.memberId, expectedOccupantId: body.expectedOccupantId },
  };
}

export function validateCannotSeat(body: unknown): Validated<CannotSeatValue> {
  if (!isPlainObject(body)) return { ok: false, field: "body" };
  const extra = unknownKey(body, ["cannotSeat", "reason"]);
  if (extra !== undefined) return { ok: false, field: extra };
  if (body.cannotSeat === false) {
    if (body.reason !== undefined && body.reason !== null) return { ok: false, field: "reason" };
    return { ok: true, value: { cannotSeat: false } };
  }
  if (body.cannotSeat !== true) return { ok: false, field: "cannotSeat" };
  if (typeof body.reason !== "string") return { ok: false, field: "reason" };
  const reason = body.reason.normalize("NFC").trim();
  if (reason.length < 1 || reason.length > SEAT_LIMITS.reason) {
    return { ok: false, field: "reason" };
  }
  return { ok: true, value: { cannotSeat: true, reason } };
}
