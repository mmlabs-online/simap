# Review: SIM-039.7

## Attempt 1 — 2026-11-25
Verdict: REWORK

Reviewed commit 36ad730 (`git diff origin/main...HEAD`, branch `claude/modest-allen-yru4g8`).

### Checks (run by reviewer)
- `pnpm typecheck` — exit 0.
- `pnpm check:layers` — exit 0, "check-layers: 805 files, no violations".
- `pnpm format:check` — exit 0.
- `pnpm test` — exit 0, "Test Files 306 passed | 1 skipped (307); Tests 3088 passed | 7 skipped (3095)".
- `pnpm build` — exit 0.
- Throwaway local Postgres 16 (127.0.0.1, under /var/tmp, stopped and removed afterwards):
  - `pnpm migrate:smoke` — exit 0, "migrate smoke ok".
  - `pnpm migrate` — exit 0, "applied 20261125230000_device_type_sprite (4 ms)".
  - `pnpm schema:check` — exit 0, "schema check ok"; includes "pass: 1 later run applies device_type_sprite",
    "pass: 9 bad sprite_key refused (23514 device_types_sprite_key_check)", "pass: 9 sprite_key family or null accepted".
  - `pnpm test:db` — exit 1, "Tests 2 failed | 294 passed (296)". The 2 failures are
    `devices.db.test.ts` > "canReturn ... canTakeBack ..." (`device_handoffs_decided_check` violation at
    devices.db.test.ts:888) and `members/manage.db.test.ts` > "deactivate with release ..." (unexpected
    `cancelledHandoffs: 0` key). Re-run on a clean `origin/main` worktree against the same cluster: the same 2 fail
    ("Tests 2 failed | 288 passed (290)"). Both are handoff-related; this diff touches neither file nor any handoff
    code. Pre-existing, unrelated. All new and changed DB tests in this diff pass.
- Implementer's numbers in impl-log.md match my runs.

### Acceptance criteria
- [x] 1 Picked sprite drawn on desks, facing the desk for directional families — `device-slots.ts:90` (packageSprite),
  `:146` (`deviceFrameKey(art.family, dir)`); `device-slots.test.ts` > "placeDevices packageSprite" > "directional family
  follows the desk", "non-directional family draws its own key"; `layout.db.test.ts` > "seat devices carry the type's
  sprite (null when none)". All pass.
- [x] 2 Image wins; placeholder while not ready; removal reveals pick — `device-slots.test.ts` > "image wins over sprite;
  image not ready with sprite: placeholder"; `image.db.test.ts` > "image set and clear keep sprite_key". Pass.
- [x] 3 Fallback to slot sprite for no pick / unknown family — `device-sprites.test.ts` > "deviceFrameKey" (unknown ->
  null); `device-slots.test.ts` > "unknown family falls back to the slot sprite". Pass.
- [x] 4 Set/change/clear on PATCH, set on POST; 400 shape, 422 before any write — validator `device-type.ts` (sprite on
  create/patch), `device-type.test.ts` > "sprite on create and patch"; `device-types-routes.test.ts` > "sprite: PATCH and
  POST forward it; bad shape 400 without service call; 422 mapped"; `device-types.db.test.ts:178` "sprite refused ...
  row and audit unchanged" (also proves the combined `name` change is not applied). 422 returned at
  `device-types.ts:93-94` / `:144-145`, before `inTx` at `:95` / `:146`.
- [x] 5 Org scoping — `device-types.db.test.ts:204` "sprite patch with another org's id -> 404, row unchanged"; layout
  join keeps `t.org_id = $1` (`layout.ts:147`).
- [x] 6 Audit — `device-types.db.test.ts:156` (fields `["sprite"]`, `meta.sprite {from,to}`, no row when unchanged),
  `:218` (create meta has `sprite`; slot change keeps the pick). Existing 401/403 route tests unchanged and green.
- [x] 7 Dialog picker — `DeviceTypeSpriteField.test.tsx`, `device-type-sprite.test.ts`, `DeviceTypeFormDialog.test.tsx`
  > "DeviceTypeFormDialog sprite wiring". Pass. (The save path from this picker is untested, see Issue 1.)
- [x] 8 Migration expand-only, constraint works — `20261125230000_device_type_sprite.sql` (one nullable column, no
  default, check only); `sql-sync.test.ts` > "sprite migration"; `schema:check` section 9 passes.
- [x] 9 Checks green — see above (test:db failures are pre-existing on `origin/main`).

### Issues
#### Issue 1 — 🔴 blocker — missing planned test (R5)
- **Where**: `src/ui/deviceTypes/device-type-form.ts:47` (new logic) vs `src/ui/deviceTypes/device-type-form.test.ts:42-68`
  (`describe("toPatchBody")`).
- **Expected**: plan.md "Tests to write" row `device-type-form.test.ts` > "toPatchBody sends sprite only when changed;
  clear sends null" (the changed-fields-only / lost-update guard for the new field). impl-log lists this file as
  "Extended".
- **Actual**: the file only got `sprite: null` added to existing fixtures. No test exercises a changed sprite in
  `toPatchBody`; `device-type-save.test.ts` does not either. Nothing would catch a regression where the dialog never
  sends the pick or always sends it. The deviation is not recorded in impl-log.
