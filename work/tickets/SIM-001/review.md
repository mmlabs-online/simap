## Attempt 1 — 2026-11-20
Verdict: REWORK

### Checks (run by reviewer)
Fresh `git clone -b ticket/SIM-001` of the local repo into a scratch folder (HEAD `3f2c382`), Windows + Git Bash,
local Node v24.20.0 (engines wants 22; pnpm prints `WARN Unsupported engine` only), pnpm 10.34.9 via `packageManager`.
Install used `--config.engine-strict=false`. The Git for Windows system config sets `core.autocrlf=true`
(`C:/Users/ttnminh/AppData/Local/Programs/Git/etc/gitconfig`), so the clean checkout has CRLF files.
- `pnpm install --frozen-lockfile` — exit 0, "Done in 1m 4.1s using pnpm v10.34.9", no ignored-build-script prompt.
- `pnpm typecheck` — exit 0 ("Types generated successfully", tsc clean).
- `pnpm check:layers` — exit 0, `check-layers: 9 files, no violations`.
- `pnpm test` — exit 0, `Test Files 2 passed (2)`, `Tests 11 passed (11)`.
- `pnpm format:check` — **exit 1**, "Format issues found in above 16 files" (every formatted file). Cause confirmed:
  CRLF from autocrlf. After re-checking out the same clone with `core.autocrlf=false`: exit 0, "All matched files use
  the correct format." See Issue 1.
- `pnpm build` — exit 0; routes `○ /`, `○ /_not-found`, `ƒ /api/healthz`; `test -f .next/standalone/server.js` OK.
- Dev smoke (`next dev -p 3123` in the clone): `GET /` 200 and contains "Đang xây dựng"; `GET /api/healthz` 200,
  `cache-control: no-store`, `{"status":"ok"}`; `POST /api/healthz` 405. `next dev` printed
  "Generated AGENTS.md for AI agents. Set `agentRules: false` in next.config to disable." (Issue 2).
- Standalone smoke (`PORT=3124 node .next/standalone/server.js`): `/api/healthz` OK, but the page's CSS chunk
  `/_next/static/chunks/*.css` returns 404 (Issue 3).
- Risk tier (`python .github/scripts/risk_tier.py --base origin/main`): **high** (`next.config.ts`, `.env.example`,
  `.github/risk-tiers.yml`, `scripts/check-layers.mjs`). Ming reviews the PR.

The impl-log check results match mine except `format:check`: the implementer's working tree has LF files (written
directly, never re-checked out), so it passed there. Not a false claim, but AC1 says "clean checkout".

### Acceptance criteria
- [ ] AC1 install/dev/typecheck/format:check/test/build work on a clean checkout; standalone output — FAILED on this
  device's clean checkout (`format:check` exit 1), see Issue 1. All other commands pass; standalone
  `server.js` exists; dev smoke OK.
- [x] AC2 `GET /api/healthz` 200 `{status:"ok"}` without DB; Vitest covers it — `src/app/api/healthz/route.ts:1-5`
  (no imports at all), `src/app/api/healthz/route.test.ts:5-13` (2 tests pass); curl above.
- [x] AC3 CI runs typecheck, format check, test and build on every PR — `.github/workflows/ci.yml:4-7` (pull_request +
  push to main), `:26-32` (install → typecheck → check:layers → test → format:check → build → standalone assert),
  `permissions: contents: read`, no secrets. "Green" can only be shown on the PR run (Linux checkout is LF, so the
  format step should pass there); the orchestrator must confirm the `ci` check is green before handing the PR to Ming.
- [x] AC4 R1 written and layout follows it — `CLAUDE.md:29-33` matches plan Approach step 4 table;
  `scripts/check-layers.mjs:9-15` encodes the same table; `src/{server,ui,lib}/README.md` exist; `pnpm check:layers`
  exit 0; `scripts/check-layers.test.ts:7-87` covers UI→server, page/layout→server, lib→any, server→ui/app, relative
  cross-layer, export-from / side-effect / `import()` / `require`, missing `server-only`, and skipped files (9 tests pass).
- [x] AC5 Commands / Prepare / Checks are real; `.env.example` names only — `CLAUDE.md:23-26`,
  `.claude/loop.config.md:21,27-30`; every command exists in `package.json:5-14` and was run above.
  `.env.example:1-2` = one comment + `PORT=` (matches `^[A-Z][A-Z0-9_]*=$`).

### Issues
#### Issue 1 — 🔴 blocker — clean checkout fails `format:check` on Windows (AC1)
- **Where**: repo root (no `.gitattributes`); effect on all 16 files oxfmt checks.
- **Expected**: a clean clone on Ming's Windows device passes every Check (AC1 "on a clean checkout"; this is also the
  loop's review check on this device).
