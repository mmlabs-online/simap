Status: READY

# Plan — SIM-010.2: Rooms page UI: cards, occupancy ring, create/edit/delete dialogs

> Slice B of the approved `work/tickets/SIM-010/plan.md` (lines 73-90, 196-211; approved 2026-11-20, batch
> 2026-11-20-2). This plan reuses that slice. It re-plans only what changed on `main` since then: SIM-006.2
> (`AuthGate` + `useApiFetch`, `ApiAccessError`), SIM-022 (copy convention, auto-collected `copy.test.ts`,
> `apiErrorMessage`), SIM-025 (server-only, no UI contract change) and SIM-019 (audit API, no UI on main; SIM-019.2
> will follow the same `create*Api(fetcher)` pattern). Each change against the source slice is marked **(changed)**.

## Scope summary
- Source slice, SIM-010 plan AC4: "Non-Admins get 403 on writes; the UI hides the actions." UI half:
  "`src/ui/rooms/RoomsView.test.tsx` › user/manager see no New room, Edit or Delete buttons; admin sees them."
- Source slice, split proposal (`SIM-010/plan.md:305-308`): "Acceptance: AC4's UI half; loading, empty and error
  states; the rename warning; forced-delete confirmation; and `RoomsView`/`rooms-api`/`occupancy` tests."
- spec ROO-01 (`docs/spec-v1.md:210-218`): "An Admin creates a room with code, name, description and floor. A duplicate
  code is rejected with a clear message." "Changing the code regenerates every seat code of the room (`C302-01` →
  `C303-01`)". "Deleting a room first shows its impact: the number of occupied seats and placed devices." "If the room is
  empty, delete works directly. If not, the Admin must confirm a forced delete."
- spec DSH (`:373`): "room cards and an occupancy ring as in seatMGT".
- Ticket: "Ming Q22: the code input uppercases as the user types." "Calls the API only through SIM-006 apiFetch (via
  SIM-006.2 context)."
- `work/decisions.md` D36 (UI copy English, in copy files), D47 (no map/canvas/pixel UI; no seat list; cards link
  nowhere; room switcher is SIM-012), D52 (management surfaces use the clean UI kit).
