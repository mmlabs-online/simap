import { decodeCursor } from "@/lib/audit/cursor";
import {
  REQUEST_LIMITS,
  REQUEST_STATUSES,
  type MyRequestsFilter,
  type RequestListFilter,
  type RequestStatus,
} from "@/lib/requests/types";

export type RequestListQueryResult =
  | { ok: true; value: RequestListFilter }
  | { ok: false; field: string };
export type MyRequestsQueryResult =
  | { ok: true; value: MyRequestsFilter }
  | { ok: false; field: string };

const LIMIT_RE = /^[1-9]\d{0,2}$/;

/** undefined = absent (or blank); "dup" = repeated param. */
function get(params: URLSearchParams, k: string): string | undefined | "dup" {
  const all = params.getAll(k);
  if (all.length > 1) return "dup";
  return all[0] === "" ? undefined : all[0];
}

/** Shared by both parsers: `limit` and `cursor`. */
function parsePaging(params: URLSearchParams): MyRequestsFilter | { field: string } {
  const value: MyRequestsFilter = { limit: REQUEST_LIMITS.defaultLimit };
  const limit = get(params, "limit");
  if (limit === "dup" || (limit !== undefined && !LIMIT_RE.test(limit))) return { field: "limit" };
  if (limit !== undefined) {
    const n = Number(limit);
    if (n > REQUEST_LIMITS.maxLimit) return { field: "limit" };
    value.limit = n;
  }
  const cursor = get(params, "cursor");
  if (cursor === "dup") return { field: "cursor" };
  if (cursor !== undefined) {
    const c = decodeCursor(cursor);
    if (c === null) return { field: "cursor" };
    value.cursor = c;
  }
  return value;
}

export function parseRequestListQuery(params: URLSearchParams): RequestListQueryResult {
  const status = get(params, "status");
  if (
    status === "dup" ||
    (status !== undefined && !(REQUEST_STATUSES as readonly string[]).includes(status))
  ) {
    return { ok: false, field: "status" };
  }
  const paging = parsePaging(params);
  if ("field" in paging) return { ok: false, field: paging.field };
  return { ok: true, value: { ...paging, status: (status ?? "pending") as RequestStatus } };
}

export function parseMyRequestsQuery(params: URLSearchParams): MyRequestsQueryResult {
  const paging = parsePaging(params);
  if ("field" in paging) return { ok: false, field: paging.field };
  return { ok: true, value: paging };
}
