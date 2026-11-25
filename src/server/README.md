# src/server

Server-only logic and SQL, grouped by module (`src/server/<module>/service.ts`, `queries.ts`, tests) plus
`src/server/http/` (bearer verify wrapper, single error shape).

- Every non-test `.ts` file starts with `import "server-only";`.
- May import `src/server/**` and `src/lib/**` only; never `src/ui` or `src/app`.
- Entered only from route handlers under `src/app/api/**` (D4). Enforced by `pnpm check:layers`.
- Route handlers (except healthz/readyz) are wrapped with `withAuth(handler, { tier })` from `src/server/http/with-auth.ts`; `routes-guarded.test.ts` enforces the wrap through a runtime marker.
- Org queries use `orgQuery(db, ctx.scope, sql, values)` (`org_id = $1` required). `ctx.scope` is built by `withAuth` only; services take `scope: OrgScope`, never an org id string. Never take an org id from a request.
- Seat/device lock order (see the comment above `deleteRoom` in `rooms/rooms.ts`): room row first (`for update` to create/delete/rename seats, `for share` to change an occupant or place a device), then seat rows `for update` in ascending `id`, then devices / seat_requests. Never take a seat lock before the room row. Layout save: room `for update` → seats `for update` → catalog marker → `map_items` rows `for key share` in key order.
