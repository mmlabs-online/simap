# Consult — api-platform-engineer (SIM-017)

## Findings

**Schema / platform facts**
- `db/migrations/` has 3 files (init, members_profile_confirmed_at, room_tile_layout). There is no extension, no search column and no trigram index. Existing indexes are all `(org_id, ...)`; there are none on name/code text, so any search is an org-filtered scan.
- `db/migrations/README.md:9-10` and `db/migrator.test.ts:212` forbid `create extension`, `grant` and `create role` in migrations. They are "Ming's steps on the shared server". So the `unaccent` route cannot be an ordinary migration. It needs a manual Ming step on the shared Postgres, and the migrator test and README would have to change. Whether role `simap` may create it is unknown to me. `unaccent` is a "trusted" extension since PG13, so a role with CREATE on its own database can usually install it. Only Ming can confirm, and local, CI and prod would all need it. Also `unaccent()` is STABLE, not IMMUTABLE, so it cannot be used in an index without a wrapper function. That makes a second migration likely.
- Existing member search (`src/server/members/manage.ts:148-152`, `src/lib/members/search.ts` `escapeLike`) is `ilike` on display_name, email and employee_code. It is diacritic-sensitive. SIM-011 plan A7 explicitly deferred accent-insensitive search to this ticket. SIM-017 should make that list use the same fold, or at least not diverge.
- Text is stored NFC (spec §NFR line ~485). `parseMemberQuery` already does NFC, whitespace collapse, trim and a length cap (`MEMBER_LIMITS.q`). Search should reuse that parsing shape.
- Conventions to copy:
  - Route: `withAuth(handler, { tier })`, `getPool()` (503 `unavailable` if null), `apiError(400, "invalid_request")`, and `Response.json(body, { headers: { "Cache-Control": "no-store" } })` with `dynamic = "force-dynamic"`. See `src/app/api/members/route.ts`.
  - Queries: `orgQuery(db, scope, "... org_id = $1 ...", values)` with a `binder` helper (`src/server/requests/read.ts:20`). Every join repeats `org_id`.
  - Lists return `{ items, nextCursor }` (members, requests, audit) via keyset on `(sort key, id)` with `limit+1` and `encodeCursor` (`src/lib/audit/cursor.ts`, `src/lib/members/cursor.ts`). Devices instead return `{ items, truncated }`.
  - Multi-query consistency: `withTx` plus `set transaction isolation level repeatable read, read only` (`listMyRequests`).
  - Camel-case DTOs live in `src/lib/**/types.ts`, and server rows are mapped in `toDto`.
- No dashboard or search endpoint exists yet. Seat status is derived (no status column): occupied = `occupant_id is not null`. Devices: placed = `seat_id is not null`, inventory = `seat_id is null`. A deactivated member holding a seat is `members.status='deactivated'` joined via `seats.occupant_id`. `seats_org_occupant_idx` supports this.

## Recommendations

**1. Diacritics: choose a fourth option, SQL `translate()` with a shared char map (no migration, no extension).**
- Built in, IMMUTABLE and available to the `simap` role. Vietnamese letters are a finite set of precomposed NFC code points (about 134, plus `đ`/`Đ`). Compare `translate(lower(col), FROM, TO) like $n` against the query folded in TS.
- Put the map in one pure lib module, e.g. `src/lib/search/fold.ts`:
  - `foldText(s)`: NFC, then NFD with combining marks stripped (`\p{M}`), `đ`->`d`, then lowercase.
  - Export `FOLD_FROM` and `FOLD_TO` strings generated from the same table.
  - The server builds `translate(lower(x), '<FROM>', '<TO>')` from constants (never user input).
  - A unit test asserts that for every char in FROM, `foldText(c) === TO[i]`, so the SQL and TS folds cannot drift. This satisfies "unit tests cover normalisation".
- Why not the others:
  - `unaccent`: out-of-band manual DB step, conflicts with the README and migrator test, a High path with a cross-env dependency, and it blocks CI/local unless provisioned everywhere.
  - Normalised column: a migration, a backfill, and every write path (members, devices, seats, plus owner and occupant name changes) must keep it in sync. That recreates a cached-value hazard, and an occupant rename would have to rewrite seat rows. Over-engineered for v1.
  - App-layer filtering of a candidate set: it must fetch all org rows or accept false negatives, which breaks "bounded and paginated" and "always current".
