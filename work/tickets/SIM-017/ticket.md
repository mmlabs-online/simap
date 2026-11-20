# SIM-017: Dashboard and search

| Field | Value |
|---|---|
| State | BACKLOG |
| Priority | P2 |
| Size | M |
| Areas | api, ui |
| Gate | none |
| Depends on | SIM-013, SIM-014 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-20 |
| Claimed by | — |
| PR | — |

## Goal
Managers see the org's capacity and use at a glance, and everyone finds seats, devices and members quickly.

## Scope reference
spec DSH-01, DSH-02; D34 (warning for deactivated members holding seats).

## Scope
- Dashboard numbers from live aggregates: rooms, seats, occupied, rate, devices placed vs inventory; per-room breakdown; warning for deactivated members still holding seats.
- Server search across seats, devices, members; case- and diacritics-insensitive; bounded results.

## Out of scope
- History/trends.

## Acceptance criteria
- [ ] Numbers match the database after any change (no cached counters).
- [ ] "nguyen" finds "Nguyễn".
- [ ] Search results are limited and paginated.
- [ ] Unit tests cover the diacritics normalisation.

## Technical notes
- Files: `src/server/dashboard/*`, `src/server/search/*`, `src/app/(app)/page.tsx`, `src/ui/dashboard/*`; reference seatMGT `src/lib/data/search.ts`, `DashboardRooms.tsx`.
- Risks / open questions: Diacritics-insensitive search in SQL (`unaccent` needs an extension → migration; or a normalised column).

## Test plan
- Unit: normalisation.
- Manual: search Vietnamese names (diacritics).

## Notes / answers from Ming
—

## Handoff
