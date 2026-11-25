# SIM-039.5: Editor palette and map rendering from the catalog

| Field | Value |
|---|---|
| State | DONE |
| Priority | P1 |
| Size | M |
| Areas | ui |
| Gate | plan-approval |
| Depends on | SIM-039.3, SIM-039.4 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-25 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/101 |

## Goal
The editor's "Add items" palette and both maps show the org's catalog: names, groups, order, hidden flags, sizes and art.

## Scope reference
`docs/spec-v1.md` LAY-01, LAY-03, LAY-06, LAY-07 (map item catalog, phase 1), DEV-01; `work/decisions.md` D61, D64, D66 (OQ-46 to OQ-53).

## Scope
- Palette from `GET /api/map-items`; editor ghost and hit areas use catalog sizes.
- Renderer per direction: custom image → package sprite → library frame → placeholder, for fixtures, desk, chair and floors; package sprite on a resized item drawn at its own size, bottom-left aligned (OQ-53 default).
- Images loaded via `apiFetch` and `blob:` URLs cached per version.

## Out of scope
- Admin-created item kinds and per-desk art (later phase, D66). Changing how placed fixtures are stored (`sprite_key` stays).
- Admin page (039.6).

## Acceptance criteria
- [ ] Palette shows Admin names/groups/order and hides hidden items.
- [ ] Custom art shows on the editor and read-only map; a failing image draws the placeholder.
- [ ] Every query is scoped by the token's org (R6); Admin-only writes are audited; checks green including `pnpm test:db` run locally.

## Technical notes
- Generalise the image draw op used for device types.
- Runs in parallel with SIM-037.x except where noted (migrations, nav, device types).

## Test plan
- Unit and DB tests as the plan lists. Manual: as the plan lists.

## Notes / answers from Ming
- 2026-11-25: scope from Ming's answers on the map item catalog (D66); OQ-52/OQ-53 take their defaults.
- 2026-11-25 (orchestrator): planner split the ticket. This ticket is slice 1 (palette and editor sizes from the catalog, AC 1 and AC 3). Art rendering, image loading and the image draw op (AC 2) move to SIM-039.8.
- 2026-11-25: Plan approved (Ming: "duyệt SIM-039.5") for slice 1, assumptions as written (A5: group headings show the stored group string).

## Handoff

### 2026-11-25 — claude — BLOCKED
- Agent calls: 2 (frontend-developer×1 75k, planner×1 135k; default models)
- Done: plan READY (slice 1): `catalogPalette` from GET /api/map-items, editor `footprints` lookup from layout items + palette, geometry functions take the lookup, `MapView.items`, map-items API client and hook. Split: art rendering → SIM-039.8 (added to the board).
- In progress / next: Ming approves A1-A9 (M-71), then implement and review.
- Gotchas: A5 group headings show raw library group keys until renamed; AC2 wording conflicts with the spec fallback chain (spec wins, reword in 039.8).

### 2026-11-25 — claude — DONE
- Agent calls: 4 (frontend-developer×1 75k, planner×1 135k, implementer×1 107k, reviewer×1 66k; default models; ~383k total)
- Done: slice 1 — palette from the catalog, editor sizes from the catalog (footprints lookup in editor state), MapView.items, map-items API client and hook. Review PASS on attempt 1; PR https://github.com/mmlabs-online/simap/pull/101.
- In progress / next: SIM-039.8 (art rendering) after merge; SIM-039.6 (admin page) is also runnable.
- Gotchas: pre-existing test:db failures on main are now 18 (devices, handoffs, members) — bug ticket needed.
