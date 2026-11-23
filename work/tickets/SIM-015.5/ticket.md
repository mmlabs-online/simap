# SIM-015.5: Save a room layout through the API

| Field | Value |
|---|---|
| State | MERGED |
| Priority | P1 |
| Size | M |
| Areas | api, security |
| Gate | plan-approval |
| Depends on | SIM-015.6 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-22 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/51 |

## Goal
An Admin can save a whole room layout in one safe step, without losing another Admin's work.

## Scope reference
- Spec LAY-01, LAY-03, SEA-02.
- D43, D48, D58, D59.
- `work/tickets/SIM-015.1/plan.md`: `## API contract` (PUT, `LayoutSave`, error codes, PUT transaction) and choices
  A1-A14. These are approved and are not decided again.

## Scope
- `PUT /api/rooms/{id}/layout` for Admin, with a 256 KiB body limit, validated before any transaction.
- One transaction in the plan's lock order: room, seats, seat placement, placed fixtures, room grid and floors, version,
  one counts-only audit row.
- Refusals `layout_stale`, `layout_seats_changed` and `layout_too_many_seats`.

## Out of scope
- Creating or deleting seats through the save (LAY-02, decided in SIM-015.2's plan).
- Any migration or editor UI.

## Acceptance criteria
- [ ] PUT is Admin-only, and a valid layout survives a reload.
- [ ] A refused payload, or a seat from another room or org, saves nothing.
- [ ] A stale `baseVersion` returns 409 `layout_stale`, and of two concurrent saves only one succeeds.
- [ ] A changed seat set returns 409 `layout_seats_changed`, with the same answer for a foreign seat id.
- [ ] A save never changes occupants, status, `seat_counter`, devices or legacy fixture rows.
- [ ] Auth codes come only from the wrapper, and domain refusals are 409 or 422 (R7).
- [ ] DB integration tests cover rollback, org scoping, stale and concurrent saves.

## Technical notes
- Files: `src/server/layout/*`, `src/app/api/rooms/[id]/layout/route.ts`, `src/lib/api/error.ts`, `src/ui/copy/api.ts`.
- SIM-015.2 note: `unplaced` seats are not in `layout.seats`, but PUT needs the exact seat set, so the editor must place them before saving.
- Security (SIM-015.4 review, finding 3): call the shared `floorCellsWithinCap` in `validateLayoutSave`, only after `checkLayoutRules` returns ok.
- Security (SIM-015.1 review): (1) cap total floor cells at twice the grid area, with a test for 64 full-grid zones, because overlapping zones can hang every member's browser; (2) refuse `baseVersion` above the int4 range; (3) keep `org_id` and `room_id` on the seat UPDATE; (4) use one `unnest` UPDATE and one INSERT; (5) check the room seat count before the seat-set comparison; (6) add a DB test that a foreign-org seat id changes neither org.

## Test plan
- Unit: route refusal mapping.
- DB: `pnpm test:db`.
- Manual: none in a browser, because this ticket has no UI.

## Notes / answers from Ming
- 2026-11-22 (D59): split from SIM-015.1; Ming approved the split and defaults A1-A14.
- 2026-11-23: Plan approved in advance: Ming waived the plan-approval stop for this ticket ("chạy luôn SIM-015.5 k cần duyệt plan"). Ming still reviews and merges the PR.

## Handoff

### 2026-11-23 — claude — DONE (merge conditional on CI)
- Agent calls: 6 (api-platform-engineer×1 55.4k, planner×1 114.9k, implementer×1 80.2k, reviewer×1 usage not yet reported, security review×1 via general-purpose opus 123.4k, plus one failed dispatch of the unavailable security agent type). In/out split not reported.
- Done: `PUT /api/rooms/{id}/layout`, save transaction, validator caps, 3 error codes. Review attempt 1 PASS, conditional on CI; security review has no 🔴. Local format, typecheck, layers, build and unit tests green (1613 passed, 8 skipped, on Node 24; the repo targets 22).
- In progress / next: `gh` is not installed, so Ming opens the PR from the prefilled link. **Do not merge until the PR's `db integration tests` step is green**: the 13 DB tests and all new SQL have never been executed. A failure returns the ticket to REWORK.
- Gotchas: `debt` issues NOT created (no `gh`): security F1 (no `lock_timeout`, parallel saves can exhaust the shared 5-connection pool), fixture ids change on each save so paint order on a shared tile may flip (SIM-015.2), no audit label for `room.layout_save`. Plan approval was waived by Ming for this ticket.
