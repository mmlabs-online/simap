## Attempt 1 — 2026-11-26

### Files touched
Slice A (data layer, button, first-room wiring; commit A):
| File | Required because |
|---|---|
| `src/ui/checkin/presence-api.ts` (+ `.test.ts`) | Shared client wrapper for the SIM-058 endpoints (`mine`, `checkIn`, `checkOut`, `move`, `room`) |
| `src/ui/checkin/useMyPresence.ts` | Shared "my presence" hook `{status, data, errorCode, reload, refresh, apply}` |
| `src/ui/checkin/useRoomPresence.ts` | Shared per-room read `{status, data, errorCode, refresh}` (for SIM-060) |
| `src/ui/checkin/CheckinButton.tsx` (+ `.test.tsx`) | Floating Check in / Check out / Try again button |
| `src/ui/copy/checkin-popup.ts` | Copy (D36) for popup and button (button strings are used by Slice A; popup strings by B) |
| `src/ui/checkin/CheckinView.tsx` (+ `.test.tsx`) | `button` prop fills the SIM-057 slot |
| `src/lib/checkin-popup.ts` (+ `.test.ts`) | `buttonAction` and `firstRoomInputs` are Slice A; the other exports are Slice B (one file, so commit it in A whole, or in B) |
| `src/ui/checkin/CheckinPage.tsx` | `firstRoom` presence wiring, `useCheckinFlow`, button, popup sibling (the whole file wires both; commit it in B because it imports B files) |

Slice B (popup; commit B):
| File | Required because |
|---|---|
| `src/lib/checkin-popup.ts`, `.test.ts` | `autoOpen`, `popupReducer`, `popupRooms`, `initialSelection`, `checkInOutcome` (file shared with A) |
| `src/lib/sprites/room-thumb.ts` (+ `.test.ts`) | Thumbnail data |
| `src/ui/checkin/usePopupExtras.ts` | Count and layout reads while the popup is open |
| `src/ui/checkin/useCheckinFlow.ts` | Popup phase, check-in/out handlers, props for popup and button |
| `src/ui/checkin/CheckinPopup.tsx` (+ `.test.tsx`) | The modal dialog view |
| `src/ui/checkin/RoomThumb.tsx` | SVG thumbnail (`RoomThumbView`) |
| `src/ui/checkin/CheckinPage.tsx` | see above |

Note for the orchestrator: `CheckinPage.tsx` and `src/lib/checkin-popup.ts` cannot be cleanly split across A and B (A would need the B files to compile). Simplest: commit A = presence-api, useMyPresence, useRoomPresence, CheckinButton, copy, CheckinView (+ tests); commit B = everything else.

### Tests added / changed
- `src/lib/checkin-popup.test.ts` (autoOpen, popupReducer, popupRooms, initialSelection, buttonAction, checkInOutcome, firstRoomInputs)
- `src/lib/sprites/room-thumb.test.ts`
- `src/ui/checkin/presence-api.test.ts`
- `src/ui/checkin/CheckinPopup.test.tsx`
- `src/ui/checkin/CheckinButton.test.tsx`
- `src/ui/checkin/CheckinView.test.tsx › button prop renders inside data-slot=checkin-button`

### Checks (actual output summary)
- format:check: All matched files use the correct format.
- typecheck: exit=0; check:layers: 940 files, no violations
- test: Test Files 357 passed | 1 skipped; Tests 3501 passed | 9 skipped
- build: exit=0
- test:db: Test Files 23 passed; Tests 365 passed

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- Wall colour uses the global `--px-wall` token (Assumption 1); a per-room colour would need data the rooms do not have.
- Deviations: the checked radio is focused by an effect after `showModal()` (React `autoFocus` does not work before the dialog is shown); `buttonAction` checks zero seats before presence error; the popup `skip` event also fires only when seats and presence are both ready and the member is checked in or has no seat (a seat panel open on arrival keeps it pending, per Assumption 6).
- The "Check in to <code>" button shows the code, as planned. Dialog focus, Escape, arrow keys and the 390 px layout are untested in a browser (node-only Vitest); see "Ming verification".

### Scope self-check
- Could the diff be smaller? No; every file is in the plan.
- Diff size: about +1100 lines including tests, no deletions beyond the replaced `firstRoom` stub.
