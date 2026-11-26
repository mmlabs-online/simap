# Impl log — SIM-050

## Attempt 1 — 2026-11-26

### Files touched
| File | Required because |
|---|---|
| `src/server/members/manage.ts` | email selected as `case when <visible> then m.email end` (User: own row only); `q` email term is `(like(email) and visible)` for a User; `MemberRow.email` nullable. `loadMember` already passed the viewer sub, no change needed |
| `src/lib/members/types.ts` | `MemberDto.email: string \| null` |
| `src/ui/members/MembersView.tsx` | render `m.email ?? membersCopy.hiddenEmail` |
| `src/ui/copy/members.ts` | new `hiddenEmail: "-"` (UI copy rule D36 / no-literals test) |
| `src/ui/members/EditMemberDialog.tsx` | `subtitle={member.email ?? undefined}` for typing |
| `src/ui/members/MembersView.test.tsx` | null-email case |
| `src/server/members/manage.test.ts` | SQL-shape assertion updated (3 -> 4 wrapped `case when`, plus email q guard) |
| `src/server/members/manage.db.test.ts` | per-tier email test |

### Tests added / changed
- `MembersView.test.tsx` › renders a dash when email is null
- `manage.db.test.ts` › email: a user sees only their own, in list and detail; q by another's email matches nothing; manager and admin see all (name and employee code q still work for the User)
- `manage.test.ts` › "listMembers user: sub is $2 ..." assertion updated
- `search.db.test.ts`: unchanged; DSH-02 search is tier-independent and already never selects or matches email (l.87, l.126).

### Checks (actual output summary)
- format:check: All matched files use the correct format.
- typecheck: exit 0
- check:layers: 864 files, no violations
- test: Test Files 328 passed | 1 skipped; Tests 3283 passed | 9 skipped
- build: exit 0
- test:db: 22 files, 336 passed (run before the final unit-test-only edit; the new db test was included in that run)

### Out-of-plan files
- `src/ui/copy/members.ts` (new copy string, required by the UI copy rule)
- `src/server/members/manage.test.ts` (existing unit test asserted the old SQL shape; plan listed it only for fixture typing)

### Follow-ups (noticed, not done)
- None

### Scope self-check
- Could the diff be smaller? No.
- Diff size: roughly +60 / -5 lines.
