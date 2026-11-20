Status: READY

# Plan — SIM-010: Rooms: CRUD, seat codes and room list

> **Split (default, see Q1 and `## Split proposal`):** this ticket is about 1,600 changed lines in total, so it is
> split into two slices. **Slice A (this ticket's PR)** covers the API, server transactions, pure logic and tests.
> **Slice B (new ticket SIM-010.2)** covers the Rooms page UI. This plan specifies Slice A completely. Slice B is
> specified at file and test level so SIM-010.2 can reuse it without re-planning. If Ming answers "no split" to Q1, the
> implementer builds both slices in one PR from this same plan.

## Scope summary
- spec ROO-01 (`docs/spec-v1.md:210-218`):
  "An Admin creates a room with code, name, description and floor. A duplicate code is rejected with a clear message."
  "An Admin edits a room's code, name, description and floor. The code stays unique within the org. Changing the code
  regenerates every seat code of the room (`C302-01` → `C303-01`) in one transaction, with an audit row (D29)."
  "Deleting a room first shows its impact: the number of occupied seats and placed devices."
  "If the room is empty, delete works directly. If not, the Admin must confirm a forced delete. A forced delete turns
  primary devices in the room into secondary, returns them to inventory, deletes the room's seats and drops their
  pending requests. This is seatMGT `deleteRoom(force)` behaviour."
- spec ROO-02 (`:220-223`): "A new seat's code is `<room code>-<NN>`. NN is the highest existing sequence number in the
  room plus 1, padded to 2 digits. Numbers are never reused: the room keeps a counter of the highest number ever issued
  (D30)." "No API or form lets anyone type in a seat code." The spec has two rules here. The D30 counter wins:
  `next = seat_counter + 1`, never `max(seq) + 1`.
- spec SYS-02 (`:394-397`): "All inputs are validated at the server boundary. Every invariant in section 5 is checked
  inside the same transaction as the write." "The error shape carries a code and never a stack trace."
- spec SYS-03 (`:399-401`): "Every change writes an audit row in the same transaction: actor `sub`, action, entity, id,
  small meta. The row holds no secrets and no tokens."
- spec SYS-01 (`:391-392`): "an id from another org answers 404, as if it did not exist."
- spec DSH (`:373`): "room cards and an occupancy ring as in seatMGT". The ticket ports these for the room list
  (Slice B).
- spec §5 invariant 7 (`:145`): "Seat codes are generated from room code + port sequence … never typed in by hand."
- `work/decisions.md` D29: "Room code is editable; unique within the org; changing it regenerates the room's seat codes
  in one transaction." D30: "Seat numbers are never reused (per-room counter)." D36: UI copy is English and lives in
  copy files.
- CLAUDE.md R1 (layers), R6 (org_id scoping via verified token), R5 (tests).

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | A duplicate room code in the same org is refused (codes are case-insensitive because they are uppercased, Q2: `c302` and `C302` are the same code); the same code in another org is allowed. | `src/lib/validate/room.test.ts` › "code `c302` normalises to `C302`" and "`c302` and `C302` yield the same value" (so the second create hits the unique key); `src/server/rooms/pg-error.test.ts` › "23505 on rooms_org_code_key → room_code_taken"; `src/server/rooms/rooms.test.ts` › "create maps unique violation to 409 room_code_taken" and "every statement is org-scoped ($1 = scope.orgId)". The cross-org half rests on the schema: `rooms_org_code_key unique (org_id, code)` (`db/migrations/20261120150000_init.sql:73`); the reviewer confirms that by reading. One-off psql check in impl-log: insert `C302` in org A twice → 23505, then in org B → ok; then POST `c302` after `C302` through the validator output → 409 `room_code_taken`. |
| 2 | Renaming `C302` to `C303` renames all its seats to `C303-NN` atomically. | `src/lib/rooms/seat-code.test.ts` › "renameSeatCodes C302→C303 derives from seq"; `src/server/rooms/rooms.test.ts` › "rename runs BEGIN, lock, update room, update seats (unnest from renameSeatCodes), audit, COMMIT in one client" and "rename failure → ROLLBACK, no COMMIT". One-off psql replay in impl-log against compose Postgres. |
| 3 | Deleting the last seat and adding a new one gives the next number, not the deleted one. | `src/lib/rooms/seat-code.test.ts` › "after seats 1..3 and deleting 3, next seq is 4 (D30)"; `src/server/rooms/rooms.test.ts` › "allocateSeatSeq increments seat_counter with UPDATE … RETURNING, never reads max(seq)". |
| 4 | Non-Admins get 403 on writes; the UI hides the actions. | API (Slice A): `src/app/api/rooms/route.test.ts` › "User and Manager get 403 forbidden on POST, PATCH, DELETE, delete-impact" and "User passes the GET gate". UI (Slice B): `src/ui/rooms/RoomsView.test.tsx` › "user/manager see no New room, Edit or Delete buttons; admin sees them". |
| 5 | Unit tests cover code generation, rename mapping and the delete-impact rules. | `pnpm test` runs `seat-code.test.ts`, `delete-impact.test.ts` and `validate/room.test.ts` (cases listed below). |
| — | Checks green | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`. |

## Ming verification after merge
- End-to-end in a browser once SIM-006 (sign-in) and SIM-007 (org picker) are merged and SIM-010.2 is built: as Admin,
  create `C302`, add seats (SIM-015.x), rename to `C303`, and check the seat codes. Force-delete a room that has an
  occupant and a primary device, and confirm the device is in inventory as secondary. As User, no write actions are
  shown. This cannot run locally before then because there is no way to mint an Identity token without SIM-006 + M-1.

## Files to create / modify

### Slice A (this ticket)
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/api/error.ts` | Append `invalid_request`, `not_found`, `room_code_taken`, `room_not_empty` to `API_ERROR_CODES` (append only, `ApiErrorBody` shape unchanged) | Errors for 400/404/409 (SYS-02) | No |
| `src/lib/rooms/types.ts` (new) | `RoomDto = {id, code, name, description, floor, seatCount, occupiedCount}`, `DeleteImpact = {seats, occupiedSeats, placedDevices, pendingRequests}` | Shared by API and UI (R1: lib) | No |
| `src/lib/rooms/seat-code.ts` (new) | `formatSeatCode(roomCode, seq)`, `nextSeatSeq(counter)`, `renameSeatCodes(newCode, seats:{id,seq}[]) → {id, code}[]` | ROO-02, D29, D30 pure logic | No |
| `src/lib/rooms/delete-impact.ts` (new) | `canDeleteDirectly(impact)` rule | ROO-01 delete rule, unit-testable | No |
| `src/lib/validate/room.ts` (new) | `validateRoomCreate(body)`, `validateRoomPatch(body)` → `{ok:true,value}` / `{ok:false, field}`; `ROOM_LIMITS` constants. The code is normalised first (`trim().toUpperCase()`), then validated against `[A-Z0-9._-]`, 1-32 chars; `value.code` is the uppercase form that the service stores (Q2, Ming) | SYS-02 boundary validation; reused by the UI form in Slice B | No |
| `src/server/db/tx.ts` (new) | `withTx(pool, fn(client))`: connect, BEGIN, fn, COMMIT, ROLLBACK on throw, release | One transaction per write (SYS-02/03) | No |
| `src/server/audit/write.ts` (new) | `writeAudit(client, scope, {actorSub, action, entity, entityId, meta})` via `orgQuery` | SYS-03; reused by later tickets | No |
| `src/server/request/read-json.ts` (new) | `readJson(req, maxBytes = 16_384)` → `{ok:true, body}` / `{ok:false}` (content type `application/json`, size cap, parse error) | POST/PATCH bodies; kept outside `src/server/http/**` on purpose (see Q10) | No |
| `src/server/rooms/pg-error.ts` (new) | `roomConflict(err)`: 23505 on `rooms_org_code_key` or `seats_org_code_key` → `"room_code_taken"`, else `null` | AC1 mapping | No |
| `src/server/rooms/rooms.ts` (new) | `listRooms`, `createRoom`, `updateRoom`, `getDeleteImpact`, `deleteRoom`, `allocateSeatSeq` (all take `scope: OrgScope`, `actorSub`); result union `{ok:true,…}` / `{ok:false, status, code}` | ROO-01/02 transactions | No |
| `src/app/api/rooms/route.ts` (new) | `GET` (tier user), `POST` (tier admin) | API | No |
| `src/app/api/rooms/[id]/route.ts` (new) | `PATCH`, `DELETE` (tier admin) | API | No |
| `src/app/api/rooms/[id]/delete-impact/route.ts` (new) | `GET` (tier admin) | ROO-01 impact | No |
| Tests (new) | `src/lib/rooms/seat-code.test.ts`, `src/lib/rooms/delete-impact.test.ts`, `src/lib/validate/room.test.ts`, `src/server/rooms/pg-error.test.ts`, `src/server/rooms/rooms.test.ts`, `src/server/request/read-json.test.ts`, `src/server/db/tx.test.ts`, `src/app/api/rooms/route.test.ts` | R5 | No |

### Slice B (SIM-010.2 by default; listed so it needs no re-plan)
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/ui/copy/rooms.ts` (new) | `export const roomsCopy = {...} as const`, English; value-taking strings are pure functions (e.g. `occupancyLabel(n, total)`, `renameWarning(from, to)`, `forceDeleteBody(impact)`); `errors: Record<…>` for the room error codes | D36, SIM-022 convention | No |
| `src/ui/copy/copy.test.ts` | Add `roomsCopy` to the strings scanned | Copy hygiene | No |
| `src/lib/rooms/occupancy.ts` (new) | `occupancyPercent(occupied, total)` (0 seats → 0), `ringDash(percent, radius)` | Pure ring math | No |
| `src/ui/rooms/rooms-api.ts` (new) | `createRoomsApi(fetcher)` → `list/create/update/impact/remove(id, force)`; parses `{error:{code}}` | Isolates the SIM-006 `apiFetch` signature | No |
| `src/ui/rooms/useRooms.ts` (new) | `{status:"loading"|"error"|"ready", rooms, errorCode, reload}`; waits for a session before fetching | Data loading | No |
| `src/ui/rooms/RoomsView.tsx` (new) | Pure view: header + "New room" (admin only), loading skeleton cards (`aria-busy`), empty, error (`role=alert` + Retry), grid of cards | Test seam | No |
| `src/ui/rooms/RoomCard.tsx`, `src/ui/rooms/OccupancyRing.tsx` (new) | Port of the seatMGT card and ring (SVG `role=img`, `aria-label` from copy) | DSH/ticket scope | No |
| `src/ui/rooms/RoomFormDialog.tsx` (new) | Create/edit on `EntityFormDialog` + `DialogField`; the code input uppercases as the user types (`onChange` → `toUpperCase()`, Q2); client validation through `@/lib/validate/room`; rename warning subtitle | ROO-01 | No |
| `src/ui/rooms/DeleteRoomDialog.tsx` (new) | Loads impact, then plain or forced confirmation | ROO-01 | No |
| `src/ui/rooms/RoomsPage.tsx` (new) | `"use client"` wiring: `useSession`, `useRooms`, dialogs, `atLeastTier(tier,"admin")` | Glue | No |
| `src/app/(app)/rooms/page.tsx` | Render `<RoomsPage />` instead of `PageSkeleton` | Route | No |
| Tests (new) | `src/lib/rooms/occupancy.test.ts`, `src/ui/rooms/rooms-api.test.ts`, `src/ui/rooms/RoomsView.test.tsx` | R5 | No |

**High paths:** none in either slice, so the gate stays `none`. The security review trigger still runs because
`src/server/` changes.

## Data model / migration
None. The schema from SIM-008 (`db/migrations/20261120150000_init.sql:59-139`, `:143-187`, `:209-221`) already has
`rooms (org_id, code)` unique, `seat_counter >= 0`, seats unique on `(org_id, code)` and `(org_id, room_id, seq)`,
`seats_room_fkey on delete restrict`, `devices_seat_fkey on delete restrict`,
`devices_primary_needs_seat_check (seat_id is not null or role = 'secondary')`, `seat_requests` and `layout_fixtures`
cascade, and append-only `audit_log`. The deferred triggers (`:225-271`) re-read the device row at COMMIT and return
early when `role <> 'primary'`. That is why the forced delete sets `role = 'secondary', seat_id = null` in one UPDATE.

## API contract
All responses carry `Cache-Control: no-store`. Errors use the existing shape `{ "error": { "code": "<ApiErrorCode>" } }`
and go through `apiError` (`src/server/http/respond.ts:5`, unchanged). The DB is not configured (`getPool()` returns
null) → 503 `unavailable`. An `:id` that is not a canonical UUID (`isCanonicalUuid`) → 404 `not_found` (Q9).

| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| GET | `/api/rooms` | — | 200 `{ rooms: RoomDto[] }`, `order by code`, SQL `limit 500` | 401, 403, 503 | tier `user` (all members) |
| POST | `/api/rooms` | JSON `{code, name, description?, floor?}`; unknown keys → 400 | 201 `RoomDto` (`seatCount: 0, occupiedCount: 0`) | 400 `invalid_request`, 409 `room_code_taken`, 401/403/503 | tier `admin` |
| PATCH | `/api/rooms/:id` | JSON with at least one of `code, name, description, floor`; `description`/`floor` may be `null` or `""` (→ null) | 200 `RoomDto` | 400, 404 `not_found`, 409 `room_code_taken`, 401/403/503 | tier `admin` |
| GET | `/api/rooms/:id/delete-impact` | — | 200 `DeleteImpact` `{seats, occupiedSeats, placedDevices, pendingRequests}` | 404, 401/403/503 | tier `admin` |
| DELETE | `/api/rooms/:id?force=true` | no body; `force` read only from the query (`"true"` exactly) | 204 | 404, 409 `room_not_empty` (impact re-checked inside the transaction), 401/403/503 | tier `admin` |

No endpoint accepts `seat_counter`, `org_id`, `id` or any seat code (ROO-02).

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/rooms/seat-code.test.ts` › formatSeatCode pads 1→`C302-01`, 9→`-09`, 10→`-10`, 99→`-99`, 100→`C302-100` (no truncation); it takes the already-normalised (uppercase) room code and does not change case itself | ROO-02, Q2 |
| › formatSeatCode throws for seq 0, negative, non-integer | Bounds |
| › nextSeatSeq(0)=1; nextSeatSeq(counter) = counter+1 | D30 |
| › after seats 1..3 and deleting 3, next seq is 4 (D30), not 3 | AC3 |
| › renameSeatCodes C302→C303 derives from seq (`C303-01`, `C303-02`, `C303-110`) | AC2 |
| › renameSeatCodes repairs a corrupted old code (derived from seq, not by string replace) | D29 |
| › renameSeatCodes with no seats → [] | Empty |
| `src/lib/rooms/delete-impact.test.ts` › all zero → direct | ROO-01 |
| › occupiedSeats > 0 → needs force; placedDevices > 0 → needs force | ROO-01 |
| › unoccupied seats and pending requests only → direct (Q4) | ROO-01 |
| `src/lib/validate/room.test.ts` › valid create; trims code/name; code charset after normalisation `[A-Z0-9._-]` (space, `/`, `Phòng` rejected), length 0 and 33 rejected | SYS-02 |
| › lowercase input `c302` (and ` c302 `) → `value.code === "C302"` (stored uppercase); same for PATCH `code` | Q2 |
| › `c302` and `C302` normalise to the same value (a duplicate differing only by case reaches the unique key → 409) | Q2, AC1 |
| › length is checked after trim and uppercase (a 32-char lowercase code is accepted, 33 rejected) | Q2 |
| › name with Vietnamese diacritics accepted and NFC-normalized (`"Phòng họp"` in NFD → NFC); 121 chars rejected | Domain focus |
| › description > 500, floor > 40 rejected; `""` → null | Empty/null |
| › unknown keys (`seat_counter`, `org_id`, `seatCode`) rejected with that field | ROO-02, R6 |
| › non-object body (null, array, string) rejected; non-string field types rejected | SYS-02 |
| › patch `{}` rejected; patch `code: null` / `name: null` rejected; patch `description: null` accepted | PATCH rules |
| `src/server/rooms/pg-error.test.ts` › 23505 + `rooms_org_code_key` → room_code_taken; 23505 + `seats_org_code_key` → room_code_taken; other code/constraint → null | AC1 |
| `src/server/rooms/rooms.test.ts` (fake client records `[sql, values]`; `{ orgId } as OrgScope`) › every statement matches `org_id = $1` and binds the scope org first | R6 |
| › create: insert + audit `room.create` in one transaction; unique violation → `{ok:false,409,"room_code_taken"}` and ROLLBACK | AC1, SYS-03 |
| › create after validation of `c302`: the insert binds `"C302"` (uppercase) and the audit meta `{code:"C302"}`; a second create of `C302` (unique violation) → 409 `room_code_taken` | Q2, AC1 |
| › rename: BEGIN, `select … for update`, update rooms, update seats from `unnest($2::uuid[], $3::text[])` built by renameSeatCodes, audit `room.update` meta `{fields, from, to, seats}`, COMMIT | AC2 |
| › update without a code change does not touch seats | D29 |
| › rename failure → ROLLBACK, no COMMIT | Atomicity |
| › missing room (lock returns 0 rows) → 404 not_found for PATCH, impact and DELETE | SYS-01 |
| › delete without force on a non-empty room → 409 room_not_empty and ROLLBACK; no device/seat/room statement ran | ROO-01 |
| › forced delete order: lock → counts → `update devices set role='secondary', seat_id=null` → delete seats → delete room → audit `room.delete` meta `{code, seats, devices, forced}` → COMMIT | ROO-01 |
| › allocateSeatSeq uses `update rooms set seat_counter = seat_counter + 1 … returning seat_counter, code`, never `max(seq)` | AC3, D30 |
| › audit meta holds only codes, field names and counts (no name/description text, no tokens) | SYS-03 |
| `src/server/request/read-json.test.ts` › wrong content type, invalid JSON, body over 16 KB → not ok; valid JSON → ok | SYS-02 |
| `src/server/db/tx.test.ts` › COMMIT on success, ROLLBACK + rethrow on error, client always released | Tx helper |
| `src/app/api/rooms/route.test.ts` › no Authorization → 401 on every handler (pattern of `src/app/api/me/route.test.ts`) | Wiring |
| › with fake auth deps (`globalThis.__simapAuth` + `MM_IDENTITY_ISSUER`, as SIM-023 leaves it): `simap:user` and `simap:manager` → 403 `forbidden` on POST, PATCH, DELETE, delete-impact; `simap:user` GET passes the gate (503 `unavailable` with `DATABASE_URL` unset) | AC4 (API) |
| › non-UUID id → 404 not_found (admin, no DB call) | Q9 |
| The existing `src/app/api/routes-guarded.test.ts` (SIM-023 version) covers the new route files automatically | Guard |

## Approach
1. **Base:** branch from the current `main` after SIM-023 has merged (it comes first in build order). Use `ctx.scope`
   and do not import `orgScopeOf`.
2. **Pure lib first** (`src/lib/rooms/*`, `src/lib/validate/room.ts`) with tests. Add a comment in `seat-code.ts`:
   "D30: next = seat_counter + 1, never max(seq) + 1 (spec ROO-02 wording superseded by the counter)."
3. **Error codes:** append the 4 codes to `src/lib/api/error.ts`. If SIM-006 added an exhaustive
   `Record<ApiErrorCode, …>` error-copy map, add entries for the new codes there; that map is in the UI layer, which
   Slice A otherwise does not touch.
4. **Server helpers:** `withTx`, `writeAudit`, `readJson`, `roomConflict`. Every non-test file starts with
   `import "server-only"`. Every query goes through `orgQuery(client, scope, "… where org_id = $1 …")` (R6). Joins
   also filter by `org_id = $1` on each table (e.g. `left join seats s on s.org_id = r.org_id and s.room_id = r.id`).
5. **`src/server/rooms/rooms.ts`:**
   - `listRooms`: one SELECT with `count(s.id)::int` and `count(s.occupant_id)::int`, `group by r.id`,
     `order by r.code`, `limit 500`.
   - `createRoom`: withTx, insert … returning, `writeAudit("room.create", {code})`, catch → `roomConflict`.
   - `updateRoom`: withTx, `select id, code from rooms where org_id=$1 and id=$2 for update` (404 if no row), update
     the changed fields + `updated_at = now()`. If the code changed: `select id, seq from seats where org_id=$1 and
     room_id=$2`, `renameSeatCodes`, then a single `update seats … from unnest(...)` and `updated_at = now()`. Then
     audit `room.update` with `{fields, from?, to?, seats?}`, then re-select the DTO.
   - `getDeleteImpact(client|pool, scope, id)`: shared count query (seats, occupied, devices on those seats, pending
     requests on those seats). It is used by the GET and, inside the DELETE transaction after the lock, by the
     server-side re-check.
   - `deleteRoom(force)`: lock → impact → if `!force && !canDeleteDirectly` return 409. Otherwise demote and release
     devices in one UPDATE, delete seats (requests cascade), delete the room (fixtures cascade), audit `room.delete`.
     The same steps run for a direct delete (the device UPDATE is then a no-op).
   - `allocateSeatSeq(client, scope, roomId)`: exported for SIM-015.x, no route (Q11). It takes the same row lock as
     rename, so a rename and a seat creation serialize.
6. **Routes:** a thin `withAuth` per method with `{ tier }`. Steps: check the id → `getPool()` (null → 503) →
   `readJson` → validator → service → `Response.json` / `apiError`. Never return pg error text. The `withAuth`
   catch-all already turns unexpected throws into 500 `internal` and logs only the code.
7. **One-off DB check** (recorded in impl-log, not committed): with `docker compose -f compose.dev.yml up -d` and
   `pnpm migrate`, replay the rename and forced-delete SQL in psql on a hand-seeded org (room `C302`, 3 seats, delete
   seq 3 then `update rooms set seat_counter…` → 4; one occupant + one primary device). Confirm that COMMIT succeeds
   (the deferred trigger passes), the device ends `secondary` with `seat_id null`, and the seat codes read `C303-01..`.
8. Run all Checks.

Rules: R1 (lib is pure; routes are the only entry into `src/server/**`; Slice B UI imports only `@/lib/*` and `@/ui/*`),
R3 (no new env names; `DATABASE_URL` already exists), R4 (room switcher, seat CRUD routes and route re-keying are
follow-ups), R5 (tests above), R6 (`orgQuery` + `ctx.scope`, 404 for other orgs' ids). No `.env.example` change.

### Slice B approach (for SIM-010.2)
- `RoomsPage` (client) gets `fetcher = apiFetch` from SIM-006's `src/ui/api/` and builds `createRoomsApi(fetcher)`.
  `RoomsView` is pure (`rooms`, `status`, `errorCode`, `canManage`, callbacks) and is tested with
  `renderToStaticMarkup` in the node environment, like `AppShellView.test.tsx`. Dialogs are not rendered in tests
  (no `showModal` in node).
- `canManage = session ? atLeastTier(session.tier, "admin") : false` (`src/lib/tier.ts:7`). Actions are hidden, not
  disabled.
- Form state lives in a child keyed per open (`EntityFormDialog` unmounts when closed). It validates with
  `validateRoomCreate/Patch`, maps the `field` to an inline copy message, maps `room_code_taken` inline, and keeps the
  dialog open. In edit mode, when the code changes, the subtitle is
  `roomsCopy.renameWarning(old, new)` ("Seat codes will be renamed (C302-01 becomes C303-01)").
- Delete: GET impact → if `canDeleteDirectly`, plain confirm; else forced confirm that lists occupied seats, placed
  devices and pending requests → `DELETE ?force=true`. A 409 `room_not_empty` reloads the impact. `reload()` runs
  after every mutation.
- No literals in components (SIM-022 `no-literals.test.ts`). Components import `../copy/rooms`; the page imports
  `@/ui/copy/rooms`.

## Specialist input used
- api-platform-engineer, adopted: route shapes, tiers, `?force=true` from the query, re-check inside the transaction,
  404 for foreign ids, no pagination + `limit 500`, counter allocation via `UPDATE … RETURNING`, rename derived from
  seq, forced-delete order with role+seat_id in one UPDATE, `writeAudit`, `readJson`, validator rules, error codes
  `invalid_request`/`not_found`/`room_code_taken`/`room_not_empty`, and the 23505 mapping.
- api-platform-engineer, changed:
  - The rename uses `unnest` arrays from the pure `renameSeatCodes` instead of `lpad(seq::text, 2, '0')`.
    `lpad(…, 2, …)` truncates `100` to `10`, and this way the tested function is the production path.
  - No `field` in `ApiErrorBody` and no impact counts in the 409 body. Either one would mean editing
    `src/server/http/respond.ts`, a High path. The UI validates with the same lib validator and fetches the impact
    separately (Q5, Q6).
  - `readJson` lives in `src/server/request/`, not `src/server/http` (Q10).
  - A non-UUID id gives 404, not 400 (Q9).
- frontend-developer, adopted (Slice B): RoomsView/RoomsPage split, `useRooms` without SWR, `roomsApi` with an injected
  fetcher, states (loading/empty/error/ready), hidden admin actions, one form dialog for create/edit with a rename
  warning, a separate delete dialog with impact, `RoomCard` + `OccupancyRing` with a 0-seat guard and `role=img`, a
  copy file, and testing the view only (no `showModal` in tests).
- frontend-developer, deferred: the room switcher + `RoomsProvider` + `AppShellView` slot (not in the ticket scope;
  it touches the SIM-022/SIM-006 hotspot `AppShellView.tsx`; follow-up, Q7). Re-keying `rooms/[roomCode]` to the id
  is left to SIM-015.1/SIM-012, which build those pages (Q13).
- frontend-developer, rejected: error code names `duplicate_room_code`/`room_not_found`/`validation`, in favour of the
  API consult's names (one set).
- Uppercase normalization of codes: adopted after Ming's answer to Q2 (server `trim().toUpperCase()` in the validator,
  plus input uppercasing in the Slice B form).

## Assumptions
- **SIM-023 (merged before this ticket is built):** `AuthContext = Readonly<{sub, email, org, tier, scope: OrgScope}>`;
  `withAuth(handler(req, ctx, {params: Promise<P>}), { tier })`. Handlers pass `ctx.scope` to services, and services
  take `scope: OrgScope`. `orgScopeOf` is gone. Tests build scopes with `{ orgId } as OrgScope`, which is allowed only
  in test files. The route test that fakes auth deps assumes SIM-023 keeps `globalThis.__simapAuth`/`AuthDeps`. If it
  does not, the test uses whatever seam SIM-023's `with-auth.test.ts` uses. If SIM-023 has not merged when
  implementation starts, the implementer waits or rebases onto it rather than calling `orgScopeOf`.
- **SIM-022 (copy convention):** `src/ui/copy/<feature>.ts` exports `<feature>Copy` `as const`, English only.
  Value-taking strings are pure functions. Components import relatively and pages via `@/ui/copy/…`.
  `src/ui/copy/no-literals.test.ts` fails on JSX text or user-facing string props outside copy files (escape hatch
  `// copy-ok: <reason>`). Slice B follows this. Slice A has no UI copy. API errors carry codes only (D36).
- **SIM-006 (browser `apiFetch`):** Slice A does not need it. Slice B calls the API only through
  `createRoomsApi(fetcher)`, where `fetcher: (path: string, init?: RequestInit) => Promise<Response>`. `RoomsPage`
  passes SIM-006's `apiFetch` (bearer, re-mint once on 401/403). Before SIM-006 merges, only the injected-fetcher unit
  tests and the pure view can run. That is why SIM-010.2 lists SIM-006 in `Depends on` (default), and there is no
  placeholder `fetch` without a token.
- **Hotspots shared with open tickets:**
  - `src/lib/api/error.ts`: SIM-006 may add client-side codes or an exhaustive error-copy map. This ticket appends
    only, so expect a trivial rebase.
  - `src/app/api/routes-guarded.test.ts` and `with-auth.ts` (SIM-023): not edited here.
  - `src/ui/copy/copy.test.ts`, `src/app/(app)/rooms/page.tsx` (SIM-022) and `src/ui/index.ts`: Slice B only.
- "Empty room" for a direct delete means 0 occupied seats and 0 placed devices. Unoccupied seats and their pending
  requests are removed without force (Q4).
- Room codes are always uppercase (Ming, Q2/Q22). The validator normalises (`trim().toUpperCase()`) before validation
  and storage, so `c302` and `C302` are the same code and the unique key `(org_id, code)` yields 409 on a case-only
  duplicate. No migration is needed: the schema stays as is, and case is enforced at the server boundary. A
  `check (code = upper(code))` constraint would be a separate forward-only migration and is not part of this ticket
  (follow-up if wanted). Importing lowercase seatMGT data is outside this ticket; an importer would have to normalise.
- Floor is free text of at most 40 characters (schema `floor text null`). Name is at most 120, description at most 500.
- Audit actions: `room.create` `{code}`, `room.update` `{fields, from?, to?, seats?}` (one row, including the seat
  rename), `room.delete` `{code, seats, devices, forced}`. Entity `room`.
- Room cards in Slice B do not link anywhere yet. The detail route belongs to SIM-012/SIM-015.1.
- Rename collisions: a seat code is `<room code>-<digits>`, so it splits uniquely at the last `-`. A rename to an
  unused room code cannot collide with another room's seats. A 23505 on `seats_org_code_key` still maps to 409
  defensively.

## Blocking questions
None. All decisions below have defaults and are reversible. They are listed for Ming's batch approval round:
1. **Split** into Slice A (API, this PR) and SIM-010.2 (UI, depends on SIM-006)? Why: about 1,600 lines in total;
   Slice A alone is about 900 (about 60% tests). Default: **yes, split**. The orchestrator adds SIM-010.2 to the
   board after SIM-010. AC4's "UI hides the actions" moves there.
2. Room code case: **ANSWERED by Ming (Q22, 2026-11-20): always uppercase.** The UI input uppercases as the user
   types (Slice B) and the server validator normalises with trim + `toUpperCase()` before validation and storage, so
   `c302` and `C302` are the same code (409 on a duplicate).
3. Code charset/length: Default **`[A-Z0-9._-]` after normalisation, 1-32 characters** (changed from `[A-Za-z0-9._-]`
   by Q2; lowercase input is accepted and uppercased, not rejected).
4. Does "empty room" mean no occupants and no devices, or no seats at all? Default: **no occupants and no devices**.
5. A 400 carries only `invalid_request` (no `field`), so that `src/server/http/respond.ts` (High) is not touched.
   Default: **yes**. The UI validates with the same lib validator.
6. A 409 `room_not_empty` has no counts in the body, and the UI re-fetches `/delete-impact`. Default: **yes** (same
   reason).
7. The room switcher in the shell (spec `:413`) is not in this ticket. Default: **follow-up debt issue, picked up by
   SIM-015.1**.
8. Is the room list open to every member, with no pagination and `limit 500`? Default: **yes**.
9. Non-UUID `:id` → 404 (as if it did not exist). Default: **yes**.
10. `readJson` goes in `src/server/request/` (not a High path) rather than `src/server/http/` (High). Why: it does no
    auth. Default: **`src/server/request/`**. Ming may prefer it in `http/`, which would make this PR High-gated.
11. Export `allocateSeatSeq` now, without a route, for SIM-015.x. Default: **yes** (it is the D30 mechanism under
    AC3's test).
12. Audit action names as in Assumptions. Default: **as listed**.
13. Re-key `/rooms/[roomCode]` to the id. Default: **left to SIM-015.1/SIM-012**.

## Split proposal
- **Slice A, SIM-010 (this plan, built now):** error codes, `src/lib/rooms/*`, `src/lib/validate/room.ts`,
  `src/server/{db/tx,audit/write,request/read-json,rooms/*}.ts`, the three route files, and the tests. About 900
  changed lines (about 550 of them tests). This is over the ~400 guide, but it cannot be cut further without shipping
  routes without their transactions or tests.
- **Slice B, SIM-010.2 "Rooms page: room cards, occupancy ring, create/edit/delete dialogs"** (Depends on SIM-010,
  SIM-006, SIM-022; Gate none; about 700 lines). Its files, tests and approach are in this plan under "Slice B".
  Acceptance: AC4's UI half; loading, empty and error states; the rename warning; forced-delete confirmation; and
  `RoomsView`/`rooms-api`/`occupancy` tests.
- If Ming rejects the split (Q1), both slices are built in one PR from this plan, and SIM-010 then also depends on
  SIM-006 and SIM-022.
