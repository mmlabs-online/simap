# Security review: SIM-036.2

## Attempt 1 (slice 1: catalog, migration, CRUD, layout deviceType)

**Verdict: no 🔴 blockers and no 🟡 should-fix findings.** Code read only; no checks run by the auditor.

### Findings

🟢 **1. The seed and trigger functions have no pinned `search_path`.** `db/migrations/20261124160000_device_types.sql:37` (`device_types_seed`), `:52` (`members_seed_device_types`), `:7` (`device_type_key`).
- None of them is `SECURITY DEFINER`, so they run as the invoker, the `simap` role. Nobody can gain privileges through them.
- Unqualified names (`device_type_catalogs`, `device_types`, `lower`, `translate`) resolve through the caller's `search_path`. That only matters if an untrusted role can create objects in `public`, which isn't the case in the single-role `simap` DB.
- PG17+ maintenance runs (`REINDEX`/`VACUUM`/`ANALYZE`) use `search_path = pg_catalog, pg_temp`. `device_type_key` only calls pg_catalog built-ins, so the index keeps working.
- Optional hardening for a later migration (never edit this one, R2): `alter function ... set search_path = public, pg_catalog`. No action needed for this ticket.

🟢 **2. The `immutable` key relies on `lower()`, which depends on `lc_ctype`.** Migration `:7-11`, index `:28`.
- Vietnamese capitals are folded by the explicit `translate` map. Other scripts still go through `lower()`, which follows the DB locale.
- After a glibc/ICU collation change, `device_types_org_name_key` would need a `REINDEX`, like any expression index over `lower()`.
- This is an integrity/ops note, not an access-control issue. The plan already records the `lc_ctype` open point.

🟢 **3. The audit row for a slot change records no old or new slot.** `src/server/device-types/device-types.ts:157-160`. It logs `fields: ["slot"]` with no from/to, which is what plan.md:165 specifies, so it's not a deviation.

🟢 **4. Audit meta stores type names.** `device-types.ts:119, 159, 186`. `writeAudit`'s doc comment (`src/server/audit/write.ts:6`) says meta holds "codes, field names and counts only". Type names are Admin-entered labels, not secrets or personal data, and plan A11 approves them. Wording mismatch only.

🟢 **5. Device-type rows have no cleanup path when an org's data is removed.** Migration `:13-35`. No FK to an org table (there isn't one), so the rows stay if an org is ever purged. They are org-scoped, so nothing leaks.

### Verified clean
- **R6 org scoping:** all queries in `device-types.ts` (lines 71, 89, 94, 99, 107-110, 137, 148-149, 177) and `writeAudit` go through `orgQuery`, with `$1` taken from `ctx.scope`.
  - INSERTs use the `select ... from (select $1::uuid as org_id) o` form, so `org_id` always comes from the token's org, never from the body.
  - Update and delete filter `org_id = $1 and id = $2`, so another org's id gets 404 `not_found` (no oracle).
  - The layout join (`src/server/layout/layout.ts:115-116`) puts `t.org_id = $1` in the ON clause.
- **Admin-only writes:** POST (`src/app/api/device-types/route.ts:36`) and PATCH/DELETE (`[id]/route.ts:28, 41`) use `withAuth { tier: "admin" }`. GET uses `user` (D61). Tier comes only from `orgRoles`.
- **R7:** 401/403 come only from the wrapper, before the handler. Handlers return 400/404/409/503 only; a bad uuid gets 404 before any DB access. Unique violations map narrowly by constraint name to 409 `name_taken` (`pg-error.ts:8`); anything else becomes 500 `internal`.
- **Per-org cap under concurrency:** holds under READ COMMITTED (marker `on conflict do nothing`, then `select ... for update` on the marker row, then `count(*)` after the lock, then insert). The trigger seed path inserts only when it newly creates the marker. List `limit 100` matches the cap.
- **The Drive file id is never exposed:** `COLS` (`device-types.ts:53`) and the layout query (`layout.ts:108`) return only `has_image`; the DTOs have no id field; `device_types_image_check` constrains future values.
- **Expand-only, forward-only migration:** new function, tables, index and trigger only; the AFTER trigger writes only to the new tables, so the previous image keeps working; the backfill is idempotent.
- **Audit rows:** create, update and delete each write one row in the same transaction; a no-op PATCH writes none; the seed writes none (A11).
- **Input validation** (`src/lib/validate/device-type.ts`): body capped at 1024 bytes, unknown keys refused, names NFC + whitespace-collapsed + 1..60 code points with `\p{Cc}`/`\p{Cf}` refused, slot allow-list, empty PATCH refused; all SQL parameterized.
- **R3:** no secrets, env values or tokens in the changed code.
- **R1:** routes import `@/server/**` and `@/lib/**`; lib imports only lib; server files start with `import "server-only"`.
- **`scripts/schema-check.mjs`:** section 9 works only on `randomUUID()` orgs or the script's own fixture orgs.

### Follow-ups (out of scope)
- A later migration could pin `search_path` on `device_type_key`, `device_types_seed` and `members_seed_device_types` (note 1).
- Record the old and new slot in `device_type.update` audit meta (note 3).
- Align the `writeAudit` meta doc comment with the label values it now stores (note 4).
- Clean up `device_types`/`device_type_catalogs` when an org purge path exists (note 5).
