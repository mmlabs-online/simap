Status: READY

# Plan: SIM-015.8: Layout editor desk add and delete

Slice 3 of 3 of the tile layout editor (SIM-015.2 split). An Admin places new `desk.single` desks from the palette and
deletes desks (existing seats and new ones). Save runs the approved A3 sequence: DELETE removed seats, then POST new
seats in chunks of 50, then PUT the layout. It reports partial failures and keeps the progress so far, so a retry
only sends the remaining calls. The ticket's gate is plan-approval (P1). Approve the defaults A1 to A12 under
`## Assumptions` with the plan.

## Scope summary
- spec `docs/spec-v1.md` LAY-02 (l.345-347): "Each desk on the grid is one seat record. Placing a desk creates a seat
  and its code (ROO-02). Removing a desk deletes the seat, with the SEA-01 guard."
- SEA-01 (l.229-231): "the map editor (LAY-02) places existing seats and can also add new ones." / "Deleting a seat
  that has an occupant or any device is refused with a clear message (seatMGT guard)."
- ROO-02 (l.221-224): "A new seat's code is `<room code>-<NN>`. NN is the highest existing sequence number in the room
  plus 1, padded to 2 digits. Numbers are never reused: the room keeps a counter of the highest number ever issued
  (D30)." / "No API or form lets anyone type in a seat code."
