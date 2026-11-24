## Attempt 1 — 2026-11-24

### Files touched
| File | Required because |
|---|---|
| `src/app/(app)/members/page.tsx` | renders `<MembersPage headerAction={<InvitePeople />} />`; SIM-009 button kept |
| `src/ui/index.ts` | `MembersPage` export appended; SIM-017.3 `SearchPage` and `InvitePeople` exports kept |
| `src/ui/copy/members.ts` | D36 copy |
| `src/ui/members/members-api.ts`, `members-state.ts`, `useMembers.ts`, `usePendingInvitations.ts` | API client, pure helpers, hooks (plan files) |
| `src/ui/members/member-form.ts`, `deactivate-flow.ts` | pure edit / deactivate logic |
| `src/ui/members/MembersView.tsx`, `PendingInvitations.tsx`, `MembersPage.tsx` | view, invitations section, container |
| `src/ui/members/EditMemberDialog.tsx`, `DeactivateMemberDialog.tsx`, `ReactivateMemberDialog.tsx` | dialogs |

### Tests added / changed
- `members-api.test.ts`, `members-state.test.ts`, `member-form.test.ts`, `deactivate-flow.test.ts`, `MembersView.test.tsx` (cases per plan table)

### Checks (actual output summary)
- typecheck + check:layers: exit 0, "check-layers: 588 files, no violations"
- format:check: exit 0
- test: Test Files 223 passed (223); Tests 2218 passed | 6 skipped
- build: exit 0

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- Refs in rows are capped at 20 (A2); full lists need `GET /api/members/[id]` if wanted.

### Scope self-check
- Could the diff be smaller? No; every file is in the plan list.
- Diff size: about +1500 lines new (incl. tests), 2 modified files.
