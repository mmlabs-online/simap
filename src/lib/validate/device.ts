import type { DeviceRole, PlacementFilter } from "@/lib/devices/types";
import type { Validated } from "./room";
import { isCanonicalUuid } from "./uuid";

export type DeviceQueryResult = { ok: true; value: PlacementFilter } | { ok: false; field: string };
export type PlacementPutValue = {
  seatId: string | null;
  role: DeviceRole;
  expectedSeatId: string | null;
};

const FILTERS: readonly string[] = ["all", "placed", "inventory"];

/** `?placement=`: absent or blank = all; repeated or unknown = invalid. Other keys are ignored. */
export function parseDeviceQuery(params: URLSearchParams): DeviceQueryResult {
  const all = params.getAll("placement");
  if (all.length > 1) return { ok: false, field: "placement" };
  const v = all[0];
  if (v === undefined || v === "") return { ok: true, value: "all" };
  if (!FILTERS.includes(v)) return { ok: false, field: "placement" };
  return { ok: true, value: v as PlacementFilter };
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const uuidOrNull = (v: unknown): v is string | null => v === null || isCanonicalUuid(v);

export function validatePlacementPut(body: unknown): Validated<PlacementPutValue> {
  if (!isPlainObject(body)) return { ok: false, field: "body" };
  const extra = Object.keys(body).find((k) => !["seatId", "role", "expectedSeatId"].includes(k));
  if (extra !== undefined) return { ok: false, field: extra };
  if (!("seatId" in body) || !uuidOrNull(body.seatId)) return { ok: false, field: "seatId" };
  if (!("expectedSeatId" in body) || !uuidOrNull(body.expectedSeatId)) {
    return { ok: false, field: "expectedSeatId" };
  }
  const role = body.role;
  if (body.seatId === null) {
    if (role !== undefined && role !== "secondary") return { ok: false, field: "role" };
    return {
      ok: true,
      value: { seatId: null, role: "secondary", expectedSeatId: body.expectedSeatId },
    };
  }
  if (role !== "primary" && role !== "secondary") return { ok: false, field: "role" };
  return { ok: true, value: { seatId: body.seatId, role, expectedSeatId: body.expectedSeatId } };
}
