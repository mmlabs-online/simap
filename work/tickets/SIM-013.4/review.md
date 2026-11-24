# Review — SIM-013.4: Device create and edit dialog

## Attempt 1 — 2026-11-24
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format." (522 files)
- `pnpm typecheck && pnpm check:layers` — exit 0 / exit 0; "Types generated successfully", tsc clean; "check-layers: 468 files, no violations"
- `pnpm test` — exit 0, "Test Files 184 passed (184); Tests 1941 passed | 3 skipped (1944)" (matches impl-log)
- `pnpm build` — exit 0, route list printed, no errors
- `pnpm test:db` — CI-only; no server or SQL change in this diff

### Acceptance criteria
- [x] A member creates a device for themselves; an Admin can also create one for another member — evidence: `device-form.test.ts` › "create for self sends no ownerId" (non-Admin and Admin, key absent), "Admin for a member sends ownerId", "non-Admin never sends ownerId", "member kind without a pick is invalid"; `devices-api.test.ts` › "create sends POST /api/devices with JSON"; `DeviceFormDialog.test.tsx` › "non-Admin create has no owner UI", "Admin create shows Me / Another member", "picker only for Another member" (`loadPage` not called during render); `DevicesView.test.tsx` › "New device button when onNew is given"; button ungated in `DevicesView.tsx:39-44`, wired for every member in `DevicesPage.tsx:50`.
- [x] Edit changes only the changed fields; the owner cannot be changed; Edit shows only where the server says `canEdit` — evidence: `device-form.test.ts` › "patch sends only changed fields", "nothing changed is unchanged, also for whitespace and NFD" (real NFD bytes on line 101), "MAC retyped in another form is unchanged…", "blank MAC clears to null…", "patch never has ownerId"; `DeviceFormDialog.test.tsx` › "edit shows the owner as text, no radios, no picker" (both tiers); `device-actions.test.ts` › "Edit only when canEdit and onEdit", "place and edit actions are independent"; `device-actions.ts:33` gates on `onEdit && d.canEdit`; `devices-api.test.ts` › "update sends PATCH /api/devices/<id>".
- [x] Duplicate inventory number or MAC and an inactive owner show clear messages — evidence: `device-form.test.ts` › "maps device codes, passes shared ones through" (`member_not_assignable` → device text; `inventory_number_taken`/`mac_taken` → `api.ts:41-42` texts); `DeviceFormDialog.tsx:79-83` sets the error; `no_linked_member` keeps the shared text per Ming-approved Assumption 1 (M-37).
- [x] Static-render and pure-logic tests (no jsdom) cover the form logic and the Admin-only owner picker — evidence: all new tests use `renderToStaticMarkup` or plain functions; `pnpm test` green including `copy.test.ts` and `no-literals.test.ts`.

Ming verification after merge: none in the plan. The manual run from the ticket's test plan (create as User; create as Admin for another member; edit) was not performed by the reviewer; the PR should carry it as an optional local check.

### Issues
None.

### Scope
Every changed source file is in the plan's file list; `src/ui/copy/api.ts`, `src/ui/index.ts`, `src/lib/**` and `src/server/**` are untouched. `work/ming-todo.md` (M-37 approval line) and the ticket's work files are workflow files. No High path touched.

### Rules (CLAUDE.md)
No violations found. R1: new code imports only `@/lib/*` and `../*` UI modules (check:layers clean). R4: no Delete action or server change. R5: new logic has tests. R7/R2/R3/R6: not touched (single client writes, no schema, no env).

### Blockers from review agents
None (no review trigger path changed).

### Nits (do not block)
- `DeviceFormDialog.test.tsx` › "error prop renders as an alert" renders `EntityFormDialog` directly, so it does not exercise `DeviceFormInner`'s error wiring (as planned; hooks plus async submit cannot be driven without jsdom).
- The "Another member" radio resets `member` to `null` only via `onChange`, which is fine because a checked radio does not refire; no change needed.

### Follow-ups (out of scope)
- None.
