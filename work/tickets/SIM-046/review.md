# Review — SIM-046

## Attempt 1 — 2026-11-26
Verdict: PASS

Slice 1 of 3 (server only). Reviewed `git diff origin/main...HEAD` (838257c on top of the plan commits).

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format."
- `pnpm typecheck` — exit 0, route types generated, tsc clean.
- `pnpm check:layers` — exit 0, "check-layers: 850 files, no violations".
- `pnpm test` — exit 0, "Test Files 323 passed | 1 skipped (324)", "Tests 3251 passed | 9 skipped (3260)".
- `pnpm build` — exit 0.
- `pnpm migrate:smoke` (local DB) — exit 0, "migrate smoke ok".
- `pnpm schema:check` (local DB) — exit 0, "schema check ok"; includes "pass: 1 later run applies members_photo" and the
  four "12 …" checks.
- `pnpm test:db` (local DB, run twice) — exit 0 both times, "Test Files 21 passed (21)", "Tests 329 passed (329)"
  (21 = every `src/**/*.db.test.ts`, so `photo.db.test.ts` is included).
- All of these match the numbers in impl-log.md attempt 1.

### Acceptance criteria
- [x] 1 Forward-only migration, previous image keeps working — evidence:
  `db/migrations/20261126130000_members_photo.sql` is a single `alter table members` with one nullable column, one
  `not null default 0` integer and the two named checks; no drop, rename, backfill or index. schema-check
  "12 member created before the migration has no photo, version 0", "12 bad Drive id refused (23514
  members_photo_check)", "12 negative version refused (23514 members_photo_version_check)", "12 valid id with version 1
  accepted" all pass; migrate:smoke green; existing members/manage DB tests untouched and green.
- [x] 2 Upload / replace / remove own photo; header and OQ-56 limits checked before any DB or storage call; 422 with a
  domain code — evidence: `src/app/api/me/photo/route.ts` PUT order readBytes → validatePhoto → strip → revalidate →
  getPool → setOwnPhoto; `photo-routes.test.ts` › "PUT refusals: 422 code, getPool and the service are not called"
  (wrong type, empty, declared and streamed 262145, truncated JPEG, 513 px, non-square PNG; asserts getPool, getDrive,
  setOwnPhoto never called); `photo.test.ts` (validator, lib) all format / size / structure cases;
  `photo.db.test.ts` › "first set", "replace", "remove own: idempotent".
- [x] 3 Org-scoped, server-chosen name, behind the bearer with ETag and `private, no-cache` — evidence:
  `src/server/members/photo.ts` upload name `photo-${id}-${randomUUID()}.${ext}` to `uploadOrgFile(scope.orgId, …)`;
  `photo.db.test.ts` › "first set: version 1, org-scoped server-chosen name, mime from the type" and "get: cross-org id
  404 with no Drive call …"; `photo-routes.test.ts` › "GET 200 headers …" (Content-Type from bytes, ETag, private
  no-cache, nosniff, inline, CSP sandbox, Content-Length), "GET 304 keeps ETag and Cache-Control", "no bearer gives 401
  on every handler".
- [x] 4 (server half) Never drawn on the room map — evidence: `git diff --stat origin/main...HEAD` touches nothing under
  `src/server/layout/**`, `src/lib/sprites/**`, `src/ui/roomlayout/**`. UI half is SIM-046.1 / SIM-046.2.
- [x] 5 Only OQ-61 rights — evidence: `src/app/api/members/[id]/photo/route.ts` exports only GET (`tier: "user"`) and
  DELETE (`tier: "manager"`); `photo-routes.test.ts` › "exports no PUT (405 from Next; OQ-61)", "DELETE as user gives
  403 from withAuth and the service is not called", "DELETE as manager and admin gives 204 with the actor and target";
  `photo.db.test.ts` › "manager removes another member's photo: audited with the manager as actor and self false".
- [x] 6 Audit without image bytes; tests cover validation and permissions — evidence: `photo.db.test.ts` › "audit
  meta: set is exactly version, self, type, bytes; remove is version and self; no ids or bytes" (meta `toEqual`
  exact, Drive id absent, every value ≤ 10 chars), plus the deactivated-race test asserting no audit row.

