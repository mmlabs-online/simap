# SIM-029: Guard dev scripts against the production DB and add `pnpm dev:prod`

| Field | Value |
|---|---|
| State | BACKLOG |
| Priority | P1 |
| Size | S |
| Areas | db, security |
| Gate | none |
| Depends on | SIM-028 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-21 |
| Claimed by | — |
| PR | — |

## Goal
Let Ming run the local app against the production database through the Cloudflare pg-tunnel without any dev script
being able to migrate, seed or create throwaway databases there.

## Scope reference
- D56 (Ming, 2026-11-21); tudocuatui README "Development" D45 guardrails (production `DATABASE_URL` only at runtime,
  never in a file; never migrate production from a laptop).
- loop.config.md Guardrails: never apply migrations to a production database.

## Scope
- A shared pure check (`src/lib/…` or `scripts/…`) that marks a target as production when its port is the tunnel port
  (`15432`, override `SIMAP_PROD_TUNNEL_PORT`) or `SIMAP_DB_TARGET=production` is set.
- `pnpm migrate`, `seed:dev`, `test:db`, `schema:check`, `migrate:smoke` refuse a production target (exit 2, value never
  printed), even though the host is `127.0.0.1`. The production image's migrate entry (`node db/migrate.js` in the
  container) keeps working.
- `pnpm dev:prod`: checks the tunnel answers on `127.0.0.1:15432`, refuses when `.env.local` sets `DATABASE_URL`, asks for
  the `simap` role password with hidden input, then starts `pnpm dev` with `DATABASE_URL` only in the child env.
- README: production-DB section with the guardrails.

## Out of scope
- Starting the tunnel itself (`d:\project\pg-tunnel`, Ming's machine), creating the `simap` role (M-3).

## Acceptance criteria
- [ ] Each of the five scripts exits 2 before connecting when `DATABASE_URL` points at port 15432 or
      `SIMAP_DB_TARGET=production`; tests cover each entry.
- [ ] The container migrate path (`NODE_ENV=production`, image entry) is unaffected; a test proves it.
- [ ] `pnpm dev:prod` never writes the password or URL to disk or stdout and refuses when `.env.local` has `DATABASE_URL`.
- [ ] All Checks green.

## Technical notes
- Files: `db/migrate.js`, `db/seed-dev.js`, `scripts/test-db.mjs`, `scripts/schema-check.mjs`,
  `scripts/migrate-smoke.mjs`, new `scripts/dev-prod.mjs`, `package.json`, `README.md`, `.env.example` (names only).
- Real use needs M-3 (database and role `simap` on the shared Postgres).

## Test plan
- Unit: target classifier; CLI tests that each script exits 2 on a production target.
- Manual: tunnel up, `pnpm dev:prod`, `/api/readyz` 200; `pnpm seed:dev` with the tunnel URL refused.

## Notes / answers from Ming

## Handoff
