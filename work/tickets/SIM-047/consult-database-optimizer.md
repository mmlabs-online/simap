# Consult — database-optimizer — SIM-047

## Findings
- `members` (init.sql lines 37-57) has org_id not null, unique (org_id,sub), unique (org_id,id), and enums as text+check (`members_status_check`). Naming convention: `members_<col>_check`. The precedent for adding a member column is `20261120190000_members_profile_confirmed_at.sql`: one nullable column, no default, no backfill, and a header comment saying "previous image never reads or writes it". `db/migrations/README.md` has a per-column bullet (line ~37) that this ticket should extend.
- The derived look is `avatarFor(sub)` in `src/lib/sprites/avatar.ts`. It returns {skin, hair, shirt, style}. The ramps are colour hex arrays: SKIN 4, HAIR 6, SHIRT 7. `style` is 1|2|3. Everything is stored as hex strings, not indices, in code.
- The existing member reads use `COLS = "id, display_name, status, profile_confirmed_at"` in `src/server/members/members.ts`. Updates are `update members ... where org_id=$1 and sub=$2`. Follow that pattern for R6.
- `scripts/schema-check.mjs` has generic catalogue checks that need no change: every table has org_id not null, every FK has org_id, and every unique key includes org_id. A column-only addition passes them. It inserts members with only (org_id, sub, email, display_name), so a nullable column with no default keeps those inserts valid. The seed counts are table-level, so they are unaffected.
- The spec Member entity (line 130) says "pixel character look (optional; preset part per layer)". POR-06 says "no stored look = derived", and that the server accepts only presets (422).

## Recommendations
1. **Storage: use one nullable jsonb column, `pixel_look`, with a check. This is the call I would make; both options work.** Reasons:
   - null = derived look is a single, atomic state. With 4 separate nullable columns you need an extra "all null or all set" check to avoid half-set looks, because a partial look has no defined meaning (the picker saves all four layers).
   - Reset is `set pixel_look = null`.
   - It is one expand step. If a new layer is added later (the "more parts only with new art" case), the jsonb needs no further migration, only a check change.
   - The SIM-046 columns stay untouched.
   - Cost: the preset check lives in two places (SQL and the TS validator), and jsonb checks are less readable. Keep the DB check structural, as a backstop, and keep the preset enforcement in the TS validator in `src/lib/validate/`.
   - Alternative if Ming prefers flat columns: `skin_idx`, `hair_idx`, `hair_style`, `shirt_idx` as smallint, each with a range check, plus one `num_nonnulls(...) in (0,4)` check. This is more verbose but gives per-column constraints.
2. **Store preset indices, not hex strings.** The ramps are code constants. Indices survive a later palette tweak, and a hex check in SQL would freeze the palette. The shape is `{"skin":0-3,"hair":0-5,"style":1-3,"shirt":0-6}`. The tradeoff is that reordering or inserting into a ramp changes everyone's look. So add a comment and a unit test that pins ramp lengths and order, and append-only extension. Suggested check:
   ```sql
   alter table members add column pixel_look jsonb null;
   alter table members add constraint members_pixel_look_check check (
     pixel_look is null or (
       jsonb_typeof(pixel_look) = 'object'
       and (select array_agg(k order by k) from jsonb_object_keys(pixel_look) k) = array['hair','shirt','skin','style']
       and jsonb_typeof(pixel_look->'skin') = 'number' and (pixel_look->>'skin') ~ '^[0-3]$'
       and (pixel_look->>'hair') ~ '^[0-5]$'
       and (pixel_look->>'shirt') ~ '^[0-6]$'
       and (pixel_look->>'style') ~ '^[1-3]$'));
   ```
   Subqueries are not allowed in check constraints. So for the exact-keys test use `pixel_look ?& array['skin','hair','shirt','style'] and (select count(*) ...)`, which also fails. Instead use `pixel_look - 'skin' - 'hair' - 'shirt' - 'style' = '{}'::jsonb`, which is a plain immutable expression. The regex tests on `->>` also reject floats such as "1.5" and strings. A JSON string "2" would pass `->>` regex, so also add `jsonb_typeof(...) = 'number'` for each key.
   - **Be sure the constraint is added in the same migration file, and test it with the DB suite.** `add column` plus `add constraint` on a fresh null column is cheap: the constraint validates against all-null rows.
