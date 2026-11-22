Status: READY

# Plan — SIM-012.6: Remove occupant and set or clear cannot-seat

Branch `ticket/SIM-012.6` is checked out (`.git/HEAD`). Fast lane: no consult files. The "Settled for SIM-012.6" defaults in
`work/tickets/SIM-012.4/plan.md:252-261` are applied as written and not reopened.

## Scope summary
From `ticket.md`:
- "Remove the occupant after confirmation with `PUT /api/seats/[id]/occupant` and `{memberId: null, expectedOccupantId}`, using the occupant id that was shown."
- "Remove stays available on a cannot-seat seat. On `occupant_changed`: reload and show a message, with no re-ask and no retry. On `not_found`: close and reload."
- "A Manager or Admin who is the occupant sees Release, not Remove."
- "Set cannot-seat with `PATCH /api/seats/[id]/cannot-seat`, on empty and occupied seats. The reason is a single-line field without `maxLength`, checked with `validateCannotSeat`, and the validator's value is what is sent. On an occupied seat the dialog says the occupant stays until removed."
- "Clear cannot-seat with exactly `{cannotSeat: false}`, after a small confirmation."
- "UI copy in `src/ui/copy/seats.ts`." Out of scope: any server, API, schema or migration change; DSH-02; a hook test harness.

Spec: SEA-03 (`spec-v1.md:238-241`, "A Manager+ sets a seat's occupant to any member, or clears it"), DEV-06 (`:286`, the server demotes the
primary device in the same transaction, so the client does nothing for it), D26 (cannot-seat flag with a reason), D36 (copy files).
Reviewer lesson, `SIM-012.4/review.md` Attempt 1 Issue 1: a hand-written write path ignored `actionOutcome`'s `reload`, so an
auth failure reloaded the page and emptied the seat list.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Remove and the set and clear cannot-seat actions appear only for Manager and Admin. | `seat-actions.test.ts › seatButtons gating`: for tier user/null/undefined all three are false; manager and admin get them per seat state. `SeatActions.test.tsx › remove and cannot-seat buttons` (static markup per tier). |
| 2 | A Manager or Admin who is the occupant sees Release, not Remove. | `seat-actions.test.ts › seatButtons: mine seat`: manager and admin with `mine: true` get `release: true`, `removeOccupant: false`. Same in `SeatActions.test.tsx` markup (Release present, "Remove occupant" absent). |
| 3 | Remove asks for confirmation and sends the shown occupant id. If the occupant changed, the page reloads, shows a message and sends nothing more. | `seat-actions.test.ts › removeDialog` (the snapshot holds the occupant id and name from the seat clicked); `seats-api.test.ts › setOccupant null` (body is exactly `{memberId:null, expectedOccupantId:<id>}`); `seat-actions.test.ts › actionOutcome removeOccupant` (`occupant_changed` gives reload true, own message, no `keepDialog`). "Sends nothing more" holds by construction: the Remove path is `run(...)` with one `seatsApi.setOccupant` call, no refetch and no second call. Reviewer checks that by reading `useSeatActions.ts`. Manual: two tabs. |
| 4 | Setting cannot-seat requires a valid reason. An invalid reason shows a field error and sends nothing. | `seat-actions.test.ts › parseCannotSeatReason` (blank, whitespace-only, control chars, 201 chars, zero-width-only are refused; NFD input returns the NFC trimmed value). `SeatActionDialogs.test.tsx › reason field` (text input, no `maxLength`, single line). Manual: invalid reason shows the error and the network tab shows no request. |
| 5 | Clearing cannot-seat asks for confirmation and sends exactly `{cannotSeat: false}`. | `seats-api.test.ts › clearCannotSeat` (PATCH to `/api/seats/<id>/cannot-seat`, `JSON.parse(body)` `toEqual({cannotSeat:false})` and key count 1; passes `validateCannotSeat`). Clear uses `ConfirmSeatDialog`, so no request happens before Confirm (manual). |
| 6 | Unit tests cover the role gating, the reason check, the Remove and cannot-seat request bodies and their refusal outcomes. | The tests under `## Tests to write`; `pnpm test` green. |

