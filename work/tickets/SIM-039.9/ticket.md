# SIM-039.9: Map items page: art per direction

| Field | Value |
|---|---|
| State | DONE |
| Priority | P1 |
| Size | M |
| Areas | ui, ux |
| Gate | plan-approval |
| Depends on | SIM-039.6, SIM-039.8 |
| Needs Ming | — |
| Attempts | 1 |
| Created | 2026-11-25 |
| Claimed by | claude@2026-11-25T17:03Z |
| PR | — |

## Goal
Slice 2 of SIM-039.6: on the Map items page, Admins set each item's art per direction: pick a bundled package sprite,
upload or remove a custom image, or go back to the library sprite.

## Scope reference
`docs/spec-v1.md` LAY-07 (map item catalog); `work/decisions.md` D66, D67, D68; split proposal in
`work/tickets/SIM-039.6/plan.md` (§ Split proposal); SIM-039.4 A8 (map-item image error copy).

## Scope
- An "Art" action per row; per-direction panels (n/e/s/w for directional items, `s` only otherwise) showing the
  active source as text (custom image / package sprite / library) with previews at 1× and 2× (pixelated).
- "Choose package sprite" browser filtered by `spriteAllowedFor` + `spriteFits`, with a confirm step and a text-only
  fallback if the atlas fails; "Use library sprite" (PUT art `{ sprite: null }`).
- "Upload image" with a client precheck (`parsePng`, 64 KB, `mapItemImageFits`) and the exact expected size for that
  direction; "Remove custom image"; map-item-specific copy for `image_too_large` / `image_bad_size` / `image_not_png`.
- `image_changed` reloads the item; `images_unavailable` / `drive_error` shown only in the art panel; blob URLs keyed
  `key|dir|imageVersion` and revoked on unmount; a "Customised" row badge and a row thumbnail.

## Out of scope
- Map rendering of art (SIM-039.8). Admin-created item kinds and per-desk art (later phase, D66).

## Acceptance criteria
- [ ] Every art action from 039.2/039.4 is reachable and shows its errors inline.
- [ ] Images never rotate to fill another direction; a non-directional item only offers `s`.
- [ ] Checks green.

## Test plan
- Unit: sprite filter, image precheck messages, art view states, API methods. Manual: pick a sprite, upload and
  remove an image for each direction of a directional item.

## Notes / answers from Ming
- 2026-11-25: split from SIM-039.6 by its planner (ticket too large for one cycle).
- 2026-11-25 (orchestrator): planner split the ticket. This ticket is slice 2a (art dialog, sprite browser as text, upload/remove with previews for custom images). Atlas previews move to SIM-039.10.
- 2026-11-25: Plan approved by Ming (A1-A14 as written).

## Handoff

### 2026-11-25 — claude — BLOCKED
- Agent calls: 3 (frontend-developer×1 55k, ux-architect×1 53k, planner×1 105k; default models)
- Done: plan READY (slice 2a, ~480 product lines): API putArt/putImage/deleteImage, pure art helpers and upload precheck with map-item error copy, page-level image cache, art dialog with per-direction panels, inline text sprite browser, row Art button, Customised badge and thumbnail. Split: atlas previews → SIM-039.10 (added to the board).
- In progress / next: Ming approves A1-A14 (M-74), then implement and review.
- Gotchas: the image hook and dialog wiring have no unit tests (no DOM in Vitest; jsdom not allowed) — reviewer checks a local run.

### 2026-11-25 — claude — DONE
- Agent calls: 4 (implementer×2, reviewer×2; default models). No security audit (UI only, no trigger paths).
- Done: slice 2a built: API putArt/putImage/deleteImage, art helpers and upload precheck with map-item copy, page image cache, art dialog per direction, inline text sprite browser, row Art button, Customised badge, thumbnail. Review attempt 1 REWORK (not_found reload, dialog reopening after Retry, focus return after picking a sprite, "South" in non-directional size error); attempt 2 PASS. Checks green (3053 tests, build ok).
- In progress / next: Ming merges the PR; manual click-through (pick sprite, upload/remove per direction) after merge. Then SIM-039.10 / SIM-039.7.
- Gotchas: product code ~750 lines vs ~480 estimate (dialog JSX). Dialog/hook wiring has no DOM tests. Follow-ups: dead `useMapItems.ts`; consider a DOM test layer (needs Ming's decision, jsdom not allowed today).