3. **Migration file `db/migrations/20261126140000_members_pixel_look.sql`.** Forward-only, with a header comment in the SIM-007 style. It touches only `pixel_look` and its constraint, with no defaults, no backfill, and no data rewrite. The previous image never reads or writes the column and its `COLS` does not select it, so rolling back the image is safe (R2). Add a bullet to `db/migrations/README.md` next to the `profile_confirmed_at` bullet. Do not edit SIM-046's migration or README bullet text. Expect a README merge conflict with SIM-046 and resolve it by keeping both bullets.
4. **API.** Writes go through a PATCH or PUT under the caller's own member: `update members set pixel_look = $3, updated_at = now() where org_id=$1 and sub=$2` (R6). Reset sends null. Also write one `audit_log` row in the same transaction, with meta holding before and after (indices or null). Return 422 for non-preset values. All 401/403 handling stays in the auth wrapper before any write (R7). Only add `pixel_look` to the member DTO and to the layout occupant query. Do not add it to `COLS` blindly, because `COLS` feeds the `needsProfile` DTO.
5. **Layout fallback.** Resolve the look in one pure function in `src/lib/sprites/` (for example `resolveLook(stored, sub)`). It returns the stored look mapped through the ramps, or `avatarFor(sub)` if null. Defend against an unexpected stored value (out-of-range index) by falling back to derived rather than crashing, since the DB check is the backstop but not the only guard. The layout query must read `pixel_look` filtered by `org_id`. Tests: validator, resolve (stored/null/garbage), audit meta.
6. **schema:check additions.**
   - Valid insert and update of `pixel_look` succeeds.
   - Rejected: `{}`, a missing key, an extra key, an out-of-range index (skin 4, hair 6, shirt 7, style 0 or 4), a string value, a float, a non-object (array, number), each with `code '23514'` and constraint `members_pixel_look_check`.
   - A member created without it reads null.
   - Use the existing `tx` helper pattern (lines ~242-258).
   - Keep the existing catalogue checks as they are.

## Risks
- **Ramp reorder changes looks.** With index storage, a reordered or shortened ramp silently alters stored looks. Mitigate with a test that pins the ramps and with the "append only" comment.
- **Migration ordering.** `db/migrator.js` refuses a pending migration older than the newest applied. 20261126140000 is later than SIM-046's 20261126130000, so it works only if SIM-046 merges first (or both apply together). If SIM-047 is deployed to a DB before SIM-046's migration is applied, SIM-046 would be refused afterwards. Merge order is the control.
- **Shared-file conflicts with SIM-046.** `members.ts` and the README will conflict on rebase. Keep SIM-047 edits additive.
- **Check-constraint complexity.** The jsonb check is easy to get wrong, so the DB test cases above are required (R5). A mistake would make the migration fail on apply.
- **High path.** The migration needs plan approval from Ming.
- **Privacy and visibility.** The look is visible to every viewer of the map, but it is a preset choice with no PII.

## Open questions
1. jsonb with indices (recommended) or four flat columns? Should hex be stored instead of indices?
2. OQ-61 (spec ~line 845) says by default only the member changes their own look. Confirm there is no Admin override, and so no audit-actor difference.
3. The audit action name and meta shape (SYS-03): does the existing audit helper have a naming scheme, for example `member.pixel_look.set` and `.reset`?
4. Does the deactivated-member state block editing? I would guess it does, via the auth wrapper's `member_deactivated`.
5. Should a user who sets a look equal to their derived look store it, or normalise to null? I suggest storing it as chosen, because the derived look follows `sub` and would not change, but this is a minor choice.

Files: `db/migrations/20261120150000_init.sql`, `db/migrations/20261120190000_members_profile_confirmed_at.sql`, `db/migrations/README.md`, `src/lib/sprites/avatar.ts`, `src/server/members/members.ts`, `scripts/schema-check.mjs`, `docs/spec-v1.md` (lines 130, 591-599).
