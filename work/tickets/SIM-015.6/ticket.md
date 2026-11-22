# SIM-015.6: Room layout read API

| Field | Value |
|---|---|
| State | DONE |
| Priority | P1 |
| Size | M |
| Areas | api, security |
| Gate | none |
| Depends on | SIM-015.4 |
| Needs Ming | — |
| Attempts | 1 |
| Created | 2026-11-22 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/49 |

## Goal
Any org member can read a room's map data through the API, including a usable default for a room nobody has arranged yet.

## Scope reference
- Spec LAY-01, LAY-06, "Room view (all roles)", SEA-02.
- D43, D48, D58, D59.
- `work/tickets/SIM-015.1/plan.md`: `## API contract` (GET, `LayoutResponse`) and choices A1-A14.
- `work/tickets/SIM-015.4/plan.md`: `## Split proposal`, "Fixed design for SIM-015.6". Its planner confirms it against the
  code.

## Scope
- `GET /api/rooms/{id}/layout` for any org member, returning `LayoutResponse`.
- A `getRoomLayout` service that reads in one `repeatable read, read only` transaction, scoped by the verified token's
  org (R6), and builds the response with the pure SIM-015.4 helpers.

## Out of scope
- `PUT` and the save transaction (SIM-015.5).
- Any migration or map UI.
- The `pending` overlay state (SIM-014).

## Acceptance criteria
- [ ] GET returns the room size, each seat's placement and derived status, and the fixtures, for the caller's org only.
- [ ] A room with no saved layout returns a usable default without writing anything, and its seats stay reachable.
- [ ] A room over 500 seats returns the first 500 with `truncated: true`.
- [ ] A bad id, or a room in another org, returns 404.
- [ ] The response never contains a raw Identity `sub`.
- [ ] Corrupt stored floors, grid or sprite keys never break the read.
- [ ] DB integration tests cover org scoping, the read, and a concurrent commit between two reads. Route tests cover 404,
      503 and `no-store`.

## Technical notes
- Files: `src/server/layout/layout.ts`, `src/server/layout/layout.db.test.ts`, `src/app/api/rooms/[id]/layout/route.ts` and
  its route test.
- `pnpm build` confirms the `[id]/layout` route path.
- Security (SIM-015.4 review, 🟡 1): add the type guard at the start of `take` in `resolve-layout.ts` (object, string sprite, integer x, y and rotation), test the five bad shapes, and map an unplaced seat to `null`.
- Security (SIM-015.4 review, finding 2): in SQL, return `floor_zones` only when it has at most 64 items and 262,144 bytes, and select `left(sprite_key, 129)`. Pass `s.occupant_id` as the avatar seed.
- GitHub CI may be unavailable (billing), so record local evidence with `node scripts/test-db.mjs` on the local Postgres.

## Test plan
- DB: `node scripts/test-db.mjs`.
- Unit: route refusals.
- Manual: none in a browser, because this ticket has no UI.

## Notes / answers from Ming
- 2026-11-22: split from SIM-015.4 by its plan, while Ming asked to continue the room map work.

## Handoff

### 2026-11-22 — claude — DONE
- Agent calls: 5, tokens ~264k total (in/out split not reported) (api-platform-engineer×1 sonnet 38k, planner×1 opus 74k, implementer×1 sonnet 65k, reviewer×1 opus 51k, security-ai-generated-code-auditor×1 opus 36k).
- Done: GET /api/rooms/{id}/layout + getRoomLayout service (repeatable read, read only; org-scoped), SQL caps on floor_zones / sprite_key, type guard in `take`. Review PASS attempt 1, security review PASS (no 🔴). PR #49.
- In progress / next: Ming reviews and merges PR #49; then SIM-015.3 and SIM-015.5 become runnable.
- Gotchas: pnpm/node come from fnm — in Bash run `eval "$(fnm env --shell bash)" && fnm use 22` first. DB tests need DATABASE_URL inline (local trust URL from compose.dev.yml); GitHub CI may be unavailable, so local evidence is in review.md.
