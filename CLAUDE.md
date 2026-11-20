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

## Conventions
- Code, comments, docs and commits in English; reports to Ming in Vietnamese.
- Commits: `<ID>: <imperative summary>` for tickets, `solo: …` for `/solo`, otherwise conventional style.
