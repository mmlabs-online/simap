# SIM-017.2: Search API, diacritics-insensitive

| Field | Value |
|---|---|
| State | BACKLOG |
| Priority | P2 |
| Size | M |
| Areas | api |
| Gate | none |
| Depends on | SIM-017 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-24 |
| Claimed by | — |
| PR | — |

## Goal
Everyone finds seats, devices and members quickly, whatever diacritics they type.

## Scope reference
spec DSH-02, §8 (NFC, search correctly). Split out of SIM-017 by its plan (`work/tickets/SIM-017/plan.md` → Split proposal, item 2, with its defaults).

## Scope
- `GET /api/search?q=&kind=all|seat|device|member&limit=&cursor=`, tier `user`; keyset-paged per kind.
- Diacritics: SQL `translate(lower(col), FOLD_FROM, FOLD_TO)` with a shared TS fold map in `src/lib/search/fold.ts` (no migration, no extension).
- Fields: seats (code, occupant name), devices (name, inventory no., MAC with separators ignored, owner name), members (name, employee code; no email).
- Switch `listMembers` `?q=` to the same fold.

## Out of scope
- Search page UI (SIM-017.3). A trigram index (follow-up only if slow).

## Acceptance criteria
- [ ] "nguyen" finds "Nguyễn" (and đ/Đ matches d).
- [ ] Search results are limited and paginated.
- [ ] Unit tests cover the diacritics normalisation, incl. a check that the TS fold and the SQL map agree.

## Test plan
- Unit: fold table, query validator, cursors. DB: diacritics, org isolation, paging.

## Notes / answers from Ming
—

## Handoff