- LAY-05 (l.353-355): "undo of the last steps before save. All of this is saved in one layout save."
- `work/decisions.md` D30: "Seat numbers are never reused (per-room counter)."
- SIM-015.2 `plan.md` A3 (approved 2026-11-23): "Desk add and delete stay local until Save ... 1. `DELETE
  /api/seats/{id}` for each removed existing seat. On a 409 `seat_not_empty`, stop: restore that desk, show the SEA-01
  message naming the seat code, and do not send the PUT. Earlier successful deletes stay done. 2. `POST
  /api/rooms/{id}/seats {count}` for the new desks, in chunks of 50 ... 3. `PUT /api/rooms/{id}/layout`. If step 3
  fails after step 2, the created seats exist without a saved place ... shown to the admin as a message." A4: "A new
  desk shows 'New' until Save ... The editor never invents a code (ROO-02)."
- SIM-015.7 `plan.md` A4: "`savePayload` refuses if seat deletes or creates are ever pending. SIM-015.8 replaces that
  branch." SIM-015.9 `plan.md` A2: "SIM-015.8 adds the desk entry together with its DELETE/POST save sequence."
- Ticket Scope: "a refused DELETE restores the desk and stops before the PUT; seats created before a failed PUT are
  shown as unplaced."

Spec note (no conflict with code, wording only): ROO-02's "highest existing sequence number plus 1" is refined by its
own D30 clause. The server uses the room counter (`allocateSeatSeq`, `src/server/seats/seats.ts:267-274`), so codes
are not contiguous after deletes. AC1 is read as "the next number from the room counter".

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Adding a desk creates seat `<room>-NN` with the next number after Save. The desk gets the code that the server gave it. The editor never makes up a code. Before Save, the desk is named "New desk". | `save-run.test.ts` › "created seats map by ascending seq onto new desks in add order …" and "deletes, then creates, then PUT …". `editor-state.test.ts` › "saveDone after desk add …". `LayoutEditorViews.test.tsx` › "new desk is named New desk …". Real server numbering: Ming verification 1. |
| 2 | Deleting a desk whose seat has an occupant or device is refused with the SEA-01 message, and the desk comes back. No POST and no PUT are sent after the refusal. | `save-run.test.ts` › "DELETE 409 seat_not_empty …" (both cases). `editor-state.test.ts` › "saveFailed with progress …". `LayoutEditorViews.test.tsx` › "save error banner for seat_not_empty …". Real run: Ming verification 2. |
| 3 | Component tests for the Save sequence use a fake `seatsApi`. They cover call order, chunks of 50, partial failure at each stage, DELETE 404 counted as done, retry with no duplicate calls, and a run that never throws. | `src/lib/layout-editor/save-run.test.ts` (all rows in `## Tests to write`), run with `pnpm test` |
| 4 | Palette has a "Desks" group with "New desk". Arming it places `desk.single` desks (rotation 0) and the tool stays armed. A place past the seat limit (`LAYOUT_LIMITS.seats`) is refused with a message. | `place-tool.test.ts` › "tryPlace desk …", "placementPreview …desk", "nextTool keeps a desk tool". `palette.test.ts` › "editorPalette …". `LayoutEditorViews.test.tsx` › "palette renders the Desks group first …" |
| 5 | Deleting a selection with seats works. Existing seats move to `removed`, new desks are dropped, and this is one undo step. Undo brings a deleted seat back with no network call. The Inspector Delete button is enabled for seats and shows a note. | `editor-state.test.ts` › "delete of an existing seat …". `LayoutEditorViews.test.tsx` › "inspector enables Delete for a seat with the save note …" |
| 6 | Save is no longer blocked by pending seat changes. The pre-Save check still refuses an invalid payload (count caps) with no calls sent. | `editor-state.test.ts` › "savePayload accepts removed seats and new desks …"; the existing "savePayload refuses …" test is updated |
| 7 | R1 layers hold (new lib code imports only `@/lib/**`). All checks are green. | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build` |

## Ming verification after merge
1. In a room with seats up to `<room>-05`, where `-04` was deleted earlier, add two desks and Save. The new seats are
   `<room>-06` and `<room>-07` (counter, D30). They show on the room map and in the seat table, at the tiles where you
   put them. Reload: they are still there.
2. Give one seat an occupant (or a device). In the editor, delete that desk and one empty desk, then Save. The empty
   seat is deleted. The SEA-01 message names the occupied seat's code. The occupied desk is back at its tile. Save
   again: the rest saves.
3. Delete a new (unsaved) desk before Save: no network call (DevTools Network). Delete an existing desk, then press
   Undo: the desk is back, and Save is not needed for it.
4. Partial failure (optional): in DevTools, set the network to Offline after the DELETE or POST calls (or block
   `PUT */layout`). The message says what was already done. Turn the network back on and Save: only the missing calls
   are sent, and no duplicate seats appear in the seat table.
5. While a Save with several deletes runs, try to click the nav rail: the leave dialog asks first (A8).

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/layout-editor/save-run.ts` (new) | `SaveApi` type, `SaveDetail`, `SaveOutcome`, `runSave(input, api)` (Approach step 3). Pure async code. It never throws. | AC1-AC3; A3 sequence | No |
| `src/lib/layout-editor/save-run.test.ts` (new) | Runner tests with a scripted fake `seatsApi` | AC1-AC3, R5 | No |
| `src/lib/layout-editor/save-plan.ts` | Add `withPlaceholderSeatIds(draft)` (dry-run ids for new desks, A4) and `dropSeat(draft, id)` (removes a deleted seat from the items and the tray, used on the baseline). `assignCreatedSeats` is unchanged: the runner passes a slice of the keys per chunk. | AC6, partial progress | No |
| `src/lib/layout-editor/save-plan.test.ts` | Tests for both helpers | R5 | No |
| `src/lib/layout-editor/editor-state.ts` | `delete`: drop the `seat_delete` refusal (l.170-177). `savePayload`: remove the `pending_seats` branch (l.75-80) and build from `withPlaceholderSeatIds`. `missing_seat_id` maps to `invalid`. `saveFailed` gets optional `progress` and `detail` (step 4). `save` error state carries `detail`. Notice codes: remove `seat_delete`, add `seat_limit`. | AC2, AC5, AC6 | No |
| `src/lib/layout-editor/editor-state.test.ts` | Update the delete test (l.104-118) and the `pending_seats` part (l.160-182). Add the new tests. | R5 | No |
| `src/lib/layout-editor/place-tool.ts` | `Tool` gets `{ kind: "desk" }`. `tryPlace`, `sameTool`, `nextTool` and `placementPreview` handle it. Add the `seat_limit` refusal. A fixture tool with a seat sprite stays refused. | AC4 | No |
| `src/lib/layout-editor/place-tool.test.ts` | Desk tool tests | R5 | No |
| `src/lib/layout-editor/palette.ts` | Rename `fixturePalette` to `editorPalette`. It now includes the seat entries (group `desk`) first. | AC4 | No |
| `src/lib/layout-editor/palette.test.ts` | Update the `fixturePalette` test (l.38-) | R5 | No |
| `src/lib/layout-editor/save-errors.ts` | `seat_not_empty` → `invalid` (no button; Save stays on). `seats_unmatched` (client-only) → `conflict` (Reload; Save off). | AC2, count mismatch | No |
| `src/lib/layout-editor/save-errors.test.ts` | Two new cases | R5 | No |
| `src/ui/roomlayout/LayoutEditor.tsx` | `save()` calls `runSave` and dispatches `saveDone` or `saveFailed` with progress and detail. Palette arming maps the desk entry to `{kind:"desk"}`. `toolName` handles the desk tool. Leave guard on while saving (A8). | AC1-AC4 | No |
| `src/ui/roomlayout/Palette.tsx` | `onArm(entry: PaletteEntry)`. The armed check covers the desk entry. The label comes from `itemName` by kind. | AC4 | No |
| `src/ui/roomlayout/EditorInspector.tsx` | Delete enabled for seats. A note shows when the selection has an existing seat. Add `"use client"` (SIM-015.9 nit). | AC5 | No |
| `src/ui/roomlayout/EditorViews.tsx` | `SaveErrorBanner` gets an optional `detail` prop and renders `copy.saveDetail(detail)`. The message comes from `copy.saveErrors[code] ?? apiErrorMessage(code)`. | AC2, partial messages | No |
| `src/ui/copy/roomlayout.ts` | Palette group `desk: "Desks"`. `itemName` gives "New desk" for a seat with no code. Add `refused.seat_limit`, `inspector.deleteSeatNote`, `saveErrors.seats_unmatched` and `saveDetail(d)`. Remove `refused.seat_delete`. | D36 | No |
| `src/ui/roomlayout/LayoutEditorViews.test.tsx` | Update the palette test (l.153-169) and the inspector Delete test (l.121-152). Add banner detail, status-line and naming tests. | R5 | No |