- CLAUDE.md R1 (ui → lib only; page → ui, lib), R4, R5; Conventions: "UI copy: English, in `src/ui/copy/<feature>.ts`".

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | AC4 UI half: User and Manager see no New room, Edit or Delete action; Admin sees all three (hidden, not disabled). | `src/ui/rooms/RoomsView.test.tsx` › "user/manager (canManage=false) markup has no New room, Edit or Delete labels; admin (canManage=true) has all three per card". Reading `RoomsPage.tsx`: `canManage = session ? atLeastTier(session.tier, "admin") : false` (`src/lib/tier.ts:7`). |
| 2 | Loading, empty and error states. | `RoomsView.test.tsx` › "loading renders skeleton cards with aria-busy=true", "ready with 0 rooms shows the empty text", "error shows role=alert with apiErrorMessage(code) and a Retry button". |
| 3 | Room cards with an occupancy ring (0-seat safe, accessible). | `src/lib/rooms/occupancy.test.ts` (cases below); `RoomsView.test.tsx` › "ready renders one card per room with code, name, and an svg role=img whose aria-label is roomsCopy.occupancyLabel(occupied, total)". |
| 4 | Rename warning when the code changes in edit mode. | `src/ui/rooms/room-form.test.ts` › "renameWarningFor: null when code unchanged (case/space-insensitive), text with C302-01 → C303-01 when changed, null in create mode". |
| 5 | Delete shows impact; plain confirm when empty, forced confirm otherwise; force sent only after forced confirm. | `src/ui/rooms/delete-flow.test.ts` › "deleteStep: all zero → plain; occupied>0 → forced; devices>0 → forced; free seats + pending only → plain (Q4)", "impactLines lists only non-zero counts"; `src/ui/rooms/rooms-api.test.ts` › "remove(id, false) calls DELETE /api/rooms/<id> without query; remove(id, true) adds ?force=true". |
| 6 | Code input uppercases as the user types (Q22). | `room-form.test.ts` › "codeInput('c302') → 'C302'; ' c3a ' keeps spaces (trim is the validator's job) → ' C3A '"; reviewer reads `RoomFormDialog.tsx`: the code `DialogField` has `onChange={(e) => set("code", codeInput(e.target.value))}`, `autoCapitalize="characters"`, `spellCheck={false}`. |
| 7 | Client validation reuses the lib validator; server errors map to copy. | `room-form.test.ts` › "toCreateBody runs validateRoomCreate; field code/name/description/floor → roomsCopy.fieldErrors[field]", "toPatchBody sends only changed fields; no change → { kind: 'unchanged' }"; `rooms-api.test.ts` › "409 body room_code_taken → {ok:false, code:'room_code_taken'}". |
| 8 | API only through `useApiFetch`; `ApiAccessError` and network errors never leave `rooms-api` unhandled. | `rooms-api.test.ts` › "fetcher throwing ApiAccessError('forbidden') → {ok:false, code:'forbidden'}", "'signed_out' → 'unauthenticated'", "TypeError → 'unavailable'", "unparsable error body → 'internal'". Reviewer greps: no `fetch(` in `src/ui/rooms/**`. |
| 9 | Copy follows the SIM-022 convention. | `pnpm test` runs `src/ui/copy/no-literals.test.ts` (new `.tsx` files scanned) and `copy.test.ts` (auto-collects `src/ui/copy/rooms.ts`). |
| — | Checks green | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`. |

## Ming verification after merge
- In a browser, signed in as an Admin of an org (needs an Identity token with an `org` claim; if the account has no
  default org this waits for SIM-007), on `/rooms`: create `c302` (field shows `C302` while typing), create `C302`
  again (message "This room code is already used."), edit it to `C303` (rename warning shown), delete an empty room
  (plain confirm), and force-delete a room with an occupant (forced confirm lists counts). Seat creation needs SIM-012,
  so the occupant case may have to be seeded with `pnpm seed:dev` or psql locally.
- Signed in as User or Manager: the list shows, no New room / Edit / Delete buttons.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/ui/copy/rooms.ts` (new) | `export const roomsCopy = {...} as const`, English, no diacritics: `newRoom`, `edit`, `delete`, `retry`, `createTitle`, `editTitle`, `create` (submit), `fields: {code, name, description, floor}`, `fieldErrors: {code, name, description, floor, body}` (code: "Use 1-32 letters, digits, dot, dash or underscore."), `deleteTitle`, `deleteSubmit`, `forceDeleteSubmit`; pure functions `occupancyLabel(occupied,total)`, `percent(p)`, `seatsSummary(occupied,total)`, `renameWarning(from,to)`, `deleteBody(code)`, `forceDeleteIntro(code)`, `impactSeats(n)`, `impactOccupied(n)`, `impactDevices(n)`, `impactRequests(n)`, `editLabel(code)`, `deleteLabel(code)`. **(changed)** No `errors` map: API errors use the existing `apiErrorMessage` (`src/ui/copy/api.ts:21`); no Cancel/Saving (kitCopy defaults). Title and empty text reuse `shellCopy.pages.rooms`. | D36, SIM-022 | No |
| ~~`src/ui/copy/copy.test.ts`~~ | **(changed) dropped**: it auto-collects every copy file via `import.meta.glob` (`copy.test.ts:6`). | — | — |
| `src/lib/rooms/occupancy.ts` (new) | `occupancyPercent(occupied,total)` (total ≤ 0 → 0; rounded; clamped 0-100), `ringDash(percent, radius)` → `{circumference, offset}` | Pure ring math | No |
| `src/ui/rooms/rooms-api.ts` (new) | `createRoomsApi(fetcher: ApiFetch)` → `list()`, `create(body)`, `update(id, patch)`, `impact(id)`, `remove(id, force)`; each returns `RoomsResult<T> = {ok:true,value:T} \| {ok:false,code:string}` and never throws. **(changed)** maps thrown `ApiAccessError` (`signed_out`/`unauthenticated` → `unauthenticated`, others → their code), any other throw → `unavailable`, non-2xx → `{error:{code}}` body code or `internal`. Paths `/api/rooms`, `/api/rooms/${encodeURIComponent(id)}`, `/delete-impact`, `?force=true`. JSON bodies with `content-type: application/json`. | Isolates `apiFetch` (`src/lib/api/fetch.ts:47`) | No |
| `src/ui/rooms/useRooms.ts` (new) | `useRooms(api)` → `{status:"loading"\|"error"\|"ready", rooms, errorCode, reload}`; stable `reload` (`useCallback`), request counter drops stale responses and post-unmount setState. **(changed)** no "wait for session": `RoomsPage` only renders inside `AuthGate` ready state (`AuthGate.tsx:384-391`). | Data loading | No |
| `src/ui/rooms/room-form.ts` (new) | **(new vs source)** pure helpers: `codeInput(raw)` (`toUpperCase()`, Q22); `emptyForm()` / `formFromRoom(room)`; `toCreateBody(form)` → `{kind:"ok",body}` \| `{kind:"invalid",message}` via `validateRoomCreate`; `toPatchBody(form, room)` → only changed fields, validated via `validateRoomPatch`, or `{kind:"unchanged"}`; `fieldMessage(field)` → `roomsCopy.fieldErrors[...]` (fallback `body`); `renameWarningFor(mode, originalCode, typedCode)` | Testable without jsdom (consult §5) | No |
| `src/ui/rooms/delete-flow.ts` (new) | **(new vs source)** `deleteStep(impact)` → `"plain" \| "forced"` (wraps `canDeleteDirectly`, `src/lib/rooms/delete-impact.ts:4`); `impactLines(impact)` → copy strings for non-zero counts | Testable delete logic | No |
| `src/ui/rooms/OccupancyRing.tsx` (new) | Plain SVG ring (`role="img"`, `aria-label={roomsCopy.occupancyLabel(...)}`), centre text `{roomsCopy.percent(p)}`; tokens only, no pixel art (D47/D52) | DSH | No |
| `src/ui/rooms/RoomCard.tsx` (new) | Presentation-only `Card` with code, name, floor, `seatsSummary`, ring; optional `actions` slot. Does not link (D47). | DSH | No |
| `src/ui/rooms/RoomsView.tsx` (new) | Pure view: props `{status, rooms, errorCode, canManage, onRetry, onNew, onEdit(room), onDelete(room)}`; header `h1` (shellCopy title) + `New room` (`Button icon="add"`) only when `canManage`; loading = 3 skeleton cards in a container with `aria-busy="true"`; empty = `shellCopy.pages.rooms.empty`; error = `role="alert"` + `apiErrorMessage(errorCode)` + Retry; ready = grid of `RoomCard key={room.id}` with Edit (`Button variant="tonal" icon="edit"`) and Delete (`Button variant="danger"`) only when `canManage` | Test seam | No |
| `src/ui/rooms/RoomFormDialog.tsx` (new) | `EntityFormDialog` with four `DialogField`s (icons from the existing list: code `grid_view`, name `meeting_room`, description `edit_square`, floor `lan`); inner form keyed per open; uses `room-form.ts`; subtitle = `renameWarningFor(...)`; server error → `apiErrorMessage(code)` in the dialog `error`; `unchanged` → close without a request | ROO-01, Q22 | No |
| `src/ui/rooms/DeleteRoomDialog.tsx` (new) | `EntityFormDialog`: loads `api.impact(id)`, body = `deleteBody` or `forceDeleteIntro` + `impactLines` list, submit `deleteSubmit` / `forceDeleteSubmit`, calls `remove(id, step === "forced")`; 409 `room_not_empty` → reload impact and stay; 404 → close and reload list | ROO-01 | No |
| `src/ui/rooms/RoomsPage.tsx` (new) | `"use client"`: `useApiFetch()`, `useMemo(() => createRoomsApi(apiFetch), [apiFetch])`, `useSession()`, `useRooms`, dialog state, `canManage`; `reload()` after every successful mutation and after a 404 | Glue | No |
| `src/ui/index.ts` | **(changed)** add `export { RoomsPage } from "./rooms/RoomsPage";` (existing barrel pattern, consult §9) | R1: page imports `@/ui` | No |
| `src/app/(app)/rooms/page.tsx` | Render `<RoomsPage />` from `@/ui` instead of `PageSkeleton`; stays a server component | Route | No |
| Tests (new) | `src/lib/rooms/occupancy.test.ts`, `src/ui/rooms/rooms-api.test.ts`, `src/ui/rooms/room-form.test.ts`, `src/ui/rooms/delete-flow.test.ts`, `src/ui/rooms/RoomsView.test.tsx` | R5 | No |

