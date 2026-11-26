# Consult — frontend-developer — SIM-046.2

## Findings

**Server state**
- `src/app/api/members/[id]/photo/route.ts` is merged. GET uses tier `user`, returns an ETag of `"<memberId>-<photo_version>"`, and answers 304 on a match. It sends `Cache-Control: private, no-cache`, `nosniff` and `CSP: sandbox`. DELETE uses tier `manager`, is idempotent, and returns 204 with `no-store`.
- `removeMemberPhoto` bumps `photo_version`, nulls the Drive file id and audits the removal. A deactivated member's photo can be removed by a Manager. A non-UUID id gives 404.
- `MemberPhotoDto = {hasPhoto, photoVersion}` is in `src/lib/members/photo.ts`. Nothing yet puts it on `MemberDto` or on the seat occupant.
- `memberSelect` in `src/server/members/manage.ts:116` does not select photo columns. `seatRows` in `src/server/seats/seats.ts:107` has `occupant_id` and `occupant_name` only. `SeatDto.occupant` is `{id, displayName}` in `src/lib/seats/types.ts:29`.
- The Drive file id never leaves the server: `photo_drive_file_id` appears only in `src/server/members/photo.ts`. When you add the DTO fields, derive them in SQL as `m.photo_drive_file_id is not null as has_photo, m.photo_version`, and never select or spread the file id into a row mapped to a DTO. The "no Drive file id in any response" criterion is a good one for a route or DB test.

**UI building blocks**
- `createImageUrlCache` (`src/ui/deviceTypes/image-url-cache.ts`) is generic. It takes `ImageEntry = {id, hasImage, imageVersion}`, defaults to a concurrency of 4, drops stale versions, and marks failures as `failed` so `url()` returns null. It is already reused by `useDeviceTypeImages`, `useMapItemImages` and `roomlayout/catalog-images.ts`.
- Reuse the `useDeviceTypeImages` hook shape for a new `src/ui/members/useMemberPhotos.ts`. Map `{id, hasPhoto, photoVersion}` to `ImageEntry`, with `load = fetcher('/api/members/<id>/photo')` and a check that `blob.type` is `image/png` or `image/jpeg`. Revoke blob URLs on unmount.
- `src/ui/Avatar.tsx` is initials only and takes `name`, `color` and `size`. Add an optional `src?: string | null` prop that renders an `<img alt="" width height className="rounded-full object-cover">` and falls back to initials on `onError`. It is also used by `AppShellView` and `KitGallery`, so the change must be backward-compatible.
- The Members list is `src/ui/members/MembersView.tsx`: a `<tr>` per `MemberRow`, with `onEdit`, `onDeactivate` and `onReactivate`. There is no separate "member card" component. The closest thing is `EditMemberDialog`, or the row itself. Confirm what "member card" means before planning (see Open questions).
- The seat panel is `src/ui/seats/SeatDetailPanel.tsx:69-71`, where the occupant is shown as plain text. Seat data comes through `seats-api.ts` and `seat-view.ts`.
- `members-api.ts` has the `createMembersApi(apiFetch)` pattern, where every method returns a result and never throws. Add `getPhoto(id)` and `removePhoto(id)` there, copying `getImage` and `removeImage` from `device-types-api.ts`.

## Recommendations
1. **DTO fields (AC3).**
   - Add `hasPhoto: boolean; photoVersion: number` to `MemberDto` in `src/lib/members/types.ts`, and to `SeatDto.occupant`. Select them in `memberSelect` and in `seatRows`. If the seat query uses a left join on members, the fields must be null-safe, since a vacant seat has no occupant.
   - Update `toDto` and the list and detail mappers. Also check other users of `MemberDto`, such as search, the member picker and fixtures, and fix the typecheck fallout.
   - Update the existing members and seats tests, including DB tests, for the new shape.
2. **Photos stay out of the room map (SIM-046 review rule).**
   - Do not add photo fields to `src/server/layout/layout.ts`, `src/lib/sprites/**` or `src/ui/roomlayout/**`.
   - `lib/sprites/seat-view.ts` takes `occupantId` and `occupantName` only. The UI-side `src/ui/seats/seat-view.ts` uses `SeatDto`. Check that nothing passes the whole `SeatDto` into roomlayout code. Add an explicit test, or a grep check, that the layout response has no photo fields.
   - Put the new hook, `PhotoAvatar` and API in `src/ui/members/` and `src/ui/seats/`. They must not import from `src/ui/roomlayout`.
