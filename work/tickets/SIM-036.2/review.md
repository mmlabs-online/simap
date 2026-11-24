## Attempt 1 — 2026-11-24
Verdict: PASS

Scope: slice 1 only (plan approved by Ming with defaults A1-A11 and the split). Ticket ACs 3 and 4 (image upload and
serve) moved to SIM-036.5 and are not verified here.

### Checks (run by reviewer)
Run on Windows via fnm Node 22 against the local compose Postgres. Every command exited 0.
- `pnpm format:check`: "All matched files use the correct format." (677 files).
- `pnpm typecheck`: next typegen and tsc ran clean (exit 0).
- `pnpm check:layers`: "623 files, no violations".
- `pnpm test`: "Test Files 237 passed | 1 skipped (238)", "Tests 2335 passed | 4 skipped (2339)". This matches impl-log.
- `pnpm build`: "Compiled successfully"; `/api/device-types` and `/api/device-types/[id]` are listed.
- `pnpm test:db`: "Test Files 14 passed (14)", "Tests 173 passed (173)".
- `pnpm schema:check`: 54 pass, no FAIL. This includes "1 later run applies device_types", "1 second run is up to date" and all 10 step-9 cases.
- `pnpm migrate:smoke`: "migrate smoke ok".

### Acceptance criteria
- [x] AC1: the migration is forward-only and expand-only, schema:check and migrate:smoke pass, and every org gets the five seeded types. Evidence:
  - `db/migrations/20261124160000_device_types.sql` only creates objects: 3 functions, 2 tables, 1 unique index, 1 trigger, plus the backfill select. It has no alter/drop and no transaction control.
  - schema:check passes "9 orgs existing before the migration get 5 types" (the two-stage backfill with a member-only org and a room-only org), "9 org created after the migration gets 5 types on first member", "9 second member adds none" and "9 deleted seed type stays deleted".
  - test:db passes `device-types (db) › a new member's first visit seeds the org once; a second member adds none`.
- [x] AC2: Admin only, 409 on a duplicate name, org-scoped, with a two-org DB test. Evidence:
  - `device-types-routes.test.ts › 403 forbidden for user and manager on POST, PATCH, DELETE; service not called` (the wrapper returns 403 at `src/server/http/with-auth.ts:70`, before the handler runs).
  - `device-types.db.test.ts › create … duplicates are refused case- and space-insensitively` covers `"  ip   PHONE "` → 409 name_taken, "MÁY IN" after "Máy in" → name_taken, and "May in" allowed.
  - `› org B cannot list, rename, change the slot of or delete org A's type (404, row unchanged)`.
  - Every SQL statement in `src/server/device-types/device-types.ts` goes through `orgQuery` with `org_id = $1`.
- [x] Plan AC3 (ticket AC5): the layout returns the resolved type, and a type not in the catalog resolves to none. Evidence:
  - `layout.db.test.ts`: the updated equality at the seatDevices default-order test.
  - `› unknown type resolves to null; ' pc ' and 'PC' both resolve to PC`.
  - `› another org's catalog type with the same name is never used`.
  - `› after deleting the Monitor type, Monitor devices resolve to null`.
  - The join in `src/server/layout/layout.ts` is scoped `t.org_id = $1`.
- [x] Plan AC4 (ticket AC6): spec updated. Evidence: `docs/spec-v1.md` has the DEV-01 bullets, the LAY-06 bullet, the §4 DeviceType row and the §12 row, worded as in plan step 9.
- [x] Plan AC5: the cap and validation hold. Evidence:
  - `src/lib/validate/device-type.test.ts` (4 cases: NFC, NBSP, blank, 61 code points, Cc/Cf, extra keys, slot) passes.
  - `device-types.db.test.ts › 101st type -> 409 type_limit; two concurrent creates at 99 -> exactly one succeeds` passes.
- Ming verification after merge (not reviewer-verified, carry to the PR):
  - After deploy, `GET /api/device-types` (or the SIM-036.3 page) for each existing org lists PC, Laptop, Monitor, IP phone and Other.
  - Optional: `show lc_ctype;` on the `simap` database.

### Issues
None.

### Rules (CLAUDE.md)
No violations found.
- R1: the server files start with `import "server-only"`, the lib files are pure, check:layers is clean.
- R2: the migration is a new file, forward-only and expand-only. The previous image ignores the new tables, and the trigger only writes to the new tables.
- R6: `org_id` is on both new tables and in the unique index. All queries and the layout join are scoped by `$1`.
- R7: the service has no 401/403 codes. Refusals are 404/409 and validation failures are 400.
- R4: out-of-plan `src/lib/api/error.ts` and `src/ui/copy/api.ts` are justified in impl-log, because the type system forces the code list and its copy. The only High path changed is the migration, which the plan names and Ming approved.
- R5: the new logic has unit, route and DB tests.

### Blockers from review agents
None from the reviewer. The orchestrator adds any red findings from `security-review.md`.
security-review.md (attempt 1): no 🔴 blockers, no 🟡 findings (5 🟢 notes, follow-ups only).

### Nits (do not block)
- `src/lib/device-types/name.ts` `deviceTypeKey` is used only by tests. It lowercases only ASCII and the VI map, while the SQL `lower()` also folds other scripts by the DB locale. This matches the plan (A5) and is documented. If a future caller uses it in app code for matching, it can differ from SQL for Greek and Cyrillic text.
- `device-types-routes.test.ts › 503 when there is no pool` covers only GET. POST, PATCH and DELETE share the same two lines.
- `src/server/layout/layout.ts`: the non-null assertions (`d.slot!` etc.) are safe because of the `t.id` guard of the left join. A short comment would help.

### Follow-ups (out of scope)
- Client parse `src/lib/sprites/map-view.ts` still drops `deviceType` (SIM-036.4, as impl-log notes).
- Image upload, remove and serve, and the SIM-036.1 security follow-ups (SIM-036.5).
- A device type with an internal NBSP never matches the catalog, because the device validator does not collapse whitespace (accepted in A5). Consider aligning `validateDevice*` type normalization later.
