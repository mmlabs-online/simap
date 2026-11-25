# Review: SIM-039.4

## Attempt 1 — 2026-11-25
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check`: exit 0, "All matched files use the correct format."
- `pnpm typecheck && pnpm check:layers`: exit 0, "check-layers: 738 files, no violations"
- `pnpm test`: exit 0, "Test Files 279 passed | 1 skipped (280)", "Tests 2847 passed | 7 skipped (2854)"
- `pnpm build`: exit 0
- Local throwaway PostgreSQL 16 (under /var/tmp, port 55433, 127.0.0.1, trust; DATABASE_URL inline, no `.env*` read; stopped and deleted after):
  - `pnpm migrate && pnpm migrate:smoke && pnpm schema:check` (branch HEAD f1d3626): exit 0, "schema check ok"
  - `pnpm test:db` (HEAD): exit 1, "Tests 9 failed | 263 passed (272)"
  - `pnpm test:db` (base f115c60, extracted with `git archive` to a temp dir, fresh database): exit 1, "Tests 9 failed | 254 passed (263)"
  - The sorted FAIL lists of the two runs are identical (diff empty): 7 in `src/server/devices/handoffs.db.test.ts`
    (start ×5, return ×2), 1 in `src/server/devices/devices.db.test.ts` (canReturn/canTakeBack flags), 1 in
    `src/server/members/manage.db.test.ts` (deactivate with release). These failures already exist on the base commit, so they do not count against this ticket. The implementer's claim matches.
  - `map-items-image.db.test.ts` run alone with the verbose reporter: 9/9 passed. The 9 extra passing tests at HEAD are these. The device-type DB suites are not in either FAIL list.

### Acceptance criteria
- [x] 1 Not PNG / APNG / too large → 422 before any DB or Drive call. Wrong size → 422 after one read-only select. Evidence: route test `PUT 422: too large (Content-Length and streamed), wrong type, garbage, APNG; the service is not called`. `image.test.ts › unknown key gives 404 and n/e/w ... with zero db calls` (`h.sql` empty) and `› bad size: exactly one select ...` (one SQL, `calls == ["select"]`). DB test `› a refused upload (wrong size) writes nothing and makes no Drive call`. Route order is at `src/app/api/map-items/[key]/art/[dir]/image/route.ts:23-33`.
- [x] 2 Replace and remove delete the old Drive file. Evidence: DB test `› replace deletes the old file; remove nulls the id ...; a second remove writes no audit` passed. Unit tests: order test (delete old after commit), the remove test, and `Drive off: still ok and the orphan is logged`.
- [x] 3 Cross-org → 404. Evidence: DB test `› org B gets 404 on PUT, DELETE and GET ...`. B's GET is 404. B's DELETE on its own row with no file is an idempotent 204 with no Drive call. An org with no rows gets 404 on all three. A's row is unchanged.
- [x] 4 Every query is scoped by the token's org (R6). Evidence: all 4 SQL statements in `src/server/map-items/image.ts` (select l.44-50, CAS update l.93-101, lock select l.149-154, remove update l.158-164) go through `orgQuery` with `org_id = $1` and `scope` from `ctx.scope`. Audit goes through `writeAudit(c, scope, …)`.
- [x] 5 Admin-only writes are audited. Evidence: route test `PUT and DELETE with a user or manager token give 403 and never call the service; a user may GET`. Tiers are `admin`/`admin`/`user` (route.ts l.39, 52, 83). DB tests assert one `map_item.image_set` / `map_item.image_remove` row with meta `{key, dir, version}`, `entity_id` null and no file id. A second remove adds no row.
- [x] 6 Size rule. Evidence: `art.test.ts › mapItemImageFits` (6 cases: floor exact; 1×1 overhang bounds; 2×1 n/s; e/w swap; 4×4 upper bound; desk/chair). `png.test.ts › parsePng` (3). Route test `a valid PNG of exactly 64 KB reaches the service` plus the 65537-byte refusal. Rule is at `src/lib/map-items/art.ts:39-52`, constants at `src/lib/map-items/types.ts:12-15`.
- [x] 7 Device-type image behaviour unchanged. Evidence: `git diff origin/main...HEAD` shows no change to `src/server/device-types/image.test.ts`, `image.db.test.ts`, `src/app/api/device-types/**` or `src/ui/deviceTypes/**`. The only change to `png.test.ts` is the import line plus an appended `describe("parsePng")` block. The existing cases are unedited. `validatePng` is now `parsePng` plus the unchanged `IMAGE_LIMITS` test (`src/lib/validate/png.ts:73-82`). `driveFailure` wraps `mapDriveFailure` with the old `device_type_image_drive` event. `discardImageFile`, `orphan {typeId}` and the SQL are untouched. Every re-exported name stays available to `src/app/api/device-types/**`. All of these suites pass in `pnpm test`, and the device-type DB suites pass in `pnpm test:db`.
- [x] 8 Checks green, including `pnpm test:db`. Evidence: above. The 9 `test:db` failures already exist on the base commit (identical list).

Ming verification after merge (not reviewer's): with real Drive config, upload a PNG for one direction (e.g. 2 × 1 table `e`, 32 × 64), replace it (old file gone from Drive), remove it (file gone).

### Issues
None.

### Rules (CLAUDE.md)
No violations found.
- R1: the new server files start with `import "server-only"`. The route is the only importer of `@/server/map-items/image`. `check:layers` is clean.
- R2: no schema change.
- R3: no new env. Logs carry event/op/code/key only, never file ids or bytes (`image.test.ts › deleting the old file fails ... (no file id)`).
- R4: every changed file is in the plan's file list. `work/ming-todo.md` and `ticket.md` are loop bookkeeping (M-69 restore and M-70 approval line).
- R5: new logic has tests.
- R6: see AC 4.
- R7: 401/403 come only from `withAuth`. Service refusals are 404/409/422/502/503. `mapDriveFailure` never yields 401/403.

### Blockers from review agents
None (no 🔴). `security-review.md` attempt 1 has two 🟡 should-fix items, carried as follow-ups: (1) a `toDto` null after the update commits then deletes the new Drive file (unreachable today; throw to roll back); (2) the image ETag `"<key>-<dir>-<version>"` is the same across orgs, so a user switching orgs could get a 304 for another org's art (fix before 039.5/039.6 fetch this route: add an org hash to the ETag or `Vary: Authorization`).

### Nits (do not block)
- `src/server/map-items/image.ts:105-106,123-125`: if `toDto` returned null after the CAS update had applied, the tx would commit the new file id and the code would then discard that same file and report 409/404. This cannot happen today, because `libraryItem(key)` is checked first and `toDto` only fails on an unknown key. Throwing instead of `return null` there would make that impossible by construction.
- `png` is passed to `setMapItemImage` with its `ok: true` field (route.ts l.34). This is harmless.

### Follow-ups (out of scope)
- A BUG ticket for the 9 `pnpm test:db` failures on the base commit (`handoffs.db.test.ts` ×7, `devices.db.test.ts` ×1, `members/manage.db.test.ts` ×1). A11 expected 5. The base commit has 9.
- 039.6: map-item-specific copy for `image_bad_size` / `image_too_large` / `image_not_png` (A8).

## Attempt 2 — 2026-11-25
Verdict: PASS

Scope of this attempt: the rework Ming asked for, to fix `security-review.md` attempt 1 finding 🟡 2 (the image ETag was the same across orgs). The fix is commit c81607c.

### Checks (run by reviewer)
- `pnpm format:check`: exit 0, "All matched files use the correct format."
- `pnpm typecheck`: exit 0
- `pnpm check:layers`: exit 0, "check-layers: 738 files, no violations"
- `pnpm test`: exit 0, "Test Files 279 passed | 1 skipped (280)", "Tests 2847 passed | 7 skipped (2854)". The count is the same as attempt 1. That is expected, because the unit and route changes only add assertions to existing `it` cases and add no new case.
- `pnpm build`: exit 0
- I ran a throwaway PostgreSQL 16 under `/var/tmp` (port 55433, trust auth, 127.0.0.1, DATABASE_URL passed inline). I stopped it and deleted the directory afterwards.
  - `pnpm migrate && pnpm migrate:smoke && pnpm schema:check`: exit 0, "schema check ok"
  - `pnpm test:db`: exit 1, "Tests 9 failed | 264 passed (273)". Attempt 1 had 263 passed of 272, so this is +1 passed and +1 total, which is the new cross-org test. The 9 failures are the same set as attempt 1: `devices/handoffs.db.test.ts` ×7, `devices/devices.db.test.ts` ×1 (canReturn/canTakeBack), `members/manage.db.test.ts` ×1 (deactivate with release). Attempt 1 confirmed these are pre-existing on the base commit. None of them is in map-items or device-types.
  - `map-items-image.db.test.ts` run alone with the verbose reporter: 10/10 passed, including `another org sending this org's ETag never gets 304`.

### Finding 2 fix
- [x] The ETag is now org-specific and does not expose the org id. Evidence: `src/server/map-items/image.ts:181-184`. `mapItemEtag` returns `"<key>-<dir>-<version>-<12 hex of sha256(orgId)>"`, and `getMapItemImage` uses it at `:198`.
- [x] Org B sending org A's ETag never gets 304. Evidence: the DB test `another org sending this org's ETag never gets 304` passed. Both orgs are at version 1 for the same key and dir. With the old ETag format the two tags would be equal and B would get 304, so this test would fail without the fix. B gets `kind: "bytes"`.
- [x] The raw org id is not in the ETag. Evidence: `image.test.ts` ETag test (`not.toContain("org-1")`, and a different org gives a different tag). The DB test also asserts `not.toContain(a.orgId)`.
- [x] `Vary: Authorization` is sent on both 200 and 304. Evidence: `route.ts:19-23`, where `IMAGE_HEADERS` is spread into both responses. The route tests assert `Vary` on both. The constant lives in the server module because `routes-guarded.test.ts` forbids the header name in route files. That is a sensible reason.
- [x] Same-org revalidation still answers 304. Evidence: the DB test `get returns the bytes ...` (If-None-Match with the org's own tag gives `not_modified`) and the unit `If-None-Match match ...` test.
- [x] Device-type behaviour is unchanged. c81607c touches no file under `device-types` or `drive/image-flow`, and the device-type unit, route and DB suites pass. No client code builds or parses the ETag: a grep of `src/ui` and `src/lib` finds no ETag use.

### Issues
None.

### Rules (CLAUDE.md)
I found no violations. R1: `check:layers` is clean and the route imports only from `@/server/...`. R3: no secrets, and the ETag hash hides the org id. R4: c81607c changes only planned files plus `impl-log.md`. R5: the new logic has unit, route and DB tests. R7: unchanged, and no 401/403 is returned outside `withAuth`.

### Blockers from review agents
None. Security finding 🟡 2 is resolved by this attempt. Finding 🟡 1 (`toDto` null after the commit) stays a nit and follow-up, as in attempt 1.

### Nits (do not block)
- `src/server/map-items/map-items-image.db.test.ts`: the test name `get returns the bytes with ETag "<key>-<dir>-<version>"` still describes the old format. It should be renamed to say the ETag is org-specific.

### Follow-ups (out of scope)
- The device-type image ETag has the same cross-org shape. The impl-log notes this. The risk is low because the id is a UUID per org row, but adding `Vary: Authorization` there would be consistent.
- Still open from attempt 1: a BUG ticket for the 9 pre-existing `test:db` failures, and the 039.6 map-item copy for the image refusal codes.
