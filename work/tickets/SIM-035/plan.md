Status: READY

# Plan — SIM-035: Draw a seat's devices on its desk and keep other items off desks

## Scope summary
- `docs/spec-v1.md` LAY-06 (line 360): "Devices at a seat are drawn by type (PC, laptop, monitor, IP phone, other;
  D37): the primary on the desk, secondary next to it." Amended by D61. This ticket rewrites the bullet.
- `docs/spec-v1.md` LAY-01 (line 343): "Items cannot overlap where the manifest says they block (e.g. two desks on one
  tile)." LAY-03 (fixtures) and LAY-05 (editor controls) are unchanged apart from the new desk rule.
- `work/decisions.md` D61 (1): "Every device placed at a seat (`seat_id`) is drawn on its desk, one sprite per device,
  at its type's preferred slot (e.g. first monitor right, second left, PC under the desk, small items on the desk
  top); fixtures can no longer be placed on desk tiles (SIM-035)." D61 also says "a device whose type is not in the
  catalog draws as one built-in square placeholder sprite". Here that placeholder is `device.other`; the catalog is
  SIM-036.
- D37: device types are PC, Laptop, Monitor, IP phone and Other, plus free text.
- The spec conflict flagged in the ticket is already settled by D61, which records Ming's rule. This ticket brings
  LAY-06 (and LAY-01) in line with D61 and adds D62 for the defaults Ming confirms at plan approval (see Assumptions
  A1 to A6).

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | In the editor, placing a fixture on any tile of a desk is refused: the ghost shows not-ok and no item is added. Moving a fixture onto a desk tile (drag or group move) is refused. | `place-tool.test.ts` › "a fixture on any desk tile is refused (ghost not ok)"; `draft.test.ts` › "moving a fixture onto a desk is refused", "moving a desk onto a prop is refused", "moving a prop and its desk together is allowed", "rotating a desk onto a prop is refused"; `editor-state.test.ts` › "place on a desk sets the refused notice, draft unchanged". Manual: in `pnpm dev`, arm Props › mug and hover a desk: the ghost is red and a click adds nothing. |
| 2 | `PUT /api/rooms/{id}/layout` with a fixture on a desk tile returns 422 with a layout rule code. Unit tests cover a prop on a desk and a prop next to a desk (allowed). | `validate/layout.test.ts` › "fixture on a desk" block (both tiles of an s desk, the second tile of an e/w 1x2 desk, next to the desk allowed, on the chair tile allowed as today, blocking plant on a desk still `layout_overlap`). `route.test.ts` › "a fixture on a desk gives 422 layout_fixture_on_desk; service not called". |
| 3 | `GET /api/rooms/{id}/layout` returns the types of the devices placed at each seat, only from the caller's org (R6). A DB test shows another org's device is never returned. | `layout.db.test.ts` › "seatDevices: types per seat, primary first then created_at, id", "seatDevices: another org's devices, inventory devices and other rooms' devices are never returned", "seatDevices: at most 8 per seat, truncated stays false". CI runs `pnpm test:db`. |
| 4 | A seat with 2 `PC` devices draws 2 `device.pc` sprites. `Laptop`, `Monitor` and `IP phone` map to their sprites. Any other type (e.g. `Printer`) maps to `device.other`, and ` pc ` (spaces, case) maps to `device.pc`. | `device-slots.test.ts` › "deviceKind maps D37 types case- and space-insensitively; anything else is other"; `placement.test.ts` › "two PC devices draw two device.pc frames", "each type maps to its sprite (directional laptop/monitor follow the desk)". |
| 5 | Devices use their type's slot. With 2 monitors, the first (primary first) is offset right and the second left. A PC draws under the desk (painted before the desk top). Phone and other items sit on the desk top. A desk with one of every type draws with no two devices on the same slot. Slots follow all 4 desk rotations. | `device-slots.test.ts` › "one of every kind: distinct positions inside the desk, all 4 rotations", "monitor 1 is on the occupant's right of monitor 2, all 4 rotations", "only pc is under"; `placement.test.ts` › "a PC op comes before its desk op, phone/other/monitor after", "slots follow rotation 0/90/180/270". |
| 6 | The editor draws the same device sprites on desks. They cannot be selected, moved or deleted, and they are not part of the save body. | `placement.test.ts` › "device ops add no seat box and no selectable id"; `editor-state.test.ts` › "seatDevices are kept from the view and never reach savePayload" (save body keys unchanged); the editor selects from `draft.items` (`tiles.ts` `itemAt`), which never contains devices. Manual: open the editor, click a monitor: the desk (or nothing) is selected. |
| 7 | LAY-06 in `docs/spec-v1.md` states the new rule and a decision row records it. | Read `docs/spec-v1.md` LAY-01/LAY-06 and `work/decisions.md` D61 (rule) plus D62 (the defaults confirmed at plan approval). |

