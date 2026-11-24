Status: READY

# Plan — SIM-012.4: Member picker, assign and replace (slice 1 of 2)

The whole ticket is about 650 production lines, so this plan covers **slice 1 only**: picker, Assign, Replace and the
re-ask. Remove and set/clear cannot-seat go to slice 2 (see `## Split proposal`). **The ticket's AC1, AC6 and AC8 are only
partly delivered by this slice.** The table below says which part.

## Scope summary
Ticket:
- "Active-member picker over `GET /api/members?status=active`: debounced search, stale responses dropped, a radio list
  with name and employee code, and "Load more" by cursor."
- "Assign and replace with `PUT /api/seats/[id]/occupant`, always sending `expectedOccupantId`."
- "Replace confirmation: "X sits here. Replace with Y?", with the shown occupant's id and name kept in one snapshot."
- "Re-ask after `occupant_changed`, as settled in the plan. Never resend without a new confirmation."

Spec:
- SEA-03 (`docs/spec-v1.md:241-244`): "Assigning a different member to an occupied seat asks for confirmation ("X sits
  here. Replace with Y?"); on confirm it replaces the occupant and demotes the primary (D18)." "Assigning the current
  occupant again changes nothing."
- SEA-01 (`:232-233`): "Such a seat cannot be assigned or requested and shows grey with the reason; its status is still
  derived (D26)."
- DEV-06 (`:287-288`): the server demotes the primary device in the same transaction. No UI work.

Decisions:
- D18: "Assigning to an occupied seat asks for confirmation, then replaces the occupant and demotes the primary device."
- D26: "it blocks assignment and requests; status stays derived."
- D32: the seat takes the occupant's group on assign. Server only (`src/server/seats/seats.ts:379-380`).
- D36: UI copy is English and lives in copy files. Names keep Vietnamese diacritics.

Settled, applied and not reopened (`work/tickets/SIM-012.2/plan.md:239-267`):
- "Branch on `error.code`, never on status. Reload after every success and after any 404, 409 or 422."
- Assign: "`member_not_assignable` (422) → reload picker, keep dialog; `seat_cannot_seat` → close, panel shows reason".
- Re-ask: "On `occupant_changed`, refetch the seat, then: a new occupant → ask again with that name; now empty → ask a
  plain assign confirm; already the chosen person → close, done; now cannot-seat → close and show the reason; refetch
  failed → show the error and send nothing. **Never resend without a new confirmation.**"
- Picker: "list with its own `max-h` in `dvh` and `overflow-y-auto`"; "**Enter in the search box must not submit the
  form**"; ""Load more" is `type="button"`. `q` max 80 characters. Show name plus employee code."
- "SEA-03 says "any member", but the server and the SIM-012 ticket allow only active members. The picker uses
  `status=active`."
- Back closes an action dialog with the panel. "A write in flight still reloads when it finishes."
- "Focus after an action: if the opener is gone, focus the panel heading."

## Acceptance criteria → verification
Numbers are the ticket's AC order.

| # | Criterion | This slice | How the reviewer verifies it |
|---|---|---|---|
| 1 | Assign, Replace, Remove and cannot-seat actions appear only for Manager and Admin | **Assign, Replace** | `seat-actions.test.ts › seatButtons`; `SeatActions.test.tsx › assign role matrix` |
| 2 | The picker lists active members, searches by name, loads more, and Enter in search does not submit | Full | `seats-api.test.ts › activeMembers`; `member-picker.test.ts` (reducer, Enter rule); `MemberPickerDialog.test.tsx`; Enter itself is browser check B2 |
| 3 | Assigning to an empty seat updates the table and panel | Full | `seat-actions.test.ts › pickStep empty seat sends expected null`; `actionOutcome assign ok reloads`; browser check B1 |
| 4 | Assigning to an occupied seat asks "X sits here. Replace with Y?" | Full | `seat-actions.test.ts › pickStep occupied`, `› confirmText exact replace text` |
| 5 | If the occupant changed, the page reloads and asks again with the current state and sends nothing until confirmed | Full | `seat-actions.test.ts › decideReask`, `› reaskDialog`; browser check B3 |
| 6 | A cannot-seat seat shows its reason and has Assign disabled. Setting the flag requires a valid reason | **Reason and disabled Assign/Replace.** Setting is slice 2 | `SeatActions.test.tsx › cannot-seat disables assign and replace`; existing `SeatDetailPanel.test.tsx` covers the reason |
| 7 | A member who became unassignable is refused with a message, the picker reloads and the dialog stays open | Full | `seat-actions.test.ts › actionOutcome member_not_assignable`, `› refusedDialog`; browser check B4 |
| 8 | Unit tests cover role gating, the re-ask decision, replace text, the reason check, the picker's stale handling and the API client | **All except the reason check** (slice 2) | The tests in `## Tests to write`; `pnpm test` |

