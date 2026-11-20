import "server-only";

declare const orgScopeBrand: unique symbol;

/** The caller's verified org. Created only by `withAuth` from the verified token (`ctx.scope`); no exported constructor. Tests may cast. */
export type OrgScope = { readonly orgId: string; readonly [orgScopeBrand]: true };

type Db<R> = { query(text: string, values: unknown[]): Promise<{ rows: R[] }> };

/**
 * Every query of org data goes through here (R6). Write `WHERE org_id = $1 AND ...` and number your own
 * parameters from `$2`; `scope.orgId` is bound as `$1`. The guard is a heuristic (it checks the text only);
 * reviewers still check joins. Works with a `pg.Pool` and a `PoolClient` (transactions).
 */
export function orgQuery<R = unknown>(
  db: Db<R>,
  scope: OrgScope,
  text: string,
  values: readonly unknown[] = [],
): Promise<{ rows: R[] }> {
  if (!/\borg_id\s*=\s*\$1\b/i.test(text)) {
    throw new Error("orgQuery: SQL must filter org_id = $1");
  }
  return db.query(text, [scope.orgId, ...values]);
}
