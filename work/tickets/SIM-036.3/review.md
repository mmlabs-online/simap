# Review: SIM-036.3 (slice 1: catalog page and Type suggestions, no images)

## Attempt 1
Verdict: PASS

Date: 2026-11-25. Diff: `git diff origin/main...HEAD` (594ab54 and the work commits on `claude/modest-allen-yru4g8`).

### Checks (run by reviewer)
- `pnpm format:check`: exit 0, "All matched files use the correct format." (703 files)
- `pnpm typecheck && pnpm check:layers`: exit 0 and exit 0, "check-layers: 649 files, no violations"
- `pnpm test`: exit 0, "Test Files 247 passed | 1 skipped (248)", "Tests 2404 passed | 7 skipped (2411)". This matches impl-log.
- `pnpm build`: exit 0. The route list includes `ƒ /device-types`. impl-log said "build: not run", so this result is new evidence and does not contradict it.
- `pnpm test:db`: skipped (CI-only, as instructed). No server or SQL change in this diff.

### Acceptance criteria (slice 1, plan.md table)
- [x] 1 Only Admins see the nav entry and the page; others get the no-access card. Evidence: `src/lib/nav.test.ts` "deviceTypes is admin only" plus the rail order and the admin count of 11; `device-types-state.test.ts` "canManageDeviceTypes › only admin" (admin true; manager, user and undefined false); `DeviceTypesView.test.tsx` "forbidden shows the title and a no-access alert, no New button"; code read `src/ui/deviceTypes/DeviceTypesPage.tsx:33-47`: the forbidden view returns before `DeviceTypesLoaded` mounts `useList`, so no request is sent. `AppShellView.test.tsx` admin case shows 10 links with `/device-types` after `/audit`.
- [x] 2 Create, rename, change slot and delete work, and server refusals (`name_taken`, `type_limit`, `invalid_request` fallback) show inline. Evidence: `device-type-form.test.ts` (create body, patch only sends changed fields, unchanged, invalid name or slot); `device-types-state.test.ts` "settleSave / settleDelete" (`not_found` is done; `name_taken`, `type_limit` and `invalid_request` give `apiCopy.errors[code]`; an unknown code gives `internal`); `device-types-api.test.ts` (method, path with an encoded id, JSON content-type and body, 204 delete, error code parsing, never throws). The flow is wired as planned: `DeviceTypeFormDialog.tsx:419-439` sets the inline error, and `DeviceTypesPage.tsx:556-560` closes and reloads. The local `pnpm dev` walkthrough was not run (no Identity or DB here; impl-log says the same). The unit coverage plus the code read are enough evidence for the slice, and the PR should list the walkthrough as a quick manual check.
- [x] 3 The delete confirm says devices keep their type text and show the placeholder. Evidence: `DeleteDeviceTypeDialog.test.tsx` "body names the type and shows the placeholder warning" (Vietnamese name "Máy in").
- [x] 4 The device dialog's Type field suggests catalog names and still allows free text. Evidence: `DeviceFormDialog.test.tsx` "datalist lists the given suggestions; type input stays free text" (2 options, no `pattern`, `maxLength="60"`); `device-types-state.test.ts` "typeSuggestions" (seed list while loading or on error, catalog order when ready, `[]` when ready and empty); `src/ui/devices/DeviceFormDialog.tsx:63` mounts `useTypeSuggestions` only inside the open dialog.
- [x] 5 UI copy lives in `src/ui/copy/deviceTypes.ts`, and component tests cover the dialog validation. Evidence: the copy file exists; `no-literals.test.ts` is green within the full run; `DeviceTypeFormDialog.test.tsx` (name `maxLength="60"` and `required`, 5 radios with exactly one checked, PC checked, svg `aria-hidden`).
- [x] 6 Checks are green (see above).

Ming verification after merge: none for slice 1, per the plan. AC3 of the ticket (images) and the 422 half of AC2 belong to SIM-036.6.

### Scope
Every changed source file is in the plan's file list. The only deviation is that the planned `delete.{title, body, confirm}` copy lives under `deleteDialog`, because `delete` is already the row button label. impl-log justifies this, and it is cosmetic. No High path is touched: no migrations, nothing under `src/server/**`, no config, proxy or deploy files.

### Issues
#### Issue 1 (🟡 should-fix, accessibility)
- **Where**: `src/ui/deviceTypes/DeviceTypeFormDialog.tsx:108-110`
- **Expected**: `<legend>` is the first child of `<fieldset>`, so the radio group gets "Place on the desk" as its accessible name. This is the pattern in `src/ui/devices/DeviceFormDialog.tsx:188-189` and `src/ui/org/OrgSwitcherDialog.tsx:62-63`.
- **Actual**: the legend is nested in a `<div>` inside the fieldset. Per HTML, it is then not the fieldset's legend, so the group has no name for screen readers (each radio still has its own label).
- **Fix instruction**: make `<legend className={CAPTION}>` the first child of the `<fieldset>`, and wrap the radio list and `<DeskSlotDiagram>` in an inner `<div className="flex items-start justify-between gap-3">`. Keep the radio column `flex flex-col gap-2`. Optionally assert in `DeviceTypeFormDialog.test.tsx` that the markup matches `/<fieldset[^>]*><legend/`.

This issue does not block: all checks are green, every AC has evidence, and the defect is small. The orchestrator can fold it into this PR as a one-line follow-up commit or into SIM-036.6, which edits the same dialog.

### Rules (CLAUDE.md)
No violations found.
- R1: the new files import only `@/lib/**` and `../` ui modules, and `check:layers` is clean.
- R2, R3, R6, R7: not touched (no schema, env, server or handler change).
- R4: in plan.
- R5: green checks, and the new logic has tests.
- D36: copy is in `src/ui/copy/deviceTypes.ts` and `shell.ts`.
- D52: kit components only, the diagram is a plain SVG, no pixel font.

### Blockers from review agents
None (no review trigger path changed).

### Nits (do not block)
- `deviceTypesCopy.diagram.chairSide` (`src/ui/copy/deviceTypes.ts:169`) is unused, because the diagram is `aria-hidden` and has no text. Remove it or use it.
- `toPatchBody` (`src/ui/deviceTypes/device-type-form.ts:832`) re-implements the validator's name normalisation (`norm`). It matches today, but it could drift. Consider exporting the normaliser from `@/lib/validate/device-type`.
- `settleSave` treats `not_found` on create as done. This cannot happen today and is harmless.
- `src/ui/devices/DeviceFormDialog.tsx:11`: the new import sits after the `../seats/*` imports rather than in alphabetical order (oxfmt does not sort imports).

### Follow-ups (out of scope)
- SIM-036.6: images (list preview, upload with the client check, remove, 422 refusals), as in the plan's `## Split proposal`.
- Move `useList` and `ListSection` from `src/ui/groups` to a shared place now that a second feature uses them.
- Manual walkthrough with `pnpm dev`: create, rename, change slot, duplicate-name refusal, delete; rename "IP phone" and see the new name in the New device Type suggestions.
