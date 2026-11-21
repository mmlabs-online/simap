# SIM-029: Guard dev scripts against the production DB and add `pnpm dev:prod`

| Field | Value |
|---|---|
| State | PLANNING |
| Priority | P1 |
| Size | M |
| Areas | db, security |
| Gate | none |
| Depends on | SIM-028 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-21 |
| Claimed by | claude@2026-11-21T03:25:25Z |
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
- `pnpm dev:prod` (`scripts/dev-prod.mjs`, cross-platform Node; the simap counterpart of tudocuatui
  `scripts/start-dev.sh`), in order, stopping at the first failure with nothing started:
  1. dev token: if the token file is missing, malformed or expires within 2 minutes, run the `dev:token` script
     (SIM-028); stop unless a fresh token is on disk afterwards.
  2. tunnel: if the Docker container (default `pg-tunnel-pg-tunnel-1`, override `SIMAP_PG_TUNNEL`) is not running,
     `docker start` it; then check `127.0.0.1:15432` answers.
  3. refuse when `.env.local` sets `DATABASE_URL` (line check only, value never read into output); ask for the `simap`
     role password with hidden input, URL-encode it, keep it only in the child env.
  4. start the SIM-028 launcher (`next dev -H 127.0.0.1`, dev-token mode) with that env, print a "production data:
     every change is real" banner; Ctrl-C stops the child and leaves the terminal usable.
- README: production-DB section with the guardrails.

## Out of scope
- Starting the tunnel itself (`d:\project\pg-tunnel`, Ming's machine), creating the `simap` role (M-3).

## Acceptance criteria
- [ ] Each of the five scripts exits 2 before connecting when `DATABASE_URL` points at port 15432 or
      `SIMAP_DB_TARGET=production`; tests cover each entry.
- [ ] The container migrate path (`NODE_ENV=production`, image entry) is unaffected; a test proves it.
- [ ] `pnpm dev:prod` never writes the password or URL to disk or stdout and refuses when `.env.local` has `DATABASE_URL`.
- [ ] `pnpm dev:prod` stops before asking for the password when the token step or the tunnel step fails, and with a
      valid token and tunnel starts the app bound to `127.0.0.1` (`/api/readyz` 200); tests cover the step order with
      the token, Docker and child-process calls injected.
- [ ] All Checks green.

## Technical notes
- Files: `db/migrate.js`, `db/seed-dev.js`, `scripts/test-db.mjs`, `scripts/schema-check.mjs`,
  `scripts/migrate-smoke.mjs`, new `scripts/dev-prod.mjs`, `package.json`, `README.md`, `.env.example` (names only).
- Real use needs M-3 (database and role `simap` on the shared Postgres).

## Test plan
- Unit: target classifier; CLI tests that each script exits 2 on a production target.
- Manual: tunnel up, `pnpm dev:prod`, `/api/readyz` 200; `pnpm seed:dev` with the tunnel URL refused.

## Notes / answers from Ming
- 2026-11-21: `pnpm dev:prod` is simap's one-command equivalent of tudocuatui `scripts/start-dev.sh` (token → tunnel →
  password → app), written in Node for Windows; one Next.js process replaces tudocuatui's API + UI pair.

## Handoff
