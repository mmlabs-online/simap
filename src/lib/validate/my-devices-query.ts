import { decodeMyDevicesCursor, type MyDevicesCursor } from "@/lib/devices/cursor";
import { MY_DEVICES_LIMITS } from "@/lib/devices/types";

export type MyDevicesQuery = { limit: number; cursor?: MyDevicesCursor };
export type MyDevicesQueryResult =
  | { ok: true; value: MyDevicesQuery }
  | { ok: false; field: string };

const LIMIT_RE = /^[1-9]\d{0,2}$/;

export function parseMyDevicesQuery(params: URLSearchParams): MyDevicesQueryResult {
  /** undefined = absent (or blank); "dup" = repeated param. */
  const get = (k: string): string | undefined | "dup" => {
    const all = params.getAll(k);
    if (all.length > 1) return "dup";
    return all[0] === "" ? undefined : all[0];
  };
  const value: MyDevicesQuery = { limit: MY_DEVICES_LIMITS.defaultLimit };

  const limit = get("limit");
  if (limit === "dup" || (limit !== undefined && !LIMIT_RE.test(limit))) {
    return { ok: false, field: "limit" };
  }
  if (limit !== undefined) {
    const n = Number(limit);
    if (n > MY_DEVICES_LIMITS.maxLimit) return { ok: false, field: "limit" };
    value.limit = n;
  }

  const cursor = get("cursor");
  if (cursor === "dup") return { ok: false, field: "cursor" };
  if (cursor !== undefined) {
    const c = decodeMyDevicesCursor(cursor);
    if (c === null) return { ok: false, field: "cursor" };
    value.cursor = c;
  }
  return { ok: true, value };
}
