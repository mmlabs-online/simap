# SIM-015.4: Default room layout and stored-layout resolver

| Field | Value |
|---|---|
| State | MERGED |
| Priority | P1 |
| Size | M |
| Areas | api, security |
| Gate | none |
| Depends on | SIM-015.1 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-22 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/48 |

## Goal
Any org member can read a room's map data, including a usable default for a room nobody has arranged yet.

## Scope reference
- Spec LAY-01, LAY-06, "Room view (all roles)", SEA-02.
- D43, D48, D58, D59.
- `work/tickets/SIM-015.1/plan.md`: `## API contract` (GET, `LayoutResponse`, default layout) and choices A1-A14. These are
  approved and are not decided again.

## Scope
- A pure `defaultLayout` in `src/lib/sprites/default-layout.ts`, using the plan's grid rule.
- `GET /api/rooms/{id}/layout` for any org member, returning `LayoutResponse`.
- Read in one `repeatable read, read only` transaction, scoped by the verified token's org (R6).
- Seat status derived, never read from storage. The avatar seed is the member id, and raw `sub` is never returned.
- In a saved room, a seat with no valid placement takes the first free slot, or is listed in `unplaced`.

## Out of scope
- `PUT` and the save transaction (SIM-015.5).
- Any migration or map UI (SIM-015.1, SIM-015.3).
- The `pending` overlay state (SIM-014).

## Acceptance criteria
- [ ] GET returns the room size, each seat's placement and derived status, and the fixtures, for the caller's org only.
- [ ] A room with no saved layout returns a usable default without writing anything, and its seats stay reachable.
- [ ] The default layout passes the SIM-015.1 layout rules, so an Admin can save it unchanged.
- [ ] A room over 500 seats returns the first 500 with `truncated: true`.
- [ ] A bad id, or a room in another org, returns 404.
- [ ] The response never contains a raw Identity `sub`.
- [ ] Unit tests cover `defaultLayout`, and DB integration tests cover org scoping and the read.

## Technical notes
- Files: `src/lib/sprites/default-layout.ts`, `src/server/layout/layout.ts`, `src/app/api/rooms/[id]/layout/route.ts`.
- Security (SIM-015.1 review, finding 3): treat stored `floor_zones` as untrusted on read. Re-validate shape, bounds, known sprite and a total-cell cap, and fall back to the default floor.
- Security (SIM-015.1 review, attempt 2): treat stored `sprite_key` as untrusted on read. Look it up in the registry and handle an unknown key without crashing the room view.
- `pnpm build` confirms the `[id]` route path.

## Test plan
- Unit: default layout.
- DB: `pnpm test:db`.
- Manual: none in a browser, because this ticket has no UI.

## Notes / answers from Ming
- 2026-11-22 (D59): split from SIM-015.1; Ming approved the split and defaults A1-A14.
- 2026-11-22: the plan splits this ticket. SIM-015.4 delivers the pure `src/lib` slice: AC3, the unit-test part of AC7, and the pure parts of AC1, AC2, AC4 and AC6. SIM-015.6 delivers the GET route, DB and route tests, and the rest of those criteria.

## Handoff
### 2026-11-22 — claude — DONE (slice 1)
- Agent calls: 5, tokens about 350k total, in/out split not reported (api-platform-engineer×1 default model 55k; planner×1 default model 95k; implementer×1 default model 57k; reviewer×1 default model 70k; security-ai-generated-code-auditor×1 default model 73k).
- Done: pure `defaultLayout`, `seatViewOf`, `parseStoredFloors`, `resolveLayout`, floor-cell cap, `LayoutResponse` and unit tests. Review attempt 1 PASS, security no 🔴. PR #48 opened.
- In progress / next: Ming fixes GitHub Billing, re-runs CI and merges PR #48. Next ticket: SIM-015.6 (GET route).
- Gotchas: Node and pnpm need fnm activated. GitHub CI is not running (billing). `docs/spec-v1.md:362` still says avatars come from `sub`, which D59 supersedes.
