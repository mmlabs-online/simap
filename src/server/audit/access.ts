import "server-only";
import { writeAudit } from "@/server/audit/write";
import { getPool } from "@/server/db/pool";
import type { OrgScope } from "@/server/http/org-scope";

/** Writes the cross-org access marker (D75/D86); meta holds codes only (SYS-03). */
export type AccessAudit = (
  scope: OrgScope,
  sub: string,
  meta: { method: string; route: string },
) => Promise<void>;

export const writeAccessAudit: AccessAudit = async (scope, sub, meta) => {
  const pool = getPool();
  if (!pool) throw Object.assign(new Error("db_unavailable"), { code: "db_unavailable" });
  await writeAudit(pool, scope, {
    actorSub: sub,
    action: "access.super_admin",
    entity: "org",
    entityId: scope.orgId,
    meta,
  });
};
