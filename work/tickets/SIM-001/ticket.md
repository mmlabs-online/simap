# SIM-001: Scaffold the Next.js app, tooling and CI

| Field | Value |
|---|---|
| State | REWORK |
| Priority | P0 |
| Size | M |
| Areas | architecture, security |
| Gate | plan-approval |
| Depends on | — |
| Needs Ming | — |
| Attempts | 1 |
| Created | 2026-11-20 |
| Claimed by | claude@2026-11-20T03:57Z |
| PR | — |

## Goal
Give simap a running Next.js (App Router) project with the tudocuatui tooling and green CI checks, so every later
ticket has a layout, commands and checks to build on.

## Scope reference
- `docs/spec-v1.md` §3 Platform (App, Tooling), §8 Non-functional (Config), SYS-04 (liveness part).
- `work/decisions.md` D1 (Next.js for UI + API), D2 (tudocuatui tooling, light unit tests), D4 (route handlers + bearer).
- CLAUDE.md "Start here": the scaffold ticket fills the TODOs in CLAUDE.md and `.claude/loop.config.md`.

## Scope
- Next.js App Router project in TypeScript, Node 22 + pnpm (pinned like tudocuatui: `.mise.toml`, `.node-version`,
  `packageManager`), `output: "standalone"` ready for SIM-004.
- Tooling copied from tudocuatui (D2): oxfmt (`format`, `format:check`), `tsc --noEmit` typecheck, Vitest (`test`),
  Tailwind CSS v4. No ESLint, no ORM, no e2e runner.
- Layout and **R1 layering** (proposed in the plan, Ming approves): e.g. `src/app/**` routes and thin `/api/*` route
  handlers; `src/server/<module>/` services + SQL (server-only); `src/ui/**` components; `src/lib/**` shared pure code.
  The rule: UI code never imports server code; route handlers are the only entry to server modules (D4).
- Liveness route (no DB), e.g. `GET /api/healthz` → `{ status: "ok" }`.
- `.env.example` with names only (R3).
- GitHub Actions CI running the checks on PRs (pattern of tudocuatui `.github/workflows/ci.yml`, without the DB parts).
- Fill CLAUDE.md "Commands", R1 and the project description paragraph; fill `.claude/loop.config.md` Prepare/Checks;
  revisit High paths in `.github/risk-tiers.yml` + loop.config mirror for the chosen layout.

## Out of scope
- Database client, migrator, readiness route (SIM-002).
- UI kit, shell, pages (SIM-003). Identity sign-in (auth ticket). Dockerfile and deploy (SIM-004).

## Acceptance criteria
- [ ] `pnpm install`, `pnpm dev`, `pnpm typecheck`, `pnpm format:check`, `pnpm test`, `pnpm build` all work on a clean
  checkout; `pnpm build` produces a standalone output.
- [ ] `GET /api/healthz` answers 200 `{ "status": "ok" }` without touching a database; a Vitest unit test covers it.
- [ ] CI runs typecheck, format check, test and build on every PR and is green.
- [ ] R1 layering is written in CLAUDE.md, and the layout on disk follows it (no server module imported from UI code).
- [ ] CLAUDE.md Commands and `.claude/loop.config.md` Prepare/Checks list the real commands; `.env.example` exists
  with names and no values.

## Technical notes
- Files: `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `.mise.toml`,
  `.node-version`, `.prettierignore`/oxfmt config, `src/app/layout.tsx`, `src/app/page.tsx`,
  `src/app/api/healthz/route.ts`, `.github/workflows/ci.yml`, `.env.example`, `CLAUDE.md`, `.claude/loop.config.md`,
  `.github/risk-tiers.yml`.
- References: tudocuatui `package.json`, `.mise.toml`, `.github/workflows/ci.yml`; seatMGT `ming_dev` `next.config.ts`,
  `tsconfig.json`.
- Risks: Next.js version pin (seatMGT used 16.x); keep `server-only` imports to make the R1 rule enforceable.

## Test plan
- Unit: healthz route handler returns 200 and the expected body.
- Manual: clean clone → install → dev server shows the placeholder page; `pnpm build` succeeds.

## Notes / answers from Ming
Waiting for Ming: plan approval (High tier) — `work/tickets/SIM-001/plan.md`, incl. its 9 *Decisions for Ming* (defaults apply if approved without comment).
Plan approved — 2026-11-20 (Ming, in chat: "approved"; all 9 *Decisions for Ming* take their defaults).

## Handoff

### 2026-11-20 — claude — BLOCKED
- Agent calls: 2, tokens ~89k total (software-architect×1 opus 35k; planner×1 opus 54k; in/out split not reported)
- Done: claimed; consult saved (`consult-software-architect.md`); `plan.md` Status READY.
- In progress / next: Ming approves the plan (add a dated "Plan approved" line above, plus any changes to the 9 decisions), then `/run SIM-001` resumes at IMPLEMENT.
- Gotchas: seatMGT `ming_dev` not checked out locally, so the Next 16.x pin is unverified; the planner rejects consult Finding 6 (`**/config.*` only matches files named `config.*`); CLAUDE.md R2 still says "down/rollback" vs D3 — implementer opens a `debt` issue; `gh` CLI is missing on this Windows device, so the PR step needs it installed or Ming opens the PR.
