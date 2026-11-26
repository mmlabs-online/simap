# SIM-049: Wall clock and projector screen face only north or south

| Field | Value |
|---|---|
| State | DONE |
| Priority | P2 |
| Size | S |
| Areas | ui, api |
| Gate | none |
| Depends on | SIM-042 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-26 |
| Claimed by | claude@2026-11-26T04:37:39Z |
| PR | — |

## Goal
The side views (e/w) of the new `clock.wall` and `screen.projector` items are thin slivers that read badly on the map
(Ming's look at the atlas, 2026-11-26), so these two items should only be placeable facing north or south.

## Scope reference
- D73 / SIM-042 (the six new built-in items, A7 "all four directions").
- D66 (3) (custom images per direction n/e/s/w for directional items).
- Ming 2026-11-26: "tạo ticket chỉ dùng hướng n/s cho clock và screen". This amends SIM-042 A7 for these two items.

## Scope
- `clock.wall` and `screen.projector` accept only rotations 0° (s) and 180° (n). The other four SIM-042 items keep all
  four directions.
- Layout editor: rotating one of these items toggles between s and n, and never shows e/w.
- Layout validator (server, `src/lib/validate/layout.ts`): a save with 90° or 270° for these keys is refused with the
  existing `layout_bad_rotation` (422, before any write).
- "Map items" page: per-direction art for these two items offers only n and s.
- Atlas and sprite map: e/w frames for these two items are dropped or no longer used, whichever the plan picks; the
  registry tests and the committed atlas test still pass.

## Out of scope
- The other SIM-042 items, other directional families, recolouring.
- A migration: catalog rows are per base key and the 0° footprint is unchanged (screen 2×1, clock 1×1).

## Acceptance criteria
- [ ] In the editor, placing and rotating `clock.wall` or `screen.projector` only ever gives s or n.
- [ ] Saving a layout with `clock.wall` or `screen.projector` at 90° or 270° is refused with 422 `layout_bad_rotation`
      and nothing is written; 0° and 180° save and read back.
- [ ] The "Map items" art per direction for these two items lists only n and s.
- [ ] `bin.trash`, `chart.flip`, `cooler.water` and `lamp.desk` still accept all four directions.
- [ ] All Checks pass (including `test:db` in CI).

## Technical notes
- Files (likely): `src/lib/sprites/keys.json` and/or a per-key rotation rule next to the registry,
  `src/lib/validate/layout.ts`, `src/lib/layout-editor/draft.ts` (rotate), `src/lib/map-items/art.ts`,
  `assets/art/sprite-map.json`, `public/sprites/office.*`, `scripts/sprites/registry.test.ts`, related tests.
- Risks: `scripts/sprites/registry.test.ts` requires a full n/e/s/w set for directional families, so the plan must
  choose between a per-key allowed-rotations rule (keep e/w keys) or removing the e/w keys (registry rule change).
- **Timing:** SIM-042 is not in a release yet (latest `v0.1.9`), so no production layout stores these items at
  90°/270°. Merge this before the release that ships SIM-042; if it ships later, the plan must handle saved layouts
  with 90°/270° (e.g. read them as 0°/180°).

## Test plan
- Unit: validator refuses 90/270 for the two keys and accepts 0/180; editor rotate toggles s↔n; art directions list.
- DB: a rotated (180°) clock/screen saves and reads back.
- Manual: `/dev/roommap` or editor, rotate both items.

## Notes / answers from Ming

## Handoff
