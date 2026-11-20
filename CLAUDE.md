# simap (spaceM project rules)

simap is a seat (network port) and device tracking app in the mmlabs ecosystem, run as a multi-organization service:
each organization has its own data, admins and users. It records rooms, seats, who sits where and which devices sit
where, lets users request seats for a Manager to approve, and shows capacity on a dashboard (`docs/spec-v1.md` §1).
simap replaces the inactive SeatMGT (Ming, 2026-11-20).

- Scope: `docs/spec-v1.md` is the source of truth once it exists. If a ticket and the spec disagree, the spec wins; flag the conflict.

## Repo
- Remote: `git@github.com:mmlabs-online/simap.git`, default branch `main`, write mode `direct`.
- Backlog: `work/` (spaceM project-kit).

## Stack
- Node 22 + pnpm 10, TypeScript; Next.js 16; one Next.js app (App Router) serves the UI and the API (`/api/*` route handlers) (D1).
- Same tooling as tudocuatui (D2): `pg` with hand-written SQL (no ORM), tudocuatui's SQL migrator (forward-only),
  `jose` for Identity tokens, Tailwind CSS v4, oxfmt, Vitest (light unit tests in the first phase).
- Auth: mmlabs Identity (org-admin-api), token in browser memory, bearer to route handlers (D4); multi-org via Identity
  organizations (D5). DB: shared self-hosted mmlabs Postgres, database and role `simap` (spaceM CI/CD type `server-db`).

Do not change the stack without Ming's explicit decision.

## Commands
- `pnpm install --frozen-lockfile`, `pnpm dev`, `pnpm start` (runs the standalone server; static assets are served only after `.next/static` is copied next to it, done by the SIM-004 image), `pnpm build`.
- `pnpm typecheck` (next typegen + tsc), `pnpm check:layers` (R1 import guard), `pnpm sprites:pack` (builds `public/sprites/office.png/json`; `--no-map` = placeholders only), `pnpm format` / `pnpm format:check`
  (oxfmt), `pnpm test` (Vitest), `pnpm migrate` (applies `db/migrations`, needs `DATABASE_URL`), `pnpm migrate:smoke`
  (scripted migrator check), `pnpm schema:check` (scripted check of the real schema, needs a DB), `pnpm test:db` (DB integration tests in a throwaway database, needs a local `DATABASE_URL`; CI runs it), `pnpm seed:dev` (fake
  data, local DB only), `docker compose -f compose.dev.yml up -d` (local Postgres). There is no lint script (no ESLint, D2). Keep `.claude/loop.config.md` → Checks in sync.

## Rules (reviewer enforces these)
- R1 UI and page code never imports server code; route handlers under `src/app/api/**` are the only entry into
  `src/server/**` (D4). Layers: api (`src/app/api/**`) → server, lib; pages (`src/app/**`) → ui, lib; ui (`src/ui/**`) →
  lib; server (`src/server/**`, each non-test file starts with `import "server-only"`) → server, lib; lib
  (`src/lib/**`, pure code, validators in `src/lib/validate/`) → lib. Imports across layers use the `@/` alias.
  `pnpm check:layers` enforces this.
- R2 Every schema change ships with a reviewed forward-only SQL migration (tudocuatui rules: expand then contract, so
  the previous image keeps working); never edit an applied migration (D3).
- R6 Every org table has `org_id`; every query of org data is scoped by the verified token's `org` claim and roles come
  only from `org_roles` (D5).
- R3 Config from env only; names in `.env.example`, no values; no secrets in code, logs or client bundles.
- R4 Stay inside the ticket's plan; anything else goes to follow-ups.
- R5 No PASS without green checks; new logic has tests.

## Risk tiers
- High paths: `.github/risk-tiers.yml` (mirrored in `.claude/loop.config.md`).

## Workflow

<!-- spaceM project-kit 1.1.2 — inserted by /apply-kit. Settings: `.claude/loop.config.md`. Kit files: `.claude/kit.lock`. -->

One orchestrated loop per ticket. **The main session is the orchestrator** (subagents cannot dispatch other subagents), driven by `/run`.

```
/ticket "..."   →  BACKLOG
/bug "..."      →  BACKLOG (BUG-xxx; then: record PR, record another, or fix the batch now)
/run [ID]       →  CONSULT → PLAN ─(gate: High path → Ming approves)→ IMPLEMENT → REVIEW ─PASS→ DONE → PR → Ming merges → MERGED
                                                                         ^            │
                                                                         └── REWORK ──┘  max 2 reworks → ESCALATED (stop, ask Ming)
/solo "..."     →  small direct change outside the loop (logged in work/solo-log.md)
/status         →  board summary
/run-batch …    →  several tickets: plan all → one approval round → build + PR each (--auto-merge: merge Low / approved Medium, then continue)
```

- Each ticket runs on branch `ticket/<ID>` (or the session's mandated branch). The board `work/backlog.md` changes only on `main`; tickets run in the pick order of `loop.config.md` (default: row order).
- A ticket is claimed with `Claimed by: claude@<timestamp>` and every run appends to `## Handoff` in its `ticket.md`.
- **Ming approves and merges every PR.** The only exception is `/run-batch --auto-merge`: Low PRs when `Auto-merge Low` is on, Medium PRs Ming approved in the batch round; High never.
- Project settings (ticket prefix, scope sources, checks, consult table, review triggers, High paths, guardrails): `.claude/loop.config.md`.
- Ticket states: `BACKLOG` → `PLANNING` → `IN_PROGRESS` → `REVIEW` → `DONE` → `MERGED`, plus `REWORK`, `BLOCKED`, `ESCALATED`.

Files: `work/backlog.md` (board), `work/ming-todo.md` (Ming-only steps), `work/decisions.md`, `work/solo-log.md`,
`work/templates/`, `work/batches/` (`/run-batch` state), `work/tickets/<ID>/` (`ticket.md`, `consult-*.md`, `plan.md`, `impl-log.md`, `review.md`, review-agent files, `escalation.md`).

Kit-managed files (`.claude/commands/`, `.claude/agents/`, `work/templates/`, `.github/scripts/risk_tier.py`,
`.github/workflows/risk-tier.yml`) come from spaceM `skills-library/project-kit`; change them there, not here, so every project gets the fix.

**Start here:** run `/idea "<what simap is for>"` to write `docs/spec-v1.md`; the scaffold (SIM-001) is in place, so continue with `/ticket` for the first feature ticket.

## Conventions
- Code, comments, docs and commits in English; reports to Ming in Vietnamese.
- Commits: `<ID>: <imperative summary>` for tickets, `solo: …` for `/solo`, otherwise conventional style.
- UI copy: English, in `src/ui/copy/<feature>.ts` (D36).
