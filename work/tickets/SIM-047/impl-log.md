
## Attempt 1 — 2026-11-26

Slice A. SIM-046 is not on this branch; its migration was not added or copied. Section number in `schema-check.mjs` is 12 (no SIM-046 section present); on rebase after SIM-046 it may need renumbering to 13.

### Files touched
| File | Required because |
|---|---|
| `db/migrations/20261126140000_members_pixel_look.sql` | New nullable `pixel_look` jsonb + `members_pixel_look_check` (AC1, AC2) |
| `db/migrations/README.md` | Migration docs bullet |
| `scripts/schema-check.mjs` | Section 12 "pixel look" (null default, valid, 15 refused shapes) |
| `src/lib/sprites/avatar.ts` | Comment only: ramps are append-only |
| `src/lib/sprites/pixel-look.ts` (+ `.test.ts`) | `PixelLook`, `isPixelLook`, `parsePixelLook`, `lookFromChoice`, `resolveLook`, `derivedChoice` |
| `src/lib/validate/pixel-look.ts` (+ `.test.ts`) | `validatePixelLook` |
| `src/lib/api/error.ts`, `src/ui/copy/api.ts` | `invalid_look` code and copy |
| `src/server/members/pixel-look.ts` (+ `.db.test.ts`) | Own get/set/reset with row lock, no-op detection, audit |
| `src/app/api/me/pixel-look/route.ts` (+ `route.test.ts`) | GET/PUT/DELETE, `withAuth` user tier |
| `src/lib/sprites/layout.ts`, `seat-view.ts` (+ test) | `SeatView.look` |
| `src/server/layout/layout.ts` (+ `layout.db.test.ts`) | select `o.pixel_look`, pass to `seatViewOf` |
| `src/lib/sprites/map-view.ts` (+ test) | tolerant parse of `look` |
| `src/lib/sprites/placement.ts` (+ test) | `resolveLook(view.look, view.avatarSeed)` |
| `src/ui/roomlayout/SeatOverlay.tsx` (+ test) | `look: null` literals (type only) |
| `src/app/dev/roommap/fixture.ts` (+ test) | `look` on demo views; `seat-b2` has a stored look; test uses `resolveLook` |

### Tests added / changed
- pixel-look.test.ts (ramps pinned, isPixelLook accept/reject, lookFromChoice, resolveLook, derivedChoice 200 seeds)
- validate/pixel-look.test.ts, api/me/pixel-look/route.test.ts (GET/PUT 400/422/valid/403/DELETE/503)
- members/pixel-look.db.test.ts (set + audit meta, no-op, reset, deactivated, org isolation/404)
- layout.db.test.ts › stored pixel look is returned for every viewer; seat-view, map-view, placement tests
- schema-check section 12

### Checks (actual output summary)
- format:check: All matched files use the correct format.
- typecheck: exit 0 (first run caught `as const` typing in my test; fixed)
- check:layers: 848 files, no violations
- test: 323 files passed | 1 skipped; 3237 tests passed | 9 skipped (run before the one-line `as const` test fix; typecheck/format re-run after)
- build: exit 0
- migrate:smoke: ok; schema:check: ok (all section 12 cases pass); test:db run twice: 21 files, 325 tests passed both times
- `pnpm migrate` not run against the local `simap` database (throwaway DBs only).

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- Spec wording "derived from `sub`" should read "derived from the member id" (Assumption 2).
- SIM-047.1 (slice B): Profile picker, preview, Reset.
- After SIM-046 merges: renumber the schema-check section if it also uses 12.

### Scope self-check
- Could the diff be smaller? No; every file is on the plan list. PUT maps a non-object body to 400 (plan API contract) using validator `field === "body"`.
- Diff size: see `git diff --shortstat` at commit.
