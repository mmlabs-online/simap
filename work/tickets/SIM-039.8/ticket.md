# SIM-039.8: Map rendering from the catalog: per-direction art and custom images

| Field | Value |
|---|---|
| State | DONE |
| Priority | P1 |
| Size | M |
| Areas | ui |
| Gate | plan-approval |
| Depends on | SIM-039.5 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-25 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/106 |

## Goal
Slice 2 of SIM-039.5: the editor and the read-only room map draw each placed item with the org's catalog art per
direction, including Admins' custom images.

## Scope reference
`docs/spec-v1.md` LAY-01, LAY-03, LAY-06, LAY-07 (map item catalog, phase 1); `work/decisions.md` D66, D67, D68;
split proposal and Q2-Q4 defaults in `work/tickets/SIM-039.5/plan.md` (§ Split proposal).

## Scope
- Renderer per direction: custom image → package sprite → library frame → placeholder, for fixtures, desk, chair and
  floors; a package sprite on a resized item is drawn at its own size, bottom-left aligned (OQ-53 default).
- Images loaded via `apiFetch` from `GET /api/map-items/<key>/art/<dir>/image` as `blob:` URLs cached per
  `{key, dir, imageVersion}`, only for directions actually placed; draw inputs from the layout's `items`.
- Generalise the image draw op used for device types.

## Out of scope
- Admin page (SIM-039.6). Admin-created item kinds and per-desk art (later phase, D66).

## Acceptance criteria
- [ ] Custom art shows on the editor and the read-only map; a failing image falls back to the package sprite, then
      the built-in frame, then the placeholder (spec fallback chain).
- [ ] A resized item's package sprite is drawn at its own size, bottom-left aligned in the catalog box.
- [ ] Images are fetched with the bearer as `blob:` URLs, once per key, direction and version per page; checks green.

## Test plan
- Unit: art resolver, draw list with items, image op paint (fake ctx), item image cache. Manual: upload an image for
  a placed item and see it on the map and in the editor.

## Notes / answers from Ming
- 2026-11-25: split from SIM-039.5 by its planner (ticket too large for one cycle).
- 2026-11-25: Plan approved (Ming: "duyệt SIM-039.8"), assumptions A1-A10 as written (A1: decoded image sizes, no fixed reserve).

## Handoff

### 2026-11-25 — claude — BLOCKED
- Agent calls: 2 (frontend-developer×1 54k, planner×1 109k; default models)
- Done: plan READY (~330 product + 420 test lines, no split): `item-art.ts` resolver (custom image → package sprite → frame → placeholder), generalised image op (`src`), painted placeholder op, bottom-left alignment only for resized items, shared image cache for devices and items, `getArtImage`, placed-art sync from the layout (editor: from the draft). Existing rooms draw byte-identically (regression test over every library item and rotation).
- In progress / next: Ming approves A1-A10 (M-73), then implement and review.
- Gotchas: item-art.ts must not import map-items/art or library (import cycle).

### 2026-11-25 — claude — DONE
- Agent calls: 4 (frontend-developer×1 54k, planner×1 109k, implementer×1 106k, reviewer×1 77k; default models; ~346k total)
- Done: per-direction art resolver, generalised image op and placeholder, bottom-left alignment for resized items, shared device/item image cache with getArtImage, wiring in Seats page, room map and editor. Existing rooms byte-identical (regression test). Review PASS on attempt 1; PR https://github.com/mmlabs-online/simap/pull/106.
- In progress / next: SIM-039.9 (art per direction on the Map items page) after merge; then SIM-039.7.
- Gotchas: chair direction in placedArtEntries vs draw path (same for current library).