3. **Cache scope.** The photo cache needs to live above both the Members list and the seat panel, or each can own its own hook instance. Per-page instances are simpler and match the existing hooks. The seat panel shows one occupant, so it can reuse the hook with a single-item list. Keep sync input referentially stable (memoize) so effects do not loop.
4. **Remove photo (AC2).**
   - Show it only when `tier >= manager`, `m.hasPhoto` is true and the member is not the caller (self-removal belongs to the Profile tab). Find how `MembersView` or `MembersPage` gets the tier or role, and reuse that.
   - On success, refetch or patch the row (`hasPhoto=false`, `photoVersion+1`) so the cache drops the entry. Use a confirm step, because removal is destructive and cannot be undone. Add copy in `src/ui/copy/members.ts`.
   - Disable the button while the request is in flight. Show the error code through the existing error copy path. A 404 should be treated as already removed.
   - Rely on the server for authorization. A User does not see the action in the UI, and the route also returns 403 for tier `user`.
5. **Accessibility.** Decorative photo: `alt=""` with the name already in text, as the existing `Avatar` has `aria-hidden`. Give the button an `aria-label` such as "Remove photo of <name>". Set explicit `width` and `height` to avoid layout shift.
6. **Tests (R5).**
   - Unit tests for the new members photo hook, using the existing cache test pattern (fake `load`, `create` and `revoke`).
   - A render test for `Avatar` with `src`, and for the fallback on `onError`.
   - The remove action's visibility per tier, and `members-api` `getPhoto`/`removePhoto` mapping.
   - A DB test for `memberSelect` and `seatRows` photo fields, if the repo has DB tests for these.
   - Run `pnpm format`, `typecheck`, `check:layers` and `test`. UI code must not import server code (R1).
7. **Scope (R4).** The ticket says "no server, schema and API changes". Changing `manage.ts` and `seats.ts` SELECTs and DTO types is explicitly in scope, but adding any new route or migration is not.

## Risks
- **Request volume:** Members list pages up to 100 rows with up to 100 photo GETs. The cache queues them, 4 at a time. Photos come from Drive (the server fetches per request unless the ETag matches). Browser ETag revalidation via `private, no-cache` costs a round trip per image on reload, but it returns 304 without a Drive call. Do not set a long cache window.
- **Auth:** `apiFetch` re-sends once on 401 or 403, which is harmless for GET and for the idempotent DELETE.
- **Stale cache:** after a photo change by someone else, the version in the list differs only after a refetch of the list. This is acceptable, but note it.
- **Seat panel:** `SeatDto` is returned for the whole seat list, so adding `hasPhoto` and `photoVersion` per occupant adds a little payload. This is negligible.
- **Tier sees fields:** `hasPhoto` and `photoVersion` are visible to all tiers, including Users, which matches OQ-58 and OQ-57 and is harmless. SIM-050's email hiding does not affect it.
- **Test fixtures:** fixtures and mocks of `MemberDto` and `SeatDto` across about 48 files will need the new fields if they are typed strictly. This is likely the largest part of the typecheck churn.
- **Deactivated members:** do they still show a photo? The GET route does not refuse deactivated members, so yes. Decide whether the UI should show it for them.

## Open questions
1. What is the "member card"? The code has the Members table row and `EditMemberDialog`, but no card component. Should "Remove photo" go in the edit dialog or the row actions? Default: put the photo and "Remove photo" in the `EditMemberDialog` header (the spec text says "member page or card"), plus a small avatar in the row.
2. Spec OQ-57 says the fallback is "the pixel character's head (or initials)". The ticket says initials only. Default: initials (no pixel head), since the pixel character may only show on the room map and the Profile preview. Please confirm.
3. Should a Manager see "Remove photo" on their own card? Default: no, because self-removal is in the Profile tab (`/api/me/photo`).
4. Should a Manager (tier) be able to remove a photo for a member with an equal or higher role, such as another Manager or an Admin? The route has no hierarchy check, so any Manager+ can. Confirm this is intended per OQ-61.