No file matches a High path. No server, route, SQL or config change. Expected size: about 300 source lines (runner
about 130) plus tests.

## Data model / migration
None.

## API contract
None changed. These existing endpoints are called through `seatsApi` (`src/ui/seats/seats-api.ts:78-108`):

| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| DELETE | `/api/seats/{id}` (`src/app/api/seats/[id]/route.ts:24-35`) | none | 204 | 404 `not_found` (unknown or already deleted seat, also a non-UUID id, l.27), 409 `seat_not_empty` (`src/server/seats/seats.ts:319-320`), 503 `unavailable` | admin |
| POST | `/api/rooms/{id}/seats` | `{count}` 1 to `SEAT_LIMITS.addMax` = 50 | 201 `{items: SeatDto[]}` with `id`, `code`, `seq` (`seats.ts:61,82`), codes from the room counter (`seats.ts:267-274`) | 400, 404 | admin |
| PUT | `/api/rooms/{id}/layout` | `LayoutSaveValue` (exact keys) | `MapView` | 409 `layout_stale`, `layout_seats_changed`; 422 `layout_*` | admin |

Facts used: seat add and delete do not bump `layout_version`, so the PUT uses the same `baseVersion` (SIM-015.2 plan,
API contract). `call()` never throws and maps fetch failures to `unavailable` or the access codes
(`seats-api.ts:31-51`). R7: auth codes come only from `withAuth` before any write, so `apiFetch`'s single re-send cannot
repeat a POST that was applied. The runner does not retry.

