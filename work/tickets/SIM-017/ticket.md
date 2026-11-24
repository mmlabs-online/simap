# SIM-017: Dashboard and search

| Field | Value |
|---|---|
| State | DONE |
| Priority | P2 |
| Size | M |
| Areas | api, ui |
| Gate | none |
| Depends on | SIM-013, SIM-014 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-20 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/71 |

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

### 2026-11-24 — claude — DONE
- Agent calls: 6, tokens ~331k total (api-platform-engineer×1 default 45k, frontend-developer×1 default 35k, planner×1 default 95k, implementer×1 default 74k, reviewer×1 default 54k, security-ai-generated-code-auditor×1 default 30k)
- Done: slice 1 (dashboard) implemented, 21 files +1396/−17, review PASS, security no 🔴 and one 🟡 (no route test for the tier gate at route.ts:14); PR #71 opened. SIM-017.2 (search API) and SIM-017.3 (search page) filed.
- In progress / next: Ming decides rework vs follow-up for the tier-gate route test (default follow-up), then merges PR #71. Next: SIM-017.2.
- Gotchas: devices without a seat must be `secondary` in DB fixtures (schema rule).
