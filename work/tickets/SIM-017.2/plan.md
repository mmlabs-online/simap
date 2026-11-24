Status: READY

# Plan — SIM-017.2: Search API, diacritics-insensitive

## Scope summary
`docs/spec-v1.md` §DSH (lines 399-403):
> **DSH-02 Search and filter** (all roles)
> - [ ] Search runs on the server across seats (code, occupant), devices (name, inventory no., MAC, owner) and members
>   (name, employee code). Results are always current.
> - [ ] Search ignores case and Vietnamese diacritics: "nguyen" finds "Nguyễn".
> - [ ] Result lists have bounded page sizes.

Spec §8 (lines 484-485): "People's names and data stay as entered: Vietnamese diacritics must display, sort and search
correctly. Text is stored as Unicode NFC."

`work/decisions.md` D36 (line 43): "Names/data keep Vietnamese diacritics (display, sort, search)."

Ticket scope (ticket.md lines 24-28): `GET /api/search?q=&kind=all|seat|device|member&limit=&cursor=`, tier `user`,
keyset-paged per kind; SQL `translate()` with a shared TS fold map in `src/lib/search/fold.ts` (no migration, no
extension); fields seats (code, occupant name), devices (name, inventory no., MAC with separators ignored, owner name),
members (name, employee code; no email); switch `listMembers` `?q=` to the same fold; add
`src/app/api/dashboard/route.test.ts` for the tier gate at `route.ts:14` and `Cache-Control: no-store`.

Defaults kept from `work/tickets/SIM-017/plan.md` → Split proposal item 2 (lines 235-258) and
`work/tickets/SIM-017/security-review.md` finding 1 (lines 15-21).

