# SIM-035: Draw a seat's devices on its desk and keep other items off desks

| Field | Value |
|---|---|
| State | DONE |
| Priority | P1 |
| Size | M |
| Areas | ui, api, security |
| Gate | plan-approval |
| Depends on | SIM-015.8, SIM-013 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-24 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/76 |

## Goal
A desk shows what is really on it: one device sprite for each device placed at that seat, by type. Admins can no longer
decorate desks with fixtures in the layout editor, so the desk top is reserved for real devices.

## Scope reference
- `docs/spec-v1.md` LAY-06 "Devices at a seat are drawn by type (PC, laptop, monitor, IP phone, other; D37)".
- `docs/spec-v1.md` LAY-01 / LAY-03 (fixtures, overlap rules) and LAY-05 (editor controls).
- `work/decisions.md` D37 (device types: PC, Laptop, Monitor, IP phone, Other plus free text), D41.
- **Spec conflict (flagged):** LAY-06 says "the primary on the desk, secondary next to it". Ming (2026-11-24) wants
  every device of the seat drawn on the desk, one item per device (a seat with 2 PCs shows 2 PC items). This ticket
  follows Ming; LAY-06 must be updated (record a decision in `work/decisions.md`) before or with this ticket.

## Scope
- Layout editor: a fixture cannot be placed on, or moved onto, a tile covered by a desk (today the non-blocking
  `prop` group — keyboard, mouse, mug, papers — can be dropped on desks).
- Layout save validator (`checkLayoutRules`) refuses a fixture on a desk tile, so the API enforces the same rule.
- Layout read API (`GET /api/rooms/{id}/layout`) returns the device types of each seat (devices whose `seat_id` is
  that seat), org-scoped.
- Room map and editor draw one device sprite per device on its desk, mapped by type: PC → `device.pc`, Laptop →
  `device.laptop`, Monitor → `device.monitor`, IP phone → `device.phone`, anything else → `device.other`
  (case-insensitive, trimmed).
- Each type has its own preferred slot on the desk, so several devices never draw on top of each other in a broken
  way (Ming, 2026-11-24). Examples from Ming: the first monitor sits offset to the right, a second monitor offset to
  the left; the PC sits under the desk (drawn at floor level, below/behind the desk top); small items (phone,
  headset-like) sit on the desk top. The slot table is one pure, code-defined table (type → ordered list of slots,
  each slot = tile + pixel offset + draw order relative to the desk) that follows the desk rotation, so SIM-036 can
  later make it data-driven.
- Order of devices of the same type (which one takes slot 1): `primary` role first, then a stable order (e.g.
  created_at, id) returned by the API.
- In the editor the device sprites are read-only decoration: not selectable, movable or saved.

## Out of scope
- Placing, moving or returning devices from the map (the Devices page and seat dialogs already do this, SIM-013.3).
- Devices owned by the occupant but not placed at the seat (inventory) — not drawn.
- New sprite art (uses the existing `device.*` registry keys; SIM-033 ships the real art).
- A layout migration or cleanup of already-saved layouts.

## Acceptance criteria
- [ ] In the editor, placing a fixture on any tile of a desk footprint is refused (ghost shows not-ok, no item added),
      and moving a fixture (drag or group move) onto a desk tile is refused.
- [ ] `PUT /api/rooms/{id}/layout` with a fixture on a desk tile returns 422 with a layout rule code; unit tests cover
      a prop on a desk and a prop next to a desk (allowed).
- [ ] `GET /api/rooms/{id}/layout` returns, per seat, the types of the devices placed at that seat, only from the
      caller's org (R6); a DB test shows another org's device is never returned.
- [ ] A seat with 2 devices of type `PC` draws 2 `device.pc` sprites on the desk; `Laptop`, `Monitor`, `IP phone` map
      to their sprites and any other type (e.g. `Printer`, `pc ` with spaces/case handled) maps to `device.other` /
      the right sprite; covered by unit tests of the draw list.
- [ ] Devices use their type's slot: with 2 monitors the first (primary first) is offset right and the second left;
      a PC draws under the desk (painted before the desk top); phone/other items sit on the desk top; a desk with one
      of every type draws with no two devices on the same slot; slots follow all 4 desk rotations. Covered by unit
      tests of the slot table and the draw list.
- [ ] The editor draws the same device sprites on desks, and they cannot be selected, moved or deleted, and are not
      part of the save body.
- [ ] LAY-06 in `docs/spec-v1.md` states the new rule and a decision row records it.

