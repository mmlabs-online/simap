# SIM-052: Send only the catalog device type to Users on the room map

| Field | Value |
|---|---|
| State | MERGED |
| Priority | P2 |
| Size | S |
| Areas | api, ui, security |
| Gate | none |
| Depends on | — |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-26 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/130 |

## Goal
The room map no longer shows a User the free-text `type` of devices they do not hold, so identifying text typed there
(e.g. "Lan's MacBook") cannot leak (follow-up of the SIM-044.1 security review).

## Scope reference
`docs/spec-v1.md` LAY-06, OQ-55 (approved: sprites for every tier, type/slot only); D69.
`work/tickets/SIM-044.1/security-review.md` 💭 note on `layout.ts:137`.

## Scope
- Layout API: for a User, seat devices they do not hold carry `deviceType` (catalog) only; free-text `type` is null.
- Map rendering falls back to the catalog type / slot sprite when `type` is null.

## Out of scope
- Manager/Admin; devices the User holds (keep `type`).

## Acceptance criteria
- [ ] For a User, layout seat devices they do not hold have no free-text `type`; their own devices keep it.
- [ ] The map still draws a sprite for every device (catalog type or slot fallback).
- [ ] Manager and Admin layout responses are unchanged.
- [ ] DB test locks the User shape; map/placement unit test for the fallback.

## Technical notes
- Files: `src/server/layout/layout.ts` (l.123-166), `src/app/api/rooms/**/layout` route, `src/ui/roomlayout/**`, tests.

## Test plan
- DB: `layout.db.test.ts` per tier. Unit: placement fallback.

## Notes / answers from Ming
- Plan approved (2026-11-26, batch 2026-11-26-2): "duyệt hết theo mặc định".
- Merge approved (2026-11-26, batch 2026-11-26-2): "merge #127 #128 #130"; squash-merged by claude.

## Handoff

### 2026-11-26 — claude — DONE
- Agent calls: 4, ~184k tokens (planner×1 sonnet 41k, implementer×1 default 57k, reviewer×1 default 32k, security-ai-generated-code-auditor×1 default 55k; consult skipped, fast lane; batch 2026-11-26-2).
- Done: layout GET hides free-text `type` from Users on non-held devices; required `tier` arg; client keeps null-type devices (draws as `other`); tests; review PASS attempt 1; PR #130.
- In progress / next: Ming merges PR #130.
- Gotchas: unowned devices cannot sit on seats (`devices_unowned_not_placed_check`), so that DB test was dropped.
