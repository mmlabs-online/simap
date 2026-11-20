# SIM-002: Database client, tudocuatui migrator and readiness

| Field | Value |
|---|---|
| State | BLOCKED |
| Priority | P0 |
| Size | M |
| Areas | db, security |
| Gate | plan-approval |
| Depends on | SIM-001 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-20 |
| Claimed by | — |
| PR | — |

## Goal
Connect simap to Postgres the tudocuatui way: one `pg` pool, the tudocuatui SQL migrator run as a one-shot command,
and a readiness route, so the schema ticket can add migrations.

## Scope reference
- `docs/spec-v1.md` §3 Platform (Database, Tooling), §8 Non-functional (Database, Config), SYS-04 (readiness part).
- `work/decisions.md` D2, D3 (forward-only migrations, migrate one-shot, database and role `simap`).
- CLAUDE.md R2, R3.

## Scope
- Server-only DB module: one `pg` pool from `DATABASE_URL`; app starts without it (readiness then 503), as tudocuatui.
- Port tudocuatui `server/migrator.js` + `server/migrate.js` (TypeScript or JS with `@ts-check`): plain SQL files
  `db/migrations/YYYYMMDDHHMMSS_name.sql`, forward-only, checksums recorded, advisory lock, one transaction per file,
  rejection of transaction-control statements. Drop tudocuatui-specific checks (RLS forcing, owner sub, views).
- `pnpm migrate` script and a standalone entry the SIM-004 `migrate` container can run outside the Next.js trace.
- `db/migrations/README.md` with the rules (copied/adapted from tudocuatui) plus simap's R6 (`org_id` on every org table).
- Readiness route, e.g. `GET /api/readyz` → `select 1` → 200, else 503 with no details.
- `DATABASE_URL` added to `.env.example` (name only).
- Local Postgres for development (e.g. `docker compose` file with Postgres 17) documented in README.

## Out of scope
- Any domain table (schema ticket, after OQ-34). DB integration test suite (later, D2). Prod database setup (M-3).

## Acceptance criteria
- [ ] `pnpm migrate` against an empty local database applies all files in order and records them; a second run applies
  nothing.
- [ ] Editing an applied migration makes `pnpm migrate` fail with a checksum error and change nothing.
- [ ] A file name that does not match the pattern, or a file containing `begin`/`commit`, is refused.
- [ ] `GET /api/readyz` answers 200 when the database answers and 503 (no error details) when it does not or
  `DATABASE_URL` is unset.
- [ ] Unit tests cover file-name parsing, ordering, checksum comparison and statement rejection (pure functions; no DB).

## Technical notes
- Files: `src/server/db/*`, `db/migrate.(ts|js)`, `db/migrations/README.md`, `src/app/api/readyz/route.ts`,
  `.env.example`, `compose.dev.yml` (or similar), `package.json`.
- References: tudocuatui `server/db.js`, `server/migrator.js`, `server/migrate.js`, `db/migrations/README.md`,
  their unit tests.
- Risks: never print `DATABASE_URL`; the migrate entry must not depend on Next.js runtime.

## Test plan
- Unit: migrator pure logic as listed in the AC.
- Manual: local Postgres → `pnpm migrate` with a throwaway sample file (not committed) → re-run → readyz 200; stop
  Postgres → readyz 503.

## Notes / answers from Ming
Waiting for Ming: plan approval (High tier) — `work/tickets/SIM-002/plan.md`, incl. its 8 *Decisions for Ming* (defaults apply if approved without comment).
Orchestrator correction to plan.md: `.env.example` **already exists** (SIM-001, contains `PORT=`). The planner could not see it because `.claude/settings.json` denies `Read(**/.env.*)`, which also matches `.env.example`. The implementer must **add** `DATABASE_URL=` to the existing file, not create/overwrite it.

## Handoff

### 2026-11-20 — claude — BLOCKED
- Agent calls: 2, tokens ~105k total (database-optimizer×1 sonnet 30k; planner×1 opus 76k; in/out split not reported)
- Done: claimed; Prepare (`pnpm install`) ok; consult saved; `plan.md` Status READY.
- In progress / next: Ming approves the plan (dated "Plan approved" line), then `/run SIM-002` resumes at IMPLEMENT.
- Gotchas: tudocuatui working tree is on `bug/BUG-010` — reference files were read from its `origin/main` (41ee069) via an export in the session scratchpad; the deny rule `Read(**/.env.*)` hides `.env.example` from agents (see note above); local Postgres needs Docker for `compose.dev.yml` / smoke runs.
