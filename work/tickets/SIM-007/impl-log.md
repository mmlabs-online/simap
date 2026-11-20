## Attempt 1 — 2026-11-20

### Files touched
| File | Required because |
|---|---|
| `db/migrations/20261120190000_members_profile_confirmed_at.sql` | Persisted first-visit flag (A1), expand-only |
| `db/migrations/README.md` | Schema doc line for the new column |
| `src/lib/validate/member.ts` | Display-name normalisation, default, PATCH validator |
| `src/lib/members/types.ts` | Shared `MeMemberDto` |
| `src/server/members/members.ts` | `getOrCreateMember`, `setOwnDisplayName` |
| `src/app/api/me/route.ts` | GET adds `member`; new PATCH |
| tests: `member.test.ts`, `members.db.test.ts`, `route.test.ts`, `flow.test.ts` | Plan test list |

### Tests added / changed
- `src/lib/validate/member.test.ts` › defaultDisplayName, normalizeDisplayName, validateMePatch tables
- `src/server/members/members.db.test.ts` › the 8 DB cases of the plan (create, 10 concurrent, two orgs, second GET, NFC + audit, same name no-op, PATCH before GET, deactivated, no email)
- `src/app/api/me/route.test.ts` › replaced the old shape test; 503/400/403/401 and PATCH cases (service mocked)
- `src/lib/identity/flow.test.ts` › readMeResult with SIM-007 body

### Checks (actual output summary)
- typecheck: exit 0
- check:layers: 189 files, no violations
- format:check: all matched files use the correct format
- test: 67 files, 642 tests passed
- build: exit 0
- NOT RUN: `pnpm migrate`, `pnpm migrate:smoke`, `pnpm schema:check`, `pnpm test:db` (Docker not running, no local Postgres). `members.db.test.ts` is therefore unexecuted locally; CI runs `test:db`.

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- Email refresh on later visits (A4); SIM-011 must reuse `normalizeDisplayName` and keep `profile_confirmed_at` semantics.

### Scope self-check
- Could the diff be smaller? No.
- Diff size: about +700 / -20 lines incl. tests.

## Attempt 2 (REWORK)

### Changes
- `src/lib/validate/member.ts`: `normalizeDisplayName` now rejects `\p{Cc}`, `\p{Cf}` and fillers U+115F, U+1160, U+3164, U+FFA0 and requires one `\p{L}|\p{N}|\p{S}|\p{P}` (security 🟡1). Choice: emoji ZWJ sequences and ZWNJ are NOT supported (all `\p{Cf}` rejected; simplest, closes bidi spoofing; single emoji still fine). `defaultDisplayName` strips the same set before `clean` and falls back to "member" (security 🟡2).
- `src/server/members/members.ts`: whitespace-only email treated as no email (403, no insert) in `getOrCreateMember` and `ensure`. The `any` in `Query` stays: `orgQuery<R>` needs `rows: R[]` for different R, and `unknown[]`/`never[]` fail typecheck (not feasible).
- Tests: `member.test.ts` (rejects "​", "a‮b", "ㅤ", "́", "a‍b"; default-name cases), `members.db.test.ts` (NFC test now passes NFD through `normalizeDisplayName`; whitespace email 403 and no insert).

### Check results (local, WSL)
- format:check, typecheck, check:layers, build: exit 0; test: 651 passed (651).

### CI evidence (draft PR #23)
See below (filled after the run).

### Out-of-plan files
None.

### Scope self-check
Only review/security items fixed.
