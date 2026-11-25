
# Implementation attempt 1

## Before the fix (regression evidence)
`DATABASE_URL=postgres://simap:simap@127.0.0.1:5432/simap pnpm test:db` on unchanged code: `Test Files 2 failed | 13 passed (15)`, `Tests 3 failed | 187 passed (190)`.
- devices.db.test.ts > uniqueness: duplicate inventory number -> 409 ...
- export.db.test.ts > two orgs: each export lists only its own rows
- export.db.test.ts > an unowned device row has empty Owner name and Owner employee code, Location inventory

## Files touched
- `src/server/devices/devices.db.test.ts` — the two `updateDevice` calls (inventory number, MAC) use tier "admin"; required because `canEdit` allows only the owner or an Admin and the device is unowned (D63).
- `src/server/export/export.db.test.ts` — added `colIndex(columns, name)` (throws if missing); device assertions look up Owner name, Owner employee code, Location, Room code by name. Added Owner employee code ("E1") and Seat code ("R-a-01") checks. Room code is the room's code `R-a` (the plan said `R-a-01`, which is the seat code).

## Tests added
No new tests; the three existing DB tests were corrected.

## Checks (after)
- pnpm format:check: all files correct format
- pnpm typecheck && pnpm check:layers: ok, 663 files, no violations
- pnpm test: 252 passed | 1 skipped files; 2477 passed | 7 skipped
- pnpm build: exit 0 (run before the final test-only edit; test files are not part of the build)
- pnpm test:db: Test Files 15 passed (15), Tests 190 passed (190)

## Out-of-plan files
None.

## Follow-ups
None.

## Scope self-check
Only the two planned test files changed; no product code.
