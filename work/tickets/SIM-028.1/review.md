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

## Attempt 2 — 2026-11-21
Verdict: PASS

### Checks (run by reviewer)
Node v22.23.5.
- `pnpm format:check` — exit 0, 285 files formatted.
- `pnpm typecheck` — exit 0.
- `pnpm check:layers` — exit 0, 234 files, no violations.
- `pnpm test` — first run exit 1: 1 failed, 945 passed, 3 skipped. The failure is `src/server/identity/verify.test.ts:169` ("within leeway ok"). Five full reruns on the same code: exit 0 each, 96 files, 946 passed, 3 skipped. This branch has no diff under `src/server`, and the test depends on the wall clock. The cause of the one failure was not established.
- `pnpm build` — exit 0.
- `pnpm check:dev-bundle` — exit 0, no dev-token strings in `.next/static`.
- `pnpm test:db` — not run, left to CI as instructed.

### Rework items
- [x] F1 — `src/ui/auth/DevGate.tsx:54-74,197-212`: under the flag, profile, token, noAccess, retry and checking views all carry the red notice. Evidence: `DevGate.test.tsx` "shows the red notice…", "shows no notice…" and "wraps every non-ready view". The strings stay in the dev-only chunk (`check:dev-bundle` exit 0).
- [x] F2 — `scripts/dev.mjs:58-66,94-105`, `scripts/dev-prod.mjs:189-193`: both launchers exit 2 naming the file, without printing the value, and `dev:prod` refuses before the password prompt. Evidence: tests in `scripts/dev.test.ts` and `scripts/dev-prod.test.ts`. Compared with the regex from `@next/env` 16.4.6 on in-memory strings: plain, lower, mixed case, CRLF, `export`, indent, colon and BOM are all refused; comment and look-alike are not. Two unusual forms are still missed, see Follow-ups.
- [x] F3 — `README.md:62-65`: now says the `next dev` child loads `.env.local`, and documents the refusal.
- [x] F5 — `scripts/check-dev-bundle.mjs:16`: marker added. Negative control: a scratch probe holding `SIMAP_DEV_TOKEN` is reported by `findForbidden`.

### Acceptance criteria
- [x] AC1 (reviewer part) — evidence from Attempt 1 still applies; `DevGate` gained no new import.
- [x] AC2 (reviewer part) — `dev-flow.test.ts`, `DevGate.test.tsx` pass.
- [x] AC3 (reviewer part) — `AppShellView.test.tsx`, `profile-views.test.tsx`, `views.test.tsx` pass.
- [x] AC4 — build and `check:dev-bundle` exit 0, with the stricter marker list.
- [x] AC5 — Checks above, with the one non-reproducing failure recorded.

Ming verification after merge (from plan.md and Decision 1 = C, not verified here):
1. `pnpm dev:token --org <your-org-uuid>`, then `pnpm dev`.
2. AC1: signed in at `http://localhost:3000`, no request to `api.mmlabs.online` with "Preserve log" on; `/sign-in` redirects into the app.
3. AC2: rename the token file → "Refresh permissions" → "No usable dev token"; restore → "Check again" → signed in without restart; token without `--org` → the `--org` hint; with `--org` → "Check again" → signed in.
4. AC3: amber badge at desktop and phone width, no sign-out or org switch; the first-visit profile saves.
5. Decision 1 = C: under a real `pnpm dev:prod`, the red "Production data" badge shows in the shell and the red notice shows on the first-visit profile form, at desktop and phone width, without hiding the form.

### Issues
None that block.

### Needs Ming's decision
- Attempt 1 Issue 1: add `NEXT_PUBLIC_SIMAP_DEV_PROD` to `.env.example` (R3). This is a High path, so the implementer cannot resolve it and it does not affect this verdict. `.env.example` is absent from the `git diff --stat origin/main...HEAD` file list, so it has no diff.

### Rules (CLAUDE.md)
- R3: the open item above, waiting for Ming. No other violation found.
- R1, R2, R4, R5, R6, R7: no violations found. The rework commit `4feed2f` touches only the F1, F2, F3 and F5 files, their tests and `impl-log.md`. No High path is changed.

### Blockers from review agents
F1, F2, F3 and F5 are verified above. `security-review.md` was updated by another agent during this review; its Attempt 2 was not read or assessed here and is left for the orchestrator.

### Not verified
- Live browser behaviour, a real `pnpm dev:prod`, and the notice's layout at phone width (need a real token or production access).
- A real `next dev` loading `.env*` on Windows: no `.env*` file was read or created. F2 was checked with injected readers and in-memory strings against Next's parse regex.
- `DevGate` effects at render level (no jsdom, D2).
- `origin/main` was not fetched; the diff uses the local ref.

### Nits (do not block)
- `src/ui/auth/DevGate.tsx`: the `generation.current += 1` nit from Attempt 1 remains.
- `scripts/dev.mjs:60`: the BOM is now a literal invisible character in the regex; `﻿` would be easier to read.

### Follow-ups (out of scope)
- Harden `envFileSetsKey`: Next also accepts a lone CR as a line break and a key with `=` on the next line, and the launchers do not refuse these two forms. Parsing with the same rules as `@next/env` would close them, and belongs with the case-variant hardening of `SIMAP_DEV_EXPECTED_ORG` and `DATABASE_URL`.
- Check `src/server/identity/verify.test.ts:169` for wall-clock flakiness.
- F4, F6, and `pnpm check:dev-bundle` in CI, `.claude/loop.config.md` and `CLAUDE.md`.

