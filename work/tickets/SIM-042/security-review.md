# Security review — SIM-042

## Attempt 1

**PASS from a security standpoint.** I found no blockers. There is one should-fix item that does not block the merge, plus notes. Org scoping, the forward-only and expand-only shape, and the function's security attributes are all sound, and the reviewed files contain no secrets.

I worked with Read, Grep and Glob only, because no Bash tool was available. I could not run `git diff` against origin/main myself. I checked that the applied migration is untouched indirectly, see note 6.

### Findings

**🟡 should-fix (non-blocking): an org admin can make the shared migration abort for every org**
- Where: `db/migrations/20261126120000_map_items_new_builtin.sql:78-93`, together with the unique index at `20261125200000_map_items.sql:49`.
- Risk: the backfill only handles one name clash. It works because the conflict target is the primary key only (line 93). An Admin of any org can rename items today (`src/server/map-items/edit.ts:144`). If one org has two items named, say, `clock wall` and `clock wall (built-in)`, the insert raises 23505 and the whole migration fails for all orgs. The deploy is then blocked until someone fixes that org's data by hand. Nothing leaks across orgs and the previous image keeps running, so this is availability only and unlikely. It was accepted on purpose in plan A5 (`plan.md:188-189`).
- Fix (no code change): add a pre-release step to `work/ming-todo.md` that runs this query against production. Any rows returned mean that org must be renamed first, otherwise the migration will abort.
  ```sql
  select m.org_id, v.n from map_items m
   cross join (values ('bin trash'),('chart flip'),('clock wall'),('cooler water'),('lamp desk'),('screen projector')) v(n)
   where device_type_key(m.name) in (device_type_key(v.n), device_type_key(v.n || ' (built-in)'))
   group by m.org_id, v.n having count(*) = 2;
  ```

**🟢 notes (no action needed)**
1. **Org scoping (R6) is correct.**
   - Every inserted row carries `org_id`: `p_org` in the seed (`...new_builtin.sql:11-70`) and `c.org_id` in the backfill (`:79`).
   - The backfill starts only from `map_item_catalogs` (`:84`). Its name check is limited to the same org (`m.org_id = c.org_id`, `:81`). No data is read from another org.
   - Orgs not yet in `map_item_catalogs` are not backfilled. They get all 59 rows from the new function body when they are first seeded, either by the members trigger (`20261125200000_map_items.sql:120-126`) or by the layout save.
   - The layout save calls the seed only with the verified scope org (`src/server/layout/save.ts:81-85`, through `orgQuery`).
2. **The migration is forward-only and expand-only.**
   - It contains only `create or replace function` and one `insert ... on conflict do nothing`.
   - There is no `update`, `delete`, `alter`, `drop`, constraint or index change.
   - Existing rows, including renamed, hidden and deleted ones, stay as they are. schema-check covers this: snapshot equality, and a deleted `sofa` is not restored (`scripts/schema-check.mjs:141-152, 925-949`).
3. **Function security is unchanged.** `map_items_seed` keeps the same signature, `language plpgsql`, and no `security definer` (`...new_builtin.sql:7`, same as `20261125200000_map_items.sql:57`). `create or replace` keeps the existing owner and grants. No migration in the repo uses `security definer`, so the unqualified table names and the missing `set search_path` do not let anyone gain privileges.
4. **The seed's `on conflict do nothing` without a target (`:71`)** only runs when the catalog marker row was just inserted for a new org (`if found`, `:9-10`). A new org has no rows yet, so this cannot hide a clash or skip a row in an existing org.
5. **The constraints hold for every new row.** Keys match `map_items_builtin_key_check`. The longest name, "screen projector (built-in)", is 27 characters, within the limit of 60. All sizes are between 1 and 4.
6. **The applied migration appears untouched.** `20261125200000_map_items.sql:57-117` still lists exactly the original 53 rows, and `src/server/map-items/sql-sync.test.ts:45-47` asserts that count. Please confirm with `git diff origin/main --stat -- db/migrations/20261125200000_map_items.sql` (expected: no output).
   - Orchestrator check (2026-11-26): that command printed nothing (file unchanged).
7. **No secrets.**
   - `scripts/schema-check.mjs` has no inline database URL, password or key, and its fixtures are random UUIDs with an `@simap.example` email.
   - `src/lib/validate/layout.ts:46-68` adds only the five group names.
   - The keys.json changes are registry data with nothing sensitive.

### Follow-ups (out of scope)
- In a later ticket, consider making the clash handling in future backfills complete, so a second clash cannot abort a migration shared by all orgs. Options: a numbered suffix loop, or skipping with a NOTICE plus a report.

Files reviewed: `db/migrations/20261126120000_map_items_new_builtin.sql`, `db/migrations/20261125200000_map_items.sql`, `scripts/schema-check.mjs`, `src/lib/validate/layout.ts`, `src/server/layout/save.ts`, `src/server/map-items/sql-sync.test.ts`, `work/tickets/SIM-042/plan.md`.

## Attempt 2

**Result: PASS. No 🔴.** Nothing in the attempt-2 change affects my attempt-1 conclusions. The migration is as I reviewed it.

I had only Read, Grep and Glob, with no Bash, so I could not run `git diff` myself. I checked the current file contents against the line references in my attempt-1 review.

### Findings

**🟢 The attempt-2 change is test-only and has no security impact**
- `src/server/layout/layout.db.test.ts:368-382`: the test "a SIM-042 item saves rotated and reads back" now strips `id` from both sides and sorts by `sprite` before `toEqual` (`:378-381`).
- No production code changed. The read query is untouched, matching `work/tickets/SIM-042/impl-log.md:63` and its scope self-check at `:76`.
- The test file's imports (`:1-19`) are unchanged in kind: crypto, pg types, vitest, lib and server modules.
- The file has no DB URL, password, token or key.
- The impl-log lists no out-of-plan files (`impl-log.md:72-73`).

**🟢 The migration matches what I reviewed in attempt 1**
File: `db/migrations/20261126120000_map_items_new_builtin.sql`. Every line I cited in attempt 1 is still in place:
- The function signature is at `:7`: same signature, `language plpgsql`, no `security definer`.
- The catalog insert is `:9`, followed by the `if found` guard at `:10`.
- The seed has 59 rows at `:12-70`, all with `p_org`, ending in a targetless `on conflict do nothing` at `:71`.
- The backfill is at `:78-93`: `c.org_id` at `:79`; the same-org name check `m.org_id = c.org_id` at `:81`; it reads only from `map_item_catalogs` (`:84`); it inserts the six new rows (`:86-91`), with `on conflict (org_id, builtin_key) do nothing` at `:93`.
- It is still expand-only: there is no `update`, `delete`, `alter`, `drop`, constraint or index change.
- It has no secrets.

**🟡 Carried over from attempt 1, non-blocking and unchanged:** a second name clash in one org still aborts the shared migration for every org (`20261126120000_map_items_new_builtin.sql:78-93`).
- The fix is still the pre-release check in `work/ming-todo.md` that I recommended in `work/tickets/SIM-042/security-review.md:14-20`.
- Plan A5 accepts this risk on purpose.

### Follow-ups
- The follow-up from attempt 1 stands, and there is nothing new: make future backfills handle every name clash, so one org's data cannot abort a migration shared by all orgs.
