import "server-only";
import { getPool } from "@/server/db/pool";
import { orgQuery } from "@/server/http/org-scope";
import type { MemberGate } from "@/server/http/with-auth";

type PoolLike = { query(text: string, values: unknown[]): Promise<{ rows: any[] }> };

/**
 * SIM-005 deny list: one indexed lookup per request (members_org_sub_key), nothing cached. A missing row is
 * `active` (the first visit creates it in /api/me). A throw is a fail-closed 503 in withAuth.
 */
export function createMemberGate(getPoolFn: () => PoolLike | null): MemberGate {
  return async (scope, sub) => {
    const pool = getPoolFn();
    if (!pool) throw new Error("db_unavailable");
    const { rows } = await orgQuery<{ status: string }>(
      pool,
      scope,
      "select status from members where org_id = $1 and sub = $2",
      [sub],
    );
    return rows[0]?.status === "deactivated" ? "deactivated" : "active";
  };
}

export const dbMemberGate: MemberGate = createMemberGate(getPool);
