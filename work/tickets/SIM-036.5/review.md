## Attempt 1 — 2026-11-25
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format."
- `pnpm typecheck && pnpm check:layers` — exit 0, "check-layers: 632 files, no violations"
- `pnpm test` — exit 0, "Test Files 241 passed | 1 skipped (242); Tests 2375 passed | 7 skipped (2382)". Targeted re-run of
  `png.test.ts`, `read-bytes.test.ts`, `image.test.ts`, `src/app/api/device-types/` — 5 files, 50 tests passed.
- `pnpm build` — exit 0, "Compiled successfully"; route `ƒ /api/device-types/[id]/image` listed.
- `pnpm test:db` (local Postgres) — exit 0, "Test Files 15 passed (15); Tests 178 passed (178)" (15 = all `*.db.test.ts`,
  including the new `image.db.test.ts`).
- These match the impl-log summary exactly.

### Acceptance criteria
- [x] Upload accepts only a real 24 × 24 PNG of at most 20 KB, with 422 before any DB or Drive call. Evidence:
      `src/lib/validate/png.ts` (signature, bounds-checked chunk walk, CRC, IHDR first and length 13, IDAT required,
      `acTL` rejected, IEND last with nothing after it); `png.test.ts` (3 cases); `read-bytes.test.ts` (7 cases);
      `image-routes.test.ts › 422 cases: the service and getDrive are not called` (jpeg type, declared 20481, streamed
      20481, empty, HTML, 23×24). Route order at `[id]/image/route.ts` PUT: uuid, pool, `readBytes`, `validatePng`, then
      the service.
- [x] Replacing or removing an image deletes the old Drive file. Evidence: `image.test.ts › order is select, upload,
      tx(update CAS, audit), commit, delete old`, `› remove: commits … only then calls deleteFile(old)`;
      `image.db.test.ts › set again gives 2 and deletes the old file`, `› remove`; `device-types-routes.test.ts › DELETE
      type: the image file is discarded after commit, and not on a 404`; `image.db.test.ts › deleteDeviceType returns
      the image file id`.
- [x] Drive failures map to a fixed 5xx code. Evidence: `image.ts` `driveFailure` (only `images_unavailable` 503 /
      `drive_error` 502, others rethrown); `image.test.ts › every DriveCode and DriveConfigError maps to 502/503 …`
      (all 9 DriveCodes plus DriveConfigError, on upload and getFile, and checks that no DriveCode appears in the result).
- [x] `GET` returns bytes only to same-org members (404 across orgs). Evidence: `image.db.test.ts › cross-org: set, remove
      and get give 404 and make no Drive call`; `image-routes.test.ts › a user may GET`.
- [x] `GET` headers: ETag, `private, no-cache`, fixed `image/png`, `nosniff`, `inline`, `sandbox`, length. Evidence:
      `image-routes.test.ts › GET 200 headers` (the fake drive says `text/html`, which is not echoed) and `› GET 304`.
- [x] The server picks the file name. Evidence: `image.ts` upload name `devtype-${id}-${randomUUID()}.png`;
      `image.test.ts › upload name, mimeType and org come from the server`; the route test request carries
      `content-disposition: …filename=evil.html` and `x-filename` (`image-routes.test.ts:86-87`), and neither is read.
- [x] `drive_auth` and every other Drive failure map to 5xx, never 401/403. Evidence: same loop as above, with
      `DriveError(code, 401)` and an explicit `drive_auth` → `{502, drive_error}` case; DELETE paths are best-effort
      (`› remove: Drive off, throwing or misconfigured: still ok`).
- [x] Unit tests for `png.ts` and `readBytes`; handler tests with a fake `OrgDrive` (ordering, CAS, cleanup on failure,
      no Drive call on 422); DB tests for cross-org 404 and version bump. Evidence: the test files listed above pass.

Ming verification after merge (not reviewer-verifiable, needs M-46 production Drive secrets): as Admin, upload a 24 px
PNG with `PUT`, load it with `GET`, replace it, remove it, and check that the old files leave the org's Drive subfolder.
Until M-46, `PUT` answers 503 `images_unavailable`, which is expected.

### Issues
None.

### Rules (CLAUDE.md)
No violations found.
- R1: the new route imports only `@/server/*` and `@/lib/*`; `png.ts` is pure (its CRC table has no `node:` import); both new
  server files start with `import "server-only"`; `check:layers` is clean.
- R6: every SQL statement in `image.ts` goes through `orgQuery` with `org_id = $1`, and the Drive id always comes from the
  org-scoped row.
- R7: all handlers go through `withAuth`. After the wrapper the only codes are 404/409/422/502/503, and DELETE paths never
  surface a Drive error.
- R2: no schema change. R3: no new env names.
- R4 scope: every changed file is in the plan. The extra `export` on `Row`/`COLS`/`toDto` in the in-plan `device-types.ts`
  and the changed mock target in `device-types-routes.test.ts` are both recorded in the impl-log. `work/ming-todo.md`
  only ticks M-50 (workflow bookkeeping). No High path is touched.

### Blockers from review agents
None recorded at the time of this review. The `security-ai-generated-code-auditor` trigger fires (the diff changes
`src/server/`); the orchestrator adds its findings here.

Orchestrator: `security-review.md` Attempt 1 has no 🔴 and no 🟡, so the PASS stands. Its three 🟢 suggestions (delete the new file on a definite audit failure; allow-list PNG chunk types; read deadline in `readBytes`) are listed as follow-ups in the PR.

### Nits (do not block)
- `device-types-routes.test.ts` mocks `discardImageFile` itself, so the planned "a throwing Drive still gives 204" case is
  covered only through `image.test.ts › discardImageFile … never throws`, not at the route level. This is recorded in the
  impl-log.
- `setDeviceTypeImage`: when the CAS update matches 0 rows, `withTx` commits an empty transaction instead of rolling it
  back. Same effect.
- A3 as approved treats a failed `writeAudit` like an unknown COMMIT and keeps the new file. Inside `withTx`, an audit
  failure is in fact a definite rollback, so that file is a guaranteed orphan. The approved plan accepts it, and the
  orphan sweep will collect it.
- `ALL_CODES` in `image.test.ts` is a hand-written copy of `DriveCode`. A future code would not be added to the loop
  automatically, but `driveFailure` already falls back to 502 for any `DriveError`.

### Follow-ups (out of scope)
- Orphan Drive file sweep (already listed in the ticket as out of scope).