## Ming verification after merge
None beyond the manual local checks in the ticket's test plan (second-tab concurrency, 390 px and desktop), which need a browser. The
orchestrator or reviewer runs them locally with seeded data; no hosted service is involved.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/ui/seats/seat-actions.ts` | Extend `SeatAction` with `removeOccupant`, `setCannotSeat`, `clearCannotSeat`. Rename `SeatButtons.remove` to `deleteSeat` and add `removeOccupant`, `setCannotSeat`, `clearCannotSeat` (`:36-51`). Add dialog types `RemoveDialog`, `CannotSeatDialog`, `ClearCannotSeatDialog`, builder `removeDialog(seat)`, and `parseCannotSeatReason(raw)`. Add `actionOutcome` branches before the final release fallback (`:216`). | Pure logic first (rule 6). `actionOutcome` is the single source of reload, closePanel and message. | No |
| `src/ui/seats/seats-api.ts` | Add `setCannotSeat(seatId, reason)` and `clearCannotSeat(seatId)` (PATCH `${seatPath}/cannot-seat`, JSON body, `json(isSeat)`) after `setOccupant` (`:87-96`). `setOccupant(id, null, expected)` already exists and is reused for Remove. | The two PATCH bodies must be exact and tested. | No |
| `src/ui/seats/useSeatActions.ts` | Extend `SeatDialog` (`:21-25`). Add `requestRemove`, `requestSetCannotSeat`, `requestClearCannotSeat`, `setCannotSeat(reason)`. Extend `confirm()` (`:210-219`). All writes go through `run` (`:57-79`), never `writeOccupant`. | One flow keeps `reload` and `closePanel` honoured (Issue 1 lesson). | No |
| `src/ui/seats/SeatActions.tsx` | Add three buttons and three callbacks. The delete-seat button reads `buttons.deleteSeat`. | Entry points in the panel. | No |
| `src/ui/seats/CannotSeatDialog.tsx` (new) | Reason dialog, modelled on `AddSeatsDialog.tsx` (inner component holds `raw` and `invalid`). Single-line `DialogField type="text"`, no `maxLength`. Shows the occupant-stays note when `seat.occupant` is set. | The reason field needs local state and a field error. | No |
| `src/ui/seats/SeatsPage.tsx` | Add `remove` and `clearCannotSeat` branches to the `confirm` mapping (`:135-147`), render `CannotSeatDialog` next to `AddSeatsDialog` (`:200-205`), pass the new callbacks to `SeatActions` (`:167-175`). | Wiring. | No |
| `src/ui/copy/seats.ts` | Add copy under `actions` (see Approach step 6). | D36. | No |
| `src/ui/seats/seat-actions.test.ts`, `seats-api.test.ts`, `SeatActions.test.tsx`, `SeatActionDialogs.test.tsx` | New cases, plus the `remove` to `deleteSeat` rename in existing assertions. | R5. | No |

No file matches a High path. No `src/server/**` or `src/app/api/**` file changes, so R1, R2, R6 and R7 are untouched (the PUT and PATCH routes
already exist: `src/app/api/seats/[id]/cannot-seat/route.ts:11-26`, tier `manager`).

## Data model / migration
None.

## API contract
None. Existing endpoints used as they are:

| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| PUT | `/api/seats/[id]/occupant` | `{memberId: null, expectedOccupantId: <shown id>}` | `SeatDto` | `occupant_changed`, `not_found`, auth codes, `invalid_request` | manager |
| PATCH | `/api/seats/[id]/cannot-seat` | `{cannotSeat: true, reason}` or `{cannotSeat: false}` | `SeatDto` | `not_found`, `invalid_request`, auth codes | manager |

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `seat-actions.test.ts › seatButtons gating` | `removeOccupant` is true only for manager and admin on an occupied seat that is not `mine`, including on a cannot-seat seat. `setCannotSeat` only when `!seat.cannotSeat`, `clearCannotSeat` only when `seat.cannotSeat`, manager and admin only. All false for user, null, undefined. Admin-only `deleteSeat` unchanged. |
| `seat-actions.test.ts › seatButtons: mine seat` | A manager or admin who is the occupant: `release` true, `removeOccupant` false. |
| `seat-actions.test.ts › removeDialog` | Snapshot of `expectedOccupantId` and `occupantName` from the seat passed in. Not built for an empty seat (returns null). |
| `seat-actions.test.ts › parseCannotSeatReason` | Valid input returns the validator's value (trimmed, NFC; a `"  Ghế hỏng  "` and an NFD input). Refused: `""`, spaces, `"\n"`, zero-width space only, 201 chars. 200 chars is valid. Result has no other keys. |
| `seat-actions.test.ts › actionOutcome new actions` | For each of `removeOccupant`, `setCannotSeat`, `clearCannotSeat`: success is reload true, closePanel false, no message. Every auth code and `invalid_request` give reload false, closePanel false (the Issue 1 guard). `not_found` gives reload true, closePanel true, `deleteGone`. `removeOccupant` + `occupant_changed` gives reload true, closePanel false, the new `removeChanged` message and no `keepDialog`. `unavailable` and `internal` reload with the API message. |
| `seats-api.test.ts › setOccupant clears with null` | Body `toEqual({memberId: null, expectedOccupantId: id})`, both keys present, and it passes `validateOccupantPut`. |
| `seats-api.test.ts › setCannotSeat` | PATCH, encoded id, header `content-type`, body `{cannotSeat:true, reason}` passes `validateCannotSeat`, returns the seat; error code is read. |
| `seats-api.test.ts › clearCannotSeat` | Body is exactly `{cannotSeat:false}` (one key); never throws on `ApiAccessError`. |
| `SeatActions.test.tsx › remove and cannot-seat buttons` | Markup per tier and per seat state: user sees none (Release only when `mine`); manager sees Remove occupant and Set or Clear cannot-seat; `mine` manager sees Release, no Remove; Remove shown on a cannot-seat occupied seat; buttons disabled when `busy`. |
| `SeatActionDialogs.test.tsx › reason field` | `CannotSeatDialog` closed renders nothing; open renders `type="text"` with no `maxLength` attribute; the occupant-stays note appears only for an occupied seat; Cancel comes before submit. |

The hook has no test harness (out of scope). Its risk is covered by routing every new write through `run`, whose results all come
from `actionOutcome` (tested above), and by the reviewer check in Approach step 3.

## Approach
1. **Pure logic** in `seat-actions.ts`:
   - `seatButtons`: `removeOccupant = canAssign(tier) && seat.occupant !== null && !seat.mine`; `setCannotSeat = canAssign(tier) && !seat.cannotSeat`; `clearCannotSeat = canAssign(tier) && seat.cannotSeat`; `deleteSeat = canManageSeats(tier)` (the former `remove`). Naming the old field `deleteSeat` avoids two different "remove" meanings.
   - `removeDialog(seat)`: `{kind:"remove", seat, expectedOccupantId: seat.occupant.id, occupantName}` or null. The id comes from this snapshot, never from the live seat at confirm time.
   - `parseCannotSeatReason(raw)`: `validateCannotSeat({cannotSeat:true, reason: raw})` from `@/lib/validate/seat`; return `{ok:true, reason: value.reason}` (the validator's value is what is sent) or `{ok:false}`.
   - `actionOutcome`: add before the final fallback. `removeOccupant`: auth and `invalid_request` first (existing top block), `not_found` gives close and reload with `deleteGone`, `occupant_changed` gives reload with `removeChanged`, else `apiErrorMessage(code)` with reload. `setCannotSeat` and `clearCannotSeat`: `not_found` gives close and reload; else reload with `apiErrorMessage(code)`. The top block already guarantees "auth failure never reloads".
2. **API**: `setCannotSeat` and `clearCannotSeat` in `seats-api.ts`, through the existing `call` and `json(isSeat)`.
3. **Hook**: add the three dialog kinds to `SeatDialog`. `requestRemove(seat)` sets the dialog from `removeDialog` (no-op if null). `confirm()` sends: remove via `run("removeOccupant", seat.code, shown, () => seatsApi.setOccupant(seat.id, null, shown.expectedOccupantId))`; clear via `run("clearCannotSeat", ...)`. `setCannotSeat(reason)` via `run("setCannotSeat", ...)`. **Do not copy `writeOccupant`.** `run` already handles notice, `onDeleted` for `closePanel`, `refresh` only when `outcome.reload`, and the focus signal. `occupant_changed` on Remove therefore reloads and shows the message with no refetch, no re-ask, no retry. The existing effect at `:82-84` already drops a dialog whose seat is no longer open. Reviewer check: each new `seatsApi.*` call sits inside a `run(...)` callback, and no new code calls `refresh()` or `setFocusSignal` itself.
4. **UI**: `SeatActions` gets "Remove occupant", "Block seat" and "Unblock seat" buttons (tonal, `disabled={busy}`; Remove uses the danger variant). `CannotSeatDialog` mirrors `AddSeatsDialog`: submit calls `parseCannotSeatReason`; if not ok show the field error and send nothing; if ok call `onSubmit(reason)`. `SeatsPage` maps the remove and clear dialogs to `ConfirmSeatDialog` (title, body, submit label) like delete and release.
5. **Rules**: R1: only `src/ui/**` edits, imports via `@/` (`@/lib/validate/seat`, `@/lib/seats/types`). R3, R6, R7: no server change; the client treats auth codes as no-reload through `actionOutcome`. R4: nothing outside the file list. R5: tests above, run `pnpm typecheck`, `pnpm check:layers`, `pnpm format:check`, `pnpm test`.
6. **Copy** (`seats.ts`, `actions`): `removeOccupant`, `removeTitle(code)`, `removeBody(name)` ("Remove NAME from this seat? Their primary device here becomes a secondary device." DEV-06), `removeSubmit`, `removeChanged` ("This seat changed in the meantime, so nobody was removed. The page was reloaded."), `blockSeat`, `blockTitle(code)`, `blockReason` (field label), `blockOccupantNote` ("The current occupant stays until you remove them."), `blockSubmit`, `blockInvalid(max)` ("Enter a reason of 1 to 200 characters."), `unblockSeat`, `unblockTitle(code)`, `unblockBody` ("The reason is deleted for good."), `unblockSubmit`. Final wording is the implementer's, in English, in this file only.
7. Run (after `eval "$(fnm env --shell bash)" && fnm use --silent-if-unchanged`): `pnpm typecheck && pnpm check:layers && pnpm format:check && pnpm test`.

## Specialist input used
None (fast lane). Defaults taken from `SIM-012.4/plan.md:252-261` and the Attempt 1 Issue 1 lesson from `SIM-012.4/review.md`.

## Assumptions
1. **Hotspots:** the board (`work/backlog.md`) shows no other ticket `IN_PROGRESS`, `REVIEW` or `DONE`, so no rebase is expected. SIM-013, SIM-014 and SIM-016 will later extend `SeatActions`, `SeatsPage` and `useSeatActions`.
2. **Role gate** is `canAssign` (manager+); the server enforces it again (`withAuth {tier:"manager"}`).
3. **Reason field** is `type="text"`, so a browser strips pasted newlines. The validator refuses control characters anyway. The field has no `maxLength`, so a long paste shows the field error instead of being cut silently.
4. **Changing a reason** is Unblock then Block (last write wins, PATCH has no concurrency token). Block is not offered on an already blocked seat.
5. **A transient failure** (`unavailable`, `internal`) on any of the three writes closes the dialog, shows the message and reloads, and never resends (the write may have applied). This matches `run`'s existing behaviour.
6. **Cannot-seat dialog on `invalid_request` or auth failure** closes (via `run`) and shows the message as a notice, without reload. Acceptable, since the client validator is the server's own function, so `invalid_request` should not happen.
7. **Button label "Block seat"** vs the status text "Not for seating" (`seatsCopy.status.cannotSeat`): wording only, no behaviour effect.
8. Estimate about 220 production lines plus tests, within one cycle.

## Blocking questions
None.

## Split proposal
None.
