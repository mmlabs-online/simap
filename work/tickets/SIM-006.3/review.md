# Review — SIM-006.3

## Attempt 1 — 2026-11-20
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format." (193 files)
- `pnpm typecheck && pnpm check:layers` — exit 0; "Types generated successfully", tsc clean; "check-layers: 167 files, no violations"
- `pnpm test` — exit 0; "Test Files 61 passed (61) / Tests 573 passed (573)" (matches impl-log)
- `pnpm build` — exit 0; `○ /forgot-password`, `○ /reset-password`, `○ /sign-up`, `○ /verify-email` (static)
- `pnpm test:db` — not run (CI-only, needs Postgres); no DB change in this diff.

### Acceptance criteria
- [x] AC8 four routes, outside the gate, sign-in links — evidence: build route list above; pages at `src/app/{sign-up,forgot-password,verify-email,reset-password}/page.tsx` (not under `(app)`); `src/ui/auth/AuthGate.tsx:479-480` passes `signUpHref="/sign-up"` / `forgotHref="/forgot-password"`; existing `views.test.tsx` covers link rendering.
- [x] AC9 token read once, stripped before any network call, no-referrer — evidence: `email-link.test.ts` (accept/reject table, replaceState once before return, invalid hash stripped, `?token=` stripped and never read, empty no-op, second call null); `VerifyEmailPage.tsx:25-32` / `ResetPasswordPage.tsx:22-29` take the token in the mount effect (ref-guarded), token held only in a `useRef`, no network call in the effect; grep: no `console.` / `searchParams` in the new pages, containers or email-* modules; `account-pages.test.ts` passes; built HTML for all four routes contains `<meta name="referrer" content="no-referrer"/>`.
- [x] AC10 neutral forgot text, sign-up "check your inbox" — evidence: `email-flows.test.ts › forgotOutcome ok is sent`, `account-views.test.tsx › ForgotPasswordView sent state shows exactly the neutral text`, `› SignUpView sent state shows the address and a sign-in link, no form`; copy `src/ui/copy/auth.ts` `forgot.sent`.
- [x] AC11 error mapping — evidence: `email-flows.test.ts` tables for all five outcomes (forgot maps `email_unverified` / `not_member` / `email_taken` to `unknown`); `account-views.test.tsx › email_taken shows its own message in an alert`, `› weak_password lists the reasons and keeps the form`, `› done links to /sign-in; invalid links to /forgot-password`, `› invalid links to /sign-in only, no resend`; Turnstile spent after every attempt (`SignUpPage.tsx` `finally { spend() }`, `ForgotPasswordPage.tsx` finally block).
- [x] AC12 click-only verify; gate Resend — evidence: `account-views.test.tsx › VerifyEmailView ready has one Verify button and no form`; `VerifyEmailPage.tsx` calls `client.verifyEmail` only from `verify` (button), guard set before the await; `views.test.tsx › UnverifiedView shows Resend…`, `› sent / rate-limited / sending states`, `› without onResend shows no Resend`; `AuthGate.tsx:390-426` resend handler uses `resendOutcome`, respects `seq`.
- [x] T1 referrer via `metadata.referrer`, no High path — evidence: `account-pages.test.ts`; `git diff --name-only origin/main...HEAD` contains no `next.config*`, `config.*`, proxy/middleware, `src/server/**`, `.env*`, `check-layers`, Dockerfile or `.sql`.
- [x] T2 decision and spec — evidence: `work/decisions.md` D53 row; `docs/spec-v1.md` AUT-01 (~164), AUT-03 (~183), §9 Non-goals (~513) updated as planned.

Ming verification after merge (not reviewer-verifiable; carry to the PR): plan.md "Ming verification after merge" — end-to-end sign-up / verify / resend / forgot / reset against a local Identity with M-1 origins registered; meta tag in DevTools on the four pages; Turnstile works on `/sign-up` and `/forgot-password` with `no-referrer` (A3).

### Issues
#### Issue 1 — 🟡 should-fix — missing planned test
- **Where**: `src/ui/auth/account-views.test.tsx` (plan "Tests to write" row "field errors wire `aria-invalid` and `aria-describedby` to the error id").
- **Expected**: a static-markup test of the field error wiring.
- **Actual**: not written; impl-log says it needs interaction. It does not: `Field` is exported from `src/ui/auth/fields.tsx` and takes an `error` prop, so `renderToStaticMarkup(<Field id="x" error="e" … />)` can assert `aria-invalid="true"` and `aria-describedby="x-error"`.
- **Fix instruction**: optional in this PR (not an AC; `Field` is a pure move of already-shipped markup); otherwise add it in a follow-up.

### Rules (CLAUDE.md)
No violations found. R1: `check:layers` clean; lib modules import only lib; pages import `@/ui` and `@/ui/copy/auth`. R3: no new env/config. R4: every changed file is in the plan's file table (plus ticket.md/impl-log.md/plan/consult work files). R5: checks green, new logic tested. R6: no org data touched. D36: copy in `src/ui/copy/auth.ts`; no-literals test passes.

### Blockers from review agents
None (to be filled by the orchestrator from `security-review.md` if the security trigger runs).

### Nits (do not block)
- `AuthGate.tsx` `resend`: `busy.current = false` is cleared in `finally` before `apply(...)` for the `signIn` outcome, unlike `signIn`/`join`, which await `apply` inside the try. Harmless (seq guards it), but inconsistent.
- `SignUpView` / `ForgotPasswordView` show `email_taken` / `weak_password` in the top Notice; the outcome's `field` is computed but not rendered next to the field (noted in impl-log).
- `LinkCheckingView` is reused as the pre-runtime placeholder on `/sign-up` and `/forgot-password`, so those pages briefly show "Checking your link..." under the sign-in title, although there is no link.

### Follow-ups (out of scope)
- `docs/spec-v1.md:37-38` (§2 Users and roles) still says "simap has no local accounts, no passwords and no self-signup", which now conflicts with D53 and AUT-01. Spec is the source of truth: fix the wording in a small docs ticket or `/solo`.
- SIM-027 (site-wide Referrer-Policy header) should keep or tighten `no-referrer` for these four routes (plan A5).
