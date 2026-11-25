# Impl log: SIM-039.7

## Attempt 1

### Files touched
- `db/migrations/20261125230000_device_type_sprite.sql` (new): nullable `sprite_key` + `device_types_sprite_key_check`; expand-only.
- `db/migrations/README.md`: one bullet. `scripts/schema-check.mjs`: check 9 (bad key refused, family/null accepted) + "later run applies device_type_sprite".
- `src/lib/validate/map-item.ts`: export `SPRITE_KEY_RE` (renamed from `SPRITE`).
- `src/lib/sprites/device-sprites.ts` (new): families, `deviceSpriteAllowed`, `deviceFrameKey`.
- `src/lib/sprites/device-slots.ts`: `packageSprite` art, resolution and key. `layout.ts`, `map-view.ts`: `SeatDeviceType.sprite` and parse.
- `src/lib/device-types/types.ts`, `src/lib/validate/device-type.ts`: DTO field, create/patch `sprite` (shape, 400).
- `src/server/device-types/device-types.ts`: 422 `sprite_not_allowed` before `inTx`, column, create/update/audit. `src/server/layout/layout.ts`: join reads `t.sprite_key` (same org-scoped query).
- UI: `src/ui/deviceTypes/device-type-sprite.ts`, `DeviceTypeSpriteField.tsx` (new), `device-type-form.ts`, `DeviceTypeFormDialog.tsx`, `DeviceTypesPage.tsx`, `src/ui/copy/deviceTypes.ts`.
- Tests (new): `device-sprites.test.ts`, `device-type-sprite.test.ts`, `DeviceTypeSpriteField.test.tsx`. Extended: `device-slots`, `map-view`, `device-type` validator, `device-types-routes`, `sql-sync`, `device-types.db`, `image.db`, `layout.db`, `DeviceTypeFormDialog`, `device-type-form`. Fixture-only (`sprite: null`): `placement`, `catalog-images`, `DeviceTypesView`, `device-type-save`, `image-url-cache`.

Product size: about 297 added lines (145 in modified product files, 152 in new files).

### Checks
- `pnpm format` then `format:check`: clean. `pnpm typecheck`: ok. `pnpm check:layers`: "805 files, no violations".
- `pnpm test`: 306 files passed, 1 skipped; 3088 passed, 7 skipped. `pnpm build`: exit 0.
- Local throwaway Postgres 16 (stopped and removed afterwards): `pnpm migrate` applied `20261125230000_device_type_sprite`; `pnpm migrate:smoke` ok; `pnpm schema:check` ok (new checks "9 bad sprite_key refused", "9 sprite_key family or null accepted" pass).
- `pnpm test:db`: 294 passed, 2 failed: `devices.db.test.ts` (canReturn/canTakeBack) and `members/manage.db.test.ts` (deactivate with release). Both fail identically on a clean `origin/main` worktree (288 passed, 2 failed), so pre-existing. `handoffs.db.test.ts` passed in both runs. All new DB tests pass.

### Deviations
- `FramePreview` lives in `src/ui/mapItems/`, not `roomlayout`; imported from `../mapItems/FramePreview` (ui to ui, R1 ok).
- The dialog also sends `sprite: null` on create (form default); harmless, validator accepts it.
- `DeviceTypeFormDialog.test.tsx` wiring test renders the whole dialog with `renderToStaticMarkup`, not only the fields.
- The "unknown family -> null" case for `deviceFrameKey` is in `device-sprites.test.ts`; map-view sprite parse test is a separate describe.

### Out-of-plan files
None.

### Follow-ups
- Pre-existing `test:db` failures in `devices.db.test.ts` and `members/manage.db.test.ts` on `origin/main`.
