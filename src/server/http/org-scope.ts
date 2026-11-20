import "server-only";
import type { AuthContext } from "./with-auth";

declare const orgScopeBrand: unique symbol;

/** The caller's verified org. Only `orgScopeOf` creates one, so an org id cannot come from a request body or URL. */
export type OrgScope = { readonly orgId: string; readonly [orgScopeBrand]: true };

export function orgScopeOf(ctx: Pick<AuthContext, "org">): OrgScope {
  return { orgId: ctx.org } as OrgScope;
}

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