Ming verification after merge (not verified here; carry into the PR):
- After deploy, a real Drive round trip with a bearer client: PUT a ~250 KB JPEG to `/api/me/photo`, GET it, DELETE it;
  the file `photo-<memberId>-<uuid>.jpg` appears in the org Drive folder and disappears after the DELETE (proves the
  raised `DRIVE_MAX_BYTES` against the real Drive API).
- A device type image and a map item image still upload and load (shared Drive client).

### Scope
- Every changed file is in the plan's file list except the two listed under impl-log "Out-of-plan files":
  - `src/lib/api/error.ts:55` adds `"image_not_supported"` to `API_ERROR_CODES`. Justified: the plan's API contract
    names `image_not_supported` as a PUT refusal code, and `apiError` only accepts listed codes, so the plan cannot be
    built without it.
  - `src/ui/copy/api.ts:65` adds one message for it. Justified: `apiCopy.errors` is `satisfies Record<ApiErrorCode,
    string>`, so typecheck fails without the line. It conflicts with the plan sentence "no file in `src/ui/**` is
    touched", but it is a one-line forced consequence, it is not a SIM-044.1 / SIM-045.1 hotspot file, and the generic
    wording ("Use a PNG or JPEG image that is not animated.") does not mislead the device type surfaces (they never
    receive this code). Accepted.
- High paths touched: `db/migrations/20261126130000_members_photo.sql` only, which the plan named and Ming approved.
  `src/server/drive/client.ts` is not a High path (A6 accepted).

### Issues
None.

### Rules (CLAUDE.md)
No violations found.
- R1: `src/lib/validate/photo.ts` and `src/lib/members/photo.ts` are pure; `src/server/members/photo.ts` starts with
  `import "server-only"` and is imported only by the two route files; check:layers green.
- R2: expand-only migration, new file, nothing applied edited.
- R6: every query goes through `orgQuery` with `org_id = $1` (`photo.ts` selectRow and both updates; `photo.test.ts` ›
  "every org query filters org_id = $1 with the scope org first (R6)"); Drive ids are used only after the org-scoped
  row lookup.
- R7: 401/403 come only from `withAuth`; the deactivated race is 409 `not_allowed`; manager removal is a separate
  `tier: "manager"` handler; `photo.test.ts` › "Drive errors give 502 or 503, never 401 or 403".
- R3: no new env var; logs carry only `{event, op, code}` and `memberId` (no Drive id, sub or email).
- R4 / R5: in plan; new logic has tests.

### Blockers from review agents
None (orchestrator fills this in from security-review.md if the security trigger reports any).

### Nits (do not block)
- 💭 `src/lib/validate/photo.ts` stripPhotoMetadata (JPEG branch, copies "from the first SOS unchanged"): `parseJpeg`
  accepts APP1/APP13/COM segments between progressive scans or after the last scan, so metadata placed there survives
  the strip. Real encoders write Exif/XMP before the frame, and the behaviour matches the approved plan, so this is not
  a blocker; a later hardening could drop those segments after the first SOS too (they are length-prefixed segments,
  not entropy data).
- 💭 `src/server/request/read-bytes.ts:8` doc comment line is now over the 120-column style of the file (oxfmt does not
  rewrap comments); "exactly `type` (or one of the listed types)" could be rewrapped.
- 💭 `src/app/api/me/photo/route.ts` and `src/app/api/members/[id]/photo/route.ts` duplicate the 200/304 response
  builder; fine per the plan (no cross-route imports), but a shared helper in `src/server/http/` could serve all four
  image routes later.

### Follow-ups (out of scope)
- SIM-046.1 / SIM-046.2 as in the plan split.
- Photo UI copy for `image_bad_size` / `image_too_large` must use `PHOTO_LIMITS` (64–512 px, 256 KB), not the device
  type `IMAGE_LIMITS` text in `apiCopy.errors` (impl-log already notes this).
- Merge order: SIM-046 (`20261126130000`) before SIM-047 (`20261126140000`), or SIM-046 renames its migration (A11).
