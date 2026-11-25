# SIM-037.12: Devices UI: pending extensions for Manager+

| Field | Value |
|---|---|
| State | BACKLOG |
| Priority | P2 |
| Size | S |
| Areas | ui |
| Gate | none |
| Depends on | SIM-037.11 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-25 |
| Claimed by | — |
| PR | — |

## Goal
Admin/Manager see pending extension requests and approve or reject them; the nav badge counts them.

## Scope reference
docs/spec-v1.md §6 DEV-10; OQ-42. Slice 2 split from SIM-037.11 (its plan.md `## Split proposal`). API from SIM-037.5: `GET /api/handoffs?box=extensions` (Manager+), `POST /api/handoffs/:id/confirm`, `POST /api/handoffs/:id/decline`, count `extensions`.

## Scope
- `devices-api.ts`: `pendingExtensions()`; `useIncomingHandoffs.ts`: three-way fetcher map (incoming / returns / extensions).
- Tier-aware `handoffBoxes(isAdmin, isManager)` (extensions Manager+ only); `badgeTotal` and `badgeCountAfter` include extensions; `shell.ts` breakdown part for extension requests.
- `PendingExtensions.tsx` (like `PendingReturns`): Approve / Reject, lines owner, current expiry → requested date, note; outcomes with extension wording.
- `DevicesPage.tsx` wiring (heading ref, focus, refreshAll).
- Copy in `src/ui/copy/*` (D36); a seeded pending extension.

## Out of scope
- Reject reason field (API takes none). Owner side (SIM-037.11).

## Acceptance criteria
- [ ] Manager+ see pending extension requests and can approve (sets the new expiry) or reject them; a non-Manager never requests `box=extensions`.
- [ ] The nav badge and its breakdown include pending extensions for Manager+.
- [ ] All new strings live in `src/ui/copy/*` (D36).

## Technical notes
- See SIM-037.11 plan.md `## Split proposal`.

## Test plan
- Unit: fetcher map, handoffBoxes, badge sum, outcomes, API client path. Markup: PendingExtensions.

## Notes / answers from Ming
Split from SIM-037.11 by the planner (2026-11-25); added by the orchestrator, Ming to confirm.

## Handoff