## Ming verification after merge
- Visual read with the placeholder atlas on a real room: under-desk PC, monitor right/left and phone on the desk top
  look acceptable in all 4 desk rotations, at zoom 2x to 4x. The pixel offsets are starting values tuned by eye in
  `/dev/roommap`. Real art is SIM-033.
- A real room that already has a prop on a desk: opening the editor shows the "removed" notice, and Save clears it
  (A2).

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/validate/layout.ts` | Add `"layout_fixture_on_desk"` to `LayoutRuleCode` (l.18-21). Export a pure helper `fixturesOnDesks(input: LayoutRulesInput): number[]` that returns the indices of fixtures whose footprint touches any seat (desk) footprint cell. In `checkLayoutRules` (l.102-174), after the blocking overlap and chair checks, `fail("layout_fixture_on_desk")` when the helper is non-empty. Update the fixed-order doc comment (l.102). | AC1, AC2: one rule shared by the API and every editor op (`checked()` in draft.ts l.81) | No |
| `src/lib/validate/layout.test.ts` | New "fixture on a desk" describe block | AC2 | No |
| `src/lib/api/error.ts` | Add `"layout_fixture_on_desk"` after `layout_unknown_sprite` (l.24) | A1: a new code needs an `ApiErrorCode` | No |
| `src/lib/layout-editor/save-errors.ts` (+ `.test.ts` l.20 list) | Add the code to `INVALID` (l.4-12) | A failed save with this code reads as "invalid", not "retry" | No |
| `src/ui/copy/api.ts` | `layout_fixture_on_desk: "An item sits on a desk. Desk tops are kept for the seat's devices."` (next to l.27) | A1 copy (D36) | No |
| `src/ui/copy/roomlayout.ts` | `refused.layout_fixture_on_desk: "Items can't go on a desk. The desk top shows the seat's devices."` (l.86-94). New `cleaned: (n) => ...` line: "N item(s) on desks were removed. Save to keep this change." | A1, A2 copy | No |
| `src/lib/sprites/device-slots.ts` (new) | Pure lib: `DeviceKind`, `deviceKind(type)`, `DEVICE_SPRITE: Record<DeviceKind, string>`, `SLOTS: Record<DeviceKind, Slot[]>` (desk-local), `STACK`, `MAX_PER_KIND`, `placeDevices(desk, footprint, dir, types[]) → DevicePlacement[]` (tile, pixel offset, under, kind) | AC4, AC5: the one code-defined slot table (SIM-036 makes it data later) | No |
| `src/lib/sprites/device-slots.test.ts` (new) | Kind mapping, slot table invariants, rotations, overflow | AC4, AC5 | No |
| `src/lib/sprites/layout.ts` | `export type SeatDevice = { type: string }`. `LayoutResponse` gains `seatDevices: Record<string, SeatDevice[]>`, with a doc comment: "array order is draw order: primary first, then created_at, id; do not re-sort; at most LAYOUT_LIMITS.devicesPerSeat" | AC3 contract | No |
| `src/lib/sprites/placement.ts` | `buildDrawList(layout, seatViews, manifest, seatDevices = {})`. For each placed seat, call `placeDevices` and push device `Item`s (id `${seat.id}:dev:${n}`). `Item` gains `offset: [number, number]`, `under: boolean` and `hostRow: number \| null`. Sort: row = `hostRow ?? sortRow(i)`, then tier (`under` 0, non-sub 1, sub 2), then x, then id. `emitFrame(item.layer, item.key, item.x, item.y, item.offset)` (l.229). No seat boxes for devices. | AC4, AC5, AC6 | No |
| `src/lib/sprites/placement.test.ts` | Device draw-list tests | AC4, AC5, AC6 | No |
| `src/lib/sprites/map-view.ts` (+ `.test.ts`) | `MapView.seatDevices`. Parse it defensively: a missing or bad value gives `{}`, and per placed seat only entries `{type: string}` are kept, sliced to the cap | Client contract; older or partial bodies still load | No |
| `src/server/layout/layout.ts` | One extra org-scoped query in `readLayoutRows` (after l.91), seats from the capped `seats` list. Build `seatDevices`. Add it to the return (l.118-126). | AC3, R6 | No (`src/server/layout/**` is not a High path; the security review trigger applies) |
| `src/server/layout/layout.db.test.ts` | 3 tests (see Tests) | AC3 | No |
| `src/server/layout/save.test.ts` | The `readLayoutRows` mock (l.71) returns `seatDevices: {}` | Type and shape of the PUT response | No |
| `src/app/api/rooms/[id]/layout/route.test.ts` | One case: a fixture on a desk gives 422 `layout_fixture_on_desk` | AC2 at the route | No |
| `src/lib/layout-editor/draft.ts` | `withoutDeskFixtures(draft): { draft, dropped: number }`, using `fixturesOnDesks(rulesInput(draft))` | A2 legacy layouts | No |
| `src/lib/layout-editor/draft.test.ts`, `place-tool.test.ts` | Refusal tests (place, move, group move, rotate, tray place onto a prop) and `withoutDeskFixtures` | AC1, A2 | No |
| `src/lib/layout-editor/editor-state.ts` (+ `.test.ts`) | `EditorNotice` gains `{ kind: "cleaned"; count: number }`. `EditorState` gains `seatDevices`. `initEditor`: when not read-only, `baseline = loaded draft`, `history = startHistory(cleaned)`, `notice = cleaned` if `dropped > 0`. `saveDone` re-inits from the new view (unchanged path). | A2, AC6 | No |
| `src/ui/roomlayout/EditorViews.tsx` | `EditorStatusLine` renders `copy.cleaned(count)` for the new notice (l.145-157) | A2 | No |
| `src/ui/roomlayout/EditorCanvas.tsx` | Prop `seatDevices`, passed to `buildDrawList` (l.63-66) | AC6 | No |
| `src/ui/roomlayout/LayoutEditor.tsx` | Pass `state.seatDevices` to `EditorCanvas` (l.146) | AC6 | No |
| `src/ui/roomlayout/RoomMap.tsx`, `RoomMapSection.tsx` | Prop `seatDevices` (default `{}`), passed to `buildDrawList` (RoomMap l.46-47; RoomMapSection l.45-47 passes `view.seatDevices`) | AC4, AC5 on the room page | No |
| `src/app/dev/roommap/fixture.ts`, `RoomMapDemo.tsx`, `fixture.test.ts` | Move `mug-1` (l.34) off the desk (e.g. x 3, y 6). Add `DEMO_DEVICES` (seat-a1: Monitor, Monitor, PC, IP phone, Printer; seat-b2: Laptop; seat-b3: pc ×2) and pass it. The fixture test asserts `checkLayoutRules(DEMO_LAYOUT).ok` and no unknown keys. | The demo must pass the new rule; a manual tuning bench | No |
| `docs/spec-v1.md` | LAY-06 l.360-361 → "Every device placed at a seat is drawn on its desk, one sprite per device, at its type's slot (D61, D62)". LAY-01 l.343 adds "and no fixture is placed on a desk tile" | AC7 | No |
| `work/decisions.md` | D62 row: the defaults confirmed at plan approval (A1 to A6) | AC7, record of Ming's confirmations | No |

No High path is touched (no migration, no auth, no config).

## Data model / migration
None. The `devices` table (`db/migrations/20261120150000_init.sql` l.113-139) already has `org_id`, `seat_id`,
`type`, `role`, `created_at` and the index `devices_org_seat_idx (org_id, seat_id) where seat_id is not null`. There
is no archived or retired device state in any migration, so every row with a `seat_id` is drawn.

## API contract
| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| GET | `/api/rooms/{id}/layout` | unchanged | `LayoutResponse` plus `seatDevices: Record<seatId, { type: string }[]>`. A key is present only for seats with at least one device. Array order is draw order: primary first, then `created_at`, then `id`. At most 8 per seat. `type` is `left(type, 61)`, untrimmed. No name, id, owner, mac, inventory number or role. | unchanged (200, 404, auth codes from the wrapper) | unchanged (org member) |
| PUT | `/api/rooms/{id}/layout` | unchanged (devices are never in the body) | the same `LayoutResponse` (it re-reads via `readLayoutRows`, so it includes `seatDevices`) | adds 422 `layout_fixture_on_desk` | unchanged (Admin) |

Query (in `readLayoutRows`, same repeatable-read snapshot, via `orgQuery`):
```sql
select seat_id, left(type, 61) as type from (
  select seat_id, type, row_number() over (
           partition by seat_id order by (role = 'primary') desc, created_at, id) as n
    from devices
   where org_id = $1 and seat_id = any($2::uuid[])
) d where n <= ${LAYOUT_LIMITS.devicesPerSeat}
order by seat_id, n
```
`$2` = ids of the capped `seats` list. If that list is empty, skip the query. Add `devicesPerSeat: 8` to
`LAYOUT_LIMITS`.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/validate/layout.test.ts` › "fixture on a desk: prop.mug on either tile of an s desk → layout_fixture_on_desk" | AC2 |
| … › "prop on the second tile of an e (1x2) desk → layout_fixture_on_desk" | AC2, rotation |
| … › "prop next to a desk, and on its chair tile, is allowed" | AC2 (allowed case) |
| … › "a blocking plant on a desk is still layout_overlap (rule order)" | rule order |
| … › "validateLayoutSave with a prop on a desk returns layout_fixture_on_desk" | AC2 |
| … › "fixturesOnDesks returns exactly the offending fixture indices" | A2 helper |
| `src/app/api/rooms/[id]/layout/route.test.ts` › "a fixture on a desk gives 422 layout_fixture_on_desk; service not called" | AC2 |
| `src/lib/layout-editor/place-tool.test.ts` › "a fixture on any desk tile is refused (ghost not ok)" | AC1 |
| `src/lib/layout-editor/draft.test.ts` › "moving a fixture onto a desk is refused" / "group move onto a desk is refused" / "moving a desk onto a prop is refused" / "moving a prop and its desk together is allowed" / "rotating a desk onto a prop is refused" / "placing a tray seat onto a prop is refused" | AC1 |
| … › "withoutDeskFixtures drops only fixtures on desks and counts them" | A2 |
| `src/lib/layout-editor/editor-state.test.ts` › "a loaded prop on a desk is removed: cleaned notice, dirty, saveable, undo cannot restore it" | A2 |
| … › "read-only view keeps fixtures and shows no cleaned notice" | A2 |
| … › "place on a desk sets the refused notice, draft unchanged" | AC1 |
| … › "seatDevices are kept from the view and never reach savePayload" | AC6 |
| `src/lib/layout-editor/save-errors.test.ts` › INVALID list includes `layout_fixture_on_desk` | A1 |
| `src/lib/sprites/device-slots.test.ts` › "deviceKind maps D37 types case- and space-insensitively; anything else is other" (`PC`, ` pc `, `Laptop`, `MONITOR`, `IP phone`, `ip  Phone`, `Printer`, `Headset`, `Màn hình`, `""`) | AC4, Domain focus (diacritics, empty) |
| … › "one of every kind: distinct positions inside the desk footprint, all 4 rotations" | AC5 |
| … › "monitor 1 is on the occupant's right of monitor 2, all 4 rotations" | AC5 |
| … › "only pc is under; first pc slot differs from second" | AC5 |
| … › "overflow: the 3rd monitor reuses slot 2 with one stack step; at most 4 per kind" | A3 |
| … › "0 devices gives an empty list" | edge |
| `src/lib/sprites/placement.test.ts` › "a seat without devices draws exactly as before" | regression |
| … › "two PC devices draw two device.pc frames" | AC4 |
| … › "each type maps to its sprite (directional laptop/monitor follow the desk)" | AC4 |
| … › "a PC op comes before its desk op; phone, other and monitor ops come after it" | AC5, A4 |
| … › "slots follow rotation 0/90/180/270 (tiles inside the desk footprint)" | AC5 |
| … › "device ops add no seat box and no selectable id; devices of a seat not in the layout are ignored" | AC6 |
| `src/lib/sprites/map-view.test.ts` › "seatDevices: parsed per placed seat; a missing or bad value gives {}" | contract robustness |
| `src/server/layout/layout.db.test.ts` › "seatDevices: types per seat, primary first then created_at, id" | AC3 |
| … › "seatDevices: another org's devices, inventory devices and other rooms' devices are never returned" (org B has its own room, seat and devices; org A GET sees none of them; B's scope on A's room gives 404) | AC3, R6 |
| … › "seatDevices: at most 8 per seat, truncated stays false" | A5 |
| `src/app/dev/roommap/fixture.test.ts` › "DEMO_LAYOUT passes checkLayoutRules; demo devices have no unknown keys" | demo |

DB test notes: `addDevice` (`src/test/db/fixtures.ts` l.67) hard-codes type `laptop`, so tests set the type and
`created_at` with an `update`. A primary device needs its owner to be the seat occupant (the deferred trigger), so the
test sets `seats.occupant_id` to the owner first. The composite FK `devices_seat_fkey (org_id, seat_id)` means a
device can never point at another org's seat. The cross-org test therefore uses two orgs with their own data and
asserts that A's response holds only A's types.

## Approach
1. **Validator (pure, lib).** In `checkLayoutRules`, collect desk cells from `layout.seats` footprints (every seat
   sprite is a desk, `SEAT_SPRITES`) and the cells of each fixture. Blocking fixtures on a desk already fail earlier as
   `layout_overlap`, so the new code fires for non-blocking fixtures (props, labels, markers). `fixturesOnDesks` is the
   shared helper. `resolveLayout` (per-item checks) is not changed, so GET keeps returning stored fixtures as they are
   (A2).
2. **Error code (A1)**: `error.ts`, `save-errors.ts`, both copy files. `place-tool.ts` and `draft.ts` ops need no
   logic change: `placementPreview` → `tryPlace` → `checked()` → `checkLayoutRules`, and moves and rotates go through
   the same `checked()`.
3. **Legacy layouts (A2)**: `withoutDeskFixtures` in `initEditor` only. Baseline = what was loaded, present = cleaned
   (a fresh history, so undo cannot bring back a draft that would refuse every op), notice `cleaned`. Read-only views
   are left untouched.
4. **Device slots (pure, lib).** `src/lib/sprites/device-slots.ts`, imports only `./types` (Direction). Slots are
   defined in the desk's own frame. `u` is the desk tile index from the occupant's left. `du` is pixels toward the
   occupant's right. `dv` is pixels toward the desk's back. Per desk direction (`ROTATION_TO_DIR`, chair side = front):
   - `s`: right = (+1, 0), back = (0, -1), tile u = (x+u, y)
   - `n`: right = (-1, 0), back = (0, +1), tile u = (x+W-1-u, y)
   - `e`: right = (0, -1), back = (-1, 0), tile u = (x, y+W-1-u)
   - `w`: right = (0, +1), back = (+1, 0), tile u = (x, y+u)

   Here W is the desk's long side (2 for `desk.single`), and u is clamped to W-1. The pixel offset is
   du·right + dv·back. Starting table (tuned by eye in `/dev/roommap`; the tests assert invariants, not pixels):
   | Kind | Sprite | Slot 1 (u, du, dv, under) | Slot 2 |
   |---|---|---|---|
   | monitor | `device.monitor` (dir = desk dir) | 1, -4, 8, no | 0, 4, 8, no |
   | laptop | `device.laptop` (dir = desk dir) | 0, 6, 0, no | 1, -6, 0, no |
   | pc | `device.pc` | 1, 6, -6, **yes** | 0, -6, -6, yes |
   | phone | `device.phone` | 0, -8, -2, no | 1, 8, -2, no |
   | other | `device.other` | 0, -2, 4, no | 1, 2, -4, no |
   Order within a kind = API order (primary first). Overflow: see A3. `device.monitor.dual` is not used.
5. **Draw list.** `buildDrawList` takes `seatDevices` (default `{}`). For each seat it runs `lookup` on each device
   key (a missing frame goes to `unknown`, as today) and pushes an Item with `sub: true`,
   `hostRow = seat.y + footprint[1] - 1`, `under`, and `offset`. The sort tier puts `under` items before the desk in
   the same row (A4). Every `device.*` frame is in the `furniture` layer (keys.json l.210-305), like the desk, so the
   final layer-rank sort keeps this order. Avatars (layer `avatar`) still paint above devices.
6. **Server.** One query (see API contract), via `orgQuery` with `org_id = $1` (R6). It runs inside the existing
   transaction, so GET and the PUT re-read (save.ts l.140) both carry `seatDevices`. Only `type` is returned (no PII).
   There is no new route and no change to auth (R7 unaffected).
7. **Client plumbing.** `toMapView` → `MapView.seatDevices` → `RoomMapSection`/`RoomMap` and
   `initEditor`/`EditorState` → `EditorCanvas`. In the editor the device ops come from `buildDrawList` only. Selection,
   hit testing and save use `draft.items`, so devices cannot be selected, moved, deleted or saved. They follow their
   desk while it is dragged (keyed by `seatId`, from `draftToRoomLayout`).
8. **Demo + docs.** Move the demo mug off the desk and add demo devices. Update LAY-01/LAY-06 and add D62.

Rules: R1 (device-slots and placement stay in lib; the server imports lib only; `pnpm check:layers`). R6 (org-scoped
query, DB test). R7 (no new auth codes; 422 comes from the validator before any write). R3 (no config). R2 (no schema
change). R5 (tests above). UI copy goes in `src/ui/copy/*` (D36).

## Specialist input used
- frontend-developer #1-3 (pure `device-slots.ts`, one table rotated by a transform, `under` flag with an explicit
  "before host" sort instead of relying on F2): **adopted**. One change: slots are expressed in the desk's own frame
  (u/du/dv) rather than as `dx/dy` of the s desk, so the e/w 1x2 footprint cannot fall outside the desk (its risk 4).
- frontend-developer #4 overflow (stack +3/-3, cap 4 per kind, "+n" optional): **adopted** without "+n" (A3).
- frontend-developer Finding 1 (the validator covers place, drag, group move and rotate via `checked()`): **adopted**.
  No logic change in `place-tool.ts`; tests only.
- frontend-developer #6 legacy "drop on load with notice": **adopted** for the editor draft only (A2).
- frontend-developer #2 "reuse `layout_overlap`": **rejected** in favour of api-platform-engineer #5 (A1).
- api-platform-engineer #1 (top-level `seatDevices` parallel to `seatViews`, `SeatDevice = {type}` as an object for
  SIM-036): **adopted**.
- api-platform-engineer #2-3 (one org-scoped query in `readLayoutRows`, order primary, created_at, id; only `type`):
  **adopted**.
- api-platform-engineer #4 cap 8 per seat: **adopted**. Setting `truncated = true` on a cut is **rejected**:
  `initEditor` sets `readOnly: view.truncated` (editor-state.ts l.58), so one seat with 9 devices would lock the whole
  room's editor. The cut is silent (A5).
- api-platform-engineer #5 new code `layout_fixture_on_desk`: **adopted** (A1).
- api-platform-engineer #6 "surface, don't drop": **partly adopted**. `resolveLayout` and GET stay unchanged, so the
  read-only map still shows the stored prop. Surfacing alone would brick the editor, though: every op re-checks the
  whole draft (frontend Finding 3). So the editor draft drops such fixtures and tells the user, which is the variant
  the API engineer allowed ("apply it only to the editor draft and tell the user").
- api-platform-engineer risk "layout_version caching": checked. `RoomMapSection` and the editor load the layout fresh
  on each mount. There is no version-keyed cache, so no change (A6).
- api-platform-engineer open question on retired devices: checked. No such state exists in `db/migrations`.

## Assumptions
**Defaults for Ming to confirm at plan approval (recorded as D62 once confirmed):**
- **A1 – 422 code.** A fixture on a desk tile returns a **new** code `layout_fixture_on_desk` (not `layout_overlap`).
  It gets its own copy ("Items can't go on a desk…" instead of "That tile is taken"), and API clients can tell the two
  apart. The cost is one entry each in `error.ts`, `save-errors.ts` and the two copy files.
- **A2 – Already-saved props on desks.** These are **dropped from the editor draft on load, with a notice** ("N items
  on desks were removed. Save to keep this change."). The draft is dirty, so Save is enabled and the leave guard
  warns. Nothing changes in the DB until the Admin saves. The read-only room map keeps drawing them until then, and
  devices draw on top. Reason: if the error were only surfaced, every edit would be refused (`checked()` validates the
  whole draft) until the prop was found and deleted. No migration or cleanup (ticket out of scope).
- **A3 – Overflow.** Slots per kind: 2. A third or later device of a kind reuses the kind's last slot, shifted
  +3 px x, -3 px y (screen space) per extra device. At most **4 devices per kind** are drawn. More are not drawn and
  there is **no "+n" marker** (that needs a new overlay sprite; possible follow-up). The full list stays on the
  Devices page and in the seat dialog.
- **A4 – PC "under the desk".** The PC is painted **before its desk** (same row, lower tier) and offset 6 px toward
  the occupant and 6 px to their right. With the current opaque placeholder desk, only the part of the PC sticking
  out past the desk's front edge shows, which reads as "under/behind the desk". The PC's anchor is not changed. On an
  `n` desk (front faces away from the camera) the PC may be almost hidden until SIM-033 art. Acceptable for now.
- **A5 – Cap.** The API returns at most **8 devices per seat** (`LAYOUT_LIMITS.devicesPerSeat`), primary first. A cut
  does **not** set `truncated`, because that flag makes the editor read-only.
- **A6 – Freshness.** Device changes made elsewhere (Devices page, seat dialog) show on the map at the next layout load
  (page load, reload or editor open). No live refresh in this ticket.

**Other non-blocking assumptions:**
- `device.other` keeps its current placeholder frame (14x12). Making it "a plain square" is art (ticket out of scope:
  "New sprite art"). It is drawn for every unknown type, including Headset (SIM-036 adds types; SIM-033 adds art).
- Type mapping: trim, lowercase, collapse runs of whitespace. `pc`, `laptop`, `monitor` and `ip phone` map to their
  kinds. Everything else (including Vietnamese names such as `Màn hình` and the empty string) maps to `other`. The
  free-text type is never used as a sprite key (no arbitrary sprite lookup).
- Devices of seats that are not placed (tray) are not drawn. The server may still return them, and the client ignores
  them.
- The new rule refuses **all** fixture groups on desk tiles (the ticket says "a fixture"), including labels and
  markers. Fixtures on the chair tile stay allowed, as today.
- Hotspots: no other ticket is `IN_PROGRESS`, `REVIEW` or `DONE` on the board, so no rebase is expected. SIM-036.x
  (BACKLOG) will later touch `device-slots.ts`, `layout.ts` (`SeatDevice`) and the layout query.

## Blocking questions
None. A1 to A6 are defaults with a stated choice; Ming confirms or changes them at the plan-approval gate.

## Split proposal
None. Estimate: about 330 product lines plus about 400 test lines. If the reviewer finds it too big, a natural split
is (a) validator, code, editor refusal, legacy drop and spec (AC1, AC2, AC7) and (b) API `seatDevices`, slots and
drawing (AC3 to AC6).
