# SIM-015.9: Layout editor palette, tray placement and room resize

| Field | Value |
|---|---|
| State | DONE |
| Priority | P1 |
| Size | M |
| Areas | ui, ux |
| Gate | plan-approval |
| Depends on | SIM-015.7 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-23 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/54 |

## Goal
Slice 2b of the tile layout editor: Admins add fixtures from a sprite palette, place unplaced (tray) seats on the map,
and change the room size.

## Scope reference
spec LAY-01 (room size), LAY-03 (adds), LAY-05 (palette); SIM-015.7 `plan.md` → Split proposal (slice 2b), approved
2026-11-23.

## Scope
- `Palette` from `paletteEntries()` with labels; armed tool + click a tile → `placeItem` / `placeFromTray`; Esc
  disarms; ghost on hover.
- Refuse a new fixture once fixtures reach `LAYOUT_LIMITS.fixtures` (SIM-015.2 review follow-up).
- Room size inputs → `resizeRoom` (1–64, refusal shown inline).
- Unblocks Save for rooms with unplaced seats (SIM-015.7 A5).

## Out of scope
- Desk add/delete (SIM-015.8). Pointer drag, marquee and shortcuts (SIM-015.10). Floor painting.

## Acceptance criteria
- [ ] An Admin places a fixture from the palette and it survives save and reload.
- [ ] A tray seat can be placed; once the tray is empty, Save is enabled.
- [ ] Room size changes save; a resize that would cut off an item is refused with a message.
- [ ] A fixture beyond the fixture limit is refused at place time.

## Test plan
- Unit / static-render tests as in SIM-015.7 (A3). Manual: place fixtures and tray seats, resize a room.

## Notes / answers from Ming
- 2026-11-23: Plan approved (all defaults A1–A14; Ming: "duyệt plan SIM-015.9, chạy luôn").

## Handoff

### 2026-11-23 — claude — BLOCKED (plan approval)
- Agent calls: 3 (frontend-developer×1 inherit 38k, ux-architect×1 inherit 40k, planner×1 inherit; in/out split not reported)
- Done: consults saved; plan.md READY (palette of fixtures only, tray placement, room resize, fixture-limit refusal, ghost, keyboard place panel); assumptions A1–A14 with defaults.
- In progress / next: Ming approves; then implement.
- Gotchas: ~450 source lines; A13 fallback moves room resize to SIM-015.11 if the diff passes ~550 lines.

### 2026-11-23 — claude — DONE
- Agent calls: 2 this run (implementer×1 inherit 88k, reviewer×1 inherit 66k; in/out split not reported); 5 in total for the ticket (~334k).
- Done: palette, tray placement, room resize, fixture-limit refusal, ghost, keyboard place panel; review PASS on attempt 1; PR #54.
- In progress / next: Ming merges PR #54 and runs the 6 manual checks; then SIM-015.10 and SIM-015.8.
- Gotchas: no DOM test environment, so click/hover/Esc are manual-only; non-blocking sprites may overlap by design.
