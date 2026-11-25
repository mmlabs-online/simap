## Attempt 1 — 2026-11-25
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — exit 0.
- `pnpm typecheck && pnpm check:layers` — typecheck exit 0; "check-layers: 668 files, no violations".
- `pnpm test` — full run: Tests 1 failed | 2509 passed | 9 skipped (2519). The one failure is the known flaky `scripts/dev-process.test.ts > real tree > root exits first; the orphan grandchild is still stopped` (2547 ms, timing under load; file not touched by this diff). Re-run alone: `scripts/dev-process.test.ts` 21 passed (21). Treated as green.
- `pnpm build` — exit 0.
- `pnpm test:db` — not run (CI-only; no DB, server or migration change in the diff).
- Reviewer results match impl-log.md (format, typecheck, layers 668 files, build; test totals 2510 passed when the flaky file passes).

### Acceptance criteria
- [x] AC1 Admin/Manager sees Assign on org-inventory devices and "Note / expiry" on owned devices; a User sees neither — evidence: `src/ui/devices/device-actions.ts` rowActions gates on `d.canAssign` / `d.canEditHolding` only (no client role check), both listed first; `device-actions.test.ts › assign and holding actions` (3 cases); `DevicesView.test.tsx › Assign and Note / expiry buttons follow the flags; neither when both are false`. Wired in `DevicesPage.tsx` (`onAssign`, `onEditHolding`).
- [x] AC2 Assigning with/without expiry updates the row with the note and "Until <date>" / "No expiry" — evidence: `assign-device.test.ts › toAssignBody › No expiry sends null; a date is sent as given; today is allowed`; `devices-api.test.ts › assign sends POST /api/devices/<id>/assignment with the JSON body`; `DevicesView.test.tsx › owner cell shows Until, No expiry and the note with a title; none on an unowned row` (Vietnamese note `title="Máy mượn cho dự án"`); `DevicesPage.tsx` `onDone` closes, calls `refresh()`, focuses the heading after an assign (A4). End-to-end is Ming's manual run.
- [x] AC3 Expiry cannot pick a day before today (UTC+7); the server refusal message shows — evidence: `assign-device.test.ts › expiryMin` (assign → today; overdue edit → its own date, A3), `› toAssignBody › unchecked without a date, or a day before today, is refused`, `› toHoldingBody › an overdue holding stays editable; another past date is refused`, `› settleAssign › invalid_request has its own message`; `AssignDeviceDialog.test.tsx › No expiry checked disables the date input, which has a min`. `today` from `todayUtc7` read once at mount (`AssignDeviceDialog.tsx` `useState(todayNow)`).
- [x] AC4 Serial, manufacturer, brand on create/edit, shown in Details; duplicate serial shows `serial_taken` — evidence: `device-form.ts` create body + `OPT_FIELDS` patch loop (NFC + trim, blank → null); `device-form.test.ts` new cases and `deviceErrorMessage("serial_taken")` equals `apiCopy.errors.serial_taken`; `DeviceFormDialog.test.tsx › serial, manufacturer and brand fields with maxLength 100`; `devices-state.test.ts › detailsText …`; `DevicesView.test.tsx › Details column: maker over the serial; a dash when empty`.
- [x] AC5 All new strings in `src/ui/copy/*` (D36) — evidence: all new labels, aria labels, hints and errors in `src/ui/copy/devices.ts`; components use only copy keys; `no-literals.test.ts` and `copy.test.ts` green in the full run.
- [x] AC6 Checks green — see Checks.

Ming verification after merge (carry into the PR, not verified here):
1. Assign an org-inventory device with no expiry and a note → row shows member, "No expiry", note.
2. Assign another with an expiry date → "Until <date>"; picker offers no day before today.
3. "Note / expiry" on an owned device: change the note, set and clear the expiry.
4. Create/edit a device with serial, manufacturer, brand; reuse a serial → "Another device already has this serial number."
5. Table at 768 px and 1024 px with a long serial and a long note (table width).
6. As a User: no Assign and no "Note / expiry" buttons.

### Issues
None.

### Scope
Every changed source file is in the plan's Files table (Part A, Part B, tests, CLIP move to `src/ui/clip.ts` with the four seat imports). Work files (`work/ming-todo.md` M-55, ticket/plan/consult/impl-log) are loop bookkeeping. No High path changed; no `src/server/**`, `db/**`, route, validator or `src/lib/devices/*` change. `EntityFormDialog.tsx` untouched (A7). The documented deviation (date input focused via a `fieldset` ref + selector because `DialogField` does not forward refs) stays inside plan files and is reasonable.

### Rules (CLAUDE.md)
No violations found. R1: new imports are ui → ui/lib only (`@/lib/validate/device`, `@/lib/devices/holding`, `@/lib/devices/types`); check:layers clean. R3: nothing env-related. R4: within plan. R5: green checks, new logic tested. R6/R7: no server change; the UI treats 409/422 as domain refusals and only gates on DTO flags.

### Blockers from review agents
None (no review-trigger agent applies: no src/server, db, auth or workflow paths changed).

### Nits (do not block)
- `src/ui/devices/DeviceTable.tsx` `Details`: maker and serial lines use `break-all` but not `CLIP`, while the note does. Serial/manufacturer/brand are untrusted free text; if the validator allows stacked combining marks they can paint outside the cell. Consider adding `CLIP` to both spans (the owner name has the same pre-existing gap).
- `AssignDeviceDialog.tsx` edit mode: on `not_found` (`settleAssign` → done) `onDone("edit")` does not move focus to the heading, and the "Note / expiry" button that `EntityFormDialog` returns focus to is gone after the refresh. Rare edge; could focus the heading for any `done` whose row may have vanished.
- Card view renders `Details` unconditionally, so a device with no serial/manufacturer/brand shows a lone "—" line on mobile. Fine, but may read oddly next to the MAC "none" text.

### Follow-ups (out of scope)
- None beyond A9 (SearchView serial, device detail page, touch targets, live announcement), which the plan already rejected; only create `debt` issues if Ming asks.
