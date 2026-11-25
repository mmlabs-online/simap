## Attempt 1

## Security review: SIM-039.2 (map item admin write routes), attempt 1

**Verdict: no blockers. 0 🔴, 1 🟡, 4 🟢 notes.** I read the code only; I could not run any commands in this environment. I did not read any `.env` file.

### Findings

**🟡 1. A fixed-size item can be resized under the weaker lock.** `/home/user/simap/src/server/map-items/edit.ts:177-185`, `:193` and `:272`, `:284`
- **Where it happens:** `mayResize` is false for any `lib.fixedSize` item. `resetMapItem` also locks with `!lib.fixedSize`. Both rely on the stored `w/h` of a fixed-size item always equalling the library size.
- **The risk:** if a stored row differs (old seed data or a manual SQL fix), a PATCH that sends the library size, or a reset, goes past the `applySize` early return. The size change then runs under `for no key update`. That lock does not conflict with the KEY SHARE lock a concurrent placement insert takes on the foreign key. So the in-use count can miss an uncommitted placement, which is the race the plan says it closes.
- **How likely:** low. Nothing in this ticket writes such a row.
- **Fix:** compute `mayResize` from the requested size against the current row, not from `lib.fixedSize`. The simplest form: lock `for update` whenever the patch has `w`/`h`, and always for reset. Or keep the current lock and, inside `applySize`, throw `Abort(refuse(422,"item_fixed_size"))` when `lib.fixedSize` and the size would change, so a fixed item is never resized under the weaker lock.

**🟢 2. The Drive orphan log has the key but no org.** `/home/user/simap/src/server/map-items/drive-cleanup.ts:16`
- Logging only `{event,key}` is correct: no file id, no error text, nothing secret.
- The trade-off: an operator cannot tell which org's file was orphaned. Files carry `appProperties.orgId`, so this can be recovered later.
- Possible follow-up: add `orgId` from `scope`. It is not a secret, but that is a product decision.

**🟢 3. The audit meta stores admin-entered names.** `/home/user/simap/src/server/map-items/edit.ts:212-213`
- It records `name`/`group` `{from,to}`. `writeAudit` says meta holds "codes, field names and counts only" (`/home/user/simap/src/server/audit/write.ts:6`).
- There is precedent: `device-types.ts:159` and `devices.ts:409` do the same. Catalog item names are not PII.
- No Drive id reaches the audit meta: `imagesDeleted` is a count, and `art_set` stores frame keys. `map-items-edit.db.test.ts:266` asserts that.
- Acceptable as is.

**🟢 4. Missing test: no-op PATCH while a Drive file is set.** `/home/user/simap/src/server/map-items/edit.ts:195`, `:247`, `:285`
- On a no-op, `toDto(row)` gets the locked row, which includes `art_*_drive_file_id`.
- This is safe today: `toDto` (`/home/user/simap/src/server/map-items/map-items.ts:40-62`) copies named fields only and exposes `hasImage`, never the id.
- Optional test to guard against a future spread in `toDto`: a no-op PATCH with a Drive id set by SQL, then assert the response JSON does not contain it.

**🟢 5. The checks you asked about all pass:**
- **Admin-only, through the wrapper:** all three routes use `withAuth(..., { tier: "admin" })`:
  - `/home/user/simap/src/app/api/map-items/[key]/route.ts:22-38`
  - `/home/user/simap/src/app/api/map-items/[key]/reset/route.ts:20-32`
  - `/home/user/simap/src/app/api/map-items/[key]/art/[dir]/route.ts:13-29`

  The wrapper checks token, org, tier and member status before calling the handler (`/home/user/simap/src/server/http/with-auth.ts:57-81`).
- **R7:** handlers return only 200/400/404/409/422/503. A failure after commit becomes 500 from the wrapper, never 401/403.
- **R6:** every statement in `edit.ts` goes through `orgQuery` with `org_id = $1` (lock read :96, both UNION branches :117-118, update :149, audit insert in `write.ts`). The org comes only from `ctx.scope`. Drive ids are read only from that org's row, as the `OrgDrive` contract requires.
- **Validation:**
  - The key path param is checked against the DB regex with length ≤100. `dir` is checked against an n/e/s/w allowlist. Both run before `getPool`.
  - The body is capped at 1024 bytes, rejects unknown keys and must not be empty.
  - Name/group are NFC-normalised with whitespace collapsed, refuse control and format characters (including bidi overrides), and are limited by code points.
  - Sizes must be integers from 1 to 4.
  - Sprite keys are checked with `Object.hasOwn(REGISTRY, …)`, so `__proto__`/`constructor` cannot slip through. `libraryItem` uses a `Map`.
- **Drive ids are never returned:** `COLS` selects only `(drive_file_id is not null) as has_image`, and `toDto` copies explicit fields.
- **Drive cleanup only after commit:** `withTx` resolves before `inTx` returns, and the routes call `discardMapItemFiles` only on `r.ok`, after the service. A refusal or rollback deletes nothing. The cleanup never throws.
- **Lock order:**
  - Locks are taken only on the one `map_items` row (`for update` for a resize, `for no key update` otherwise).
  - The in-use count is a plain select.
  - Nothing touches rooms, seats or `map_item_catalogs` locks, and `map_items_seed` is never called.
  - Both `layout_fixtures` and `seats` have foreign keys on `(org_id, sprite_key)` to `map_items` (`/home/user/simap/db/migrations/20261125200000_map_items.sql:150-152`). So FOR UPDATE does wait for uncommitted placements, and the in-use count reads after that wait.
- **No secrets or PII** in logs, responses or code. No env access added.

### Follow-ups (outside this ticket)
- Decide whether the orphan log should include `orgId` (finding 2). If yes, update it in 039.4, which reuses `discardMapItemFiles`.
- 039.4: the upload compare-and-set must also compare `w`/`h`, as the plan's sibling note already says.
