# SIM-017: Dashboard and search

| Field | Value |
|---|---|
| State | REVIEW |
| Priority | P2 |
| Size | M |
| Areas | api, ui |
| Gate | none |
| Depends on | SIM-013, SIM-014 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-20 |
| Claimed by | claude@2026-11-24T11:50:05Z |
| PR | — |

## Goal
Managers see the org's capacity and use at a glance, and everyone finds seats, devices and members quickly.

## Scope reference
spec DSH-01, DSH-02; D34 (warning for deactivated members holding seats).

## Scope
Re-scoped by the plan's split (slice 1 = dashboard, DSH-01 + D34):
- Dashboard numbers from live aggregates: rooms, seats, occupied, rate, devices placed vs inventory; per-room breakdown; warning for deactivated members still holding seats (Manager+).

## Out of scope
- History/trends.
- Search: API in SIM-017.2, page UI in SIM-017.3.

## Acceptance criteria
- [ ] Numbers match the database after any change (no cached counters).
- (moved to SIM-017.2: "nguyen" finds "Nguyễn"; search results are limited and paginated; unit tests cover the diacritics normalisation.)

## Technical notes
- Files: `src/server/dashboard/*`, `src/server/search/*`, `src/app/(app)/page.tsx`, `src/ui/dashboard/*`; reference seatMGT `src/lib/data/search.ts`, `DashboardRooms.tsx`.
- Risks / open questions: Diacritics-insensitive search in SQL (`unaccent` needs an extension → migration; or a normalised column).

## Test plan
- Unit: normalisation.
- Manual: search Vietnamese names (diacritics).

## Notes / answers from Ming
—

## Handoff