## Tests to write
All are Vitest, node env, no DOM (SIM-015.7 A3). `save-run.test.ts` uses a fake `SaveApi` with one scripted result
per call that records `(method, args)` in order. Room code `Phòng-A`.

| Test (file › name) | Covers |
|---|---|
| `save-run.test.ts` › "no seat changes: only the PUT, with baseVersion; outcome saved with the response view" | regression of SIM-015.7 save |
| `save-run.test.ts` › "deletes, then creates, then PUT: one DELETE per removed seat, POST {count} = new desks, PUT body has the created ids at the new desks' tiles and no removed seat, and passes validateLayoutSave" | AC1, AC3 |
| `save-run.test.ts` › "created seats map by ascending seq onto new desks in add order, codes from the response (Phòng-A-06, Phòng-A-07 after a gap at 04)" | AC1 (next number, D30) |
| `save-run.test.ts` › "DELETE 409 seat_not_empty on the 2nd seat after a 1st success: the 2nd is restored at its baseline tile, no POST, no PUT; code seat_not_empty; detail {stage delete, deleted 1, seat code, restored map}; baseline without the 1st seat; reset true" | AC2 |
| `save-run.test.ts` › "DELETE 409 when the seat's baseline tile is now taken: restored into the tray (restored tray); on the first seat: reset false" | AC2 |
| `save-run.test.ts` › "DELETE 404 not_found counts as deleted and the run goes on" | R7 re-send |
| `save-run.test.ts` › "DELETE unavailable: the seat stays in removed, stop, no POST or PUT" | partial |
| `save-run.test.ts` › "60 new desks: POST 50 then POST 10; when the 2nd POST fails, the first 50 desks have ids and codes, 10 stay new, no PUT; detail created 50" | chunks, partial |
| `save-run.test.ts` › "POST returns fewer seats than asked: seats_unmatched, that chunk's desks stay new, no PUT" | count mismatch |
| `save-run.test.ts` › "PUT fails after creates: the draft has the created ids, removed is empty, the PUT code is passed through (unavailable, layout_stale); detail {stage put, created N}" | ticket scope "shown as unplaced" |
| `save-run.test.ts` › "retry after a DELETE failure, a 2nd-chunk failure and a PUT failure sends only the remaining calls; no seat is created twice" | AC3 |
| `save-run.test.ts` › "an api method that throws resolves to failed internal with the progress so far" | never throws (SIM-015.10 nit) |
| `save-run.test.ts` › "tray not empty: failed unplaced, no calls" | guard |
| `save-plan.test.ts` › "withPlaceholderSeatIds gives each new desk a canonical UUID, stable per key, leaves real ids alone; the payload passes validateLayoutSave" | AC6 |
| `save-plan.test.ts` › "dropSeat removes the seat from the items and the tray and keeps everything else" | baseline rebase |
| `editor-state.test.ts` › "delete of an existing seat moves it to removed in one undo step; a new desk is dropped; undo brings the seat back with removed empty" | AC5 |
| `editor-state.test.ts` › "place with a desk tool adds an n:<k> desk, selects it, keeps the tool armed; dirty and canSave true" | AC4 |
| `editor-state.test.ts` › "savePayload accepts removed seats and new desks (dry-run ids); a fixture count over the cap still refuses as invalid" (replaces the pending_seats cases) | AC6 |
| `editor-state.test.ts` › "saveFailed with progress reset: present and baseline replaced, history cleared, selection kept only for existing keys, tool reconciled; without reset the past stays; without progress only the error is set" | AC2, partial |
| `editor-state.test.ts` › "saveDone after desk add: the desk carries its code from the view, dirty false" | AC1 |
| `place-tool.test.ts` › "tryPlace desk: ok gives key n:<nextKey>, seatId null; refused on a taken tile; seat_limit when seats plus tray reach LAYOUT_LIMITS.seats; a fixture tool with desk.single is still refused" | AC4 |
| `place-tool.test.ts` › "placementPreview with a desk tool uses the desk.single footprint; sameTool desk = desk; nextTool keeps a desk tool" | AC4 |
| `palette.test.ts` › "editorPalette: the desk group comes first with desk.single only, then the fixture groups in paletteEntries order" | AC4 |
| `save-errors.test.ts` › "seat_not_empty is invalid; seats_unmatched is conflict" | AC2 |
| `LayoutEditorViews.test.tsx` › "palette renders the Desks group first with New desk; pressed when the desk tool is armed; every FIXTURE_GROUPS entry and desk has a heading" | AC4 |
| `LayoutEditorViews.test.tsx` › "inspector enables Delete for a seat with the save note; new desk is named New desk in the Items list" | AC1, AC5 |
| `LayoutEditorViews.test.tsx` › "save error banner for seat_not_empty shows the SEA-01 message, the seat code (Phòng-A-02) and where the desk is back, and no button; seats_unmatched shows Reload; a put detail names the created count" | AC2 |
| `LayoutEditorViews.test.tsx` › "EditorStatusLine shows seat_limit copy" | AC4 |

