import "server-only";
import { orgQuery, type OrgScope } from "@/server/http/org-scope";

type Db = { query(text: string, values: unknown[]): Promise<{ rows: unknown[] }> };

/** SYS-03: call inside the write's transaction. `meta` holds codes, field names and counts only; no secrets. */
export async function writeAudit(
  db: Db,
  scope: OrgScope,
  a: {
    actorSub: string;
    action: string;
    entity: string;
    entityId: string | null;
    meta?: Record<string, unknown>;
  },
): Promise<void> {
  // The select-from-subselect form satisfies orgQuery's org_id = $1 guard; org_id is always the scope org.
  await orgQuery(
    db,
    scope,
    `insert into audit_log (org_id, actor_sub, action, entity, entity_id, meta)
     select o.org_id, $2::uuid, $3::text, $4::text, $5::uuid, $6::jsonb
     from (select $1::uuid as org_id) o where o.org_id = $1::uuid`,
    [
      a.actorSub,
      a.action,
      a.entity,
      a.entityId,
      a.meta === undefined ? null : JSON.stringify(a.meta),
    ],
  );
}
