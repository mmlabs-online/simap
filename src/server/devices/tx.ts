import "server-only";
import type { PlacementRefusalCode, DeleteRefusalCode } from "@/lib/devices/rules";
import type { TransferStartRefusalCode } from "@/lib/devices/handoff-rules";
import { withTx, type TxClient, type TxPool } from "@/server/db/tx";
import { orgQuery, type OrgScope } from "@/server/http/org-scope";
import { deviceConflict, type DeviceConflictCode } from "./pg-error";

export type Query = { query(text: string, values: unknown[]): Promise<{ rows: any[] }> };
export type Db = TxPool & Query;

export type Refusal = {
  ok: false;
  status: 404 | 409 | 422;
  code:
    | "not_found"
    | "member_not_assignable"
    | "not_assigned"
    | "handoff_not_pending"
    | "handoff_stale"
    | "invalid_recipient"
    | PlacementRefusalCode
    | TransferStartRefusalCode
    | DeviceConflictCode
    | DeleteRefusalCode;
};
export type Result<T> = { ok: true; value: T } | Refusal;

export const notFound: Refusal = { ok: false, status: 404, code: "not_found" };

/** Thrown inside a transaction to roll it back and answer with a domain refusal. */
export class Abort extends Error {
  constructor(readonly refusal: Refusal) {
    super("abort");
  }
}

export async function inTx<T>(pool: Db, fn: (c: TxClient) => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, value: await withTx(pool, fn) };
  } catch (err) {
    if (err instanceof Abort) return err.refusal;
    // the deferred owner trigger fires at COMMIT, so this wraps withTx
    const code = deviceConflict(err);
    if (code) return { ok: false, status: code === "device_unowned" ? 422 : 409, code };
    throw err;
  }
}

export const refuse = (status: Refusal["status"], code: Refusal["code"]) =>
  new Abort({ ok: false, status, code });

export async function actorMemberId(
  c: Query,
  scope: OrgScope,
  actorSub: string,
): Promise<string | null> {
  const { rows } = await orgQuery<{ id: string }>(
    c,
    scope,
    "select id from members where org_id = $1 and sub = $2",
    [actorSub],
  );
  return rows[0]?.id ?? null;
}