## Technical notes
- Files (likely): `src/lib/validate/layout.ts`, `src/lib/layout-editor/place-tool.ts`, `draft.ts`/`editor-state.ts`
  (move rule), `src/lib/sprites/layout.ts` (`LayoutResponse` gains per-seat devices), `src/lib/sprites/placement.ts`
  (draw devices on the desk), `src/server/layout/layout.ts` (+ db test), `src/ui/roomlayout/*` (pass devices through),
  `src/app/dev/roommap/fixture.ts` (its `prop.mug` sits on a desk tile today).
- `device.*` sprites are sub-tile (`tiles: null`, non-blocking); the F2 sort already paints sub-tile items after their
  host desk.
- Risks / open questions:
  - More devices of one type than its slots (e.g. 3 monitors): planner proposes a fallback (small stacking offset, or
    cap + "+n" marker); Ming confirms at plan approval.
  - PC "under the desk" needs the draw order to paint it before the desk (today F2 paints sub-tile items after their
    host); the current `device.pc` frame may need an anchor that reads as under-desk with the placeholder art.
  - Headset is not a D37 type and has no sprite yet; it maps to `device.other` here and gets its own type in SIM-036.
  - D61: a device whose type is not defined draws as one built-in square placeholder. In this ticket that is
    `device.other`; its placeholder frame should read as a plain square (art can be swapped later, SIM-033).
  - Saved layouts that already have a fixture on a desk will fail the new save rule; the editor must surface it (or
    drop such fixtures on load) — planner decides, Ming confirms.
  - Whether the device list in the layout response must be capped (layout response already has a `truncated` flag).
  - Rotated desks (`desk.single.e/w`, 1×2): device positions must follow the desk orientation.

## Test plan
- Unit: validator (fixture on desk refused, next to desk allowed); place-tool/move refusal; type → sprite mapping;
  draw list with 0, 1, 2 and many devices, rotated desk.
- DB: layout read returns per-seat device types, org-scoped.
- Manual: room page and editor show devices on desks; try dropping a mug on a desk in the editor.

## Notes / answers from Ming
- 2026-11-24: "Ở layout edit. Không cho phép thêm vật dụng lên bàn. Trên bàn sẽ hiện các device được gắn với
  user/seat. Ví dụ seat đó có 2 PC thì có 2 item PC trên bàn. Tương tự với các device khác."
- 2026-11-24: Ming agrees: only devices placed at the seat (`seat_id`) are drawn; inventory devices are not.
- 2026-11-24: "Mỗi loại device sẽ có vị trí ưu tiên trên bàn khác nhau làm sao để khi chồng lên nhau vẫn không lỗi.
  Ví dụ Monitor primary thì lệch bên phải, monitor 2 sẽ lệch bên trái. PC sẽ nằm bên dưới bàn, Tai nghe thì đặt trên
  mặt bàn,..." → per-type slots added to scope. Admin-defined device types with an image → follow-up SIM-036.
- 2026-11-24: Plan approved (Ming: "duyệt"), defaults A1-A6 as written in plan.md.

## Handoff

### 2026-11-24 — claude — BLOCKED
- Agent calls: 3, tokens ~167k total (frontend-developer×1 inherited 34k, api-platform-engineer×1 inherited 33k, planner×1 default 101k)
- Done: consult (frontend, api), plan.md READY with defaults A1-A6 (new 422 `layout_fixture_on_desk`; legacy desk props dropped from the editor draft with a notice; 2 slots per type, stack up to 4; PC painted before its desk; 8 devices per seat cap without `truncated`; no live refresh).
- In progress / next: Ming approves the plan (M-47, P1 gate), then /run SIM-035 implements.
- Gotchas: Node/pnpm need fnm activation and `cmd /c pnpm` (see memory); `readLayoutRows` is shared by GET and PUT re-read.

### 2026-11-24 — claude — DONE
- Agent calls: 3 this run (implementer×1 default 124k, reviewer×1 default 83k, security-ai-generated-code-auditor×1 default 47k); 6 in total for the ticket.
- Done: implemented per plan (A1-A6), review PASS on attempt 1, security review PASS (no findings); PR #76 opened.
- In progress / next: Ming reviews and merges PR #76 after CI (`pnpm test:db`) is green; visual check of device slots at /dev/roommap.
- Gotchas: rebased on main before push (force-with-lease on the ticket branch); slot pixel offsets are starting values.