Out of scope (ticket): search page UI (SIM-017.3); a trigram index.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | "nguyen" finds "Nguyễn" (and đ/Đ matches d). | Unit: `src/lib/search/fold.test.ts › "folds Nguyễn, NGUYỄN and NFD input to nguyen; Đ/đ to d"`. DB (CI `pnpm test:db`): `src/server/search/search.db.test.ts › "nguyen finds Nguyễn in every kind; dung finds Đặng/Dũng"` and `src/server/members/manage.db.test.ts` list test (line 296 flipped: `nguyen` now returns the three Nguyễn ids). |
| 2 | Search results are limited and paginated. | Unit: `src/lib/validate/search-query.test.ts` (default 20, max 50, limit 0/51/`abc` → 400 field `limit`), `src/lib/search/cursor.test.ts`. DB: `search.db.test.ts › "pages each kind by keyset with equal names, no gaps or repeats"` and `"kind=all caps each group at limit with its own nextCursor"`. |
| 3 | Unit tests cover the diacritics normalisation, incl. a check that the TS fold and the SQL map agree. | `fold.test.ts › "every FOLD_FROM char folds to the FOLD_TO char at the same index"`, `"Vietnamese alphabet: 12 vowels x 6 tones, both cases, NFC and NFD"`, `"map has equal lengths, no duplicates, no quote or backslash, ASCII a-z targets"`. DB confirmation on real Postgres: `search.db.test.ts › "SQL fold equals foldText on the whole map"`. |
| 4 | A route test pins the dashboard tier gate (User gets no deactivated-holders data). | `src/app/api/dashboard/route.test.ts › "user tier: includeHolders false and deactivatedHolders null"`, `"manager and admin: includeHolders true"`, `"200 carries Cache-Control: no-store"`. Mutation check: changing `route.ts:14` to `atLeast(ctx.tier, "user")` or `true` makes the first test fail. |
| 5 | Search covers exactly the spec fields, members without email; MAC separators ignored. | `search.db.test.ts › "fields: seat code and occupant; device name, inventory no., MAC (aa:bb, aa-bb, aabb), owner; member name and employee code; email not matched"`. |
| 6 | Org isolation (R6). | `search.db.test.ts › "never returns another org's rows"`; code review: every query through `orgQuery`, every join repeats `org_id`. |
| 7 | Input validation at the boundary; one error shape. | `search-query.test.ts` (missing/blank/too long/dup `q`, bad `kind`, cursor with `kind=all`, cursor of another kind) and `src/app/api/search/route.test.ts › "bad query -> 400 invalid_request without calling search"`. |
| 8 | Results are always current (no cache). | `search/route.test.ts › "200 carries Cache-Control: no-store"`; `dynamic = "force-dynamic"` in the route. |
| 9 | All checks green. | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`; CI `pnpm test:db`. |

## Ming verification after merge
None. Everything is covered by unit tests and CI `pnpm test:db`. (The UI that calls this API is SIM-017.3.)

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/search/fold.ts` | create | `foldText`, `FOLD_FROM`/`FOLD_TO`, `foldSql(col)`, `macCompact(q)` — the single fold rule for TS and SQL | no |
| `src/lib/search/fold.test.ts` | create | AC 1, 3 | no |
| `src/lib/search/types.ts` | create | `SEARCH_LIMITS`, `SearchKind`, hit DTOs, `SearchResponse` | no |
| `src/lib/search/cursor.ts` | create | per-kind keyset cursor codec `{t, k, id}` | no |
| `src/lib/search/cursor.test.ts` | create | cursor round trip and strict rejection | no |
| `src/lib/validate/search-query.ts` | create | `parseSearchQuery(params)` (mirror of `member-query.ts`) | no |
| `src/lib/validate/search-query.test.ts` | create | AC 2, 7 | no |
| `src/server/search/search.ts` | create | `search(pool, scope, filter)`: one read-only repeatable-read tx, one query per requested kind | no |
| `src/server/search/search.test.ts` | create | SQL shape with a fake db: user text only in bound values, fold constants in SQL, `limit + 1` | no |
| `src/server/search/search.db.test.ts` | create | AC 1, 2, 3 (DB side), 5, 6 against Postgres | no |
| `src/app/api/search/route.ts` | create | `GET /api/search`, tier `user` | no (not under `src/server/http/**`) |
| `src/app/api/search/route.test.ts` | create | auth 401, user passes, 400, 503, no-store | no |
| `src/app/api/dashboard/route.test.ts` | create | AC 4 (carried-over security finding 1) | no |
| `src/server/members/manage.ts` | modify | lines 148-153: `?q=` condition uses `foldSql(...) like` with the folded pattern | no |
| `src/server/members/manage.test.ts` | modify | lines 190-201: `ilike $3` → `like $3`; add a case that `q: "Nguyễn"` binds `%nguyen%` | no |
| `src/server/members/manage.db.test.ts` | modify | lines 295-301: line 296 flips (`nguyen` → the three Nguyễn ids); add `NGUYEN`, `le binh` | no |

Not touched: `src/lib/members/search.ts` (`escapeLike` is imported as is), `src/lib/validate/member-query.ts`
(already NFC + trim + cap), `src/app/api/dashboard/route.ts`, `src/app/api/routes-guarded.test.ts` (discovers the new
route by itself), `src/test/db/fixtures.ts` (tests set names/codes/MACs with plain `update`s, as
`dashboard.db.test.ts:22-29`), `db/migrations/**`. No file matches a High path in `.claude/loop.config.md` → Gate stays
`none`.

## Data model / migration
None. Search reads existing columns: `seats.code`, `seats.occupant_id` (`db/migrations/20261120150000_init.sql:84-85`),
`devices.name`, `inventory_number`, `mac` (stored lowercase colon form, `init.sql:112,119,128`), `devices.owner_id`,
`members.display_name`, `employee_code`, `status`. No extension (`unaccent` ruled out: `db/migrations/README.md:9-10`,
`db/migrator.test.ts:212`), no index (seq scan per org accepted for v1; trigram index is a follow-up only if slow).