- Cost: a seq scan per org per query. That is fine at the expected size (hundreds to a few thousand rows). If it ever hurts, add a functional trigram/GIN index in a later ticket (needs `pg_trgm`, Ming's step). Record this as a follow-up and do not build it now.
- Escape LIKE with the existing `escapeLike` (applied after folding), use `like ... escape '\'` on folded columns, and bind the pattern as a parameter. Cap the query to a minimum of 1 char (or 2) and a max length like members.
- Also make `listMembers` use the same fold. That is a small change in the same ticket, but ask Ming (R4).

**2. Search endpoint**: `GET /api/search?q=&kind=all|seat|device|member&limit=&cursor=`, tier `user` (spec: all roles).
- `q` required and non-blank, else 400 `invalid_request`. Parse in `src/lib/validate/search-query.ts` (mirror `member-query.ts`: dup-param rejection, `limit` regex, max 50, default 20).
- Fields searched (spec DSH-02):
  - Seats: `seats.code`, occupant display_name (left join members).
  - Devices: name, inventory_number, mac, owner display_name. Fold the MAC query so `aa:bb` and `aabb` behave sensibly. Decide whether to strip colons for the compare.
  - Members: display_name, employee_code (spec says name and code only; the existing members list also does email. Do not add email to the global search unless Ming wants it, since emails of members are visible to Users anyway per A7).
- Response, one consistent shape, keyset-paged per kind:
  ```
  { seats:   { items: SeatHit[],   nextCursor: string|null },
    devices: { items: DeviceHit[], nextCursor: string|null },
    members: { items: MemberHit[], nextCursor: string|null } }
  ```
  - With `kind=all` each group returns the first `limit` (small, e.g. 5-10) and its `nextCursor`. Fetching more means calling again with `kind=<x>&cursor=`, which returns only that group.
  - Each cursor is keyset on `(lower(name or code), id)` like `members/cursor.ts`. Reuse that pattern with a per-kind cursor codec, or reuse `encodeCursor` with `{k, id}`.
  - Avoid a single merged cross-type cursor. It is complex and unnecessary.
- Hits carry enough to navigate: seat `{id, code, roomId, roomCode, occupant:{id,displayName}|null}`; device `{id, name, inventoryNumber, mac, owner, placement|null}`; member `{id, displayName, employeeCode, status, groupId?}`. Reuse the existing DTO sub-shapes (`DeviceDto.placement`, `owner`) rather than inventing new field names (camelCase everywhere, ISO timestamps).
- Org scoping: every sub-query `where x.org_id = $1`, joins repeated on `org_id`. Deactivated members should be included but flagged by `status`.
- Stable error codes only: 400 `invalid_request`, 503 `unavailable`. No auth refusals after side effects (read-only, so R7 is trivially fine).
- Put code in `src/server/search/search.ts` (`import "server-only"`) and `src/lib/search/{fold,types}.ts`.

**3. Dashboard endpoint**: `GET /api/dashboard`, tier `user` or `manager`, to be decided by Ming (see open questions).
- One `withTx` with `repeatable read, read only` so all numbers come from one snapshot. Three or four queries are fine:
  1. Totals: `count(*)` of rooms, seats, `count(occupant_id)` and devices placed/inventory, all `where org_id = $1`.
  2. Per-room: `rooms r left join seats s on s.org_id=r.org_id and s.room_id=r.id group by r.id` giving seats and occupied (include empty rooms, order by `lower(r.code), r.id`).
  3. Deactivated holders: seats joined to `members m on m.status='deactivated'`, returning `{member:{id,displayName}, seats:[{id,code,roomId,roomCode}]}`. Cap the list (e.g. 100) with a true `count` alongside, in the style of the "capped refs, true counts" in `manage.ts`.
  4. Devices: `count(*) filter (where seat_id is not null)` / `where seat_id is null`.
- Response (camelCase, ints, rate computed server-side so the UI and tests agree; guard divide-by-zero returns `0`):
  ```
  { totals: { rooms, seats, occupied, occupancyRate, devicesPlaced, devicesInventory },
    rooms: [{ id, code, name, floor, seats, occupied, occupancyRate }],
    deactivatedHolders: { total, items: [...] } }
  ```
  Use a ratio (0..1) or percent consistently. Pick one and document it in `types.ts`. I suggest an integer-friendly ratio rounded in the UI only.
- Headers: `Cache-Control: no-store`. No caching and no counters, which satisfies the "no cached counters" criterion. Add a DB test that mutates (assign, release, deactivate, place device) and re-reads.
- Put the pure rate/percent helper in `src/lib/dashboard/` and unit test it. Put the SQL in `src/server/dashboard/dashboard.ts`. Add `*.db.test.ts` (including org isolation with two orgs) following `read.db.test.ts`.
- No audit rows (reads). Nothing to do for `writeAudit`.

**4. Process**: no migration means this ticket may avoid High paths. Confirm in `.github/risk-tiers.yml` that `src/server/**` is not High. Adding `src/app/api/**` routes may trigger a tier. Check the file rather than assume. Also re-run `pnpm check:layers` (new routes call `src/server/**` only through the route handler).

## Risks
- `translate()` map completeness: a missed code point yields a false negative. Mitigate with the TS-vs-SQL map test and a table-driven test over all Vietnamese vowels with all five tone marks plus `ă â ê ô ơ ư đ`, upper and lower case.
- Data stored not-NFC (decomposed) would not match the precomposed map. Spec says NFC at write. Verify write paths normalise, or fold the query via NFC and note the limitation. The member name written via Identity profile may come decomposed. Check `validate/member`.
- Scan cost on large orgs (leading wildcard `like`). Bounded by `limit` and the per-org filter, but not by index. Acceptable for v1; log as a follow-up.
- Seat "capacity" semantics: if `cannot_seat` seats are counted in `seats`, the occupancy rate is understated. Needs a decision (below).
- Per-kind pagination means a `kind=all` UI must be designed around "show more" per group.
- `translate()` strings inlined in SQL: the `orgQuery` guard is text-only, so make sure the folded SQL is built from constants and the query text stays parameterised.

## Open questions (for Ming)
1. Is diacritics via `translate()` plus a shared TS map (no migration, no extension) acceptable, or does Ming prefer `unaccent`? If `unaccent`, can role `simap` run `create extension unaccent` on the shared Postgres, and who installs it for CI and local?
2. Should the dashboard count `cannot_seat` seats in capacity and the rate (seats, occupied, rate)? I suggest excluding them from the rate denominator but showing the count, so please confirm.
3. Dashboard visibility: all roles or Manager+ only? The deactivated-holders warning is a Manager action item (D34), so should Users see it? Spec DSH-01 does not state it.
4. Does search include email for members (the members list already does), or only name and employee code as the spec says?
5. Should `listMembers` (existing `?q=`) be switched to the same diacritic-insensitive fold in this ticket? It is a small change but outside the ticket's file list (R4).
6. MAC search: match with or without colons?
7. Should search results be limited to a minimum query length (1 or 2 chars)?
