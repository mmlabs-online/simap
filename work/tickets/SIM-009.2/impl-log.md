# Impl log — SIM-009.2

## Attempt 1 — 2026-11-22

### Files touched
| File | Required because |
|---|---|
| `src/app/accept-invitation/page.tsx` | Thin page, `metadata.referrer: "no-referrer"` (D53). |
| `src/app/account-pages.test.ts` | Row `accept-invitation`. |
| `src/lib/invitations/accept-flow.ts` (+ test) | Pure `acceptOutcome` / `signInOutcome`. |
| `src/lib/identity/email-link.test.ts` | Two `/accept-invitation` cases. `email-link.ts` unchanged. |
| `src/ui/auth/identityClient.ts` (+ test) | `acceptInvitation` (cookie mode, lenient 2xx). |
| `src/ui/auth/acceptController.ts` (+ test) | Token held in a closure; testable in node. |
| `src/ui/auth/accept-views.tsx` (+ test) | Presentational views. |
| `src/ui/auth/AcceptInvitationPage.tsx` | Page body, Turnstile state. |
| `src/ui/auth/views.tsx` (+ test) | `SignInView` optional `intro` / `footer`. |
| `src/ui/copy/invitations.ts` | `accept` copy block (D36). |
| `src/ui/index.ts` | Export `AcceptInvitationPage`. |

Beyond the ticket's Technical notes (page, `AcceptInvitationPage.tsx`, `identityClient.ts`, `accept-flow.ts`): the controller, views, `views.tsx` props, copy block and `index.ts` export are the minimum supporting files named in the plan (the controller makes the AC2 "same token after mismatch" claim testable; copy is required by D36; the export is needed for the page to import from `@/ui`).

### Tests added / changed
- All tests listed in plan.md *Tests to write* (accept-flow, email-link, identityClient incl. credentials table row, acceptController, accept-views, views, account-pages).

### Checks (actual output summary)
- format:check: exit 0, "All matched files use the correct format."
- typecheck: exit 0
- check:layers: "283 files, no violations"
- test: 115 files, 1159 tests passed
- build: exit 0

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- Optional "Continue as" accounts list on the accept sign-in view (plan open question 2).
- Copy uses "..." (three dots) rather than the ellipsis character, matching existing copy.

### Scope self-check
- Could the diff be smaller? No.
- `AcceptReadyView` accepts `offerOtherAccount` but does not use it (plan: always show the button).
