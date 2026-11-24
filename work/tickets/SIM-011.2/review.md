## Attempt 1 — 2026-11-24
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format." (642 files)
- `pnpm typecheck && pnpm check:layers` — exit 0, "check-layers: 588 files, no violations"
- `pnpm test` — exit 0, "Test Files 223 passed (223); Tests 2218 passed | 6 skipped (2224)"; matches impl-log
- `pnpm build` — exit 0, "Compiled successfully"; `/members` route built
- `pnpm test:db` — not run (no DB change; optional per orchestrator)

### Acceptance criteria
- [x] Users see the list read-only; Managers see Edit and Deactivate/Reactivate actions. Evidence: `MembersView.test.tsx` › "user sees no actions, no invitations section, accounts note present" and "manager sees Edit + Deactivate on active rows and Edit + Reactivate on deactivated rows" both pass. In `MembersView.tsx`, the Actions header and cell render only when `canManage`. `MembersPage.tsx` derives `canManage` from `atLeastTier(session.tier, "manager")`. There is no delete action anywhere.
- [x] Deactivating a member with seats/devices shows the counts and, on confirm, calls deactivate with `release:true`; a stale dialog re-fetches on `member_not_empty`. Evidence: `deactivate-flow.test.ts` (step, impactLines order/plurals, releaseFor, deactivateErrorAction `member_not_empty` → `reload-impact`, `not_found` → `done`); `members-api.test.ts` › "impact, deactivate and reactivate hit their endpoints" (body `{release:true}` / `{release:false}`). Code read: on `reload-impact`, `DeactivateMemberDialog.tsx` `submit` runs `setImpact(null)` and then `loadImpact()`, and submit stays disabled until the new counts arrive.
- [x] Edit maps `employee_code_taken` and `invalid_request` to inline messages. Evidence: `member-form.test.ts` › "maps the edit errors" (code taken, generic, group-only, not_found → close-reload, other → apiErrorMessage). `EditMemberDialog.tsx` sends the text to `EntityFormDialog`'s `error` slot.
- [x] Search restarts the list; "Load more" pages with the cursor. Evidence: `members-api.test.ts` › "list builds status and limit, adds q only when non-blank, encodes the cursor"; `members-state.test.ts` › listQuery / appendUnique; `MembersView.test.tsx` › "shows Load more only when hasMore…". Code read: `useMembers` reloads when the memoised `query` changes (counter bump). `loadMore` passes `state.nextCursor` and drops stale results, the same pattern as `useAudit`.
- [x] All copy lives in `src/ui/copy/members.ts`; view and api-client unit tests pass. Evidence: `pnpm test` green, including `no-literals.test.ts` and `copy.test.ts`.
- [x] (Plan #6) `<InvitePeople />` kept. Evidence: `src/app/(app)/members/page.tsx` renders `<MembersPage headerAction={<InvitePeople />} />`; the view test checks that the header slot renders.

Ming verification after merge (copy into the PR):
- With a real Identity sign-in, deactivate a member who holds a seat. The dialog should show the counts, and after confirm the seat should be free on `/seats`. Then switch the filter to "Deactivated" and Reactivate.
- The Invite button should show next to the Members title for a Manager with a real (non-dev-token) session.

### Issues
None.

### Rules (CLAUDE.md)
No violations found. R1: `check:layers` is clean, and UI code imports only `@/lib/**` and `src/ui`. R4: every changed product file is in the plan's file list; the only other changes are the `work/` process files (M-45 in `ming-todo.md`, ticket files). R5: checks are green and the new logic has tests. D36: all copy is in `members.ts`, and the aria-labels come from copy functions. R2/R3/R6/R7 do not apply.

### Blockers from review agents
None.

### Nits (do not block)
- `src/ui/members/MembersView.tsx` search `FilledInput` has no `maxLength`. A query over 80 code points (`MEMBER_LIMITS.q`) gets a 400 from the server, and the list shows the generic `invalid_request` error until the text is shortened. `maxLength={MEMBER_LIMITS.q}` would prevent this. Other search inputs in the app have the same gap.
- `DeactivateMemberDialog.tsx` `loadImpact` depends on `onDone`, which `MembersPage` recreates on every render. Each parent re-render while the dialog is open re-fetches the impact. This is harmless because it is a GET, and `DeleteRoomDialog`/`RoomsPage` already work the same way; wrapping `done` in `useCallback` would avoid it.
- If the impact load fails with anything other than `not_found`, the dialog shows the error but has no retry, and submit stays disabled. Cancel and reopen works. This matches the rooms dialog.
- In `useMembers`, a failed "Load more" switches the whole list to the error state, hiding rows that were already loaded (the same as `useAudit`).

### Follow-ups (out of scope)
- Full seat/device lists per member (rows are capped at 20 refs, A2) through `GET /api/members/[id]` if Ming wants them.
