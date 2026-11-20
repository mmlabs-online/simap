import "server-only";
import { encodeCursor } from "@/lib/audit/cursor";
import {
  AUDIT_LIMITS,
  type AuditEntryDto,
  type AuditFacets,
  type AuditFilter,
  type AuditPage,
} from "@/lib/audit/types";
import { orgQuery, type OrgScope } from "@/server/http/org-scope";

type Db = { query(text: string, values: unknown[]): Promise<{ rows: any[] }> };

type Row = {
  id: string;
  actor_sub: string;
  display_name: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  meta: Record<string, unknown> | null;
  at: string;
};

const toDto = (r: Row): AuditEntryDto => ({
  id: r.id,
  actor: { sub: r.actor_sub, displayName: r.display_name },
  action: r.action,
  entity: r.entity,
  entityId: r.entity_id,
  meta: r.meta,
  at: r.at,
});

/** SYS-03: newest first, keyset-paged on (created_at, id). Predicates are added only for present filters. */
export async function listAudit(db: Db, scope: OrgScope, f: AuditFilter): Promise<AuditPage> {
  const where = ["a.org_id = $1"];
  const values: unknown[] = [];
  const bind = (v: unknown): string => {
    values.push(v);
    return `$${values.length + 1}`;
  };
  if (f.actor !== undefined) where.push(`a.actor_sub = ${bind(f.actor)}::uuid`);
  if (f.entity !== undefined) where.push(`a.entity = ${bind(f.entity)}::text`);
  if (f.from !== undefined) where.push(`a.created_at >= ${bind(f.from)}::timestamptz`);
  if (f.to !== undefined) where.push(`a.created_at < ${bind(f.to)}::timestamptz`);
  if (f.cursor !== undefined) {
    where.push(
      `(a.created_at, a.id) < (${bind(f.cursor.at)}::timestamptz, ${bind(f.cursor.id)}::uuid)`,
    );
  }
  const limit = bind(f.limit + 1);
  const { rows } = await orgQuery<Row>(
    db,
    scope,
    `select a.id, a.actor_sub, m.display_name, a.action, a.entity, a.entity_id, a.meta,
       to_char(a.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as at
     from audit_log a
     left join members m on m.org_id = a.org_id and m.sub = a.actor_sub
     where ${where.join(" and ")}
     order by a.created_at desc, a.id desc
     limit ${limit}::int`,
    values,
  );
  const page = rows.slice(0, f.limit);
  const last = page[page.length - 1];
  const nextCursor =
    rows.length > f.limit && last !== undefined ? encodeCursor({ at: last.at, id: last.id }) : null;
  return { items: page.map(toDto), nextCursor };
}

export async function listAuditFacets(db: Db, scope: OrgScope): Promise<AuditFacets> {
  const actors = await orgQuery<{ actor_sub: string; display_name: string | null }>(
    db,
    scope,
    `select distinct a.actor_sub, m.display_name
     from audit_log a
     left join members m on m.org_id = a.org_id and m.sub = a.actor_sub
     where a.org_id = $1
     order by m.display_name nulls last, a.actor_sub
     limit ${AUDIT_LIMITS.facetActorsMax}`,
  );
  const entities = await orgQuery<{ entity: string }>(
    db,
    scope,
    `select distinct a.entity from audit_log a
     where a.org_id = $1
     order by 1
     limit ${AUDIT_LIMITS.facetEntitiesMax}`,
  );
  return {
    actors: actors.rows.map((r) => ({ sub: r.actor_sub, displayName: r.display_name })),
    entities: entities.rows.map((r) => r.entity),
  };
}
