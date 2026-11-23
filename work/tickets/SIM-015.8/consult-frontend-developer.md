## Findings
- save-plan.ts already has the pure pieces. `planSave` returns `{deletes, createKeys}`, and `assignCreatedSeats`, `forgetDeletedSeat`, `restoreRemovedSeat` and `buildSavePayload` cover the rest. What is missing is the async runner, the palette desk, and the seat-delete path.
- `savePayload` (editor-state.ts:70-73) currently returns `pending_seats` when `deletes` or `createKeys` is non-empty. `editorFlags` maps that to `saveBlock: "invalid"`. SIM-015.8 must remove that block. `canSave` then depends only on dirty, a valid payload, and the other flags. `buildSavePayload` still returns `missing_seat_id` for desks without an id, and that case is also mapped to `pending_seats`. So validation of the PUT needs a dry-run payload. For example, build the payload from a draft where new desks get placeholder ids, or validate after assignment only.
- The `delete` reducer (editor-state.ts:143-150) refuses any selection that contains a seat (`seat_delete`). 015.8 must:
  - Allow it.
  - Push existing seats (`seatId !== null`) into `draft.removed`.
  - Drop new desks (`seatId === null`) outright, with nothing added to `removed`.
  - Do this inside `deleteItems` or a sibling in lib/layout-editor/draft.ts, so undo is a single history commit.
- Undo is already correct for deferred changes. Add, delete, restore and the `removed` list all live in `Draft`, and `isDirty` compares `removed`. Undoing a delete drops the seat from `removed` with no network call.
- The API behaves as A3 assumes.
  - `POST` takes `count` from 1 to 50 and returns `items`. Seats get `seq = counter+1` (D30). The counter never decreases, so the codes are not contiguous after deletes. AC2 should say "next number", not "max+1".
  - `seatsApi.add` returns `SeatDto[]`. `assignCreatedSeats` takes `{id, code, seq}`, so check that `SeatDto` carries `seq`. It does at seats.ts:61/82.
  - `remove` returns `{ok:false, code:"seat_not_empty"}` on 409.
  - `call()` never throws. It maps `ApiAccessError` to `unauthenticated` and similar codes, and anything else to `unavailable`.
- R7 interaction: `apiFetch` re-sends once on 401/403. DELETE is idempotent in effect, but a repeated DELETE can return 404 after the first one succeeded server-side. Treat DELETE 404 `not_found` as success (the seat is gone), and call `forgetDeletedSeat`. A repeated POST could create duplicates. This only happens if the server returns 401/403 after the write, which R7 forbids, so the runner does not need to guard against it. Do not retry in the runner.

## Recommendations
1. Put the runner in `src/lib/layout-editor/save-run.ts`. It is pure async code with injected deps `{ remove, add, saveLayout }` (a `Pick<SeatsApi,...>`). The signature is `runSave(draft, baseline, baseVersion, roomId, api): Promise<SaveOutcome>`. It never throws. It returns the draft as updated so far, so the reducer applies the partial progress after every outcome.
   Outcome shape:
   - `{status:"saved", view: MapView}`
   - `{status:"failed", stage:"delete"|"create"|"put"|"assign", code, draft, ...}`
2. Sequence:
   - Step 1. `planSave`. If `unplaced`, stop with no calls.
   - Step 2. Deletes run one at a time. Sequential order keeps the "stop at first failure" semantics and a deterministic state.
     - On success, `forgetDeletedSeat`.
     - On 404, treat it as success.
     - On `seat_not_empty`, call `restoreRemovedSeat` and stop with the seat code. `ref` has the code, so the message can name it (SEA-01). No PUT is sent.
     - On other failures (network, 5xx, auth), keep the seat in `removed` and stop. Do not restore. The user can retry Save.
   - Step 3. Creates, in chunks of 50. On a chunk failure, the earlier chunks' seats exist. Assign those immediately by applying `assignCreatedSeats` per chunk. That needs `assignCreatedSeats` to accept a partial key slice, so pass `createKeys.slice(off, off+n)`. Return the draft with those seats assigned. A retry then creates only the remaining desks, and no seats are orphaned or duplicated. If the response length differs from the chunk (`count_mismatch`), stop with stage `assign`. Seats exist on the server but are unmapped, so say that in the message.
   - Step 4. `PUT` with `buildSavePayload(draft, baseVersion)` followed by `validateLayoutSave`. This is the only step that uses `baseVersion`.
     - On failure, return the draft with the assigned ids and with `removed` already cleared. Retry then only repeats the PUT.
     - On `conflict` (409 version), reuse the existing conflict path (`saveErrorKind`).
     - Message: "Seats were created but the layout was not saved. Try Save again."
