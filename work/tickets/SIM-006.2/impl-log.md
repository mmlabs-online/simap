## Attempt 1 — 2026-11-20

### Files touched
| File | Required because |
|---|---|
| `src/lib/identity/return-to.ts` (+test) | `safeReturnTo` for `/sign-in?returnTo=` without an open redirect |
| `src/lib/format.ts` (+test) | `waitText` for the `rate_limited` copy |
| `src/lib/session.ts` | `orgName` optional (no org name before SIM-007) |
| `src/lib/identity/flow.ts` (+test) | Δ3: `viewForMe` `>= 500` -> retry; new `meErrorView`; new `readMeResult` (parses the `/api/me` Response for the gate) |
| `src/ui/copy/auth.ts`, `src/ui/copy/api.ts` (+`auth.test.ts`) | D36 copy; Δ4 invalid_credentials text; Δ5 `apiErrorMessage` in its own file with `satisfies Record<ApiErrorCode, string>` |
| `src/ui/auth/turnstile.ts`, `TurnstileWidget.tsx` | port of tudocuatui (origin/main) with `siteKey`/`resetKey`, labelled group |
| `src/ui/auth/runtime.ts` (+`runtime.test.ts`) | Δ2 literal env reads, lazy singleton, auth-lost handler |
| `src/ui/auth/AuthLayout.tsx`, `SignInScene.tsx`, `src/app/globals.css` | Δ1 CSS-only pixel frame, strip, scene placeholder; `--px-*` tokens (dark value for outline) |
| `src/ui/auth/views.tsx` (+`views.test.tsx`) | props-only views |
| `src/ui/auth/AuthGate.tsx`, `api-fetch-context.tsx`, `SignInRoute.tsx` | gate state machine, bearer context, `/sign-in` |
| `src/ui/index.ts`, `src/app/(app)/layout.tsx`, `src/app/sign-in/page.tsx` | wiring |

### Tests added / changed
- `return-to.test.ts` (4), `format.test.ts › waitText` (2)
- `flow.test.ts › viewForMe 5xx`, `› meErrorView`, `› readMeResult`
- `views.test.tsx` (sign-in fields, Continue as, links only with hrefs, Turnstile slot, invalid_credentials alert, Join/NoOrg/NoAccess/Unverified/Retry/Checking, px-frame/strip/scene, scene aria-hidden, img alt)
- `runtime.test.ts` (source-text guard), `copy/auth.test.ts` (auth + api mapping)
- Existing `copy.test.ts` and `no-literals.test.ts` pass unchanged, no `copy-ok` escapes.

### Checks (actual output summary)
- typecheck (`pnpm typecheck`): exit 0; `check:layers`: 138 files, no violations
- format:check: "All matched files use the correct format."
- test: Test Files 52 passed (52); Tests 494 passed | 3 skipped (497)
- build: exit 0; route list shows `ƒ /sign-in`
- Build-output check: `grep -r NEXT_PUBLIC_MM_IDENTITY_BASE .next/static` still finds the name once, but only as a discarded
  comma-expression: `(process.env.NEXT_PUBLIC_MM_IDENTITY_BASE,"https://api.mmlabs.online/api/v1")`. The value is the
  production constant, so the plan's "finds nothing" expectation is met in behaviour, not literally.

### Out-of-plan files
None. (`.env.example` is a Ming step; `src/lib/identity/config.ts` read only.)

### Follow-ups (noticed, not done)
- Browser behaviour of `AuthGate` (restore, tabs, Turnstile, refresh) is covered by code review and Ming's manual check; no DOM tests (A8).
- Password field uses the `login` icon (the kit icon list has no lock); a `lock` icon would need `icons.ts` plus the font subset.
- Runtime CSP (Δ7) and the A19 notes (`redirect: "error"`, 401/403-after-side-effect) need `debt` issues (orchestrator).
- No focus-to-first-invalid-field on a failed submit (kit `FilledInput` has no ref prop); errors use `aria-invalid`/`aria-describedby`.

### Scope self-check
- Could the diff be smaller? No; each file is in the plan's list.
- Diff size: see `git diff --stat` of the commit.
