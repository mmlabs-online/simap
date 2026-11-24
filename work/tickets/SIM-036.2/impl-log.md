## Attempt 1 — 2026-11-24

Slice 1 only (catalog, migration, seed, CRUD routes, layout `deviceType`, spec). Image routes are SIM-036.5.

### Files touched
| File | Required because |
|---|---|
| `db/migrations/20261124160000_device_types.sql` (new, High path) | `device_type_key()`, `device_types`, `device_type_catalogs`, `device_types_seed()`, members insert trigger, backfill |
| `db/migrations/README.md` | Schema bullet |
| `scripts/schema-check.mjs` | Two-stage migrate (backfill case), counts list, step-9 cases |
| `src/lib/device-types/types.ts` (new) | Shared limits, kinds, seed list, DTOs |
| `src/lib/device-types/name.ts` (new) | VI map and `deviceTypeKey` (TS mirror of the SQL key) |
| `src/lib/device-types/name.test.ts` (new) | Unit tests |
| `src/lib/validate/device-type.ts` (new) + `.test.ts` (new) | Create/patch validators |
| `src/lib/sprites/layout.ts` | `SeatDeviceType`, optional `SeatDevice.deviceType` |
| `src/server/device-types/device-types.ts` (new) | list/create/update/delete service |
| `src/server/device-types/pg-error.ts` + `.test.ts` (new) | 23505 -> `name_taken` |
| `src/server/device-types/sql-sync.test.ts` (new) | Migration literals equal TS constants |
| `src/server/device-types/device-types.db.test.ts` (new) | DB integration tests |
| `src/server/layout/layout.ts` | Left join `device_types`, build `deviceType` |
| `src/server/layout/layout.db.test.ts` | New equality shape plus resolution tests |
| `src/app/api/device-types/route.ts` (new) | GET (user), POST (admin) |
| `src/app/api/device-types/[id]/route.ts` (new) | PATCH, DELETE (admin) |
| `src/app/api/device-types/device-types-routes.test.ts` (new) | Route tests |
| `docs/spec-v1.md` | DEV-01, LAY-06, section 4 row, section 12 row |

### Tests added / changed
- `src/lib/device-types/name.test.ts`: key trim/collapse, VI fold, diacritics kept, VI map integrity, seed keys distinct, `DEVICE_KINDS` equals `DEVICE_SPRITE` keys.
- `src/lib/validate/device-type.test.ts`: create (NFC, NBSP, edge cases, code point count) and patch shapes.
- `src/server/device-types/pg-error.test.ts`, `sql-sync.test.ts`.
- `src/app/api/device-types/device-types-routes.test.ts`: 401, 403 for user and manager, GET user tier, admin success, uuid-before-pool, 400, refusal mapping, 503.
- `src/server/device-types/device-types.db.test.ts` (DB, not run locally): seed once, deleted stays deleted, list, create/duplicates, two orgs, rename/slot/no-op, delete leaves devices, cross-org 404, 101st and concurrent cap, SQL vs TS key.
- `src/server/layout/layout.db.test.ts` (DB, not run locally): three existing assertions updated; added unknown type -> null with " pc "/"PC" resolving, other org's same-named type unused, deleted type -> null.
- `scripts/schema-check.mjs` step 9 (DB, not run locally): 10 cases from the plan.
- Bug-ticket regression-first rule: not applicable (feature ticket).

### Checks (actual output summary)
- format:check: `All matched files use the correct format.`
- typecheck: `next typegen && tsc --noEmit` clean; `check:layers`: `623 files, no violations`.
- test: `Test Files 237 passed | 1 skipped (238)`, `Tests 2335 passed | 4 skipped (2339)` (run after the last code change).
- build: `pnpm build` succeeded; `/api/device-types` and `/api/device-types/[id]` listed.
- migrate:smoke: needs `DATABASE_URL`; not run. Migration file does parse through the migrator's `readMigrationFiles` (no transaction control found).
- NOT RUN locally (no Postgres): `pnpm schema:check`, `pnpm test:db`, `pnpm migrate:smoke`, `pnpm migrate`. CI runs `test:db`. The SQL, the two-stage schema-check and all `*.db.test.ts` cases are therefore unexecuted; please run `pnpm schema:check` and `pnpm test:db` against a local Postgres before merge.

### Out-of-plan files
- `src/lib/api/error.ts` — added codes `name_taken`, `type_limit`; `apiError` is typed to `ApiErrorCode`, so the routes cannot compile without them.
- `src/ui/copy/api.ts` — English messages for the two new codes (typecheck forces a text per code, D36).

### Follow-ups (noticed, not done)
- Image upload/remove/serve and the SIM-036.1 security follow-ups: SIM-036.5.
- Client parse `src/lib/sprites/map-view.ts` still drops `deviceType`: SIM-036.4.
- `scripts/schema-check.mjs` seeds `device_types` rows through the members trigger, so counts include them; harmless.

### Scope self-check
- Could the diff be smaller? No; remaining code is the migration, API and their tests.
- Diff size: about +1,500 / -25 lines including about 960 lines of new files and the tests (modified files: +250 / -23).
