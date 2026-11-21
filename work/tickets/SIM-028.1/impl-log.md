# Implementation log — SIM-028.1

## Attempt 1 — 2026-11-21

Step 1 (bundle proof): after adding `AuthGate` + `DevGate` + the check script, `pnpm build && pnpm check:dev-bundle` exited 0:
Next drops the lazy `DevGate` chunk and the dev-only strings. Negative control: a probe `.next/static/__probe.js` containing
`pnpm dev:token` made the check exit 1 naming the file and markers; the probe was deleted. Re-run on the final code: exit 0.

### Files touched
| File | Required because |
|---|---|
| `src/ui/auth/AuthGate.tsx` | Inline-literal guard, lazy `DevGate`, new `AuthGate`; old gate renamed `IdentityGate` (body untouched) |
| `src/ui/auth/DevGate.tsx` (new) | The dev-token gate; exports `DevTokenView`, `devBadge`; reads `NEXT_PUBLIC_SIMAP_DEV_PROD` under the same literal DEV guard |
| `src/lib/api/dev-fetch.ts` (new), `src/lib/api/fetch.ts` | Dev `apiFetch` (one send, no Authorization); `accessCodeOf` exported |
| `src/lib/identity/dev-flow.ts` (new) | `DevView`, `devViewForMe`, `devMeErrorView`, `loadDevView`, `createSingleFlight` |
| `src/lib/session.ts` | `Session.devToken?: DevBadge` (carries its own label, tooltip, `prod`) |
| `src/ui/AppShellView.tsx` | Amber badge or red badge from `session.devToken`; sign-out hidden when set |
| `src/ui/copy/dev-token.ts` (new) | All dev-only copy incl. both badge labels (D36) |
| `src/ui/org/ProfileView.tsx`, `src/ui/auth/views.tsx` | `onSignOut` optional on `ProfileView` and `NoAccessView` |
| `scripts/check-dev-bundle.mjs` (new), `package.json` | `pnpm check:dev-bundle` (markers incl. `SIMAP_DEV_PROD`, `Production data`, `Dev token`) |
| `scripts/dev.mjs` | `devEnv` drops an inherited `NEXT_PUBLIC_SIMAP_DEV_PROD` in any letter case (Decision 1 = C) |
| `scripts/dev-prod.mjs` | `childEnv` sets `NEXT_PUBLIC_SIMAP_DEV_PROD=1` after `devEnv` (Decision 1 = C) |
| `README.md` | Local development steps 7-8 (Decision 3), incl. the `dev:prod` badge |
| test files | see below |

Design note: the badge texts live in `src/ui/copy/dev-token.ts` and travel in `session.devToken`, instead of in
`shell.ts` as the plan said, so `AppShellView` (in the production bundle) holds no dev-only or "Production data" string.

### Tests added / changed
- `src/lib/api/dev-fetch.test.ts` (7), `src/lib/identity/dev-flow.test.ts` (6), `src/ui/auth/DevGate.test.tsx` (6, incl. `devBadge` per mode and the guard literal)
- `src/ui/AppShellView.test.tsx` (devToken amber and prod red badge, sign-out hidden; no devToken unchanged), `src/ui/org/profile-views.test.tsx`, `src/ui/auth/views.test.tsx`
- `scripts/check-dev-bundle.test.ts` (5), `scripts/dev.test.ts` (plain dev strips the flag in any case), `scripts/dev-prod.test.ts` (child env has the flag, replacing case variants)

### Checks (actual output summary)
- typecheck: exit 0
- check:layers: 234 files, no violations
- format:check: all matched files use the correct format
- test: 96 files passed; 939 passed, 3 skipped
- build: exit 0; `pnpm check:dev-bundle`: no dev-token strings in .next/static

### Out-of-plan files
`scripts/dev.mjs`, `scripts/dev-prod.mjs`, `scripts/dev.test.ts`, `scripts/dev-prod.test.ts`: the plan's "do not edit" list, overridden by Ming's Decision 1 = C.

### Follow-ups (noticed, not done)
- Add `pnpm check:dev-bundle` to `.github/workflows/ci.yml` after `pnpm build`, and to `.claude/loop.config.md` Checks and the `CLAUDE.md` Commands (agents may not edit these).
- Not verified: live browser behaviour (needs a real token, M-1); the `dev:prod` badge in a real run; `DevGate` effects (no jsdom, D2), so ready / flip / Check again paths are covered only by the pure modules.

### Scope self-check
- Could the diff be smaller? No.

## Attempt 2 (rework of review attempt 1: F1, F2, F3, F5)

