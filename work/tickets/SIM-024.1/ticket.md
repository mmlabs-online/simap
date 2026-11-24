# SIM-024.1: Room map renderer, avatars, name tags and dev demo

| Field | Value |
|---|---|
| State | MERGED |
| Priority | P1 |
| Size | M |
| Areas | ui, architecture |
| Gate | none |
| Depends on | SIM-024 |
| Needs Ming | — |
| Attempts | 1 |
| Created | 2026-11-22 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/40 |

## Goal
Draw a pixel-art room from layout data with the sprite atlas, so the room view (SIM-015.1) and editor (SIM-015.2) can
build on a working renderer. This is slice 2 of SIM-024.

## Scope reference
- `work/tickets/SIM-024/ticket.md` (acceptance criteria 2-5 and the hash and placement parts of 6).
- `work/tickets/SIM-024/plan.md`, "Split proposal", slice 2: its settled defaults apply and are not decided again.
- `docs/art/style-guide.md` (sections 4-8); spec LAY "Visual style", LAY-06.
- D41, D43, D44, D46, D48, D50, D51, D52, D54, D55. D55 lifts D47 for the renderer and dev demo page.

## Scope
- Runtime loader for `public/sprites/office.json` + `office.png`, validated with `validateSpriteManifest`, with an error
  state.
- Renderer in `src/ui/roomlayout/`: plain canvas for art plus an unscaled HTML overlay for seats and name tags, with
  layers floor, wall, shadow, furniture, avatar, overlay and integer zoom 1x/2x/3x.
- Pure placement and draw order in `src/lib/sprites/` (`buildDrawList`, rotation to direction, overlay mapping).
- Layered avatar compositor (body, hair, shirt) with colours from a stable hash of `sub`; front and back views.
- State overlays, and name tags on hover or keyboard focus only (D50).
- UI copy in `src/ui/copy/roomlayout.ts`.
- Dev-only demo page `src/app/dev/roommap/page.tsx`, using fixture data and no API. Production returns `notFound()`.

## Out of scope
- Layout API, database columns and migrations (SIM-015.1).
- Layout editor (SIM-015.2).
- Real seat data or the seat panel (SIM-012, SIM-015.1).
- Final art, recolouring and the public-repo licence decision (M-9, M-10). No Imersa sheet or atlas built from it may be
  committed.
- A game engine or any new library (D41).

## Acceptance criteria
- [ ] The demo page renders the sample room at 1x/2x/3x with crisp pixels (no smoothing) and every seat state.
- [ ] Replacing `office.png` + `office.json` with another valid pair changes the art without code changes.
- [ ] An invalid or missing manifest or atlas shows an error state and does not crash the page.
- [ ] Avatar colours are stable for the same `sub` and differ across the sample subs.
- [ ] Name tags appear only on hover or focus, and every seat is reachable by keyboard.
- [ ] The demo page is not available in a production build, and the committed atlas stays placeholder-only.
- [ ] Unit tests cover the avatar colour hash, tile-to-pixel placement, draw order, rotation mapping and overlay mapping.

## Technical notes
- Files: `src/lib/sprites/*`, `src/ui/roomlayout/*`, `src/ui/copy/roomlayout.ts`, `src/app/dev/roommap/page.tsx`.
- Keep sprite logic pure in `src/lib` (R1). The provisional `RoomLayout` type stays minimal for SIM-015.1.
- The renderer must work under the SIM-027 CSP without `data:` URLs.
- Risks: fractional display scaling (125%/150%) can soften pixels. Check it manually and note the result in the PR.

## Test plan
- Unit: the logic listed in the acceptance criteria.
- Manual: demo page at 390 px and desktop, light and dark app theme, keyboard focus, and 125%/150% display scaling.

## Notes / answers from Ming
- 2026-11-22: Ming asked to create this ticket from the SIM-024 slice 2 proposal.

## Handoff

### 2026-11-22 — claude — DONE
- Agent calls: 7, tokens 510k, in/out split not reported (frontend-developer×1 30k, software-architect×1 72k, planner×1 115k, implementer×2 145k, reviewer×2 148k; models from agent files, no overrides)
- Done: renderer, avatars, overlays, name tags, loader, dev demo and bundle check. Review PASS on attempt 2. Checks green (1224 tests). PR: https://github.com/mmlabs-online/simap/pull/40
- In progress / next: Ming merges and runs the browser checks in the PR. SIM-012 is the next runnable art-path ticket.
- Gotchas: no agent saw real pixels. Zoom follows the spec (2/3/4), not the ticket wording. Work ran in a separate worktree because Ming's production dev server was running from the main checkout.
