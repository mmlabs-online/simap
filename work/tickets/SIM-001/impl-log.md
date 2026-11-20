## Attempt 1 — 2026-11-20

### Files touched
| File | Required because |
|---|---|
| `package.json`, `pnpm-lock.yaml`, `.mise.toml`, `.node-version` | AC1; pins as tudocuatui (pnpm 10.34.9, Node 22). next 16.4.6, react/react-dom 19.2.9, vitest 5.1.0, server-only 0.0.1 exact |
| `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `vitest.config.ts`, `src/test/server-only-stub.ts` | AC1, AC2, AC4 |
| `.prettierignore`, `.gitignore` | format:check scope, clean tree after build |
| `src/app/{layout,page}.tsx`, `src/app/globals.css` | AC1 placeholder page |
| `src/app/api/healthz/route.ts` + `route.test.ts` | AC2 |
| `src/{server,ui,lib}/README.md` | AC4 layout on disk |
| `scripts/check-layers.mjs` + `check-layers.test.ts` | AC4 |
| `.github/workflows/ci.yml` | AC3 |
| `.env.example` | AC5 (`PORT=` only) |
| `CLAUDE.md`, `.claude/loop.config.md` | AC4, AC5 (description, Stack, Commands, R1; Prepare, Checks, High paths) |
| `.github/risk-tiers.yml` | new High entries (Approach 6) |

### Tests added / changed
- `src/app/api/healthz/route.test.ts` › 2 tests (200 body, no-store)
- `scripts/check-layers.test.ts` › 9 tests per plan list

### Checks (actual output summary)
Local Node v24.20.0 (engines wants 22); pnpm resolves to 10.34.9 via corepack/packageManager. Pins unchanged; only warnings
"Unsupported engine" (pnpm does not fail on it). Installs used `--config.engine-strict=false`.
- install --frozen-lockfile: exit 0, lockfile up to date
- typecheck (`next typegen && tsc --noEmit`): exit 0
- check:layers: `check-layers: 9 files, no violations`
- test: `Test Files 2 passed (2), Tests 11 passed (11)`
- format:check: `All matched files use the correct format.`
- build: exit 0; routes `/`, `/_not-found`, `ƒ /api/healthz`; `.next/standalone/server.js` exists
- dev smoke (port 3111): `/` shows "Đang xây dựng"; `/api/healthz` 200, `cache-control: no-store`, `{"status":"ok"}`
- No pnpm ignored-build-scripts approval was needed (no `onlyBuiltDependencies`).
- CI not run locally (Linux/Node 22); first PR run is the real confirmation.

### Out-of-plan files
- `.prettierignore` also lists `.github/workflows/risk-tier.yml` (kit-managed; oxfmt would reformat it and fail
  `format:check`). `tsconfig.json` has `.next/dev/types/**/*.ts` added by Next on first typecheck.

### Follow-ups (noticed, not done)
- `gh` CLI unavailable, so no `debt` issue was opened. The planned R2-vs-D3 debt is moot: CLAUDE.md R2 already says
  "forward-only SQL migration ... (D3)" on this branch; the README/loop.config "migrations reversible" line under
  Domain focus ("Server: ... migrations reversible") still contradicts D3 and should be aligned (debt, project:simap).
- `.claude/loop.config.md` header still says "Most values are TODO until the scaffold ticket"; `CLAUDE.md` "Start here"
  paragraph is stale. Left (outside plan text).
- `.claude/loop.config.md` Domain focus still has the TODO line (spec domain edge cases).
- Local dev machine runs Node 24; consider `.mise.toml` use so local matches CI.

### Scope self-check
- Could the diff be smaller? No.
- Diff size: see `git show --stat` (config/docs plus ~100-line guard script and tests; lockfile excluded).

## Attempt 2 — 2026-11-20 (REWORK)
### Files touched
- `.gitattributes` (new): `* text=auto eol=lf` — Issue 1 (CRLF checkout broke `format:check`). Index was already LF; `git add --renormalize .` changed nothing else.
- `next.config.ts`: `agentRules: false` — Issue 2.
- `CLAUDE.md`: line 24 `pnpm start` limit stated (Issue 3); "Start here" paragraph refreshed (nit).
- `.claude/loop.config.md`: stale "TODO until the scaffold ticket" header reworded (nit).
- Deleted the untracked local `AGENTS.md` (Next-generated).

### Checks (fresh `git clone -b ticket/SIM-001` of local repo into scratchpad, default Git for Windows `core.autocrlf=true`, 0 files with CRLF in working tree)
- install --frozen-lockfile: exit 0
- format:check: exit 0, "All matched files use the correct format." (16 files)
- typecheck: exit 0; check:layers: `9 files, no violations`; test: `11 passed (11)`; build: exit 0, `.next/standalone/server.js` exists
- `next dev` on the clean clone: `/api/healthz` 200, `git status` clean, no `AGENTS.md` created.

### Out-of-plan files
- `.gitattributes` (required by AC1).

### Follow-ups
- Ming: add the spaceM thin `AGENTS.md` for simap; optionally re-enable `agentRules` (Next upserts only its marked block).
- SIM-004: copy `.next/static` (and `public/` once it exists) into the standalone image.
- Debt issues (no `gh` here): loop.config Domain focus "migrations reversible" vs D3; Domain focus spec-edge-case TODO; local Node 24 vs pinned 22 (suggest `mise`).

### Scope self-check
- Only review-listed issues (plus two trivial wording nits) changed.
