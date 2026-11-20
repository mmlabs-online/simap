# src/server

Server-only logic and SQL, grouped by module (`src/server/<module>/service.ts`, `queries.ts`, tests) plus
`src/server/http/` (bearer verify wrapper, single error shape).

- Every non-test `.ts` file starts with `import "server-only";`.
- May import `src/server/**` and `src/lib/**` only; never `src/ui` or `src/app`.
- Entered only from route handlers under `src/app/api/**` (D4). Enforced by `pnpm check:layers`.
- Route handlers (except healthz/readyz) are wrapped with `withAuth(handler, { tier })` from `src/server/http/with-auth.ts`; `routes-guarded.test.ts` enforces the wrap through a runtime marker.
- Org queries use `orgQuery(db, ctx.scope, sql, values)` (`org_id = $1` required). `ctx.scope` is built by `withAuth` only; services take `scope: OrgScope`, never an org id string. Never take an org id from a request.
