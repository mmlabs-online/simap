# SIM-039.7 security review

## Attempt 1

## Security review: SIM-039.7, attempt 1 (commit 36ad730)

**Verdict: no blockers and nothing to fix before merge. Every requested check is 🟢.**

### Findings

**🟢 Authorization: only Admins can write**
- `POST` uses `withAuth(..., { tier: "admin" })` at `src/app/api/device-types/route.ts:24-37`.
- `PATCH` is admin tier at `src/app/api/device-types/[id]/route.ts:16-31`, and `DELETE` is admin tier at `:33-45`.
- `GET` (list) is user tier at `route.ts:13-22`. That matches D61: any member may read the catalog. The `sprite` field it now returns is just a public sprite family name, so nothing sensitive is exposed.
- Validation errors return 400 `invalid_request`, never 401/403.

**🟢 Org scoping (R6)**
Every new or changed query goes through `orgQuery` with `org_id = $1`:
- create insert: `src/server/device-types/device-types.ts:115-123`
- select `for update`: `:147-152`
- update `where org_id = $1 and id = $2`: `:159-170`
- list: `:77-82`
- audit insert: `src/server/audit/write.ts:19-31`
- The layout join adds `t.sprite_key` to a join that is already scoped on both sides: `left join device_types t on t.org_id = $1 ...` and the inner `devices where org_id = $1` (`src/server/layout/layout.ts:137-149`). No other org's sprite pick can leak in.

**🟢 Input validation and injection through the sprite key**
The key is checked at four separate points:
1. **Format (400):** `SPRITE_KEY_RE = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,119}$/` (`src/lib/validate/map-item.ts:16`), applied in `src/lib/validate/device-type.ts:30-31`. Only a string or `null` gets through, and unknown body keys are refused (`:35`, `:54`).
2. **Allow-list (422):** `deviceSpriteAllowed` (`src/lib/sprites/device-sprites.ts:16-17`) uses `Array.includes` against families taken from `REGISTRY` (only 1x1 `device` group frames). It does not do an `in`/property lookup, so keys like `__proto__` or `constructor` cannot get through.
3. **DB CHECK:** `db/migrations/20261125230000_device_type_sprite.sql:9-10` is the same regex as the code, and `sql-sync.test.ts:31-36` keeps the two in sync.
4. **Client re-check:** `map-view.ts:81` runs the regex again on the layout response. `deviceFrameKey` (`device-sprites.ts:20-24`, called from `device-slots.ts:146`) runs the allow-list again before anything is drawn, and an unknown family falls back to the slot's built-in sprite. So a stale or tampered value can only pick a registry atlas frame.

Where the key is used:
- **SQL:** always a bound parameter (`$4::text` at `device-types.ts:119`, `$5` at `:162`). Never interpolated.
- **URLs:** none. It is not used in any URL or `fetch`. Image URLs still come from `id`/`imageVersion`.
- **Canvas:** used only as an atlas frame-key lookup after the allow-list check.
- **UI:** the stored "unavailable" value is rendered as escaped JSX text (`DeviceTypeSpriteField.tsx:37-39`). There is no `dangerouslySetInnerHTML` under `src/ui/deviceTypes`.

**🟢 The 422 refusal comes before any write (R7)**
`spriteRefused` returns before `inTx` is entered, in both `createDeviceType` (`device-types.ts:93-94`) and `updateDeviceType` (`:144-145`). So no transaction, lock, seed call or audit row happens on a refusal. It is a domain 422 (`sprite_not_allowed`), not a 401/403, so `apiFetch` will not re-send it.

**🟢 Audit entries**
- Create adds `sprite` to `meta` when it is set (`device-types.ts:130`).
- Update adds `"sprite"` to `fields` plus `sprite: { from, to }` (`:180`, `:183`). It only writes when something actually changed (`:155-158`).
- Both are written inside the same transaction as the change. The values are public registry family names, not secrets.

**🟢 Defaults are safe**
- The column is nullable with no default and no backfill (`migration:8`). `null` means the slot's built-in sprite, so the previous image keeps working (expand-only, R2).
- `ADD CONSTRAINT CHECK` validates existing rows, but they are all `null`, so it passes. It only takes a short lock on `device_types`.
- The PATCH form sends `sprite` only when it changed (`src/ui/deviceTypes/device-type-form.ts:47`). So if a family is later removed from the registry, renaming a type that still holds that old pick is not refused with 422.

**🟢 Secrets**
The diff adds no credentials, env reads or client-exposed env names. `src/ui/deviceTypes` has no `process.env`, and the client-side sprite code in `src/lib/sprites/*` is pure registry data.

### Notes (non-blocking, no action needed)
- In the layout join, `t.sprite_key` is read without the `left(..., 129)` cap used on the seat and fixture `sprite_key` (`layout.ts:139` vs `:79`, `:89`). The DB CHECK already limits it to 120 characters, so this is only a consistency gap.
- `updateDeviceType` runs the allow-list check even when the PATCH repeats the stored value unchanged (`device-types.ts:144`). The UI never sends an unchanged sprite, but a direct API client sending one for a removed family would get 422. That is acceptable.

### Follow-ups
None from security.
