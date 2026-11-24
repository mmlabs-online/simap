# SIM-017.2: Search API, diacritics-insensitive

| Field | Value |
|---|---|
| State | MERGED |
| Priority | P2 |
| Size | M |
| Areas | api |
| Gate | none |
| Depends on | SIM-017 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-24 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/72 |

## Goal
Everyone finds seats, devices and members quickly, whatever diacritics they type.

## Scope reference
spec DSH-02, §8 (NFC, search correctly). Split out of SIM-017 by its plan (`work/tickets/SIM-017/plan.md` → Split proposal, item 2, with its defaults).

## Scope
- `GET /api/search?q=&kind=all|seat|device|member&limit=&cursor=`, tier `user`; keyset-paged per kind.
- Diacritics: SQL `translate(lower(col), FOLD_FROM, FOLD_TO)` with a shared TS fold map in `src/lib/search/fold.ts` (no migration, no extension).
- Fields: seats (code, occupant name), devices (name, inventory no., MAC with separators ignored, owner name), members (name, employee code; no email).
- Switch `listMembers` `?q=` to the same fold.
- Carried over from SIM-017 (security 🟡1; Ming kept the default "follow-up", 2026-11-24): add `src/app/api/dashboard/route.test.ts` covering the tier gate at `route.ts:14` (user → `includeHolders: false` and `deactivatedHolders: null`; manager/admin → `true`) and `Cache-Control: no-store` on 200.

## Out of scope
- Search page UI (SIM-017.3). A trigram index (follow-up only if slow).

## Acceptance criteria
- [ ] "nguyen" finds "Nguyễn" (and đ/Đ matches d).
- [ ] Search results are limited and paginated.
- [ ] Unit tests cover the diacritics normalisation, incl. a check that the TS fold and the SQL map agree.
- [ ] A route test pins the dashboard tier gate (User gets no deactivated-holders data).

## Test plan
- Unit: fold table, query validator, cursors. DB: diacritics, org isolation, paging.

## Notes / answers from Ming
—

## Handoff

### 2026-11-24 — claude — DONE
- Agent calls: 4, tokens ~255k total (planner×1 default 80k, implementer×1 default 77k, reviewer×1 default 61k, security-ai-generated-code-auditor×1 default 37k); consult reused from SIM-017 (same design).
- Done: search API with the translate() fold (no migration), listMembers on the same fold, and the carried-over dashboard tier-gate route test (mutation-checked by the reviewer); 21 files +1462/−8; review PASS, security no 🔴/🟡; PR #72 opened.
- In progress / next: Ming merges PR #72 and answers the members-email question (security follow-up). Next: SIM-017.3 (search page).
- Gotchas: none new.
