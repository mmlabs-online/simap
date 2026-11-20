# simap (spaceM project rules)

TODO: one-paragraph description of what this project does and for whom (from `docs/spec-v1.md` once `/idea` writes it).
simap replaces the inactive SeatMGT (Ming, 2026-11-20).

- Scope: `docs/spec-v1.md` is the source of truth once it exists. If a ticket and the spec disagree, the spec wins; flag the conflict.

## Repo
- Remote: `git@github.com:mmlabs-online/simap.git`, default branch `main`, write mode `direct`.
- Backlog: `work/` (spaceM project-kit).

## Stack
- Planned: Node 22 + pnpm, TypeScript; a server with its own PostgreSQL database (spaceM CI/CD type `server-db`).
- TODO: framework, test runner, ORM / migration tool — decided by the first scaffold ticket.

Do not change the stack without Ming's explicit decision.

## Commands
- TODO (scaffold ticket): install, dev, typecheck, lint, format, test, build. Keep `.claude/loop.config.md` → Checks in sync.

## Rules (reviewer enforces these)
- R1 TODO: layering and module shape (decided by the scaffold ticket).
- R2 Every schema change ships with a reviewed migration with a working down/rollback; never edit an applied migration.
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

**Start here:** run `/idea "<what simap is for>"` to write `docs/spec-v1.md`, then `/ticket` a scaffold ticket (framework, test runner, migrations, CI) that also fills the TODOs in `.claude/loop.config.md` and this file.

## Conventions
- Code, comments, docs and commits in English; reports to Ming in Vietnamese.
- Commits: `<ID>: <imperative summary>` for tickets, `solo: …` for `/solo`, otherwise conventional style.
