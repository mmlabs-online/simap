# SIM-039.7: Device types: pick a bundled package sprite

| Field | Value |
|---|---|
| State | DONE |
| Priority | P2 |
| Size | S |
| Areas | db, api, ui |
| Gate | plan-approval |
| Depends on | SIM-039.9 |
| Needs Ming | — |
| Attempts | 1 |
| Created | 2026-11-25 |
| Claimed by | — |
| PR | #111 |

## Goal
A device type's art can be an uploaded image, a sprite picked from the bundled package, or the slot's built-in sprite (DEV-01, D66 point 7).

## Scope reference
`docs/spec-v1.md` LAY-01, LAY-03, LAY-06, LAY-07 (map item catalog, phase 1), DEV-01; `work/decisions.md` D61, D64, D66 (OQ-46 to OQ-53).

## Scope
- Column for the chosen sprite key, API and the device types page picker (reuses the 039.6 sprite browser); renderer fallback image → sprite → slot sprite.

## Out of scope
- Admin-created item kinds and per-desk art (later phase, D66). Changing how placed fixtures are stored (`sprite_key` stays).

## Acceptance criteria
- [x] A device type with a picked sprite draws it on desks; upload still wins.
- [x] Every query is scoped by the token's org (R6); Admin-only writes are audited; checks green including `pnpm test:db` run locally.

## Technical notes
- Likely a migration (High path). Run after SIM-037.8 (device types page).
- Runs in parallel with SIM-037.x except where noted (migrations, nav, device types).

## Test plan
- Unit and DB tests as the plan lists. Manual: as the plan lists.

## Notes / answers from Ming
- 2026-11-25: scope from Ming's answers on the map item catalog (D66); OQ-52/OQ-53 take their defaults.

- 2026-11-25: Plan approved by Ming (A1-A11 as written). Earlier note: Ming said "duyệt" while the planner was still running; not recorded as approval because the plan was not written yet.

## Handoff

### 2026-11-25 — claude — BLOCKED
- Agent calls: 3 (database-optimizer×1 27k, api-platform-engineer×1 40k, planner×1 133k; default models)
- Done: plan READY, one slice (~280 product lines; fallback split A=data/renderer, B=picker). Migration adds `device_types.sprite_key` (nullable, format CHECK). Stores a device sprite family (e.g. `device.laptop`), resolved per desk facing.
- In progress / next: Ming approves A1-A11 (M-75), then implement and review (+ security audit: db/ and src/server/ change).
- Gotchas: S/M boundary; ~25 fixture updates for the new SeatDeviceType field.

### 2026-11-25 — claude — DONE
- Agent calls: 5 since approval (implementer×2: default 100k, sonnet 21k; reviewer×2 default 74k/24k; security-ai-generated-code-auditor×1 37k).
- Done: migration `20261125230000_device_type_sprite.sql` (nullable `device_types.sprite_key`, format CHECK), `sprite` on device type POST/PATCH with 400/422 (before any write), audit, layout join, renderer order image → picked family (per desk facing) → slot sprite, picker field in the device types dialog. Review attempt 1 REWORK (missing toPatchBody tests), attempt 2 PASS; security all 🟢.
- In progress / next: Ming merges; the migration runs on deploy (expand-only). Manual: pick a sprite for a type, see it on desks in every facing, upload an image and see it win.
- Gotchas: pre-existing test:db failures on main (devices.db canReturn/canTakeBack, members/manage.db deactivate-with-release) — handoff-related, need a BUG ticket.