## API contract
| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| GET | `/api/search` | `q` (required), `kind` = `all` (default) \| `seat` \| `device` \| `member`, `limit` (1-50, default 20), `cursor` (only with a single `kind`) | 200 `SearchResponse`, `Cache-Control: no-store` | 200; 400 `invalid_request`; 401/403 only from `withAuth`; 503 `unavailable` (no pool) | tier `user` (all roles, DSH-02) |
| GET | `/api/members?q=` | unchanged | unchanged; `q` now ignores case and diacritics | unchanged | unchanged |

```ts
// src/lib/search/types.ts
export const SEARCH_LIMITS = { q: 80, defaultLimit: 20, maxLimit: 50 } as const;
export type SearchKind = "seat" | "device" | "member";

export type SeatHit = {
  id: string; code: string; roomId: string; roomCode: string;
  occupant: { id: string; displayName: string } | null;
};
export type DeviceHit = {
  id: string; name: string; inventoryNumber: string; mac: string | null;
  owner: { id: string; displayName: string };
  placement: DevicePlacementDto | null;      // from @/lib/devices/types
};
export type MemberHit = {
  id: string; displayName: string; employeeCode: string | null; status: MemberStatus; // no email
};
export type SearchGroup<T> = { items: T[]; nextCursor: string | null };
/** Groups not requested by `kind` are null. */
export type SearchResponse = {
  seats: SearchGroup<SeatHit> | null;
  devices: SearchGroup<DeviceHit> | null;
  members: SearchGroup<MemberHit> | null;
};
```

`kind=all` returns the first `limit` hits of each group with its own `nextCursor`; the next page is
`?kind=<x>&cursor=<that group's nextCursor>&q=<same q>`. Sort keys: seats `(lower(s.code), s.id)`, devices
`(lower(d.name), d.id)` (as `devices.ts:125`), members `(lower(m.display_name), m.id)` (as `manage.ts:164`).