## Approach
1. **Palette and tool** (`palette.ts`, `place-tool.ts`).
   - `editorPalette()` is the old `fixturePalette` grouping over all of `paletteEntries()`, so the seat group `desk`
     comes first.
   - `Tool` adds `{ kind: "desk" }`. `tryPlace` for a desk refuses `seat_limit` when the seat items plus the tray reach
     `LAYOUT_LIMITS.seats` (500, the PUT cap). Otherwise it returns `placeItem(draft, "desk.single", x, y, 0)` with key
     `n:${draft.nextKey}`.
   - `placementPreview` already uses `desk.single` for non-fixture tools. `nextTool` keeps a desk tool, the same as a
     fixture tool. `PlaceResult` and the notice codes add `seat_limit`.
2. **Reducer** (`editor-state.ts`).
   - `delete` calls `deleteItems` for any selection. It already drops new desks and records existing seats in
     `removed` (`draft.ts:160-174`), so it is one commit.
   - `savePayload` becomes the pre-Save check. It builds from `withPlaceholderSeatIds(present)` and runs
     `validateLayoutSave`. It keeps the read-only and unplaced refusals, and `missing_seat_id` maps to `invalid`. Its
     body is for validation only and is never sent. The runner builds the real body after the creates.
   - `withPlaceholderSeatIds` sets each `seatId === null` desk to `00000000-0000-4000-8000-<k as 12 hex digits>`, from
     its `n:<k>` key. These match `isCanonicalUuid` (`src/lib/validate/uuid.ts:1`).
3. **Runner** (`save-run.ts`). `runSave({ draft, baseline, baseVersion, roomId }, api): Promise<SaveOutcome>`.
   - Types:
     - `SaveApi = { remove(id): Promise<R<null>>; add(roomId, n): Promise<R<{id; code; seq}[]>>; saveLayout(roomId, body): Promise<R<MapView>> }`, with a lib-local `R<T>` that has the same shape as `SeatsResult`. The UI `SeatsApi` fits it structurally, so lib never imports ui (R1).
     - `SaveOutcome = { status: "saved"; view } | { status: "failed"; code; detail: SaveDetail; progress: { draft; baseline; reset } | null }`.
     - `SaveDetail = { stage: "delete" | "create" | "assign" | "put"; deleted; created; seat: string | null; restored: "map" | "tray" | null }`.
   - The steps:
     1. `planSave`. When it gives `unplaced`, stop with no calls.
     2. Deletes run one by one, in `removed` order:
        - ok or 404 `not_found`: `forgetDeletedSeat(draft)` and `dropSeat(baseline)`, `deleted++`.
        - 409 `seat_not_empty`: `restoreRemovedSeat(draft, baseline, id)`, and `restored` is `map` if the seat is back
          in `items`, else `tray`. Stop.
        - any other code: stop and keep the seat in `removed`.
     3. Creates run in chunks of `SEAT_LIMITS.addMax` over `createKeys`. Each chunk is
        `assignCreatedSeats(draft, keys.slice(off, off + n), items)` and adds to `created`. A failed POST stops with its
        code. A length mismatch stops with `seats_unmatched` (stage `assign`).
     4. `buildSavePayload(draft, baseVersion)`, then `validateLayoutSave`, then `saveLayout`. On ok: `saved`.
        Otherwise: fail with the PUT code.
   - `reset` is `deleted + created > 0`, which means the server changed. `progress` is null when neither the draft nor
     the baseline changed.
   - A `try/catch` around the whole run turns a throw into `failed internal` with the progress so far. Nothing else
     retries.
