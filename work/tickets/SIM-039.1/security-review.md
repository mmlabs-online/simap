## Attempt 1

## Security review: SIM-039.1, attempt 1. Verdict: no blockers, ready to PASS on security

I could not use Bash here, so I read the files named in the plan instead of running `git diff --name-only`. Files I read: `/home/user/simap/db/migrations/20261125200000_map_items.sql`, `/home/user/simap/src/app/api/map-items/route.ts`, `/home/user/simap/src/server/map-items/map-items.ts`, `/home/user/simap/src/server/layout/save.ts` (lines 30-110), `/home/user/simap/src/lib/map-items/library.ts`, `/home/user/simap/src/lib/validate/layout.ts`, `/home/user/simap/src/lib/sprites/resolve-layout.ts`, `/home/user/simap/src/server/http/with-auth.ts` and `/home/user/simap/src/server/http/org-scope.ts`. I did not open any `.env` file. I did not run the checks, so whether they are green (R5) still comes from the impl-log and the orchestrator's check run.

### Findings

**🔴 Blockers: none.**

**🟡 Should-fix: none.**

**🟢 Notes (all checked and OK):**

1. **R6, org scoping on queries and foreign keys.**
   - **The read:** `src/server/map-items/map-items.ts:71-77` uses `orgQuery`, and its guard (`org-scope.ts:21`) forces `org_id = $1`, bound to `scope.orgId` from the verified token. The request supplies no org.
   - **The safety net in the save:** `save.ts:74-78` calls the seed with `$1` = the token's org.
   - **The foreign keys:** `migration:149-152` has both FKs keyed on `(org_id, sprite_key)` → `map_items (org_id, builtin_key)`, so a placement cannot point at another org's catalog row.
   - **The catalog key:** the primary key is `(org_id, builtin_key)` and the unique name index leads with `org_id` (`:28`, `:49`).

2. **Hidden rows are only returned to Admins.** `route.ts:14` sets `includeHidden: ctx.tier === "admin"`. `ctx.tier` is built only from `tierFromOrgRoles(orgRoles)` (`with-auth.ts:69-71`). Nothing in the request can turn it on.

3. **R7, auth codes only before side effects.**
   - **The GET:** all 401/403 codes come from `withAuth` (`with-auth.ts:65-74`) before the handler runs. The handler itself only returns 503 or 200, has no side effects and sends `Cache-Control: no-store`.
   - **The save:** the new seed call (`save.ts:73-78`) runs after every refusal (404, 409 `layout_stale`, 422, 409 `layout_seats_changed` at lines 57-71) and inside the same transaction, so a refused save rolls it back. No 401/403 can follow it.

4. **No Drive file id or other internal data leaks.**
   - `COLS` (`map-items.ts:34-37`) selects only `(art_<d>_drive_file_id is not null) as art_<d>_has_image`, never the id itself. `toDto` returns `builtinKey`, `name`, `group`, `w`, `h`, `hidden`, the library facts and `art{sprite, hasImage, imageVersion}`.
   - The DTO carries no `org_id` and no timestamps.
   - The list is capped at 200 rows (`MAP_ITEM_LIMITS.list`).

5. **The cleanup only touches rows that are already not drawn (`migration:140-146`).**
   - **The keys match:** the seeded set (`LIBRARY_ITEMS`, locked to the SQL by `sql-sync.test.ts`) is a superset of every key the validator accepts. That is `desk.single` for seats (`validate/layout.ts:45`) and the base keys of `FIXTURE_GROUPS` for fixtures (`:46-63`, `:96-102`).
   - **Only undrawn rows are deleted:** `resolveLayout` checks each placement on its own (`resolve-layout.ts:68-99`, rule check at `:81`). A rejected item is dropped and takes no cells, so removing it cannot move any other item. A seat with an unknown key already goes to the waiting list (`:103-110`), which is the same result as the null placement the migration writes.
   - **The seat update passes the existing check:** it sets all four columns to null, which satisfies `seats_tile_placement_check` (`num_nonnulls ... in (0, 4)`).
   - **Legacy fixtures are kept:** rows with `sprite_key is null` are excluded.
   - **Every org with a placement gets a catalog before the delete:** the step 1 backfill covers every org in `rooms`, and fixtures and seats are tied to rooms by composite FK.
   - **Residual edge (not a risk):** a row with both a legacy `kind` and an unknown `sprite_key` would be deleted. The save path always writes `kind = null` for tile fixtures, so such a row could only come from hand-written SQL.

6. **Forward-only and expand-only (R2).** The migration only adds tables, functions, a trigger, FKs and an index. No existing migration is edited. The previous image keeps working: its saves only write keys the validator accepts, all of which are seeded, and its member inserts fire the new seed trigger.
   - **The FK check cannot fail on CHECK constraints:** a CHECK passes when its expression is NULL, so the ANDed art checks (`:34-43`) accept all-null rows and still reject any non-null value in the wrong format.

7. **Trigger and function security (search_path).**
   - **Not exploitable here:** `map_items_seed` and `members_seed_map_items` (`migration:57`, `:120`) are SECURITY INVOKER and have no `SET search_path`. Because they run with the caller's own rights, an attacker gains nothing by controlling the search_path. This matches the existing `device_types_seed` and trigger functions.
   - **Optional hardening (follow-up):** add `set search_path = public` (or schema-qualify `map_item_catalogs` and `map_items`) to these and future seed functions. This only matters if one of them is ever made SECURITY DEFINER.
   - **Lock order:** the save locks the room, then the seats, then the catalog marker (`insert ... on conflict do nothing`). That is consistent and has no deadlock cycle in this ticket. The plan already tells 039.2 not to lock rooms or seats after taking the marker.

8. **Availability of the member trigger.** Seeding now runs inside every first member insert, which happens in `withAuth`'s `memberGate`. A seed that violates a CHECK or the unique name index would make every new org's first request fail with 503. That risk is covered by `sql-sync.test.ts` and the `library.test.ts` check that names are unique and within length limits.

### Follow-ups (out of scope)
- Add `SET search_path` to the seed and trigger functions, or schema-qualify their tables, the next time those functions are touched.
- Per plan A10: adding a new library key to `keys.json` must ship with a migration that inserts it into every existing catalog. Without it, saves using that key fail on the FK (23503, returned as 500).
