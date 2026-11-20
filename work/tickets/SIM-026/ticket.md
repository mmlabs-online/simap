# SIM-026: Run service SQL against Postgres in CI (DB integration tests)

| Field | Value |
|---|---|
| State | MERGED |
| Priority | P1 |
| Size | M |
| Areas | db, security |
| Gate | none |
| Depends on | SIM-010 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-20 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/18 |

## Goal
Service SQL (starting with the rooms service) runs against a real Postgres in CI on every PR, so SQL mistakes are
caught before merge instead of only by fake-client tests and hand review.

## Scope reference
- `work/tickets/SIM-010/review.md` Attempt 1 condition: the rooms SQL never ran against Postgres; CI's Postgres job
  only runs migrate-smoke and schema-check. Plan step 7 of `work/tickets/SIM-010/plan.md` lists the cases.
- CLAUDE.md R5 (new logic has tests); D3 (forward-only migrations). Ming 2026-11-20: "tạo 2 ticket follow-up".

## Scope
- A DB integration test setup: a throwaway database per run (like `scripts/schema-check.mjs`), migrated with the real
  migrator, guarded by `assertDevSeedTarget` (never a non-local host, never `NODE_ENV=production`).
- Integration tests for the rooms service (`src/server/rooms/rooms.ts`) through its real functions:
  1. the same room code in org A and org B succeeds; a duplicate in one org (also differing only by case) → 409;
  2. rename with a seat whose seq ≥ 100 rewrites every seat code in one transaction;
  3. the seat counter keeps growing after a seat is deleted (D30);
  4. plain delete of a room with an occupant → 409 `room_not_empty`; forced delete with an occupant and a primary
     device succeeds and passes the deferred trigger at COMMIT;
  5. a room id from another org → 404 for update and delete.
- A separate command (e.g. `pnpm test:db`) and a CI step on the existing Postgres service; `pnpm test` stays
  database-free (tests skip cleanly when no DB is configured).
- Docs: the command in CLAUDE.md Commands and `.claude/loop.config.md` Checks (as a CI-only check), README.

## Out of scope
- Integration tests for services not yet written (later tickets add theirs to this setup).
- Changes to the rooms service itself (SIM-025), unless a test exposes a real bug — then record it and stop for Ming.

## Acceptance criteria
- [ ] `pnpm test:db` creates a throwaway DB, migrates, runs the integration tests, and drops the DB; it refuses a
  non-local `DATABASE_URL` (exit 2) without connecting.
- [ ] Cases 1–5 above pass against Postgres 17 in CI.
- [ ] `pnpm test` without a database still passes and does not try to connect.
- [ ] CI runs `pnpm test:db` on every PR; the step prints no connection string.
- [ ] Commands documented in CLAUDE.md, loop.config Checks and README.

## Technical notes
- Files: a Vitest config or project for DB tests, `src/server/**/*.db.test.ts` (or similar), a setup script under
  `scripts/`, `package.json`, `.github/workflows/ci.yml`, CLAUDE.md, `.claude/loop.config.md`, README.
- No High path expected (`ci.yml` is not on the High list); if the plan needs `scripts/check-layers.mjs` or
  `db/migrations/**`, the Gate becomes `plan-approval`.
- No Postgres on the dev device: CI is the first real run.

## Test plan
- Integration: cases 1–5 in CI.
- Unit: the guard refusal path of the setup script.

## Notes / answers from Ming
- Plan approved (2026-11-20, batch 2026-11-20-3) — Ming: "duyệt hết theo đề xuất" (every proposal in the batch round accepted).
- 2026-11-20: created on Ming's request ("tạo 2 ticket follow-up") from the SIM-010 review condition.

## Handoff

### 2026-11-20 — claude — DONE
- Agent calls: 5, ~320k tokens (database-optimizer×1 40k, planner×1 84k, implementer×1 70k, reviewer×1 n/a, security auditor×1 87k)
- Done: test:db wrapper + guard, throwaway-DB global setup, 11 rooms DB tests incl. trigger control and two-client lock test, CI step, docs; review PASS attempt 1 (conditional on CI); security 0 🔴 / 2 🟡 (High-path fixes)
- In progress / next: Ming merges SIM-025 first, then this once CI 'db integration tests' is green; decide on the 🟡 follow-up ticket
- Gotchas: built on ticket/SIM-025; first real DB run is CI