- **Fix instruction**: add `it("toPatchBody sends sprite only when changed; clear sends null")` to the `toPatchBody`
  describe in `device-type-form.test.ts`, asserting at least:
  `toPatchBody({ name: "Máy in", slot: "other", sprite: "device.pc" }, type)` -> `{ kind: "ok", body: { sprite: "device.pc" } }`;
  with `type = { ...type, sprite: "device.pc" }` and form sprite `null` -> `{ kind: "ok", body: { sprite: null } }`;
  form sprite equal to `type.sprite` (non-null) with name/slot unchanged -> `{ kind: "unchanged" }`;
  a name change with the same non-null sprite -> body has `name` only (no `sprite` key).
  No product code change needed. Update impl-log accordingly.

### Rules (CLAUDE.md)
- R1: no violations (`check:layers` clean; ui imports `@/lib/*` and `../` ui modules only; server imports
  `@/lib/sprites/device-sprites`, allowed).
- R2: new forward-only file, expand-only (nullable column + check, no default/backfill); no applied migration edited.
- R6: all new SQL goes through `orgQuery` with `org_id = $1` (`device-types.ts` update/insert, `layout.ts:147`);
  cross-org DB test present.
- R7: 422 `sprite_not_allowed` returned before `inTx` (no write/audit); no new 401/403 outside `withAuth`; route files
  untouched.
- R3: no config. R4: within plan (see nit on one fixture file). D36: all new copy in `src/ui/copy/deviceTypes.ts`;
  no literal strings in the new TSX.
- R5: violated, see Issue 1.

### Blockers from review agents
- `security-review.md` (attempt 1): "no blockers". None.

### Nits (do not block)
- `src/ui/deviceTypes/image-url-cache.test.ts:11` (fixture `sprite: null`) is not in the plan's fixture list and
  impl-log says "Out-of-plan files: None". It is a required-field fixture of the same kind, so fine, but list it under
  Out-of-plan files for accuracy.
- A non-allowed sprite on a cross-org id returns 422 rather than 404 (check runs before the lookup). No data leaks and
  no write; acceptable as planned.

### Follow-ups (out of scope)
- Pre-existing `test:db` failures on `origin/main`: `devices.db.test.ts` canReturn/canTakeBack
  (`device_handoffs_decided_check`) and `members/manage.db.test.ts` deactivate-with-release (`cancelledHandoffs` key).
  Likely from the SIM-037.x handoff changes; needs its own BUG ticket.
- Plan A9: pick not shown in the device types list thumbnail, Devices page or seat popup.

## Attempt 2 — 2026-11-25
Verdict: PASS

Reviewed HEAD b040224 (fix commit 46d3706). `git diff --stat 36ad730..HEAD`: only
`src/ui/deviceTypes/device-type-form.test.ts` (+17) and `work/tickets/SIM-039.7/*` changed; no product, server, SQL or
migration file changed since attempt 1, so the attempt-1 DB check results stand.

### Checks (run by reviewer)
- `pnpm typecheck` — exit 0.
- `pnpm check:layers` — exit 0, "check-layers: 805 files, no violations".
- `pnpm format:check` — exit 0, "All matched files use the correct format."
- `pnpm test` — exit 0, "Test Files 306 passed | 1 skipped (307); Tests 3089 passed | 7 skipped (3096)" (+1 test vs
  attempt 1, the new one). `device-type-form.test.ts` alone: 8 passed.
- `pnpm build` — exit 0.
- Implementer's numbers in impl-log.md Attempt 2 match my runs.

### Issue 1 (attempt 1) — fixed
`device-type-form.test.ts:69-85` > "toPatchBody sends sprite only when changed; clear sends null" asserts all four
requested cases against the fixture (`name "Máy in"`, `slot "other"`, `sprite null`):
- set: form sprite `device.pc` -> `{ kind: "ok", body: { sprite: "device.pc" } }`;
- clear: type sprite `device.pc`, form `null` -> `{ kind: "ok", body: { sprite: null } }`;
- unchanged non-null: same sprite, name/slot unchanged -> `{ kind: "unchanged" }`;
- name change with same non-null sprite -> `{ kind: "ok", body: { name: "Scanner" } }`, plus an explicit
  `"sprite" in body === false` check.
Against `device-type-form.ts:47` (`if (form.sprite !== type.sprite) changed.sprite = form.sprite;`): dropping that line
fails the set/clear cases; always sending the sprite fails the unchanged and rename cases. The guard is now covered.

### Nit (attempt 1) — fixed
impl-log.md Attempt 2 lists `src/ui/deviceTypes/image-url-cache.test.ts` under "Out-of-plan files (correction to
attempt 1)".

### Acceptance criteria
- 1-9 unchanged from attempt 1 (all met); criterion 7's save path is now covered by the test above.

### Rules (CLAUDE.md)
- R1-R7: no change from attempt 1; R5 now satisfied. R4: the only new change is the planned test file.

### Nits (do not block)
- None new.

### Follow-ups (out of scope)
- Same as attempt 1 (pre-existing `test:db` handoff failures on `origin/main`; plan A9 thumbnails elsewhere).