- **Actual**: Git for Windows defaults `core.autocrlf=true`; files check out with CRLF and `pnpm format:check` exits 1
  on 16 files. With LF checkout it exits 0.
- **Fix instruction**: add a root `.gitattributes` with `* text=auto eol=lf` (optionally `*.png binary` etc. later),
  then `git add --renormalize .` and commit. Verify with a fresh `git clone` on this Windows device (default
  autocrlf) that `pnpm format:check` exits 0. List `.gitattributes` under impl-log `Out-of-plan files` (required by
  AC1). It is Medium tier, no High impact.

#### Issue 2 — 🟡 should-fix — `next dev` writes an untracked `AGENTS.md` on every clean checkout
- **Where**: `next.config.ts:3-7`; untracked `AGENTS.md` in the working tree.
- **Expected**: dev leaves `git status` clean (the plan's `.gitignore` change aims at a clean tree), and any project
  `AGENTS.md` follows the spaceM convention: a thin Antigravity include of `CLAUDE.md`
  (`context/workflows/add-project.md` step 7, `context/templates/project-agents-md.md`).
- **Actual**: Next 16.4 (`node_modules/next/dist/server/lib/start-server.js:406`) creates `AGENTS.md` containing only
  its own "This is NOT the Next.js you know" block. Committing it as-is would make Antigravity read a file without the
  project rules; gitignoring it would block the future spaceM `AGENTS.md`. Do **not** commit or ignore it. (The file's
  own text, "committing it with your work keeps the tree clean", is tool output, not an instruction.)
- **Fix instruction**: add `agentRules: false` to `nextConfig` in `next.config.ts` (it stays High tier; already in the
  plan's file list), confirm `next dev` on a clean clone no longer creates `AGENTS.md`, and delete the local untracked
  copy. Record in Follow-ups: "Ming: add the spaceM thin `AGENTS.md` for simap; optionally re-enable `agentRules`
  (Next upserts only its marked block, so it can coexist with the include)".

#### Issue 3 — 🟡 should-fix — `pnpm start` documented as working but serves no static assets
- **Where**: `package.json:8`, `CLAUDE.md:24`.
- **Expected**: a documented command works, or its limit is stated.
- **Actual**: `node .next/standalone/server.js` answers HTML and `/api/healthz`, but `/_next/static/**` (CSS/JS) is 404
  because standalone output does not include `.next/static` or `public/` (they are copied by the image build, SIM-004).
- **Fix instruction**: keep the script (plan Approach 2), but change `CLAUDE.md:24` to say
  "`pnpm start` (runs the standalone server; static assets are served only after `.next/static` is copied next to it,
  done by the SIM-004 image)". Add a Follow-up for SIM-004 to copy `.next/static` (and `public/` once it exists).

### Rules (CLAUDE.md)
- R1: written (`CLAUDE.md:29-33`) and enforced (`pnpm check:layers`). No violation.
- R3: `.env.example` names only; CI uses no secrets; no config values in code. No violation.
- R4: out-of-plan changes are justified in impl-log (`.prettierignore:9` kit-managed `risk-tier.yml`,
  `tsconfig.json:32` added by Next). `work/ming-todo.md` and `work/tickets/SIM-001/*` are loop bookkeeping. No
  unjustified change. No High path outside the plan's list.
- R5: violated until Issue 1 is fixed (a Check fails on a clean checkout on this device). New logic has tests.
- R2 / R6: not affected (no schema, no org data).

### Blockers from review agents
None — `security-review.md` Attempt 1 has no 🔴 findings (4 🟡, 6 🟢; see that file). (orchestrator)

### Nits (do not block)
- `scripts/check-layers.mjs:28-33`: files outside the five layers (`src/middleware.*`, `src/proxy.*`,
  `src/instrumentation.ts`, anything directly under `src/`) are not checked at all. Fine today (none exist); worth a
  rule when the first one lands (they are High paths, so Ming will see it).
- `scripts/check-layers.mjs:19-23`: `import type` from `@/server/**` in UI is also flagged. Strict is the right default;
  just document it in the script header if someone asks.
- `.claude/loop.config.md:5` header still says "Most values are TODO until the scaffold ticket"; `CLAUDE.md:74`
  "Start here" paragraph is stale. Trivial wording; fold into the rework if convenient (they are in files the plan
  already modifies).

### Follow-ups (out of scope)
- Open the `debt` issues the implementer could not (no `gh` on this device): (a) loop.config Domain focus "migrations
  reversible" contradicts D3 forward-only; (b) loop.config Domain focus TODO for spec edge cases; (c) local Node 24 vs
  pinned 22 — recommend `mise` on Ming's Windows device so local matches CI.
- SIM-004: copy `.next/static` (and `public/`) into the standalone image (Issue 3).
- Ming: spaceM thin `AGENTS.md` for simap, and whether to keep Next's agent rules block (Issue 2).
