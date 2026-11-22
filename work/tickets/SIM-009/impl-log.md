# Implementation log — SIM-009

## Attempt 1 — 2026-11-22 (slice 1 of 2: invite and record)

### Files touched
| File | Required because |
|---|---|
| `src/lib/identity/types.ts`, `errors.ts` | six invitation codes (AC5, S2) |
| `src/ui/copy/auth.ts` | English text for the six codes (S2, D36) |
| `src/lib/invitations/roles.ts` | role options per tier, `canInviteRole` (AC1) |
| `src/lib/invitations/invite-flow.ts` | `inviteOutcome` / `recordOutcome` (AC5) |
| `src/lib/validate/invitation.ts` | boundary validation of the record body (S1) |
| `src/lib/api/error.ts`, `src/ui/copy/api.ts` | `role_not_allowed` code and copy (AC1, R7) |
| `src/server/invitations/record.ts` | org-scoped upsert plus audit in one tx (S1, R6) |
| `src/app/api/invitations/route.ts` | `POST` at manager tier; 422 for role above tier, before the write (R7) |
| `src/ui/auth/identityClient.ts` | `invite()` with strict response parse (contract) |
| `src/ui/invitations/invitations-api.ts` | never-throwing record call |
| `src/ui/invitations/InviteDialog.tsx`, `InvitePeople.tsx` | form view and container |
| `src/ui/copy/invitations.ts` | form copy (D36) |
| `src/ui/index.ts`, `src/app/(app)/members/page.tsx` | export and entry point |
| tests | one per new file, plus `errors.test.ts`, `auth.test.ts`, `identityClient.test.ts` |

### Tests added / changed
- `roles.test.ts`, `invite-flow.test.ts`, `validate/invitation.test.ts`, `record.test.ts`, `record.db.test.ts`,
  `api/invitations/route.test.ts`, `invitations-api.test.ts`, `InviteDialog.test.tsx` (new)
- `errors.test.ts`, `auth.test.ts`, `identityClient.test.ts` (new cases)

### Checks (actual output summary)
- typecheck: `pnpm typecheck && pnpm check:layers` exit 0; "check-layers: 275 files, no violations"
- format:check: "All matched files use the correct format."
- test: Test Files 112 passed (112); Tests 1110 passed (1110)
- test:db (local Postgres): Test Files 4 passed (4); Tests 33 passed (33)
- build: exit 0

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- SIM-011.2 must keep `<InvitePeople />` on the Members page (plan A7).
- Marking rows `accepted` at first visit (plan A4).

### Scope self-check
- Could the diff be smaller? No: each file is in the plan's list.
- No High path touched (`src/lib/identity/*` and `src/ui/auth/*` are not High; only `src/server/identity/**` is).