Files touched:
- `src/ui/auth/DevGate.tsx`: `ProdNotice` + `withNotice` wrap every non-ready view (profile, token, noAccess, retry, checking) when `prodData`; strings stay in DevGate (F1).
- `src/ui/auth/DevGate.test.tsx`: render tests (flag on/off via stubbed env + fresh import; every non-ready view wrapped) (F1).
- `scripts/dev.mjs`: `envFileSetsKey` (now with `ignoreCase`, moved here), `ENV_FILE_NAMES`, `envFileSettingDevProd`, `devProdFileMessage`; `pnpm dev` exits 2 naming the file, value never printed (F2).
- `scripts/dev-prod.mjs`: imports and re-exports `envFileSetsKey`; exits 2 on the same check before the password prompt (F2).
- `scripts/dev.test.ts`, `scripts/dev-prod.test.ts`: tests for both launchers (four files, both letter cases, no leak, comment/look-alike lines pass) (F2).
- `README.md`: corrected the `.env.local` sentence, documented the new refusal (F2, F3).
- `scripts/check-dev-bundle.mjs`: added `SIMAP_DEV_TOKEN` marker (F5); build still clean, no legitimate production file hit.

Checks (Node 22): typecheck exit 0; check:layers 234 files, no violations; format:check exit 0; test 96 files passed, 946 passed | 3 skipped; build exit 0; check:dev-bundle "no dev-token strings in .next/static".

Out-of-plan files: none beyond the files named in the rework task.

Follow-ups: F4 (`--debug-prerender`), F6, other case-variant keys, CI running check:dev-bundle, `.env.example` (High path, waiting for Ming). In `dev:prod` the new check runs after the token and tunnel steps (next to the SIMAP_DEV_ORG check), before the password prompt, not before the dev:token step. Not verified: the real `next dev` loading `.env*` on Windows (launchers were tested with injected readers only).

## Attempt 3 (rework of security review attempt 2: S1, S2, plus approved .env.example line)

Files touched
- `scripts/dev.mjs`: `envFileSetsKey` now normalises `\r\n?` to `\n` and uses a multiline regex (S1); new `EnvReadFailure`, `envReadMessage`, `makeEnvReader` (null only for ENOENT, else throws a content-free error) and `main` exits 2 with a fixed message (S2).
- `scripts/dev-prod.mjs`: uses the shared reader; `run` converts any read failure in the `.env*` checks (DATABASE_URL, SIMAP_DEV_ORG, flag) to exit 2 with the fixed message, before the password prompt.
- `scripts/dev.test.ts`, `scripts/dev-prod.test.ts`: tests for lone CR, key and `=` on separate lines, key after U+2028, commented/look-alike keys, reader with EBUSY, and `run` with EBUSY (exit 2, no prompt, no spawn, no content in the message).

S1 verification: the proposed regex was run on in-memory strings against a copy of the `@next/env` 16.4.6 parse regex; both agree on all three forms, BOM, `export`, `:` form, `# NEXT_PUBLIC_SIMAP_DEV_PROD=` and `_X` look-alikes. Case-sensitive callers (DATABASE_URL, SIMAP_DEV_ORG) stay case-sensitive.

Checks: typecheck exit 0; check:layers 234 files no violations; format:check all matched; test 96 files passed, 951 passed | 3 skipped; build exit 0; check:dev-bundle no dev-token strings.

Out-of-plan files
- `.env.example` (High path, approved by Ming, M-18): appended a comment and a commented `# NEXT_PUBLIC_SIMAP_DEV_PROD=` line with a shell append. Not opened or reordered by me.

Follow-ups: S3 (move the `.env*` checks above the token step), S4 (re-check after the prompt / watch files), F4, F6 and case-variant hardening of other keys remain open.

## Attempt 4 (rework of security review attempt 3: S5 only, one extra rework approved by Ming)

Files touched
- `scripts/dev.mjs`: `devEnv` drops any inherited `NODE_ENV` in any letter case and sets `NODE_ENV: "development"`, so Next loads the four `.env*` files the launchers check, never `.env.test*` (S5).
- `scripts/dev.test.ts`: updated `devEnv` expectations; new case that `NODE_ENV` test/production and `node_env` test each give one `NODE_ENV: "development"`.
- `scripts/dev-prod.test.ts`: `run` child env has a single `NODE_ENV: "development"` even with inherited `NODE_ENV: test` and `node_env: production`.

`childEnv` check: it spreads `devEnv(...)` last; only `NEXT_PUBLIC_SIMAP_DEV_PROD` is added afterwards, so it cannot reintroduce another NODE_ENV (covered by the new test). Dev-token guards in `src/server/http/with-auth.ts` and `dev-token.ts` were not edited; they key off the child's NODE_ENV, which is now always "development" under `dev:prod`, so the earlier shell `NODE_ENV=production` case no longer reaches the child.
Real `@next/env` 16.4.6 `loadEnvConfig` on a throwaway temp dir (scratchpad, not the repo): with `devEnv`'s NODE_ENV, `.env.test` was not read and `.env.development` was. Done with a one-off script, not committed (`@next/env` is not a direct dependency).

Checks (Node 22): typecheck exit 0; check:layers 234 files, no violations; format:check exit 0; test exit 0; build exit 0; check:dev-bundle "no dev-token strings in .next/static".

Out-of-plan files: none.
Follow-ups: S3, S4, S6, S7, F4, F6, other case-variant keys, unchanged. Not verified: `next dev` itself on Windows; the guards' behaviour was reasoned from the diff, not re-run end to end.
