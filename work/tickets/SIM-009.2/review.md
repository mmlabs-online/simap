# Review — SIM-009.2

## Attempt 1 — 2026-11-22
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check`: exit 0, "All matched files use the correct format." (334 files)
- `pnpm typecheck`: exit 0
- `pnpm check:layers`: exit 0, "check-layers: 283 files, no violations"
- `pnpm test`: exit 0, "Test Files 115 passed (115)", "Tests 1159 passed (1159)"
- `pnpm build`: exit 0, route list includes `ƒ /accept-invitation`
- `pnpm test:db`: not run (no DB change, optional per orchestrator)

These match the impl-log claims (115 files / 1159 tests, 283 files no violations).

### Acceptance criteria
- [x] The invitation token never stays in the URL, history, logs or a referrer. Evidence:
  `email-link.test.ts` › "takes a 43-char token and replaces state with /accept-invitation" and
  "/accept-invitation?token=... is never read, still cleaned". `acceptController.test.ts` › "no token -> invalid, no store
  or client call" and "start takes the token before any store or client call". `account-pages.test.ts` row
  `accept-invitation` (`metadata.referrer === "no-referrer"`, `src/app/accept-invitation/page.tsx:7`).
  `accept-views.test.tsx` › "no view renders the token" and "create-account and forgot links open a new tab with rel
  noopener noreferrer". Code read: the token exists only in the controller closure (`src/ui/auth/acceptController.ts:38`),
  never in React state, props, an href or an error. `grep console.` over the new files returns nothing. All pass.
- [x] Accepting with a different email shows the mismatch message and does not consume the token. Evidence:
  `accept-flow.test.ts` › "mismatch keeps the token and offers another account". `acceptController.test.ts` › "mismatch
  keeps the token: use another account (forget called), sign in, accept sends the same token" asserts that both calls send
  `TOKEN` (lines 136-159). `accept-views.test.tsx` › "mismatch shows the mismatch message and Use another account". All pass.
- [x] After accepting, the user lands in the org as a new member. Evidence: `acceptController.test.ts` › "ok ->
  selectOrg(orgId) then navigate('/'); token cleared", "selectOrg rejects -> still navigates to '/'", "ok with orgId null
  -> no selectOrg, navigates". `navigate` is a full load (`AcceptInvitationPage.tsx:41`), so AuthGate restore and `/api/me`
  run (D16 a). End to end: Ming verification below.
- [x] Unit tests cover fragment handling and the accept outcome mapping. Evidence: the tests above plus the
  `identityClient.test.ts` `describe("acceptInvitation")` (path/body/cookie mode/signal, lowercase orgId, lenient 2xx,
  non-UUID accountId guard, 403/422/429/network mapping) and its credentials-table row. `pnpm test` green.

Ming verification after merge (not verified here, carry into the PR):
- Needs M-1 and a second account. Invite address B, open the link as A, Accept: the mismatch message appears. "Use another
  account", sign in as B, Accept: B lands on `/` in the org and sees the profile screen.
- DevTools: no `#token` in the address bar or history. `<meta name="referrer" content="no-referrer">` is in `<head>`.
  `POST …/auth/invitations/accept` goes with the cookie only (no bearer) and body `{account_id, token}`.
- Reload `/accept-invitation`: the invalid view and the "Go to simap" link.
- Optional: fresh address via "Create an account" (new tab), verify, return, sign in, accept.

### Scope
Every changed `src/` file is in the plan's file list. No High path changed: no `src/proxy.*`, `next.config.*`,
`src/server/**`, migrations, `**/config.*` or `.env.example`. No out-of-plan files.

### Issues
None.

### Rules (CLAUDE.md)
No violations found. R1: page → ui (`@/ui`, `@/ui/copy`), ui → lib (`@/lib/identity/*`, `@/lib/invitations/*`), lib → lib.
`check:layers` is clean. R3: no new env. R4: the changes match the plan. R5: the checks are green and the new logic has
tests. R2/R6/R7 do not apply (no schema, query or route handler). D53: meta tag through metadata. D36: copy is in
`src/ui/copy/invitations.ts`.

### Blockers from review agents
None.

### Nits (do not block)
- `src/ui/auth/accept-views.tsx:20`: `AcceptReadyView` declares `offerOtherAccount` but never reads it, and the page still
  passes it (`AcceptInvitationPage.tsx:58`). Either drop the prop or use it for emphasis. The impl-log already records this.
- `src/ui/auth/acceptController.ts:91-95`: `store.signIn` runs `adopt` → `renew` with the account's remembered org. If
  that org mint fails with `org_access_denied` (for example, the account left its remembered org), the login itself
  succeeded but the page stays on sign-in and shows that error. A second submit works, because the store cleared the org.
  This is rare and recovers on its own. One option: treat `org_access_denied` as `continue` in `signInOutcome`.

### Follow-ups (out of scope)
- Optional "Continue as" accounts list on the accept sign-in view (plan open question 2).
- Consider `org_access_denied` → `continue` in `signInOutcome` (see the nit).
