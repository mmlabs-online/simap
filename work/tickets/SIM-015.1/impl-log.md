## Attempt 1 — 2026-11-22

Slice 1 only (ACs 1, 5a, 6a, S1), plan approved with defaults A1-A14 (D59). No endpoint, service or UI.

### Files touched
| File | Required because |
|---|---|
| `db/migrations/20261122120000_room_tile_layout.sql` | Forward-only expand migration (AC 1, R2) |
| `db/migrations/README.md` | Schema doc stays true |
| `scripts/schema-check.mjs` | Section 8: old-shape inserts and the new row rules |
| `src/lib/sprites/layout.ts` | Replaced the "Provisional" comment; added `LayoutSaveValue` |
| `src/lib/validate/layout.ts` | New pure validator: `LAYOUT_LIMITS`, `footprintOf`, `checkLayoutRules`, `validateLayoutSave` |
| `src/lib/validate/layout.test.ts` | AC 5a, 6a |
| `src/lib/api/error.ts` | 4 new codes (closed union) |
| `src/ui/copy/api.ts` | Copy for the 4 codes (typecheck requires it) |
| `src/app/dev/roommap/fixture.test.ts` | S1: DEMO_LAYOUT passes the rules |
| `scripts/sprites/committed-atlas.test.ts` | S1: manifest `blocks` equal registry |

### Tests added / changed
- `src/lib/validate/layout.test.ts` › shape, sprites, rotation, footprint, bounds, overlap, chair (all plan rows)
- `src/app/dev/roommap/fixture.test.ts` › DEMO_LAYOUT passes the layout rules
- `scripts/sprites/committed-atlas.test.ts` › committed manifest blocks equal the registry
- `scripts/schema-check.mjs` section 8 (17 checks): old-shape inserts, partial placement, bad rotation, negative tile, blank sprite key, partial or non-positive grid, non-array floor_zones, negative version, kind-or-sprite, null kind allowed, unknown kind still refused

### Checks (actual output summary)
Local Postgres only (`docker compose -f compose.dev.yml up -d`, `DATABASE_URL=postgres://simap@127.0.0.1:5432/simap` in the command environment).
- format:check: All matched files use the correct format.
- typecheck: exit 0
- check:layers: 352 files, no violations (before the last edits; re-run exit 0)
- test: Tests 1501 passed | 3 skipped (1504)
- build: exit 0
- schema:check: `schema check ok` (all pass, including the 8 checks)
- test:db: Test Files 5 passed (5); Tests 52 passed (52)

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- Plan A13: registry has no `pillar` sprite; `label.sign` carries no text.
- SIM-015.2's ticket text still describes the old free-form editor and should be re-scoped.

### Scope self-check
- Could the diff be smaller? No: every file is in the plan list.
- Diff size: see report.
