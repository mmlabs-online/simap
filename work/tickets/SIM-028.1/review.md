## Attempt 1 — 2026-11-21
Verdict: REWORK

### Checks (run by reviewer)
Node v22.23.5.
- `pnpm format:check` — exit 0, all 285 matched files formatted.
- `pnpm typecheck` — exit 0.
- `pnpm check:layers` — exit 0, 234 files, no violations.
- `pnpm test` — exit 0, 96 files passed; 939 passed, 3 skipped. Matches impl-log.
- `pnpm build` — exit 0.
- `pnpm check:dev-bundle` — exit 0, no dev-token strings in `.next/static`.
- `pnpm test:db` — not run (CI's job; no safe throwaway DB was set up for this review). The diff has no schema or query change.

Extra evidence:
- Negative control, run from a scratch directory: a probe holding `pnpm dev:token` gives exit 1 naming the file and markers; a missing `.next/static` gives exit 1.
- Production build with `NEXT_PUBLIC_SIMAP_DEV_TOKEN=1` and `NEXT_PUBLIC_SIMAP_DEV_PROD=1` forced on: build exit 0, `check:dev-bundle` exit 0. The flags cannot enable dev mode in a production build. Rebuilt clean afterwards: exit 0.
- Import walk from `DevGate.tsx` (27 modules, type-only imports skipped): no `runtime`, `tokenStore`, `identityClient`, `lib/dev-token` or `src/server` module.
- `next dev` on 127.0.0.1:3111 with a missing scratch token file and a dead `DATABASE_URL`, restarted plain → flag → plain on the same `.next/dev` cache: `/api/me` = 401 each time; the compiled `prodData` flag was inlined as `"1"` only in the flagged run. A cached compile does not carry the wrong badge across a restart.

### Acceptance criteria
- [x] AC1 (reviewer part) — evidence: `dev-flow.test.ts` "200 -> ready", `dev-fetch.test.ts` "sends same-origin with no Authorization", import walk above; `getAuthRuntime` is called only in `IdentityGate` among `AuthGate` routes. Live browser check is Ming's step 2.
- [x] AC2 (reviewer part) — evidence: `dev-flow.test.ts` "401 -> token invalid; 403 org_required -> token needOrg", `DevGate.test.tsx` invalid / needOrg views, live `/api/me` 401 with a missing token file. Live recovery is Ming's step 3.
- [x] AC3 (reviewer part) — evidence: `AppShellView.test.tsx` "devToken: badge shown, sign-out and switch absent…" and "no devToken…", `profile-views.test.tsx`, `views.test.tsx`; `saveProfile` follows `Gate`. Live save is Ming's step 4.
- [x] AC4 — evidence: build + `check:dev-bundle` exit 0, negative control exit 1, flagged production build clean; `IdentityGate` body unchanged in the diff.
- [x] AC5 — evidence: Checks above; `dev-fetch`, `dev-flow` and the views have Vitest tests. `DevGate` effects have no render-level test (no jsdom, D2), as impl-log states.

Ming verification after merge (from plan.md, not verified here):
1. `pnpm dev:token --org <your-org-uuid>`, then `pnpm dev`.
2. AC1: signed in at `http://localhost:3000`, no request to `api.mmlabs.online` with "Preserve log" on; `/sign-in` redirects into the app.
3. AC2: rename the token file → "Refresh permissions" → "No usable dev token"; restore → "Check again" → signed in without restart; token without `--org` → the `--org` hint; with `--org` → "Check again" → signed in.
4. AC3: amber badge at desktop and phone width, no sign-out or org switch; the first-visit profile saves.
5. Decision 1 = C: under a real `pnpm dev:prod`, the red "Production data" badge shows at desktop and phone width.

### Issues
#### Issue 1 — 🟡 should-fix — R3 env name missing (needs Ming approval: High path)
- **Where**: `.env.example` (no entry); the name is introduced at `scripts/dev-prod.mjs:91` and read in `src/ui/auth/DevGate.tsx` (`prodData`).
- **Expected**: R3: env names are listed in `.env.example`, without values. SIM-028 listed the sibling `NEXT_PUBLIC_SIMAP_DEV_TOKEN` with a "set by the launcher only" comment.
- **Actual**: a name-only count finds `NEXT_PUBLIC_SIMAP_DEV_TOKEN` once and `NEXT_PUBLIC_SIMAP_DEV_PROD` zero times.
- **Fix instruction**: `.env.example` is a High path the plan does not name, so get Ming's approval first and record it in the ticket Notes. Then append these two lines without opening or reordering the file, and list the file under `Out-of-plan files` in impl-log:
  ```
  # Set by scripts/dev-prod.mjs only (red "Production data" badge); never set it in a .env file.
  NEXT_PUBLIC_SIMAP_DEV_PROD=
  ```

### Rules (CLAUDE.md)
- R3: violation, see Issue 1.
- R1, R2, R4, R5, R6, R7: no violations found. No High path is changed. `scripts/dev.mjs`, `scripts/dev-prod.mjs` and their tests are in scope through Decision 1 = C; README steps 7-8 through Decision 3.
- Reported deviation accepted: badge text and variant travel in `Session.devToken` instead of `shell.ts`. This keeps "Dev token" and "Production data" out of the production bundle, which the marker list enforces; the type adds no access.

### Blockers from review agents
Left for the orchestrator: `security-review.md` appeared during this review and was not read or assessed here.

### Nits (do not block)
- `src/ui/auth/DevGate.tsx`: `generation.current += 1` runs inside a `setState` updater, which StrictMode invokes twice. The key only skips a number, so nothing breaks; computing it outside the updater would be cleaner.

### Follow-ups (out of scope)
- Add `pnpm check:dev-bundle` to `.github/workflows/ci.yml` after `pnpm build`, and to `.claude/loop.config.md` Checks and the `CLAUDE.md` Commands.

### Blockers from review agents (added by orchestrator, 2026-11-21)
From `security-review.md` Attempt 1. Fix these in REWORK attempt 2:
- 🔴 F1: the first-visit profile form writes to production with no red badge.
- 🟡 F2: `.env*` values can fake or suppress the badge. Both launchers must refuse them.
- 🟢 F3: `README.md:64` wrongly says `dev:prod` does not load `.env.local`. Correct it with F2.
- 🟢 F5: add a `SIMAP_DEV_TOKEN` marker to `FORBIDDEN` in `scripts/check-dev-bundle.mjs`.

Not in attempt 2:
- Issue 1 (`.env.example`) waits for Ming's decision because it is a High path. Do not edit that file.
- F4, F6 and the `simap_dev_expected_org` / `database_url` case-variant hardening are follow-ups.
