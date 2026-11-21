## Attempt 1 — 2026-11-20

### Files touched
| File | Required because |
|---|---|
| `src/lib/identity/types.ts` | `org_access_denied` code, `AuthError.orgId`, `OrgChoice` (AC4, T2) |
| `src/lib/identity/errors.ts` | accept `org_access_denied` from a server body (AC4) |
| `src/lib/identity/orgs.ts` (new) | pure `decideOrg` / `sortOrgs` (AC1, AC5, T2) |
| `src/lib/identity/flow.ts` | `noOrg` -> `needOrg`; `pickOrg` view for `org_access_denied` (AC1, AC4, T2) |
| `src/ui/auth/identityClient.ts` | `orgs()` with tolerant parser, `token(accountId, orgId?)` (AC1, Q18) |
| `src/ui/auth/orgId.ts` (new) | remembered org per account in localStorage (AC1b) |
| `src/ui/auth/authChannel.ts` | token message carries `orgId` (T1) |
| `src/ui/auth/tokenStore.ts` | org state, `orgId()`, `selectOrg()`, denial handling, per-tab org on messages (AC1, AC4, T1) |
| `src/ui/auth/AuthGate.tsx` | org entry, picker, switcher, denied set, org name in session (AC1, AC4, T2, C2) |
| `src/ui/auth/views.tsx` | `NoOrgView` new text and notice (AC1a, AC4) |
| `src/ui/org/OrgPickerView.tsx`, `src/ui/org/OrgSwitcherDialog.tsx` (new) | entry picker and switcher (AC1a, AC1c) |
| `src/ui/copy/org.ts` (new), `src/ui/copy/auth.ts` | D36 copy; `errors.org_access_denied`; `noOrg` block moved to `orgCopy.none` (C1) |
| `src/ui/AppShellView.tsx` | swap button only when `switchOrg` is given (C2) |
| tests: `orgs.test.ts`, `orgId.test.ts`, `org-views.test.tsx` (new); `errors`, `flow`, `identityClient`, `authChannel`, `tokenStore`, `tabs`, `views`, `AppShellView`, `copy/auth` tests | plan test list |

### Tests added / changed
- orgs.test.ts: decideOrg table, denied never enters, sortOrgs (vi collation, NFD/NFC)
- orgId.test.ts: per-account key, invalid value, clear-if-equal, throwing storage
- identityClient.test.ts: orgs request shape, envelopes, key variants, unreadable body rejects unknown, 401/network, token body with/without org_id, 403 org_access_denied
- authChannel.test.ts: orgId parse cases (token() helper now has `orgId: null`)
- tokenStore.test.ts: new `org` describe (selectOrg, in-flight drop, remembered restore, continueAs new account, denial, clear-if-equal, signOut/forget/session_invalid); setup gets in-memory orgStorage; message keys include `orgId`; `token` calls now `(id, undefined)`
- tabs.test.ts: per-tab org (ignore other org, legacy org-less message, selectOrg in one tab)
- flow/errors/views/AppShellView/org-views tests as listed in the plan

### Checks (actual output summary)
- format:check: All matched files use the correct format (oxfmt run on changed files first)
- typecheck: exit 0 (next typegen + tsc)
- check:layers: 197 files, no violations
- test: Test Files 70 passed (70); Tests 700 passed (700)
- build: exit 0, Compiled successfully

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- `/auth/orgs` body shape unverified (Q18): Ming check after merge; fix is local to `parseOrgs`.
- Only the first page of `/auth/orgs` is read (A3).
- `src/ui/copy/api.ts` `org_required` text is now unused by the gate; kept per plan.

### Scope self-check
- Could the diff be smaller? No; deviations from the plan: none beyond Q5 (no `session.ts` change, as planned).
- Diff size: see `git diff --stat` of the commit.