**High paths:** none. Gate stays `none`. No `src/server/**` change, so the security trigger does not fire.
Not touched: `src/lib/icons.ts` (all icons above exist, `src/lib/icons.ts:5-25`), `src/lib/api/error.ts`,
`src/ui/copy/api.ts`, `src/ui/EntityFormDialog.tsx`, `src/app/(app)/rooms/[roomCode]/**`.

## Data model / migration
None.

## API contract
None changed. Consumed as built by SIM-010 / SIM-025 (`src/app/api/rooms/route.ts`, `[id]/route.ts`,
`[id]/delete-impact/route.ts`): `GET /api/rooms` → `{rooms: RoomDto[]}`; `POST` → 201 `RoomDto`; `PATCH /api/rooms/:id`
(at least one field, `{}` → 400) → `RoomDto`; `GET /api/rooms/:id/delete-impact` → `DeleteImpact`;
`DELETE /api/rooms/:id[?force=true]` → 204 / 409 `room_not_empty`. Errors `{error:{code}}`. SIM-025 changed only
server internals (streamed body cap, seat lock order); the UI sends small JSON bodies, well under 16 KB.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/rooms/occupancy.test.ts` › occupancyPercent(0,0)=0, (0,10)=0, (5,10)=50, (1,3)=33, (2,3)=67, (10,10)=100, (11,10)=100 (clamped), negative total → 0 | Ring math, 0-seat guard |
| › ringDash(0,r).offset = circumference; ringDash(100,r).offset = 0; ringDash(50,r) = half | Ring math |
| `src/ui/rooms/rooms-api.test.ts` (fake fetcher records `[path, init]`) › list: GET `/api/rooms`, returns `rooms`; body without an array → `internal` | Contract |
| › create: POST `/api/rooms` with JSON body + content-type; 201 → RoomDto | Contract |
| › update: PATCH `/api/rooms/<id>` with only the given fields | Contract |
| › impact: GET `/api/rooms/<id>/delete-impact` | Contract |
| › remove(id,false) → DELETE without query; remove(id,true) → `?force=true`; 204 → ok | ROO-01 |
| › 409 `{error:{code:"room_code_taken"}}` → `{ok:false,code:"room_code_taken"}`; 409 `room_not_empty` likewise; 503 `unavailable` likewise | Error mapping |
| › non-JSON error body → `internal` | Error mapping |
| › fetcher throws `ApiAccessError("forbidden")` → `forbidden`; `("member_deactivated")` → same; `("signed_out")` and `("unauthenticated")` → `unauthenticated`; `TypeError` → `unavailable` | Consult §3, risk "loading forever" |
| `src/ui/rooms/room-form.test.ts` › codeInput: `c302` → `C302`; mixed `c3a-b` → `C3A-B`; spaces kept | Q22 |
| › toCreateBody: valid form → body with uppercase code (validator output); empty code → fieldErrors.code; empty name → fieldErrors.name; 501-char description → fieldErrors.description; 41-char floor → fieldErrors.floor; Vietnamese name `Phòng họp` accepted | Validation reuse, Domain focus |
| › toPatchBody: only changed fields sent; `c302` typed for room `C302` counts as unchanged code; clearing description sends `description: null`; nothing changed → `unchanged` | PATCH rules (`{}` would be a 400) |
| › fieldMessage: unknown field → fieldErrors.body | Fallback |
| › renameWarningFor: edit + `C302` → `c303` → text containing `C302-01` and `C303-01`; same code (any case, surrounding spaces) → null; invalid typed code → null; create mode → null | Rename warning |
| `src/ui/rooms/delete-flow.test.ts` › deleteStep all zero → plain; occupiedSeats>0 → forced; placedDevices>0 → forced; seats+pendingRequests only → plain | ROO-01, Q4 |
| › impactLines: only non-zero counts, in order seats, occupied, devices, requests; all zero → [] | Impact display |
| `src/ui/rooms/RoomsView.test.tsx` (`renderToStaticMarkup`, node env, like `AppShellView.test.tsx`) › loading: `aria-busy="true"`, no room codes | States |
| › ready + 0 rooms: shows `shellCopy.pages.rooms.empty` | Empty |
| › error `unavailable`: `role="alert"`, `apiCopy.errors.unavailable`, Retry label | Error |
| › ready + 2 rooms: both codes and names, two `role="img"` with `occupancyLabel` text; a 0-seat room renders `percent(0)` | Cards, ring |
| › canManage=false: no `roomsCopy.newRoom`, no `editLabel(code)`, no `deleteLabel(code)`; canManage=true: all present per card | AC4 UI half |
| Existing `src/ui/copy/no-literals.test.ts`, `copy.test.ts`, `scripts/check-layers.test.ts` | Copy and layer rules on the new files |

## Approach
1. Branch `ticket/SIM-010.2` from current `main` (SIM-010, SIM-025, SIM-026, SIM-006.2, SIM-022, SIM-019 merged).
2. Pure code first: `src/lib/rooms/occupancy.ts`, `src/ui/copy/rooms.ts`, `src/ui/rooms/room-form.ts`,
   `src/ui/rooms/delete-flow.ts`, `src/ui/rooms/rooms-api.ts`, with their tests. `rooms-api.ts` imports
   `ApiAccessError`/`type ApiFetch` from `@/lib/api/fetch` and types from `@/lib/rooms/types` (ui → lib, R1).
3. `useRooms.ts`: `useEffect(() => { void reload(); }, [reload])`; every path ends in `ready` or `error` (rooms-api
   never throws).
4. Views: `OccupancyRing`, `RoomCard`, `RoomsView` (pure, testable), then `RoomFormDialog`, `DeleteRoomDialog`,
   `RoomsPage`. Clean UI kit only (`Card`, `Button`, `EntityFormDialog`, `DialogField`), tokens, no pixel fonts or art
   (D47/D52). Cards `key={room.id}` so focus return survives `reload()`.
5. Copy rules (SIM-022): no JSX text and no literal `aria-label|title|placeholder|label|subtitle|submitLabel|…` props;
   all through `roomsCopy`, `shellCopy`, `apiErrorMessage`. Components import `../copy/rooms`, `../copy/shell`,
   `../copy/api`. No Vietnamese in copy files.
6. Mutation errors: show `apiErrorMessage(code)` in the open dialog's `error` (`role=alert`) and keep it open, except
   404 (close + reload) and delete 409 `room_not_empty` (reload impact, switch to forced step).
7. Export `RoomsPage` from `src/ui/index.ts`; `src/app/(app)/rooms/page.tsx` renders it.
8. Run all Checks. Optional local smoke: `pnpm dev` and open `/rooms` to see the gate (a real sign-in needs Identity).

Rules: R1 (ui imports only `@/lib/*` and relative `src/ui`; page imports `@/ui` only; `pnpm check:layers`), R3 (no env),
R4 (no room switcher, no detail links, no seat UI, no kit/icon changes), R5 (tests above), R6 not applicable (no
server code; scoping is the API's).

## Specialist input used
- frontend-developer (consult for SIM-010.2), adopted:
  - §1 `useApiFetch()` from `@/ui` instead of "SIM-006's `src/ui/api/`"; drop "wait for session"; keep the
    `session` null guard for typing.
  - §2 rely on the `AuthGate` generation remount; guard stale/unmounted responses with a request counter.
  - §3 `rooms-api` maps thrown `ApiAccessError` and network errors, fetcher typed `ApiFetch`.
  - §4 drop the `copy.test.ts` edit; reuse `apiErrorMessage`; no Cancel/Saving copy; reuse `shellCopy.pages.rooms`.
  - §5 extract form and delete logic into pure `room-form.ts` and `delete-flow.ts` with unit tests; view tested with
    `renderToStaticMarkup` only.
  - §6 `DeleteRoomDialog` on `EntityFormDialog`; field errors go into the dialog-level `error`.
  - §7 clean kit, presentation-only `RoomCard`/`OccupancyRing`, cards link nowhere.
  - §9 export `RoomsPage` from the `@/ui` barrel.
  - Q22: `autoCapitalize="characters"`, `spellCheck={false}`, validator re-normalises.
- Adjusted: the consult says the kit has "no destructive button style"; `Button` has a `danger` variant
  (`src/ui/Button.tsx:15`), so the card's Delete button uses it. The dialog submit stays the kit default (no kit
  change).
- Open question on icons: answered from code; `grid_view`, `meeting_room`, `edit_square`, `lan`, `edit`, `add` all
  exist, so no `icons.ts` change.
- Not adopted: calling `refreshPermissions()` on a stale-tier 403 (see Assumptions; R4).

## Assumptions
- **Stale-tier 403 on a mutation:** show `apiErrorMessage("forbidden")` in the dialog only; do not call
  `useShellActions().refreshPermissions`. Proposed default: **message only** (consult's recommendation, stays in R4);
  wiring a refresh is a follow-up if Ming wants it.
- **Edit with no change:** the dialog closes without a request (PATCH `{}` is a 400 by design). Proposed default:
  **close silently**.
- **Delete after 404:** the room was deleted elsewhere; close the dialog and reload the list, no error shown.
  Proposed default: **yes**.
- **Error-code fallback:** an unreadable error body maps to `internal`; a thrown non-`ApiAccessError` maps to
  `unavailable`. Proposed default: **as stated**.
- **Percent rounding:** `Math.round`, clamped to 0-100. Proposed default: **yes**.
- **No list sorting or search in the UI:** the API already orders by code (`limit 500`). Proposed default: **render in
  API order**; search is a follow-up.
- **Field icons** as listed (existing icon set only). Proposed default: **yes**.
- **Size:** about 700-800 changed lines (more than half tests and pure helpers), over the ~400 guide. The source plan
  already approved this slice as one unit; splitting the view from its dialogs would ship a page with hidden actions
  only. Proposed default: **no further split**.
- **Hotspots with open tickets:**
  - `src/ui/index.ts`: SIM-006.3 (PLANNING) and SIM-019.2 (BACKLOG) also add exports. Append-only; expect a trivial
    rebase.
  - `src/ui/copy/api.ts` / `src/lib/api/error.ts`: SIM-007 (PLANNING) may append codes. Read-only here.
  - SIM-019.2 will add `src/ui/audit/audit-api.ts` with the same result/error mapping. No shared helper is extracted
    now (R4); a later ticket may lift the mapping into a shared module.

## Blocking questions
None.

## Split proposal
None (this ticket is already Slice B of SIM-010).
