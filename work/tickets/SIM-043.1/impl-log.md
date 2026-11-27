
## Attempt 1 — 2026-11-27

### Files touched
| File | Required because |
|---|---|
| src/lib/identity/types.ts | `OrgChoice.access?` (plan) |
| src/ui/auth/identityClient.ts | `parseOrgs` reads/drops `access`; zero-parsed rule ignores unknown-access drops |
| src/lib/identity/orgs.ts | `decideOrg` keeps `access` |
| src/ui/copy/org.ts | `badge.supportAccess` copy (D36) |
| src/ui/org/OrgPickerView.tsx, OrgSwitcherDialog.tsx | "Support access" badge |
| src/ui/auth/tokenStore.ts | background retry waits max(RETRY_MS, Retry-After) for `rate_limited` |
| src/ui/auth/identityClient.test.ts, tokenStore.test.ts, org-views.test.tsx, src/lib/identity/orgs.test.ts | tests |

### Tests added / changed
- identityClient.test.ts: existing expectations gain `access: "member"`; access read from item/nested/missing; unknown values dropped; only-unknown returns [] while malformed still rejects unknown
- orgs.test.ts › decideOrg keeps access on enter and pick; absent stays absent
- tokenStore.test.ts › "background renewal retry delay (D86)": 30 s re-arms at 30 s; below/missing re-arms at 15 s; 120 s beyond expiry does not re-arm; network unchanged
- org-views.test.tsx › badge for picker and switcher

Deviation: the plan's "retryAfterSeconds 120 re-arms at 120 s" case cannot occur, because background renewal fires 60 s before expiry and `now()+delay < expiresAt` blocks it. The test uses 30 s for the re-arm case and 120 s for the "no re-arm" case.

### Checks (actual output summary)
- typecheck: next typegen + tsc clean; check:layers "1001 files, no violations"
- format:check: "All matched files use the correct format."
- test: 382 files passed | 1 skipped; 3735 passed | 9 skipped
- build: succeeded

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- Because renewal fires 60 s before expiry, a Retry-After over ~45 s on background renewal gives up re-arming; the next on-demand `getToken` retries.

### Scope self-check
- Could the diff be smaller? No.
- Diff size: +172 / -12 lines (including tests)