Checks (activate Node first with `eval "$(fnm env --shell bash)" && fnm use --silent-if-unchanged`):
`pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`.

## Ming verification after merge
Vitest renders static markup in node, so these need a real browser. Use `pnpm seed:dev` data: `C302-01` is occupied,
`C302-04` is cannot-seat.

- **B1 Assign:** as a Manager, assign on an empty seat. The table and panel update.
- **B2 Picker:** Enter in search does not submit, including while composing Vietnamese with an IME. Search, Load more and
  list scrolling work at 390 px and on desktop.
- **B3 Re-ask, two tabs:** open the confirm in tab A, change the occupant in tab B, confirm in A. A shows the new name,
  **focus is on Cancel**, and nothing is sent until you confirm again. Repeat with the seat emptied, with the same person
  assigned, and with the seat marked cannot-seat.
- **B4 Unassignable:** pick a member, deactivate them in another tab, submit. The message shows, the list reloads without
  them, and the dialog stays open.
- **B5 Stacked dialogs:** Esc and a scrim click on the confirm close only the confirm. Focus returns to the picker. After
  a successful replace, focus lands on the Replace button or the panel heading.
- **B6 Cannot-seat:** `C302-04` shows its reason and a disabled Assign.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/ui/seats/member-picker.ts` (new, ~65) | Pure: `PickerMember`, `normalizePickerQuery`, `pickerReducer`, `selectedMember`, `canLoadMore`, `blocksSearchEnter` | Stale handling must be unit-testable | No |
| `src/ui/seats/useMemberPicker.ts` (new, ~80) | Debounce, request ids, unmount guard, reload token | Picker effects | No |
| `src/ui/seats/MemberPickerDialog.tsx` (new, ~105) | Dialog, plus a props-driven `MemberPickerFields` | Picker UI | No |
| `src/ui/seats/seats-api.ts` (l.53-80) | Add `setOccupant`, `activeMembers` | API client; reuses `call()` | No |
| `src/ui/seats/seat-actions.ts` (l.8, l.43-80) | Add `"assign"` action, `canAssign`, `seatButtons`, `pickStep`, `confirmText`, `decideReask`, `reaskDialog`, `refusedDialog`, `AssignDialog` | Pure decisions | No |
| `src/ui/seats/useSeatActions.ts` (l.8-11, l.43-100) | `assign` dialog, `requestAssign`, `pick`, `closeConfirm`, `writeOccupant` | `run()` cannot express the re-ask | No |
| `src/ui/seats/SeatActions.tsx` | Render from `seatButtons`; one Assign/Replace button | Gating | No |
| `src/ui/seats/SeatsPage.tsx` (l.121-134, l.153-178) | Confirm text for assign; render picker; key the confirm | Stacking | No |
| `src/ui/seats/ConfirmSeatDialog.tsx` (l.33) | Add `max-h-32` and `CLIP` to the body | Untrusted names can draw over nearby UI (SIM-012.2 note) | No |
| `src/ui/copy/seats.ts` (`actions`) | New strings | D36 | No |
| `src/ui/seats/member-picker.test.ts` (new) | Reducer and query tests | AC2, AC8 | No |
| `src/ui/seats/MemberPickerDialog.test.tsx` (new) | Markup tests | AC2 | No |
| `src/ui/seats/seat-actions.test.ts` | New decision tests | AC1, 3-5, 7, 8 | No |
| `src/ui/seats/seats-api.test.ts` | Client tests | AC8 | No |
| `src/ui/seats/SeatActions.test.tsx` (l.24-34) | Pass `onAssign`; new tests | The prop is required | No |
| `src/ui/seats/SeatActionDialogs.test.tsx` | Long-name clip test | Confirm body change | No |

No High path. Estimated production change: **about 450 lines**.

## Data model / migration
None.

## API contract
No endpoint change. This slice consumes:

| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| GET | `/api/members` | `status=active`, `limit=20`, optional `q`, optional `cursor`; each key at most once | `{items, nextCursor, groups}`. The client keeps only `id`, `displayName`, `employeeCode` | 400 `invalid_request`, auth codes | User+ (`route.ts:18`) |
| PUT | `/api/seats/[id]/occupant` | `{memberId, expectedOccupantId}`; both keys always present, `null` for an empty seat (`validate/seat.ts:35-38`) | 200 `SeatDto` | 409 `occupant_changed`, 409 `seat_cannot_seat`, 422 `member_not_assignable`, 404 `not_found`, auth codes | Manager+ |
| GET | `/api/seats/[id]` | none | 200 `SeatDto` | 404, auth codes | User+ |

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `member-picker.test.ts › normalizePickerQuery: NFC, collapses whitespace, trims, caps at 80 code points, never splits a surrogate pair; the result always passes parseMemberQuery` | AC2, diacritics, bounds |
| `› pickerReducer: search resets items, cursor and selection` | AC2 |
| `› pickerReducer: a stale search response is dropped` | AC8 |
| `› pickerReducer: a load-more response from an older query is dropped, never appended` | AC8 |
| `› pickerReducer: load more appends and de-duplicates by id` | AC2 |
| `› canLoadMore: false with no cursor, while loading, or while a page is in flight` | AC2, pagination |
| `› pickerReducer: a failed load more keeps the rows and cursor` | AC2 |
| `› selectedMember: null when the id is not listed; the current occupant cannot be selected` | AC7 |
| `› blocksSearchEnter: Enter yes; Enter while composing no; other keys no` | AC2, IME |
| `MemberPickerDialog.test.tsx › shows name and code; a null code never prints "null"; Vietnamese names unchanged` | AC2 |
| `› Load more and Retry are type="button"; search is type="text"; no required or maxLength` | AC2 |
| `› list has max-h in dvh and overflow-y-auto; empty and error states; current occupant radio disabled` | AC2 |
| `seats-api.test.ts › activeMembers: status and limit always; no q when blank; cursor verbatim; no duplicate keys` | AC8 |
| `› activeMembers: keeps only id, displayName, employeeCode (no email); wrong shape is internal` | AC8, privacy |
| `› setOccupant: PUT body has exactly both keys, null expected kept; the body passes validateOccupantPut; error code passes through` | AC8 |
| `seat-actions.test.ts › seatButtons: matrix over null, undefined, user, manager, admin; empty, occupied, cannot-seat` | AC1, AC6 |
| `› pickStep: empty seat sends expected null; occupied builds one snapshot with the shown id and name; same person does nothing` | AC3, AC4 |
| `› confirmText: exact "X sits here. Replace with Y?" with diacritics; plain assign text when occupantName is null` | AC4, AC8 |
| `› decideReask: new occupant; now empty; already chosen; chosen AND cannot-seat is done; cannot-seat; refetch failed` | AC5, AC8 |
| `› reaskDialog: replaces seat and snapshot, bumps revision, keeps the picker` | AC5 |
| `› refusedDialog: clears confirm, sets the error, bumps reloadToken` | AC7 |
| `› actionOutcome assign: ok reloads; auth and invalid_request do not; member_not_assignable keeps the dialog; not_found closes the panel; seat_cannot_seat reloads with a message; never gets Release copy` | AC3, AC7, R7 |
| `SeatActions.test.tsx › assign role matrix; Replace when occupied; cannot-seat disables assign and replace` | AC1, AC6 |
| `SeatActionDialogs.test.tsx › confirm body clips a long name` | Untrusted text |

## Approach
1. **Copy** (`seats.ts`, `actions`): `assign: "Assign"`, `replace: "Replace"`, `replaceBody(x, y)` returning exactly
   `` `${x} sits here. Replace with ${y}?` ``, plain assign title, body and submit, picker strings, `assignChanged`,
   `memberGone`. Labels must not contain "Release seat" or "Delete seat", because the existing matrix test uses `includes`.
2. **API client.** Add both methods to `createSeatsApi`, reusing `call()`, so no second client or error mapper is needed.
   `activeMembers` builds its query with `URLSearchParams`, uses `normalizePickerQuery`, and maps each item to the three
   kept fields. `MemberDto` also carries email, seats and devices, which the picker has no use for.
3. **Pure picker** (`member-picker.ts`).
   - State: `{items, nextCursor, status, errorCode, moreId, moreFailed, latest, selectedId}`.
   - Events: `search(id)`, `more(id)`, `loaded(id, result)`, `select(id)`. `loaded` applies only when `id === latest`
     (replace) or `id === moreId` (append). Anything else returns the state unchanged. `search` clears `moreId` and the
     selection.
   - `normalizePickerQuery` mirrors `member-query.ts:28-29` and then caps by code points.
4. **`useMemberPicker`.** Load immediately on mount. Debounce 300 ms on the normalized query, skipping when it equals the
   last requested one. A change of `reloadToken` loads at once with the current query. Use the `useRoomSeats.ts:57-62`
   counter and mounted-ref idiom.
5. **`MemberPickerDialog`.** Mount the inner component only while open (`AddSeatsDialog.tsx:20-22`).
   - Search is `DialogField` with `type="text"`. `type="search"` is avoided because Esc also clears it in Chromium.
   - `onKeyDown`: `if (blocksSearchEnter(e.key, e.nativeEvent.isComposing)) e.preventDefault()`.
   - The list wrapper is `role="radiogroup"` with `max-h-[35dvh] overflow-y-auto`, and contains Load more and the status
     line, so the footer stays visible at 390 px. Names use `CLIP`.
   - The current occupant's radio is disabled and labelled.
   - Submitting with no selection shows an inline error. `EntityFormDialog` has no "disable submit" prop and is outside
     this ticket.
6. **Pure decisions** (`seat-actions.ts`).
   ```ts
   type OccupantConfirm = { expectedOccupantId: string | null; occupantName: string | null;
                            memberId: string; memberName: string };
   type AssignDialog = { kind: "assign"; seat: SeatDto; confirm: OccupantConfirm | null;
                         revision: number; error: string | null; reloadToken: number };
   ```
   - `decideReask` checks in this order: failed refetch → error; `occupant.id === memberId` → done (the server's no-op
     wins first, `lib/seats/rules.ts:25`); `cannotSeat` → close with the reason; no occupant → plain confirm with
     `expectedOccupantId: null`; otherwise → ask with the fresh id and name. If the same person as before is back (A→B→A),
     it still asks.
   - `actionOutcome` gets an explicit `"assign"` branch, so it can never fall through to Release copy
     (`seat-actions.ts:75-79`). `keepDialog?: true` is set **only** on `member_not_assignable`, so the existing `toEqual`
     assertions stay valid.
7. **`useSeatActions.writeOccupant(started, seat, choice)`.** Separate from `run()`, sharing `busyRef`.
   - Hold `busy` across the PUT, the refetch and the reload, so the new confirm cannot be submitted before the page shows
     the current state.
   - Read "is this dialog still open" from a ref of the latest dialog. Apply the next dialog only with
     `setDialog((d) => (d === started ? next : d))`, so a dialog the user closed or left with Back never reopens. If it was
     closed meanwhile, show the refusal as a notice.
   - **There is no code path from a refusal to a PUT.** A PUT happens only from a user's submit.
   - Bump `focusSignal` only when the dialog closed. With a dialog still open, the panel heading is inert behind it.
8. **Stacking and focus** (`SeatsPage.tsx`). Render the picker, then the confirm, as siblings.
   - Give the confirm `key={assign-<revision>}`. A re-ask remounts it, so focus lands on **Cancel**. Without this, focus
     stays on the submit button and a second Enter could approve a name the user has not read.
   - Pass the picker `submitting={busy && dialog.confirm === null}`. A disabled picker submit could not take focus back
     when the confirm closes.
   - `closeConfirm` clears only `confirm`.
9. **`SeatActions`.** Render from `seatButtons`. Assign and Replace are one `<Button>` at one position with a changing
   label, so focus survives when the seat goes from empty to occupied. It is `disabled` on a cannot-seat seat.

Rules: **R1** only `src/ui/**` and `@/lib/**` imports (`pnpm check:layers`). **R2, R3, R6** not touched. **R4** files
listed above only. **R5** tests above. **R7** auth codes never reload or resend; every domain refusal branches on
`error.code`. **D36** all strings in `copy/seats.ts`.

## Specialist input used
From `consult-frontend-developer.md`, each checked against the code.

Adopted:
- Findings on `run()`, the `actionOutcome` fall-through, `EntityFormDialog` and the validators (all confirmed).
- Rec. 2 (write body), 3 (request ids, de-duplication, no double load more), 4 (radio list, IME guard), 6 (one snapshot),
  10 (`seatButtons`), 11 (test split).

Changed or rejected:
- **Rec. 1, separate members client:** rejected. A method on `createSeatsApi` reuses `call()` and saves lines.
- **Rec. 3, keep the selection if still listed:** simplified. Every new search clears it, and `selectedMember` returns
  null for an unlisted id.
- **Rec. 3, page size (Q3):** 20, not the default 50, because each response carries per-member refs and up to 500 groups.
- **Rec. 4, submit disabled until chosen:** rejected. `EntityFormDialog` has no such prop. An inline error is used.
- **Rec. 4, `type="search"`:** rejected (Esc clears it).
- **Rec. 5, disable the picker's submit under the confirm:** rejected. It is already inert, and disabling it breaks focus
  return.
- **Rec. 7, re-ask order:** made explicit. "Already chosen" comes first, matching the server's rule.
- **Rec. 7, focus:** added the keyed remount, which the consult did not cover.

Open questions resolved:
- **Q1 (cannot-seat on an occupied seat):** the server **accepts** it and keeps the occupant. `setCannotSeat` has no
  occupant check (`seats.ts:444-473`), `seats.db.test.ts:376` asserts it, and SIM-012 A3 records it: "Cannot-seat on an
  occupied seat is allowed. The occupant stays until removed". Slice 2 does not hide the control.
- **Q2:** yes, the settled plan says close and show the reason.
- **Q3:** 20.
- **Q4:** shown disabled, because hiding rows client-side could make a page look empty while more pages exist.

## Assumptions
1. **Split accepted.** The orchestrator or Ming creates the slice 2 ticket.
2. **Slice 1 is about 450 lines,** slightly over the rough 400 guide. It is not cut further: a picker without a write
   ships dead code, and Assign without the re-ask breaks a settled rule.
3. **Replace on an occupied cannot-seat seat is disabled.** The server refuses it (`rules.ts:27`) and D26 blocks
   assignment.
4. **A Manager who is the occupant keeps Replace** (`SIM-012.2/plan.md:210-211`).
5. **Search is diacritic-sensitive for now.** "nguyen" does not find "Nguyễn" because the server uses `ilike`
   (`manage.ts:149-152`, recorded as SIM-011 A7). DSH-02 (`spec:402`) requires accent-insensitive search, but a fix is a
   server and DB change, out of scope here. **Follow-up** for SIM-017 or a DB ticket. Until then, users type the accents
   or search by employee code.
6. **Search also matches email,** so a row can appear with no visible match. Accepted: the ticket asks for name and code.
7. **A transient failure** (`unavailable`, `internal`) closes the dialog, shows the message and reloads. It never resends,
   because the write may have applied.
8. **Hotspots:** no ticket is `IN_PROGRESS`, `REVIEW` or `DONE` on the board, so no rebase is expected. SIM-013, SIM-014
   and SIM-016 will later extend `SeatActions`.

## Blocking questions
None.

## Split proposal
| Slice | Scope | Est. production lines |
|---|---|---|
| **SIM-012.4 (this plan)** | Picker, Assign, Replace, re-ask, `member_not_assignable`, Manager+ gating of these, Assign disabled on cannot-seat | ~450 |
| **SIM-012.6** (proposed, depends on .4) | Remove with confirmation; Release-not-Remove for a Manager occupant; set and clear cannot-seat with `validateCannotSeat` | ~200 |

Settled for SIM-012.6 (from this plan's code reading):
- **Remove:** `{memberId: null, expectedOccupantId: shown}`. Stays available on a cannot-seat seat (`rules.ts:26`,
  `seats.db.test.ts:363-370`). Hidden when `seat.mine`. `occupant_changed` → reload and message, no re-ask, no retry.
  `not_found` → close and reload.
- **Set cannot-seat:** offered on empty **and occupied** seats. On an occupied seat the dialog says the occupant stays
  until removed. Send the validator's `value` (trimmed, NFC). Single-line input, no `maxLength`.
- **Clear cannot-seat:** `{cannotSeat: false}` exactly, after a small confirm. The reason is lost for good, because the
  audit row stores only `hasReason` (`seats.ts:469`).
- **Changing a reason** is clear then set. PATCH has no concurrency token, so the last write wins.
- Remaining ticket AC parts: AC1 (Remove, cannot-seat), AC6 (setting requires a valid reason), AC8 (reason check).
