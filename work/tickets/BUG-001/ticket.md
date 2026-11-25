# BUG-001: `pnpm test:db` red on main after SIM-037.2 (devices uniqueness, CSV export columns)

| Field | Value |
|---|---|
| Type | bug |
| State | REVIEW |
| Severity | S1 |
| Priority | P0 |
| Size | XS |
| Areas | db |
| Gate | none |
| Found in | main 4c93730 (CI run 45543569345); release v0.1.8 built from it |
| Introduced in | SIM-037.2 (PR #83, fb1dcb5), merged with red CI; case 1 may date from SIM-037.1 (#81) |
| Depends on | — |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-25 |
| Claimed by | claude@2026-11-25T04:07:23Z |
| PR | — |

## Report
Ming 2026-11-25: "CI lỗi khi cắt release https://github.com/mmlabs-online/simap/actions/runs/45543569345" — then "tạo bug và fix ngay tại đây". The `ci` job fails at step `db integration tests` on main; the release workflow for `release/0.1.8` itself was green and opened the deployment PR `release/simap-v0.1.8` (hold it until this is fixed).

## Environment
- CI `ci` job on `ubuntu-latest` with Postgres 17; reproduced locally with Postgres 16 (`DATABASE_URL=postgres://simap:simap@127.0.0.1:5432/simap pnpm test:db`): 3 failed, 187 passed.

## Steps to reproduce
1. Start a local Postgres with a `simap` role.
2. `DATABASE_URL=postgres://simap:simap@127.0.0.1:5432/simap pnpm test:db` on main 4c93730.

## Expected
- `pnpm test:db` is green, and the assertions match the current device rules (D63) and the current CSV columns.

## Actual
1. `src/server/devices/devices.db.test.ts:523` — `updateDevice(..., "user", bId, { inventoryNumber: "INV-1" })` expects 409 `inventory_number_taken`, gets 422 `not_allowed`.
2. `src/server/export/export.db.test.ts:51` — devices export `rows[0][5]` is `null`, expected `"Nguyễn a"`.
3. `src/server/export/export.db.test.ts:71` — no devices export row with `x[7] === "inventory"` (TypeError on `row[5]`).

## Root cause
**Confirmed (reproduced):** the tests were not updated; the code behaves as specified.
- Cases 2–3: SIM-037.2 added `Serial`, `Manufacturer`, `Brand` after `MAC` in the devices export (`src/server/export/export.ts:53-81`), shifting `Role`/`Owner name`/`Owner employee code`/`Location`/`Room code`/`Seat code` by 3. `export.test.ts` was updated in #83 but `export.db.test.ts` still reads the old indices (5 → 8 owner name, 7 → 10 location, 9 → 11 room code, 6 → 9 owner code). The SQL still joins the owner via `d.owner_id`, so the export is correct.
- Case 1: devices created by an Admin are unowned (D63, SIM-037.1), and `canEdit(tier, isOwner) = isOwner || tier === "admin"` (`src/lib/devices/rules.ts:9`); `updateDevice` refuses a User on someone else's / an unowned device with 422 `not_allowed` before the uniqueness check (`src/server/devices/devices.ts:398-399`). The test still edits with tier `"user"`; it must use a tier allowed to edit (Admin) to reach the uniqueness check.
- Why it slipped: SIM-037.2's impl-log and review ran without Postgres ("test:db NOT run … awaits CI"), and the PR was merged with the `ci` check red.

## Scope
- Update the three DB-test assertions to the current rules and columns. No product code change unless the reviewer finds the code wrong.

## Out of scope
- Any change to export columns, device permissions or SIM-037.x behaviour.

## Acceptance criteria
- [ ] A regression test reproduces the bug: the three named tests fail on `main` before the fix and pass after (record the before/after in impl-log).
- [ ] The devices export DB test asserts the owner name, owner code, location and room code at their current column positions (looked up by column name, so a later column insert cannot silently shift them).
- [ ] The uniqueness test reaches the uniqueness check with an allowed tier, and still proves 409 `inventory_number_taken` / `mac_taken` on update.
- [ ] All checks pass, including `pnpm test:db` run locally against Postgres.

## Technical notes
- Files: `src/server/export/export.db.test.ts`, `src/server/devices/devices.db.test.ts`.
- Test level: `pnpm test:db` (the bug lives in the DB integration suite).

## Notes / answers from Ming
- 2026-11-25: create the bug and fix it in this session.

## Handoff
