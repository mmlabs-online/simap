# Consult — api-platform-engineer — SIM-046.2

## Findings

Scope: read-only. I checked manage.ts, seats.ts, photo.ts (server), the /api/members/[id]/photo route, image-url-cache.ts, and the SIM-046 plan.

- **`MemberDto`** (`src/lib/members/types.ts` l.37, built by `toDto` in `src/server/members/manage.ts` l.89). `memberSelect` (l.116) already reads from `members m`. Add `m.photo_drive_file_id is not null as has_photo, m.photo_version`. This single select feeds three things: list (`listMembers`), detail (`getMember` via `loadMember`), and the post-write reloads. So one change covers the Members list and the member card.
- **Seat occupant** (`seats.ts`). `SeatDto.occupant` is `{id, displayName}` (`src/lib/seats/types.ts` l.29). `seatRows` already left-joins `members o` (l.138). Add `o.photo_drive_file_id is not null as occupant_has_photo, o.photo_version as occupant_photo_version` and extend `toDto` l.95. `getSeat`, `listRoomSeats`, `loadSeat` and l.370 all go through `seatRows`, so they get it for free.
- **Other occupant and member shapes** that use the same `{id, displayName}` and are NOT in scope: `search.ts` l.111, `requests/read.ts` l.57, `dashboard.ts` l.51, device `owner`, handoffs, and the seat devices' `owner` json. The ticket scope lists only `MemberDto` and the seat occupant. `search.ts` l.111 returns the same occupant type as the seat panel. Check whether the seat panel is also fed by search results or by the room-seats list. Both would need the field if the panel can open from either.
- **No N+1 in SQL.** `has_photo` and `photo_version` are plain columns on rows already joined. The Drive file id must never be selected into a DTO. Project only the boolean and the version.
- **Photo bytes are fetched one request per member.** `GET /api/members/[id]/photo` returns `Cache-Control: private, no-cache` with ETag `"<id>-<version>"`. A matching If-None-Match gives 304 with no Drive call. An uncached 200 does a Drive `getFile` plus `validatePhoto`, so it is expensive per member. There is no batch endpoint, and one is not needed at current limits (members list page size, `SEAT_LIMITS.list`).
- **`createImageUrlCache`** (`src/ui/deviceTypes/image-url-cache.ts`) is keyed `{id, hasImage, imageVersion}`, with concurrency 4 and failures stored as "failed". Two consequences:
  - `sync()` drops every id missing from the passed list. Calling `sync` from several surfaces on one shared cache makes them evict each other.
  - Entries live only in memory, as blob URLs. After a page reload every photo needs a request. The route is `no-cache`, so the browser revalidates (304 if its HTTP cache keeps the entry), but `apiFetch` with a bearer token and `fetch` decides what is reusable. Blob URLs do not use the HTTP cache unless the fetch itself hits it.

## Recommendations

1. Map `MemberDto` to `hasPhoto: boolean` and `photoVersion: number`, reusing the `MemberPhotoDto` shape from `src/lib/members/photo.ts`. Do this as `MemberDto & MemberPhotoDto`, or add the two fields flat. Add them to the seat occupant the same way: `occupant: {id, displayName, hasPhoto, photoVersion}`. Use the same field names everywhere (AC "no Drive file id"). Add tests that the JSON has no `photo_drive_file_id` or `photoDriveFileId`.
2. Do not add the fields to the search, requests, dashboard or device `owner` shapes in this ticket (R4). Log them as a follow-up. If the seat panel can open from a search result, add the fields to the search occupant too.
3. One shared member-photo cache for the whole app, created like `useMapItemImages` and `useDeviceTypeImages`:
   - A provider with `load = apiFetch GET /api/members/{id}/photo` returning a Blob (null on non-OK, so it falls back to initials).
   - Call `sync` with the union of all currently visible entries, for example by letting each surface register its list and merging them. Otherwise use a per-page cache. The member list, member card and seat panel are on different pages, so a per-page cache is the simplest option.
   - Use `id = memberId`. Version bumps change `photoVersion`, which replaces the entry correctly.
4. The Members list can hold many rows. Only call `sync` with the rows currently rendered and fetched (the page the user loaded, with cursor pagination). Avoid fetching photos for rows past the loaded cursor. Concurrency stays at 4.
5. After a Manager removes a photo, reload the member (the DELETE returns 204 with no version). The new DTO carries `hasPhoto: false` and a bumped version, so `sync` drops the entry. The UI must not rely on a stale cached blob.
6. "Remove photo" on the member card: show it when `hasPhoto` is true and the viewer's tier is manager or higher. Use the existing tier helper. Do not show it for Users (AC2). Treat 404 as already removed and reload. Use `apiFetch` DELETE. Per R7 the 401 and 403 codes come only from the wrapper, which already holds.
7. Show initials for `!hasPhoto` or a "failed" cache state. Keep the room map free of photos (LAY-06). The slice 2 guard test is a related check.

## Risks

- **Contract**: both additions are additive and optional for consumers. Keep both fields always present (not optional), so older clients that ignore them are unaffected. A response field `occupant` changing shape from `{id, displayName}` to include the extra keys is safe. Any test that does `toEqual` on the old shape will need updating (grep tests for `occupant:`, `displayName`, and `toDto`).
- **Cache eviction bug** if one shared cache gets `sync` from several components (see Findings). It would cause refetch loops or flicker.
- **Photo cost**: a list with up to a full page of members triggers a 200 Drive fetch for each member on every cold load, because blob URLs are not persisted. A 304 only helps if the browser HTTP cache holds the entry for an `Authorization`-bearing request. Browsers may not reuse it for bearer fetches in a `no-cache` flow without an explicit conditional header from the app. That is a perf risk, not a correctness one. Consider whether the first phase accepts it.
- **Visibility**: any member can GET any member's photo (OQ-58), and `hasPhoto` in the list and seat shapes leaks nothing beyond that. Fields for deactivated members are still readable. Confirm that is intended.
- **Ordering with SIM-044.1**: both edit `src/lib/members/types.ts`, and `photo.ts` was kept separate to avoid conflicts. SIM-046.2 depends on SIM-044.1, so rebase onto it.
- Edits touch `manage.ts` and `seats.ts`. Neither is on the High path list as far as I saw, but confirm in `.github/risk-tiers.yml`. The ticket Gate says none, and no SQL migration is needed.

## Open questions

1. Should `GET /api/members/[id]/photo` return `Cache-Control: private, max-age=...` with `immutable` plus the version in the URL (`?v=N`)? That would make the browser cache effective across loads, but it is a server change outside this ticket's stated scope ("server, schema and API changes (none needed)").
2. Does the seat panel also open from search results, and does the pending-requests view (`currentOccupant`) show an occupant row that should get a photo?
3. Should the member card's own-profile view (Profile tab, shell avatar) share the same cache, or stay on `/api/me/photo`? OQ-57 lists the shell avatar and Profile tab, probably in other tickets (SIM-046.1).
4. Should deactivated members show their photo in lists?