400 cases (all `invalid_request`, from the validator): `q` missing, blank after trim, longer than 80 code points, or
empty after folding (e.g. only combining marks); any repeated param; unknown `kind`; `limit` not `^[1-9]\d{0,2}$` or
> 50; `cursor` undecodable, present with `kind=all`, or its `t` differs from `kind`.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/search/fold.test.ts › folds Nguyễn, NGUYỄN and NFD input to nguyen; Đ/đ to d` | AC 1 |
| `… › Vietnamese alphabet: 12 vowels x 6 tones, both cases, NFC and NFD` (a ă â e ê i o ô ơ u ư y × none/grave/acute/hook/tilde/dot, upper and lower; each folds to its ASCII base; every precomposed form is in `FOLD_FROM`) | AC 3, domain focus (diacritics) |
| `… › every FOLD_FROM char folds to the FOLD_TO char at the same index` | AC 3 (TS fold = SQL map) |
| `… › map has equal lengths, no duplicates, no quote or backslash, ASCII a-z targets` | `translate()` safety |
| `… › ASCII, digits, %, _, \\, space and non-Latin text pass through lowercased only` | escapeLike runs after fold; no false folding |
| `… › foldSql builds lower(translate(col, '<FROM>', '<TO>')) from constants` | SQL builder |
| `… › macCompact: aa:bb, AA-BB, aabb.cc, aabb → hex; non-hex, empty, >12 hex → null` | MAC separators ignored |
| `src/lib/search/cursor.test.ts › round trip per kind; rejects bad base64, extra/missing keys, unknown t, non-canonical id, k > 320` | AC 2 |
| `src/lib/validate/search-query.test.ts › defaults: kind all, limit 20; q NFC, whitespace collapsed, trimmed` | AC 2, 7 |
| `… › q missing, blank, 81 chars, only combining marks → field q; 80 Vietnamese chars ok` | bounds, diacritics |
| `… › limit 0, 51, abc, 1e1 → field limit; 1 and 50 ok` | pagination bounds |
| `… › kind unknown → field kind; duplicates of any param → that field` | AC 7 |
| `… › cursor with kind=all, cursor of another kind, garbage → field cursor` | AC 2, 7 |
| `src/server/search/search.test.ts › user text only in values: pattern %<escaped fold>%, limit+1; SQL contains translate constants and org_id = $1 on every table` | R6, SQL injection |
| `… › kind=seat runs only the seat query; others null` | contract |
| `src/server/search/search.db.test.ts › SQL fold equals foldText on the whole map` (`select lower(translate($2, FROM, TO))` on `FOLD_FROM` + upper ASCII + the alphabet string, via a plain `pool.query`) | AC 3 on real Postgres (independent of DB ctype) |
| `… › nguyen finds Nguyễn in every kind; dung finds Đặng/Dũng` (seat occupant "Nguyễn Văn An", device owner "Nguyễn Văn An", device name "Máy in Đặng", member "Trần Dũng") | AC 1 |
| `… › fields: seat code and occupant; device name, inventory no., MAC (aa:bb, aa-bb, aabb), owner; member name and employee code; email not matched` | AC 5 |
| `… › literal % and _ match only themselves` | escapeLike |
| `… › pages each kind by keyset with equal names, no gaps or repeats` (5 members "Nguyễn Văn A", limit 2) | AC 2 |
| `… › kind=all caps each group at limit with its own nextCursor; null when the group fits` | AC 2 |
| `… › deactivated members are returned with status deactivated` | contract |
| `… › empty org: empty groups, nextCursor null` | empty fields |
| `… › never returns another org's rows` (two orgs, same names/codes) | AC 6 (R6) |
| `… › runs begin, set transaction repeatable read read only, reads, commit` (recording pool, as `src/server/layout/layout.db.test.ts:282-291`) | one snapshot |
| `src/app/api/search/route.test.ts › no Authorization -> 401` | auth wrapper |
| `… › user tier passes and gets the service result` | DSH-02 all roles |
| `… › bad query -> 400 invalid_request without calling search` | AC 7 |
| `… › no database -> 503 unavailable` | errors |
| `… › 200 carries Cache-Control: no-store` | AC 8 |
| `src/app/api/dashboard/route.test.ts › user tier: includeHolders false and deactivatedHolders null` (stub returns the `includeHolders`-dependent body; assert the stub's 3rd arg and the JSON) | AC 4 |
| `… › manager and admin: includeHolders true` | AC 4 |
| `… › 200 carries Cache-Control: no-store` | AC 4 |
| `src/server/members/manage.test.ts › binds q escaped and folded, pages with limit + 1` (existing test updated: `like $3`; new assertion `q: "Nguyễn"` → `%nguyen%`) | listMembers fold |
| `src/server/members/manage.db.test.ts › list: search …` (existing; line 296 → three Nguyễn ids; add `NGUYEN` → same; `le binh` → `ids[4]`) | AC 1 for members list |

Existing guards that must stay green: `src/app/api/routes-guarded.test.ts`, `src/lib/members/search.test.ts`,
`pnpm check:layers`.

## Approach
1. **Fold** — `src/lib/search/fold.ts` (pure lib):
   - `foldText(s)`: `s.normalize("NFC").normalize("NFD").replace(/\p{M}/gu, "").replace(/[đĐ]/g, "d").toLowerCase()`.
   - Build the map once at module load: for every code point in U+00C0–U+024F and U+1E00–U+1EFF, keep `c` if
     `foldText(c)` is exactly one char in `[a-z]` and differs from `c`; `FOLD_FROM` = those chars (both cases),
     `FOLD_TO` = their folds. This covers all Vietnamese letters (incl. `ă â ê ô ơ ư đ` and the U+1EA0–U+1EF9 tone
     forms) plus other Latin letters with marks.
   - `foldSql(col)` returns `` `lower(translate(${col}, '${FOLD_FROM}', '${FOLD_TO}'))` ``. **Order refinement:**
     translate first, then `lower()`, and the map holds both cases. That way the non-ASCII part never depends on the
     database's `lc_ctype` (`lower()` of `Ễ` is a no-op under a `C` ctype); after translate only ASCII is left for
     `lower()`, which works under every ctype. Same result as the ticket's `translate(lower(col), …)` wording on a
     UTF-8 ctype. `col` is always a constant column name from server code.
   - `macCompact(q)`: remove `:`, `-`, `.`, lowercase; return it if it matches `^[0-9a-f]{1,12}$`, else `null`.
2. **Types and cursor** — `src/lib/search/types.ts` as in the API contract. `src/lib/search/cursor.ts`:
   `encodeSearchCursor({ t, k, id })` / `decodeSearchCursor(s)`, a copy of `src/lib/members/cursor.ts:8-28` with a third
   key `t` in `["seat","device","member"]` (exactly three keys).
3. **Validator** — `src/lib/validate/search-query.ts`, copy of `member-query.ts:16-57`:
   `parseSearchQuery(params): { ok: true; value: SearchFilter } | { ok: false; field: string }` with
   `SearchFilter = { q: string; folded: string; kind: SearchKind | "all"; limit: number; cursor?: SearchCursor }`.
   `q` required; `folded = foldText(q)`, empty → field `q`. Cursor rules as in the API contract.
4. **Server** — `src/server/search/search.ts`, first line `import "server-only"` (R1); `Db` from
   `@/server/members/manage` style (`TxPool & Query`).
   - `export async function search(pool: Db, scope: OrgScope, f: SearchFilter): Promise<SearchResponse>`:
     `withTx(pool, async (c) => { await c.query("set transaction isolation level repeatable read, read only"); … })`
     (pattern `src/server/dashboard/dashboard.ts`), then one query per requested kind; others `null`.
   - Pattern `p = "%" + escapeLike(f.folded) + "%"` (`@/lib/members/search`), bound as a parameter; every match is
     `${foldSql(col)} like $n escape '\\'`. Per-kind binder like `manage.ts:141-146`; `limit + 1` bound; keyset
     `(sortExpr, id) > ($k::text, $id::uuid)` only when `f.cursor` is set; `nextCursor` from the last row's DB-returned
     `sort_key` (as `manage.ts:167-170`).
   - Seats: `from seats s join rooms r on r.org_id = s.org_id and r.id = s.room_id left join members m on m.org_id =
     s.org_id and m.id = s.occupant_id where s.org_id = $1 and (fold(s.code) like p or fold(m.display_name) like p)`.
   - Devices: joins of `devices.ts:118-124` (owner, seat, room, all on `org_id`); match `fold(d.name)`,
     `fold(d.inventory_number)`, `fold(d.mac)`, `fold(m.display_name)`, plus `replace(d.mac, ':', '') like $m` with
     `$m = "%" + mac + "%"` only when `macCompact(f.q)` is not null. Map to `DeviceHit` (placement shape of
     `devices.ts:91-99`; no `mine`/`canEdit`/`canPlace`).
   - Members: `from members m where m.org_id = $1 and (fold(m.display_name) like p or fold(m.employee_code) like p)`;
     no email; all statuses.
   - No writes, no audit rows.
5. **Route** — `src/app/api/search/route.ts`, copy of `src/app/api/members/route.ts`: `dynamic = "force-dynamic"`,
   parse → `apiError(400, "invalid_request")`, `getPool()` → `apiError(503, "unavailable")`, `search(...)`,
   `Response.json(body, { headers: { "Cache-Control": "no-store" } })`, `withAuth(…, { tier: "user" })`. Read-only, so
   R7 holds (no 401/403 outside the wrapper).
6. **listMembers** — `manage.ts:148-153`: `const p = bind(\`%${escapeLike(foldText(f.q))}%\`)`; condition
   `(${foldSql("m.display_name")} like ${p} escape '\\' or ${foldSql("m.email")} like ${p} escape '\\' or
   ${foldSql("m.employee_code")} like ${p} escape '\\')`. Email stays in the members list (existing behaviour; only the
   global search leaves it out). Sort and cursor unchanged. Update the two existing tests as listed.
7. **Dashboard route test** — `src/app/api/dashboard/route.test.ts`, copy of the harness in
   `src/app/api/members/route.test.ts:1-69` (`vi.mock("@/server/db/pool")`, `vi.mock("@/server/dashboard/dashboard")`,
   `fakeAuth(["simap:user"|"simap:manager"|"simap:admin"])`). The `getDashboard` stub returns
   `deactivatedHolders: opts.includeHolders ? { total: 1, items: [...] } : null`; assert the stub's third argument
   `{ includeHolders: false|true }`, the JSON `deactivatedHolders`, and `cache-control: no-store`.
8. Run all Checks; `pnpm test:db` locally if a DB is available (CI runs it).

Rules: R1 (server-only header; route is the only server entry; fold and validator in lib), R3 (no env), R4 (only the
listed files), R5 (tests above), R6 (`orgQuery` + `org_id` on every join), R7 (read-only routes), D36 (no UI copy in
this ticket).

## Specialist input used
- api-platform-engineer (`work/tickets/SIM-017/consult-api-platform-engineer.md`), reused as instructed:
  - Adopted: `translate()` + shared TS fold map, no extension (rec. 1); map-agreement unit test and table-driven
    Vietnamese test (Risks); `escapeLike` after folding, bound pattern, constants-only SQL; endpoint, tier `user`,
    `400 invalid_request` / `503 unavailable`, validator mirroring `member-query.ts` with dup rejection, default 20 /
    max 50 (rec. 2); per-kind groups with their own keyset cursors, no merged cursor; hit shapes reusing
    `DevicePlacementDto` and `owner`; deactivated members included with `status`; `listMembers` uses the same fold;
    seq scan accepted, trigram index as follow-up.
  - Adapted: `lower(translate(col, …))` with both cases in the map instead of `translate(lower(col), …)`, so the fold
    does not depend on the database ctype (same result on UTF-8).
  - Adapted: cursor carries its kind `t`, so a seat cursor cannot page devices.
  - Open questions Q1, Q4-Q7: answered by the SIM-017 split defaults (translate, no email, `listMembers` folded, MAC
    separators ignored, min 1 char), kept as instructed.

## Assumptions
- **A1 Stored text is NFC.** Write paths normalise (`src/lib/validate/member.ts:9`, `device.ts:83`, `room.ts:28`); spec
  §8. A row stored decomposed would not match; not handled in SQL (no `normalize()` per row).
- **A2 Database encoding is UTF-8** (Vietnamese names are already stored); `translate()` maps by character.
- **A3 Non-decomposing letters** (`ø`, `ł`, `ß`, …) are not folded on either side; only case may differ from JS under a
  `C` ctype. Outside the Vietnamese scope of DSH-02.
- **A4 MAC.** A query whose compact form is 1-12 hex chars also matches `replace(d.mac, ':', '')`; so `aa-bb`, `aabb`
  and `aa:bb` find `aa:bb:…`. The plain folded match on `d.mac` still applies.
- **A5 One `limit` for all groups.** `kind=all` uses the same `limit` per group (default 20); SIM-017.3 may pass a
  smaller one.
- **A6 Visibility.** Seats, devices and members are already listed to every User (`/api/members`, `/api/devices` are
  tier `user`), so search exposes nothing new; member hits carry no email.
- **Hotspots:** no other ticket is `IN_PROGRESS`, `REVIEW` or `DONE` (board lines 76-77). SIM-017.3 (BACKLOG) will
  consume this API but edits no file here.

## Blocking questions
None.

## Split proposal
None. Roughly 400 source lines plus tests; one implement/review cycle.