4. **Apply the outcome** (`saveFailed`).
   - `{ code, detail?, progress? }`. With `progress.reset` the history becomes `startHistory(progress.draft)`, because
     an undo across server changes would resend a DELETE or create a duplicate (consult Rec 4). Without reset it uses
     `replacePresent`.
   - Baseline: `progress.baseline`. Selection: filtered to existing keys. Tool: `reconcileTool`. Save state:
     `{ status: "error", code, detail }`.
   - `saveDone` is unchanged (`initEditor(view)`). The PUT response has the new codes.
5. **UI.**
   - `LayoutEditor.save()` keeps the `inFlight` ref and `canSave`. It sends `runSave` with the state at click time (the
     editor is frozen while saving).
   - Palette arm: `entry.kind === "seat" ? { kind: "desk" } : { kind: "fixture", sprite }`.
   - Inspector: Delete is enabled for seats. `deleteSeatNote` shows when the selection has an item with a non-null
     `seatId`.
   - Banner: message, then the detail line, then the existing action buttons by `saveErrorKind`.
6. **Copy** (`roomlayout.ts`, D36):
   - `itemName`: a seat with no code is "New desk".
   - `saveDetail(d)` joins sentences:
     - "Desk {seat} was not deleted and is back on the map." (or "… is back in Seats not placed.")
     - "{n} seat(s) were deleted."
     - "{n} new seat(s) were created, but the layout was not saved. Save again to place them." (stage `create` or
       `put`; it says "unplaced on reload" for `assign`)
   - `saveErrors.seats_unmatched`: "New seats were created but could not be matched to desks. Reload the editor; they
     will be in Seats not placed."
7. **Rules.**
   - R1: lib files import only `@/lib/**` and `./*`. UI imports lib and ui.
   - R4: only the files listed.
   - R5: runner and reducer tests.
   - R2, R3, R6 and R7 are not touched (no server change). R7's re-send is covered by DELETE 404 = done.
   - Domain focus: diacritic room code in mapping and banner tests. Empty cases: no deletes, no creates, empty
     tray. Bounds: chunk 50/10, seat limit 500.
8. Checks (`eval "$(fnm env --shell bash)"` first): `pnpm format:check`, `pnpm typecheck && pnpm check:layers`,
   `pnpm test`, `pnpm build`. `pnpm test:db` is CI-only and not affected.

## Specialist input used
consult-frontend-developer.md:
- Finding 1 (pure pieces exist, the runner is missing): adopted.
- Finding 2 (remove `pending_seats`, PUT validation needs a dry-run payload): adopted as placeholder ids (A4).
- Finding 3 (delete reducer rules, one commit): adopted. `deleteItems` already does it.
- Finding 4 (undo of deferred changes is correct): adopted. No change.
- Finding 5 (API facts, "next number" and not "max+1"): adopted (Scope summary note, AC1).
- Finding 6 (DELETE 404 = done, no retry in the runner): adopted. The open question was checked: the route returns
  404 `not_found` (`route.ts:27`, `seats.ts:34`).
- Rec 1 (`save-run.ts`, injected API, never throws, returns partial draft): adopted, with a `SaveApi` structural type
  for R1.
- Rec 2 (sequence, sequential deletes, per-chunk assign, `count_mismatch`): adopted.
- Rec 3 (rebase on success): already done by `saveDone` → `initEditor`.
- Rec 4 (rebase on partial failure, clear undo): adopted, with the refinement that history is cleared only when the
  server changed (A6).
