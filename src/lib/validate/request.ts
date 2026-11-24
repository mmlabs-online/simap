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
