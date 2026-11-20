# Loop config — simap

Project-specific settings for the spaceM project-kit commands (`/run`, `/run-batch`, `/ticket`, `/bug`, `/solo`,
`/status`, `/idea`) and the `planner` / `implementer` / `reviewer` agents. Written by `/apply-kit` (2026-11-20, empty
repo), then owned by this project: a kit upgrade never overwrites this file. **Most values are TODO until the
scaffold ticket picks the framework**; that ticket updates this file in the same PR.

## Identity
- Ticket prefix: `SIM` (tickets `SIM-001`…; bugs `BUG-001`…).
- Ticket IDs: `SIM-NNN` for every ticket that is not a bug.
- Owner: Ming. Reports to Ming in Vietnamese. Ming merges every PR; agents never approve, merge or enable auto-merge.

## Selection
- Pick order: `board`

## Scope sources
- `docs/spec-v1.md` (written by `/idea`, 2026-11-20)
- `work/decisions.md`

## Prepare
- `pnpm install --frozen-lockfile` (once `package.json` exists; before that: none)
- TODO (scaffold ticket): local Postgres for tests (docker compose or a test container).

## Checks
| Check | Command |
|---|---|
| format | TODO (scaffold ticket), e.g. `pnpm format:check` |
| lint / typecheck | TODO, e.g. `pnpm lint && pnpm typecheck` |
| test | TODO, e.g. `pnpm test` |
| build | TODO, e.g. `pnpm build` |

Until the scaffold ticket lands there is no code: tickets before it are docs/spec only and have no checks.
Bug test level: unit/integration test with the project's test runner (TODO); a one-off scripted check recorded in
impl-log when that level cannot see the bug.

## Plan approval gate
- Policy: `high-paths`

## High paths
<!-- Mirror of `high:` in .github/risk-tiers.yml. Revisit when the scaffold ticket fixes the layout. -->
- DB migrations: `migrations/**`, `db/migrations/**`, `**/*.sql`
- Server auth, secrets and config: `server/**/auth*`, `src/server/**/auth*`, `**/config.*`, `.env.example`
- Production build and deploy: `Dockerfile`, `.dockerignore`, `docker/**`, `deploy/**`, `.github/workflows/release*`,
  `.github/workflows/deploy*`, `.github/risk-tiers.yml`

## Consult
<!-- Area → specialist agent (read-only, at PLAN). -->
| Area | Agent |
|---|---|
| architecture | `software-architect` |
| db | `database-optimizer` |
| api | `api-platform-engineer` |
| ui | `frontend-developer` |
| ux | `ux-architect` |

## Review triggers
<!-- Run in parallel with `reviewer`. A 🔴 finding turns PASS into REWORK. -->
| Agent | Output file | Areas | Changed paths |
|---|---|---|---|
| `security-ai-generated-code-auditor` | `security-review.md` | security | `server/`, `src/server/`, `**/auth*`, `migrations/`, `db/`, `**/*.sql`, `.env.example`, `Dockerfile`, `.github/workflows/` |

## Cost controls
- Fast lane: `on` — Size XS/S tickets with Gate `none` skip consult; planner runs on sonnet.
- Small-diff review: `on` — diff < 100 changed lines and no High path → reviewer on sonnet.
- Max consultants: `2` per ticket.

## Model overrides
- —

## Batch
- Batch size: `5`
- Auto-merge Low: `off` — mirror of `auto_merge` in spaceM `bootstrap/projects.yaml`; only Ming changes it.
- Merge method: `squash`

## /solo limits
- Any High path, schema changes, auth, secrets, and anything before the scaffold ticket defines the layout.

## Domain focus
- TODO (from `docs/spec-v1.md` once written): domain edge cases.
- Always: Vietnamese text and diacritics, UTC vs UTC+7 dates, empty/null fields, pagination bounds.
- Server: input validation at the boundary, one error shape, no secrets or PII in logs, migrations reversible.

## Guardrails
- Never read `.env*` values; never touch the hosting dashboard, the shared Postgres or the deployment repo by hand.
- Never apply migrations to a production database; never push `release/*` (a release is Ming's step).