- Rec 5 (error copy): adopted, as one detail line plus a client-only `seats_unmatched`, and not four new codes.
  `delete_failed` is dropped because the API code (for example `unavailable`) plus "N seats were deleted" says the
  same.
- Rec 6 (palette desk, "New" label): adopted, with a separate `desk` tool kind instead of a seat sprite in the fixture
  tool.
- Rec 7 (tests): adopted. The "ascending seq follows add order" check is already in `save-plan.test.ts` (SIM-015.2).
- Rec 8 (frozen while saving, ref guard): already in place (`LayoutEditor.tsx:59-74`).
- Open question "client-side pre-check of occupied seats": default is no pre-check (A3).
- Open question "PUT validator and the seat set": `layout_seats_changed` 409 is a conflict, so the existing path is
  reused.

## Assumptions
Defaults for Ming to approve with the plan (P1 gate).

- **A1 Sequential deletes, stop at the first failure.** The order follows `removed` (delete order). A 409 restores only
  that seat. Seats after it stay in `removed` and are tried on the next Save. The user does not see every occupied seat
  at once.
- **A2 Refused delete placement.** The seat goes back to its baseline tile if the rules allow. Otherwise it goes into
  the tray, and Save stays blocked until it is placed (SIM-015.2 `restoreRemovedSeat`). The restore is not an undo
  step.
- **A3 No client pre-check.** The editor does not warn about occupied seats before Save. `MapView.seatViews` has an
  occupancy state but no device count, so a partial warning could mislead. The server's 409 is the SEA-01 guard. The
  Inspector note says that a seat with an occupant or devices is kept.
- **A4 Dry-run ids.** The pre-Save check fills new desks with deterministic placeholder UUIDs
  (`00000000-0000-4000-8000-…`) only to run `validateLayoutSave`. They are never sent.
- **A5 Seat limit.** A new desk is refused at place time when seats on the map plus the tray reach 500
  (`LAYOUT_LIMITS.seats`). This mirrors `fixture_limit` (SIM-015.9).
- **A6 Undo after partial Save.** When any DELETE or POST succeeded, undo history is cleared. Nothing that the server
  already did can be undone. When nothing changed on the server (for example the first DELETE refused), history stays.
- **A7 Count mismatch.** When POST returns a different number of seats, the error is the client code `seats_unmatched`,
  treated as a conflict: Reload, and Save off. A retry would create duplicates. After reload the extra seats are in the
  tray.
- **A8 Leave guard while saving.** The guard stays on during Save (`useLeaveGuard(flags.dirty)`, today
  `flags.dirty && !saving`), because a multi-step Save left halfway leaves partial state. This is a small behaviour
  change from SIM-015.7.
- **A9 Error kinds.** `seat_not_empty` shows no action button. Save stays enabled (the rest can be saved). Any edit
  clears the banner, as for other non-conflict errors.
- **A10 Palette.** `fixturePalette` is renamed to `editorPalette` and includes the Desks group first. The registry has
  only `desk.single` as a seat sprite (D59).
- **A11 Test tooling.** As in SIM-015.7 A3, there is no DOM env. "Component tests" are the runner tests with a fake
  API, reducer tests and `renderToStaticMarkup` tests. The click-through is Ming verification 1 to 5.
- **A12 Hotspots.** No other ticket is `IN_PROGRESS`, `REVIEW` or `DONE` on `work/backlog.md`. No rebase is expected.
  Carried nits from SIM-015.9 and SIM-015.10 are not taken here, except the two that touch files already in scope: the
  runner never throws (SIM-015.10 nit on a stuck "saving") and `"use client"` in `EditorInspector.tsx` (SIM-015.9 nit).

## Blocking questions
None.

## Split proposal
None. About 300 source lines, within one cycle. If the implementer goes past about 450 source lines, move the
`seat_limit` refusal (A5) and the copy polish into SIM-015.11, and record that in impl-log.
