Status: READY

# Plan — SIM-046.2: Profile photos in member lists, member card and seat panel

## Scope summary
This is slice 3 of SIM-046. The server routes, migration and service already shipped in SIM-046. The shell avatar and
Profile tab are SIM-046.1.

- Ticket scope:
  - "`hasPhoto` / `photoVersion` on `MemberDto` (`manage.ts` `memberSelect`) and on the seat occupant (`seats.ts`
    `seatRows`)."
  - "A list photo cache (reuse `createImageUrlCache`, concurrency 4; failures fall back to initials)."
  - "Photo in the Members list, member card and seat panel occupant row; 'Remove photo' on the member card for
    Manager+."
- Parent split (`work/tickets/SIM-046/plan.md` l.382-389) lists the same items. It says slice 3 "Covers AC4 (lists,
  seat panel) and the UI of AC5".
- `docs/spec-v1.md` OQ-57 (l.841-843, answered): "the photo shows in the shell avatar, the Members list and member card,
  the seat panel's occupant row and the Profile tab; without a photo those places show the pixel character's head (or
  initials). The pixel character shows only on the room map and in its Profile preview."
- `docs/spec-v1.md` OQ-61 (l.856-858, answered): "a Manager+ can remove another member's photo (audited) but not upload
  one".
- `docs/spec-v1.md` OQ-58 (l.845): Users still see the Members page. Any member may GET another member's photo.
- `docs/spec-v1.md` l.477 (LAY-06) and POR-05: "The photo is never drawn on the room map".
- `work/decisions.md` D71 adds the profile photo and amends D44 ("the map still never shows photos").
- A note on the ticket's "Out of scope: … server, schema and API changes (none needed)": the same ticket's Scope
  explicitly adds two columns to the `memberSelect` and `seatRows` SELECTs. This plan reads "API changes" as "no new
  routes, no new endpoints, no migration". The only server change is two additive read-only response fields (see A1).

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | The Members list, member card and seat panel show the member's photo, or initials when there is none or loading fails. | `MembersView.test.tsx` › "row shows the photo img when photoUrl returns a url, initials otherwise". `MemberPhotoSection.test.tsx` › "shows the photo when photoUrl is set; initials when null". `SeatDetailPanel.test.tsx` › "occupant row shows the photo img when occupantPhoto is set; initials otherwise; nothing for a vacant seat". `member-photos.test.ts` › "cache: no photo -> null url and no load; failed load -> null (initials); version bump reloads". `members-api.test.ts` › "getPhoto accepts png/jpeg blobs, rejects other types". Local run: the Members page and `/rooms/<code>?seat=<code>` show the photo for a member with a photo. |
| 2 | A Manager+ can remove another member's photo from the member card. A User does not see the action. | `MemberPhotoSection.test.tsx` › "Remove photo button only when hasPhoto; aria-label names the member". `MembersView.test.tsx` › "canManage=false: no Edit action, so no member card with Remove photo" (existing Edit-hidden test extended). `member-photos.test.ts` › "removePhotoOutcome: ok -> removed; not_found -> removed; other code -> error". `members-api.test.ts` › "removePhoto sends DELETE /api/members/<id>/photo; 204 -> ok". Server authorization is already covered by SIM-046 `photo-routes.test.ts` ("DELETE as user gives 403"). Local run as Manager: Edit -> Remove photo -> confirm, and the row falls back to initials. |
| 3 | No Drive file id is exposed in any response. | `manage.test.ts` › "memberSelect projects has_photo and photo_version, never the Drive file id column". `seats.test.ts` › "seatRows projects occupant photo fields, never the Drive file id column". DB tests (`pnpm test:db`): `manage.db.test.ts` › "photo fields: list and detail carry hasPhoto/photoVersion; JSON has no Drive id" and `seats.db.test.ts` › "occupant photo fields; JSON has no Drive id". |
| 4 | All Checks pass. | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`. CI also runs `pnpm test:db`. |

The room map stays free of photos (LAY-06). `git diff --stat main` shows no file under `src/server/layout/**`,
`src/lib/sprites/**` or `src/ui/roomlayout/**`. SIM-046.1's guard test (that `roomlayout`/`sprites` never reference a
photo) keeps passing.

## Ming verification after merge
- Hosted (real Drive), as a Manager:
  - Open Members. Members with a photo show it in their row; others show initials.
  - Open a seat whose occupant has a photo. The panel shows it.
  - Edit a member -> Remove photo -> confirm. The member falls back to initials, and an audit row
    `member.photo_remove` exists.
- As a User: Members shows photos, and there is no Edit, so there is no Remove photo.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/members/types.ts` | `MemberDto` gains `hasPhoto: boolean; photoVersion: number` (as `MemberPhotoDto & {…}`, importing the type from `./photo`) | AC1 and AC3: the shape for the list and detail | No |
| `src/lib/seats/types.ts` (l.29) | `occupant: ({ id: string; displayName: string } & MemberPhotoDto) \| null` | AC1: the seat panel occupant | No |
| `src/server/members/manage.ts` (l.66-130) | `MemberRow` gets `has_photo: boolean; photo_version: number`. `toDto` maps them. `memberSelect` adds `m.photo_drive_file_id is not null as has_photo, m.photo_version` (not gated by `visible`; see A3) | AC1 and AC3. The one select feeds the list, the detail and the post-write reloads | No |
| `src/server/seats/seats.ts` (l.65-145) | `SeatRow` gets `occupant_has_photo: boolean \| null; occupant_photo_version: number \| null`. `seatRows` adds `o.photo_drive_file_id is not null as occupant_has_photo, o.photo_version as occupant_photo_version`. `toDto` puts them on `occupant` (only when `occupant_id` is set) | AC1 and AC3 | No |
| `src/ui/Avatar.tsx` | **Only if SIM-046.1 has not already added it.** Optional `src?: string \| null`: `"use client"`, render `<img src alt="" width={size} height={size} className="rounded-full object-cover flex-none" aria-hidden>` and fall back to initials on `onError` (a `failed` state reset when `src` changes). Backward-compatible | AC1. Shared with SIM-046.1 (see A2) | No |
| `src/ui/members/members-api.ts` | `getPhoto(id)`: GET `/api/members/<id>/photo` -> Blob, ok only if `blob.type` starts with `image/png` or `image/jpeg`, else `internal`. `removePhoto(id)`: DELETE, any 2xx -> `{ok:true, value:null}`. Copies `getImage`/`removeImage` in `src/ui/deviceTypes/device-types-api.ts` l.65-84 | AC1 and AC2 | No |
| `src/ui/members/member-photos.ts` (new) | Pure: `type PhotoRef = { id: string } & MemberPhotoDto`. `toImageEntry(r)` -> `{id, hasImage: hasPhoto, imageVersion: photoVersion}`. `photoLoader(api)` -> `(id) => api.getPhoto(id).then(r => r.ok ? r.value : null)`. `removePhotoOutcome(result)` -> `{kind:"removed"}` for ok or `not_found`, else `{kind:"error", code}` | Pure logic first (rule 6), testable without a DOM | No |
| `src/ui/members/useMemberPhotos.ts` (new) | `"use client"` hook `useMemberPhotos(api: Pick<MembersApi,"getPhoto">, items: readonly PhotoRef[]): (r: PhotoRef) => string \| null`. Same shape as `src/ui/deviceTypes/useDeviceTypeImages.ts` (create the cache on mount with `createImageUrlCache` from `../deviceTypes/image-url-cache`, default limit 4, `URL.createObjectURL`/`revokeObjectURL`, dispose on unmount, `sync(items.map(toImageEntry))` in an effect) | AC1: the list photo cache | No |
| `src/ui/members/MemberPhotoSection.tsx` (new) | The member card's photo block: `Avatar` (size 64, `src` = `photoUrl`), and when `member.hasPhoto && !removed`, a "Remove photo" button (`variant="tonal"`, `aria-label` = `removePhotoLabel(name)`). Clicking shows an inline confirm (body text plus danger "Remove" and "Keep" buttons, all `type="button"`). While the request runs, the buttons are disabled. On `removed`, set local `removed=true` (shows initials) and call `onRemoved()`. On error, show `apiErrorMessage(code)` with `role="alert"` | AC2 | No |
| `src/ui/members/EditMemberDialog.tsx` | New props `photoUrl: string \| null` and `onPhotoRemoved: () => void`. Renders `<MemberPhotoSection>` as the first child of the form. Passes `api` through | AC2: the member card is the Manager's edit dialog (A4) | No |
| `src/ui/members/MembersView.tsx` | New optional prop `photoUrl?: (m: MemberDto) => string \| null` (default `() => null`). The name cell (l.143) becomes `<span className="flex items-center gap-2"><Avatar name={m.displayName} src={…} size={32} />{m.displayName}</span>` | AC1: the Members list | No |
| `src/ui/members/MembersPage.tsx` | `const photoUrl = useMemberPhotos(api, members.items)`. Pass it to `MembersView`. Pass `photoUrl(dialog.member)` and `onPhotoRemoved={() => void members.reload()}` to `EditMemberDialog` | AC1 and AC2 | No |
| `src/ui/seats/SeatDetailPanel.tsx` (l.43-73, l.132-146) | New optional prop `occupantPhoto?: string \| null`, passed to `SeatBody`. The occupant field renders `<span className="flex items-center gap-2"><Avatar name src size={32} /><span className={…CLIP}>{displayName}</span></span>` when there is an occupant, and `seatsCopy.noOccupant` otherwise | AC1: the seat panel | No |
| `src/ui/seats/SeatsPage.tsx` (l.37-43, l.151, l.212-217) | `membersApi = useMemo(() => createMembersApi(apiFetch), [apiFetch])`. `occupant = view.kind === "ready" ? view.seat.occupant : null`. `occupantItems = useMemo(() => occupant ? [occupant] : [], [occupant?.id, occupant?.hasPhoto, occupant?.photoVersion])`. `const photoUrl = useMemberPhotos(membersApi, occupantItems)`. Pass `occupantPhoto={occupant ? photoUrl(occupant) : null}` | AC1 | No |
| `src/ui/copy/members.ts` | `photo: { remove: "Remove photo", removeLabel: (name) => \`Remove photo of ${name}\`, confirmBody: "Remove this photo? The member can upload a new one.", confirm: "Remove", keep: "Keep", removing: "Removing..." }` | D36: UI copy | No |
| `src/server/members/manage.test.ts` | `memberRow` fixture gets `has_photo: false, photo_version: 0`. New SQL and mapping test | AC3 | No |
| `src/server/seats/seats.test.ts` | Fixture (around l.57) gets `occupant_has_photo: null, occupant_photo_version: null`. New SQL test | AC3 | No |
| `src/server/members/manage.db.test.ts` | New test (photo fields, no Drive id) | AC3 | No |
| `src/server/seats/seats.db.test.ts` (l.196) | The `occupant` `toEqual` gets `hasPhoto: false, photoVersion: 0`. New test | AC3 | No |
| `src/ui/members/member-photos.test.ts` (new) | Pure and cache tests | AC1 and AC2 | No |
| `src/ui/members/MemberPhotoSection.test.tsx` (new) | Static render tests | AC1 and AC2 | No |
| `src/ui/members/members-api.test.ts` | `getPhoto` and `removePhoto` tests | AC1 and AC2 | No |
| `src/ui/members/MembersView.test.tsx` | `base` fixture gets `hasPhoto: false, photoVersion: 0`. New photo-cell test | AC1 | No |
| `src/ui/seats/SeatDetailPanel.test.tsx` | Fixture occupant gets the photo fields. New occupant-photo test | AC1 | No |
| `src/ui/Avatar.test.tsx` (new, only if SIM-046.1 did not add one) | `src` renders `<img alt="">`; no `src` renders initials | AC1 | No |
| Fixture-only typecheck fallout: `src/ui/members/member-form.test.ts` (l.7), `src/ui/seats/SeatActions.test.tsx` (l.71, 82, 97, 151), `src/ui/seats/SeatActionDialogs.test.tsx` (l.81), `src/ui/seats/SeatsView.test.tsx` (l.41), `src/ui/seats/seat-actions.test.ts` (l.225, 558), `src/ui/devices/PlaceDeviceDialog.test.tsx` (l.101, 161) | Add `hasPhoto: false, photoVersion: 0` to the `MemberDto` / seat `occupant` literals. No assertion changes. Any further fixture that `pnpm typecheck` flags gets the same two fields and is recorded in impl-log | Typecheck (R5) | No |

No file matches a High path (no migration, `src/server/http/**`, auth, config or `.env.example`).

## Data model / migration
None. The columns `members.photo_drive_file_id` and `members.photo_version` (integer, not null, default 0) exist from
`db/migrations/20261126130000_members_photo.sql`.

## API contract
No new endpoint. Two existing responses gain additive fields:

| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| GET | `/api/members`, `/api/members/[id]`, and every route that returns a `MemberDto` (PATCH, deactivate, reactivate) | unchanged | each `MemberDto` gains `hasPhoto: boolean`, `photoVersion: number` (always present) | unchanged | unchanged (user+) |
| GET/POST | every seat route that returns a `SeatDto` (room seats list, seat detail, seat writes) | unchanged | `occupant` becomes `{id, displayName, hasPhoto, photoVersion} \| null` | unchanged | unchanged |

The client uses these existing routes from SIM-046 unchanged: `GET /api/members/[id]/photo` (user+, ETag) and
`DELETE /api/members/[id]/photo` (manager+, idempotent 204). `photo_drive_file_id` is never selected into a DTO row.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/server/members/manage.test.ts` › "memberSelect projects has_photo and photo_version, never the Drive file id column" (list SQL contains `photo_drive_file_id is not null as has_photo` and `m.photo_version`. After removing that exact expression, the SQL has no other `photo_drive_file_id`. Mapping a row with `has_photo: true, photo_version: 3` gives `hasPhoto: true, photoVersion: 3` and `JSON.stringify` of the DTO has no `drive`, case-insensitive) | AC3 |
| `src/server/seats/seats.test.ts` › "seatRows projects occupant photo fields, never the Drive file id column" (same SQL check with `o.`; a vacant row gives `occupant: null`) | AC3 |
| `src/server/members/manage.db.test.ts` › "photo fields: list and detail carry hasPhoto/photoVersion; JSON has no Drive id". Set B's `photo_drive_file_id = 'file_abcdefghij', photo_version = 2` with SQL, as `photo.db.test.ts` l.118 does. Then `listMembers` (as user and as manager) and `getMember` give B `{hasPhoto:true, photoVersion:2}` and A `{hasPhoto:false, photoVersion:0}`. `JSON.stringify` contains neither `file_abcdefghij` nor `drive` | AC1 and AC3 |
| `src/server/seats/seats.db.test.ts` › "occupant photo fields; JSON has no Drive id". Occupant X has a photo at version 4: `listRoomSeats` and `getSeat` give `occupant: {id, displayName, hasPhoto:true, photoVersion:4}`, a vacant seat gives `occupant: null`, and the JSON does not contain the file id | AC1 and AC3 |
| `src/ui/members/member-photos.test.ts` › "toImageEntry maps hasPhoto/photoVersion" | AC1 |
| `member-photos.test.ts` › "cache: no photo -> null url and no load; ready -> blob url; failed load -> null (initials); version bump reloads and revokes the old url" (`createImageUrlCache` with `photoLoader(fakeApi)`, fake `create` and `revoke`, as in `image-url-cache.test.ts`) | AC1 |
| `member-photos.test.ts` › "photoLoader: api ok -> blob; api error -> null" | AC1 |
| `member-photos.test.ts` › "removePhotoOutcome: ok -> removed; not_found -> removed; forbidden / unavailable -> error with code" | AC2 |
| `src/ui/members/members-api.test.ts` › "getPhoto GETs /api/members/<encoded id>/photo; png and jpeg ok; text/html -> internal; 404 -> not_found" | AC1 |
| `members-api.test.ts` › "removePhoto sends DELETE /api/members/<id>/photo; 204 -> ok; 403 -> forbidden" | AC2 |
| `src/ui/members/MemberPhotoSection.test.tsx` › "shows the photo img (alt empty) when photoUrl is set; initials when null" | AC1 |
| `MemberPhotoSection.test.tsx` › "Remove photo button only when hasPhoto; aria-label names the member (Vietnamese diacritics kept)" | AC2 |
| `src/ui/members/MembersView.test.tsx` › "row shows the photo img when photoUrl returns a url, initials otherwise" | AC1 |
| `MembersView.test.tsx` › "canManage=false: no Edit action (no member card, no Remove photo)" (extend the existing assertion if one already exists) | AC2 |
| `src/ui/seats/SeatDetailPanel.test.tsx` › "occupant row shows the photo img when occupantPhoto is set; initials otherwise; vacant seat shows no avatar" | AC1 |
| `src/ui/Avatar.test.tsx` › "src renders img alt='' at size; no src renders initials" (skip if SIM-046.1 already added an equivalent test) | AC1 |

The `onError` fallback inside `Avatar` cannot be exercised without a DOM: the repo has no jsdom or testing-library, and
tests use `renderToStaticMarkup`. Failed loads are covered at the cache level instead (failed -> `url()` null ->
initials).

## Approach
1. Rebase on `main` after SIM-046.1 merges. Check `src/ui/Avatar.tsx`:
   - If it already has `src`, use it as is.
   - If not, add the shape described above.
2. Types: `MemberDto` and the seat `occupant` gain `MemberPhotoDto`. lib imports lib only (R1).
3. Server SQL (`manage.ts`, `seats.ts`):
   - Project only `photo_drive_file_id is not null` as a boolean, plus `photo_version`.
   - Every query stays scoped by `org_id = $1`, and the `members o` join already repeats `org_id` (R6).
   - No new routes, no writes, no 401/403 paths (R7 untouched).
   - Update the unit and DB tests.
4. `members-api.ts`: add `getPhoto` and `removePhoto`.
5. Pure `member-photos.ts` and its tests. Then `useMemberPhotos.ts` (same shape as `useDeviceTypeImages`).
6. UI:
   - Avatar in the `MembersView` name cell.
   - `MemberPhotoSection` inside `EditMemberDialog`.
   - Wiring in `MembersPage`. One cache per page; `sync` gets only the loaded rows, so a page of at most 100 is
     fetched 4 at a time.
   - `SeatDetailPanel` prop and `SeatsPage` wiring, with a single-item memoized list and its own cache instance, so
     no cache is shared across surfaces. This avoids the eviction issue noted by api-platform-engineer.
7. Remove flow:
   - Confirm, then `api.removePhoto`, then `removePhotoOutcome`.
   - On removed: local `removed=true`, then `onPhotoRemoved()` reloads the list. The new `photoVersion` makes
     `sync` drop and revoke the old blob.
   - The dialog stays open, so the Manager can still edit fields.
   - 404 counts as already removed.
8. Copy goes in `src/ui/copy/members.ts` (D36). `"use client"` only where hooks or state are used.
9. Layers (R1): new files live in `src/ui/members/`. `src/ui/seats/SeatsPage.tsx` imports
   `../members/members-api` and `../members/useMemberPhotos` (ui -> ui is allowed). No import from `src/server/**`,
   and nothing in `src/ui/roomlayout/**`, `src/lib/sprites/**` or `src/server/layout/**` changes (LAY-06).
10. Run `pnpm format`, `pnpm typecheck && pnpm check:layers`, `pnpm test` and `pnpm build`. Run `pnpm test:db` with a
    local DB if available; otherwise CI runs it.

Estimate: about 300 changed product lines and about 300 test lines. That fits one cycle; most of the test lines are
fixture churn.

## Specialist input used
- **frontend-developer:**
  - Adopted:
    - `useMemberPhotos` on the `useDeviceTypeImages` shape.
    - `getPhoto`/`removePhoto` copied from `device-types-api.ts`, with the png/jpeg blob check.
    - `Avatar` `src` with `alt=""` and an initials fallback.
    - Per-page cache instances.
    - A confirm step, a disabled button in flight, 404 treated as removed, and an `aria-label` with the name.
    - Reload after removal.
    - No photo fields in the layout, sprites or roomlayout code.
  - Adopted with change:
    - Open question 1 (what the member card is): the default is adopted, with the photo plus Remove photo in
      `EditMemberDialog` and a small avatar in the row.
    - Open question 2 (fallback): initials, per the parent plan A8, until SIM-047 has a pixel-head renderer.
  - Rejected:
    - Recommendation 4 / open question 3 (hide Remove photo on the Manager's own card). The `Session` type
      (`src/lib/session.ts` l.4) has no member id. Matching by email is fragile, and the server allows self-removal
      through this route (audited with `self: true`). See A5.
- **api-platform-engineer:**
  - Adopted:
    - Exact SQL projections.
    - Fields always present, not optional.
    - Search, requests, dashboard and device `owner` shapes left unchanged (R4; follow-up).
    - JSON "no Drive id" tests.
    - Per-page caches to avoid cross-surface `sync` eviction.
    - Reload after DELETE.
  - Open question 1 (`max-age` + `?v=`) is rejected for this ticket: it is a server change and out of scope.
    Follow-up F2.
  - Open question 2 (search-opened seat panel): checked. Search links to the seat page, which loads the seat through
    the seat routes (`seatRows`). The search occupant type (`src/lib/search/types.ts` l.12) is not rendered in the
    panel, so it is not changed.

## Assumptions
- **A1 Scope reading.** "No server/API changes" means no new routes, endpoints or migrations. Adding two read-only
  fields to `memberSelect` and `seatRows` is the ticket's own first Scope bullet.
- **A2 Overlap with SIM-046.1 (hotspot).** SIM-046.1 (PLANNING, same batch, merges first) edits `src/ui/Avatar.tsx`
  and probably adds `src?: string | null` (`img alt=""`, initials on error).
  - This ticket reuses that exact prop and does not change `Avatar.tsx` if it has landed.
  - If SIM-046.1 has not merged when this ticket is implemented, this ticket adds the identical shape. The later one
    to merge then resolves a trivial conflict.
  - Any SIM-046.1 guard test (roomlayout and sprites never reference a photo) must keep passing.
- **A3 Visibility.** `hasPhoto`/`photoVersion` are returned to every tier, including Users viewing other members. This
  matches OQ-58 (anyone may GET any member's photo) and is not gated by the D69 `visible` clause, which hides only
  devices and email.
- **A4 "Member card" = `EditMemberDialog` for Manager+, and the list row for everyone.** The repo has no card
  component. Users never open the edit dialog, so they never see Remove photo (AC2), and the server refuses them
  anyway (403).
- **A5 Self-removal.** The Remove photo button is shown for any member with a photo, including the Manager's own row.
  The route allows it and audits it with `self: true`. Hiding it would need a member id on the session, which is out
  of scope.
- **A6 Deactivated members** still show their photo, because the GET route serves them. Their row is already dimmed
  (`opacity-60`).
- **A7 Fallback** is initials until SIM-047 provides a pixel-head renderer (parent plan A8). OQ-57 allows "(or
  initials)".
- **A8 Staleness.** A photo changed by someone else shows after the next list or seat reload. This is acceptable.
- **A9 Hotspot with SIM-053** (PLANNING): both touch `src/ui/devices/PlaceDeviceDialog.test.tsx`. This ticket only adds
  two fixture fields there, so expect a trivial rebase. SIM-053 also edits `src/ui/seats/seats-api.ts`, which this
  ticket does not touch.
- **A10 Request cost.** Each cold load fetches every visible photo (4 at a time). `apiFetch` uses `cache: "no-store"`,
  so there are no 304s. This is accepted for the first phase (F2).

Follow-ups (not in this ticket):
- **F1:** photo fields on the search, requests (`currentOccupant`), dashboard and device `owner` member shapes, if those
  surfaces should show photos.
- **F2:** versioned photo URLs with a long `max-age` (a server change) to cut repeat Drive fetches.
- **F3:** a pixel-head fallback after SIM-047.
- **F4:** hide Remove photo on one's own card, once the session carries the member id.

## Blocking questions
None.

## Split proposal
None. The estimate is about 300 product lines plus about 300 test lines, mostly fixture churn.