3. After a successful run, rebase. Set `baseline = present = draft` with the ids from the response `MapView`, `baseVersion = view.version`, `history` reset (an undo across a Save would resurrect deleted seats, which the server no longer has), `tool` null, `selection` cleared.
4. After a partial failure, rebase the baseline in a way that stays correct:
   - Deleted seats (`removed` cleared) must also leave the baseline's items.
   - Created seats get ids in both draft and baseline, so `isDirty` stays true and Save stays enabled.
   - Simplest approach: a reducer action `saveProgress {draft}` that replaces the history present and clears the undo stack. The undo stack holds drafts with old `removed` entries and `null` ids. Undo into those would send DELETEs for seats that are already gone, or create duplicates. So clear history on any partial progress.
5. Add a new `SaveError` code set and copy in `src/ui/copy/`: `seat_not_empty` (names the code), `seats_partial_create`, `layout_not_saved_after_create`, `delete_failed`. Reuse `saveErrorKind` for 401/conflict. Only the first failure shows. State what already happened ("N seats were deleted").
6. Palette desk (`desk.single`): reuse `fixturePalette` and extend it with a seat entry that makes `{kind:"seat", seatId:null, code:null}` and the label "New" (A4). `tryPlace` should accept it with the same rules as other items. Check that `normalised`/`isNewDesk` handle `key` generation (`n:<k>`) so keys stay stable across undo.
7. Tests (Vitest, no DOM). A fake `seatsApi` with scripted results per call, asserting call order and the arguments:
   - Happy path: delete, create, PUT order.
   - Delete 409 after an earlier success: restore, no create, no PUT, draft state.
   - Delete 404 treated as success.
   - Create failure on the second chunk (60 new desks): the first 50 assigned, 10 remain.
   - `count_mismatch`.
   - PUT failure: draft has ids, `removed` empty.
   - Conflict.
   - Retry after each partial failure completes with no duplicate calls.
   - Undo history cleared after partial progress.
   - Reducer tests for the delete rules and the removed `pending_seats` block.
   - Static-render tests for the palette entry and the Delete button.
   - Order assertion: in `assignCreatedSeats`, ascending `seq` follows add order.
8. UI: keep `frozen` while saving. Disable Save while saving, so a double click cannot run two sequences. A re-entrancy guard in the runner call site (ref flag) is also advisable.

## Risks
- Orphans on PUT failure or `count_mismatch` leave seats in the room with no layout position. A3 accepts this. Retry works only because partial progress is rebased into state. If the user reloads instead, the unplaced seats show up in the tray (A5) and can be placed or deleted.
- Another admin deleting or adding seats mid-session makes the PUT fail on the seat set (`layout_seats_mismatch` or similar). The message should say "reload".
- DELETEs are not atomic with the PUT. Seats can be deleted and the PUT can then fail (network). The server no longer has those seats, so the baseline must drop them (see Rec 4), or a later Save would try them again and get 404 (handled).
- A long Save (many sequential DELETEs) with no abort: leaving the page mid-sequence leaves partial state. The leave guard (A9) should stay on while saving.
- Seat `seq` after concurrent POSTs elsewhere: the mapping relies on ascending `seq` within one response. This is safe within one POST, and chunks are sequential.

## Open questions
- Does the PUT validator (`validateLayoutSave` / server) reject a removed seat that still exists, or a seat missing from the room's set? That decides which error code to expect in the conflict path.
- Should the Delete button for a seat that is known to have an occupant be refused client-side before Save? The seat DTO may not be in the editor. Current plan relies on the server 409 at Save, so the user finds out late. Option: show a warning. Ask Ming.
- Is `404 not_found` on the repeated DELETE the exact code the route returns? Check `src/app/api/seats/[id]/route.ts` before relying on it.
- Chunk size: the plan says 50, which matches `validateSeatAdd` (max 50). Confirmed, no change needed.
