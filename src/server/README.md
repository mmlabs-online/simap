# src/server

Server-only logic and SQL, grouped by module (`src/server/<module>/service.ts`, `queries.ts`, tests) plus
`src/server/http/` (bearer verify wrapper, single error shape).

- Every non-test `.ts` file starts with `import "server-only";`.
- May import `src/server/**` and `src/lib/**` only; never `src/ui` or `src/app`.
- Entered only from route handlers under `src/app/api/**` (D4). Enforced by `pnpm check:layers`.
