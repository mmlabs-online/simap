## Attempt 1 — 2026-11-25 (slice 1 only: catalog page and Type suggestions, no images)

### Files touched
| File | Required because |
|---|---|
| `src/ui/copy/deviceTypes.ts` | D36 copy (page, form, slots, delete dialog); delete dialog texts live under `deleteDialog` because `delete` is already the button label |
| `src/ui/deviceTypes/device-types-api.ts` (+ test) | never-throw API client |
| `src/ui/deviceTypes/device-type-form.ts` (+ test) | create/patch bodies and validation messages |
| `src/ui/deviceTypes/device-types-state.ts` (+ test) | tier gate, `settleSave`/`settleDelete`, `typeSuggestions`, `slotMarker` |
| `src/ui/deviceTypes/DeviceTypesPage.tsx`, `DeviceTypesView.tsx` (+ view test) | page and pure view |
| `src/ui/deviceTypes/DeviceTypeFormDialog.tsx` (+ test), `DeskSlotDiagram.tsx` | create/edit dialog with slot radios and diagram |
| `src/ui/deviceTypes/DeleteDeviceTypeDialog.tsx` (+ test) | delete confirm |
| `src/ui/deviceTypes/useTypeSuggestions.ts` | catalog names for the device dialog |
| `src/app/(app)/device-types/page.tsx` | route |
| `src/ui/index.ts`, `src/lib/nav.ts`, `src/lib/icons.ts`, `src/ui/copy/shell.ts` | wiring, admin-only nav entry, icon `category` |
| `src/lib/nav.test.ts`, `src/ui/AppShellView.test.tsx` | nav change (admin 11 items, 10 rail links) |
| `src/ui/devices/DeviceFormDialog.tsx` (+ test) | datalist uses the `suggestions` prop |

### Tests added / changed
- device-types-api.test.ts, device-type-form.test.ts, device-types-state.test.ts
- DeviceTypesView.test.tsx, DeviceTypeFormDialog.test.tsx, DeleteDeviceTypeDialog.test.tsx
- DeviceFormDialog.test.tsx › datalist lists the given suggestions; type input stays free text
- nav.test.ts › deviceTypes is admin only (+ rail order, admin count 11); AppShellView.test.tsx › 10 links

### Checks (actual output summary)
- typecheck: exit 0
- check:layers: 649 files, no violations
- format:check: all matched files use the correct format
- test: 247 files passed, 1 skipped; 2404 passed, 7 skipped
- build: not run

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- Slice 2 (images) as in plan `## Split proposal` (SIM-036.6).
- `useList`/`ListSection` could move to a shared place.
- Local `pnpm dev` walkthrough not run here.

### Scope self-check
- Could the diff be smaller? No.
- Diff size: about +1000 lines (mostly new files and tests).