### Rework requested by Ming (added by orchestrator, 2026-11-21)
Fix in REWORK attempt 3: security Attempt 2 S1 and S2, and add the `.env.example` name (M-18). S3, S4 and the other follow-ups stay out of this PR.

## Attempt 3 — 2026-11-21
Verdict: PASS

This PASS covers S1, S2 and the Checks. It does not cover the content of `.env.example`, which was not verified (see "Not verified"). Ming should run the command there before merging.

### Checks (run by reviewer)
Node 22 through fnm.
- `pnpm format:check` — exit 0, 285 files.
- `pnpm typecheck` — exit 0.
- `pnpm check:layers` — exit 0, 234 files, no violations.
- `pnpm test` — exit 0, 96 files, 951 passed, 3 skipped. Matches impl-log.
- `pnpm build` — exit 0.
- `pnpm check:dev-bundle` — exit 0, no dev-token strings in `.next/static`.
- `pnpm test:db` — not run, left to CI as instructed.

### Rework items
- [x] S1 — `scripts/dev.mjs:61-67`. Evidence: the real `@next/env` 16.4.6 `loadEnvConfig`, fed in-memory strings through a patched `fs` on a non-existent root (no real `.env*` file read).
  - 108 named cases, 0 mismatches, across the flag (upper and lower case), `DATABASE_URL` and `SIMAP_DEV_ORG`: lone CR, key and `=` on separate lines, key after U+2028/2029, BOM, `export`, colon form; comments and look-alikes pass.
  - 120,000 seeded generated strings (40,000 per key): 0 cases where Next sets the key and the launcher misses it.
  - Over-refusals, the safe direction: 64 (flag), 41 (`DATABASE_URL`), 30 (`SIMAP_DEV_ORG`).
  - No weakening: 0 strings refused by the previous matcher (`4d07c7e`) and accepted by the new one, for all three keys. `DATABASE_URL` and `SIMAP_DEV_ORG` stay case-sensitive (`scripts/dev-prod.mjs:74,195`).
- [x] S2 — `scripts/dev.mjs:85-94,124-130`, `scripts/dev-prod.mjs:179-185,218-222`.
  - `dev:prod` `run()` with injected deps: EBUSY, EPERM, EACCES, EISDIR and EIO on each of the 4 files (20 cases) all exit 2 with the fixed message, no password prompt, no spawn, no error content.
  - `dev` launcher: a scratch copy with a real unreadable path (directory named as each of the 4 files) exits 2 with the fixed message and starts nothing.
  - The real reader returns null for missing files and throws `EnvReadFailure` with no `cause` on EISDIR.
- [ ] `.env.example` (M-18) — NOT VERIFIED. The file name appears in the branch diff and in `d17dc00`; line counts and added lines were not inspected.

### Acceptance criteria
- [x] AC1, AC2, AC3 (reviewer parts) — no change to UI code in the rework commit `d17dc00`; related tests pass.
- [x] AC4 — build and `check:dev-bundle` exit 0.
- [x] AC5 — Checks above; new logic has tests in `scripts/dev.test.ts` and `scripts/dev-prod.test.ts`.

Ming verification after merge (from plan.md and Decision 1 = C, not verified here):
1. `pnpm dev:token --org <your-org-uuid>`, then `pnpm dev`.
2. AC1: signed in at `http://localhost:3000`, no request to `api.mmlabs.online` with "Preserve log" on; `/sign-in` redirects into the app.
3. AC2: rename the token file → "Refresh permissions" → "No usable dev token"; restore → "Check again" → signed in without restart; token without `--org` → the `--org` hint; with `--org` → "Check again" → signed in.
4. AC3: amber badge at desktop and phone width, no sign-out or org switch; the first-visit profile saves.
5. Decision 1 = C: under a real `pnpm dev:prod`, the red "Production data" badge shows in the shell and the red notice shows on the first-visit profile form, at desktop and phone width, without hiding the form.

### Issues
None that block.

### Rules (CLAUDE.md)
- R3: the `.env.example` entry is not verified, see below. No other violation found.
- R1, R2, R4, R5, R6, R7: no violations found. `d17dc00` changes only `.env.example` (approved, M-18), both launchers, their tests and `impl-log.md`.

### Blockers from review agents
None recorded at the time of this review. `security-review.md` showed as modified in the working tree during this review, by another agent; it was not read again or assessed.

### Not verified
- `.env.example` content: the permission system denied the command that included `git diff --numstat origin/main...HEAD -- .env.example`, and it was not retried. So the 3-line count, the commented form and the absence of a value are unconfirmed. Before merging, Ming can run: `git diff --numstat origin/main...HEAD -- .env.example` (expected `3	0	.env.example`).
- A real `next dev` loading `.env*` on Windows, a real `pnpm dev:prod`, and live browser behaviour.
- `dev:prod` `main()` itself (it needs a TTY); its read-failure path was exercised through `run()` with the real reader's contract.
- `origin/main` was not fetched; the diff uses the local ref.

### Nits (do not block)
- `src/ui/auth/DevGate.tsx`: the `generation.current += 1` nit from Attempt 1 remains.

### Follow-ups (out of scope)
- S3, S4, F4, F6 and case-variant hardening of other keys.
- Check `src/server/identity/verify.test.ts:169` for wall-clock flakiness (passed in this run).
- `pnpm check:dev-bundle` in CI, `.claude/loop.config.md` and `CLAUDE.md`.

### Rework requested by Ming (added by orchestrator, 2026-11-21)
Fix in REWORK attempt 4 on `ticket/SIM-028.1-fixes` (PR #34): security Attempt 3 S5 only.
