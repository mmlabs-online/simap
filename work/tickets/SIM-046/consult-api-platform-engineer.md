## SIM-046 consult: profile photo upload (read-only)

### Findings

**Pattern to copy**
- Device type image flow: `src/server/device-types/image.ts`, with shared helpers in `src/server/drive/image-flow.ts` (`mapDriveFailure`, `useDrive`, `etagMatches`, `ImageResult`) and the route in `src/app/api/device-types/[id]/image/route.ts`.
- Route order is: `readBytes(req, max, type)` (type and size checked while streaming), then the validator, then `getPool`, then the server function. All of it runs inside `withAuth`. Refusals are 422 with `image_too_large`, `image_not_png`, or `image_bad_size`.
- `setDeviceTypeImage` works like this:
  1. Read the current file id.
  2. Upload to Drive with the server-chosen name `devtype-<id>-<uuid>.png`.
  3. Run one short compare-and-set transaction (`image_drive_file_id is not distinct from old`) that also bumps `image_version` and writes the audit row.
  4. If the CAS is lost, delete the new file and return 409 `image_changed`.
  5. After commit, delete the old file on a best-effort basis. Failures are logged as `drive_orphan`.
- Remove is DB first (row lock, null the file id, bump the version, audit), then a best-effort Drive delete. It is idempotent and works with Drive off.
- GET returns a 304 on a matching ETag before any Drive call. The ETag is `"<id>-<version>"`. Headers are `Cache-Control: private, no-cache`, `nosniff`, `Content-Disposition: inline` and `CSP: sandbox`. It also re-validates the bytes read back from Drive.
- DB column pattern (`db/migrations/20261124160000_device_types.sql`): `image_drive_file_id text null`, an `image_version` column, and a check `~ '^[A-Za-z0-9_-]{10,200}$'`.
- Audit rows carry only `{version}` and never any bytes.

**Gaps and traps for a photo**
1. **Drive client cap conflicts with OQ-56.** `DRIVE_MAX_BYTES = 128 * 1024` in `src/server/drive/client.ts:38`. It is enforced on upload (line 351) and on download (lines 129 and 141), and it throws `drive_too_large`. OQ-56 allows 256 KB, so a valid 200 KB photo would pass the route and then fail with a 502 `drive_error`. The cap must be raised to at least 256 KB. The tests at `client.test.ts:208-229` assert on it and need updating. This touches the shared Drive client, which is also used by device types and map items, so keep the change minimal and noted in the plan.
2. **`src/lib/validate/png.ts` is PNG-only.** `validatePng` has a 24-100 px limit and a 100 KB `IMAGE_LIMITS`. `parsePng` is reusable for the PNG half. A new validator, for example `src/lib/validate/photo.ts`, is needed with:
   - A JPEG structural parse: SOI `FFD8`, walk the segments to an SOF0/1/2 marker for the size, and require EOI `FFD9`.
   - A decision on progressive JPEG (SOF2): allow it. It is not animation.
   - Square, 64-512 px, and at most 262144 bytes.
   - The magic bytes decide the type, not the Content-Type.
   - Mapping to domain codes (for example `image_too_large`, `image_not_supported`, `image_bad_size`) returned as 422.
   - Keep `lib` pure, with unit tests.
3. **`readBytes` takes one exact media type.** It needs `image/png` or `image/jpeg`, so it must be called per type (peek at the header first) or extended to take a list. Safest: extend it to accept a set, and keep the same caps.
4. **Content type and file extension.** Store the detected type (`photo-<memberId>-<uuid>.png|jpg`). On GET, serve the detected type, which needs a stored `image_type` or must be re-sniffed from the bytes. The simplest option is a `photo_mime` column, or sniffing on read. EXIF is not stripped, because there is no image library. Mention this as a privacy risk (GPS in metadata). A cheap mitigation is to reject, or strip at the segment level, APP1/Exif. Segment-level stripping is doable without a library but it changes the bytes, so decide it at plan time.
5. **Members row shape.** `src/server/members/members.ts` has `COLS = "id, display_name, status, profile_confirmed_at"` and `toDto -> MeMemberDto`. `src/server/members/manage.ts` has its own select and `toDto` for `MemberDto` (list, card). The photo should surface as `hasPhoto` plus `photoVersion` (or a ready URL path), never as a Drive id. The Drive id and the MIME type stay server-only. `MeMemberDto` lives in `src/lib/members/types`.
6. **Parallel work in SIM-044.1** is changing `src/server/members/manage.ts` and `src/server/seats/**`, which are exactly where the photo fields must be added for the members list, member card and seat panel occupant row (OQ-57). To avoid conflicts, keep SIM-046's server code in new files (`src/server/members/photo.ts` and the new route) plus a minimal, late edit to those SELECT and DTO lists, ideally after SIM-044.1 merges. Check the dependency order at plan time.
7. **Member lookup in the route.** Own-photo functions take `sub` from the token and resolve the member id with `org_id = $1 and sub = $2`, creating on first visit via `ensure` as `setOwnDisplayName` does. A deactivated member is refused with `member_deactivated`, as `setOwnDisplayName` already does (so no photo changes while deactivated). `withAuth` has a `memberGate` that also does this, but it is not worth relying on alone. This check comes from the auth wrapper (R7), so no 403 from inside the handler after a write.
8. **No `members` migration for Drive yet.** The only prior members migration is `20261120190000_members_profile_confirmed_at.sql`. The new migration is expand-only (R2): `photo_drive_file_id text null`, `photo_version int not null default 0`, `photo_mime text null` (nullable with a check or an enum), and the same regex check as device types. The previous image ignores the columns. Add it to the `db/migrations/README.md` table. Run `pnpm schema:check` and the `sql-sync`-style tests, and update `COLS` in the same step. Note `0` default avoids a table rewrite on modern Postgres.
9. **R6.** Every query goes through `orgQuery` (the `org_id = $1` guard). Drive files are org-scoped by folder and `appProperties`, but the binding is the DB row, as the `OrgDrive` comment says. The GET must look up the member row by `org_id` and `id` before touching Drive. A member id from another org gives 404.
10. **Routes.** Two designs:
   - `/api/me/photo` (PUT / DELETE, own photo; GET own photo).
   - `/api/members/[id]/photo` (GET for any member in the org at tier user, which is needed for lists and seat panel; DELETE for Manager+, per the OQ-61 default). It must not accept PUT for another member.
   The GET-by-member-id route serves everyone, and `Cache-Control: private, no-cache` with ETag `"<memberId>-<photoVersion>"`. Because it is bearer-protected, the UI cannot use a plain `<img src>`. Look at how device-type images are fetched in the UI (blob via `apiFetch` plus object URL, and any cache) and reuse that mechanism, or `Avatar.tsx` will have to do the same. `apiFetch` re-sends once on 401/403, and PUT of a body stream may not be replayable, so check `apiFetch` with a `Uint8Array`/Blob body, which is fine.
11. **Visibility.** Following OQ-57, a user who may see a member in a list may see the photo, and the member list and seat panel are visible to all tiers already, but check whether a User may see other members at all (SEA-05, MEM-02 restrict some data). The GET gate should match whoever can see that member's name today, not simply "any user".

### Recommendations (tied to acceptance criteria)

1. Migration `db/migrations/<ts>_members_photo.sql` with expand-only columns (`photo_drive_file_id`, `photo_version`, `photo_mime`) and the id regex check (AC1, R2). Update README and the schema check.
2. `src/lib/validate/photo.ts` with PNG (reuse `parsePng`) and JPEG parsing, limits as constants (`minPx 64`, `maxPx 512`, `maxBytes 262144`) and domain codes. Run it in the route before `getPool()`, and before any DB or Drive call (AC2). Unit tests: truncated, wrong CRC, APNG, non-square, 63 and 513 px, 256 KB vs 256 KB + 1, JPEG with trailing bytes, polyglot, wrong Content-Type with correct magic, and the magic bytes deciding the type.
3. `src/server/members/photo.ts` mirroring `device-types/image.ts`: `setOwnPhoto`, `removePhoto` (own, or Manager+ on another), and `getPhoto`. Reuse `image-flow.ts` helpers, and pass the actor and the target in audit meta: `member.photo_set`, `member.photo_remove` with `{ version, self: boolean }` and the target member as `entityId` (AC6). No bytes. Do not log the Drive id.
4. Raise `DRIVE_MAX_BYTES` to 256 KB or more, and update the client tests. Make a cheap test that a maximum photo round-trips.
5. Serve with the same headers as device types, with the stored MIME and `Content-Type` re-checked on read (AC3). Keep the 304-before-Drive behaviour. Test that a bad stored photo gives 502 and never 401/403 (R7).
6. Auth tiers: PUT and own DELETE at `user`; remove-others at `manager` using a route tier (or a tier check done before any side effect by the wrapper, not inside after a write). Per R7, ensure all 401/403 come from `withAuth`. A cross-member remove that is not a Manager must be rejected by the wrapper tier, so the route needs a separate DELETE handler for another member with `tier: "manager"`, not a conditional inside a `user` handler (a late 403 from inside the handler is the thing R7 forbids).
7. UI: Profile tab upload/replace/remove with client-side pre-checks (copy in `src/ui/copy/<feature>.ts`, D36), `Avatar.tsx` gets an optional photo and falls back to the pixel head or initials (AC4). Do not touch the map renderer (LAY-06). Add a test or grep guard that map code does not import the photo path.
8. Order work to avoid SIM-044.1 conflicts: land the migration, photo server module, validators and routes first, then add `hasPhoto/photoVersion` to the members list, card and seat panel DTOs once SIM-044.1 merges, or in a very small separate hunk.
9. Tests: `pnpm test:db` for columns, the CAS race (409 `image_changed`), remove idempotence, cross-org 404 (R6), deactivated member refused, and Manager removing another member's photo with an audit row. Route tests like `image-routes.test.ts` for each code.

### Risks
- Drive cap (above) is a silent 502 on valid input if missed. Shared client change touches device-type and map-item flows.
- JPEG parsing by hand is a hotspot for polyglot and malformed files. Keep the check structural and strict, and serve with `nosniff`, `CSP: sandbox` and `inline`.
- EXIF and GPS data are kept as uploaded. Without server resizing, there is no re-encode.
- Merge conflicts with SIM-044.1 in `manage.ts` and `seats/**`.
- Per-view cost: every list row triggers a bearer GET and a DB lookup (plus Drive on a cache miss, up to 256 KB). With `private, no-cache`, each revalidation hits the DB. Fine for a small org, but consider a concurrency cap or lazy loading in the UI, and note that Drive rate limits (`images_unavailable`, 503) must degrade to the fallback and not to a broken image.
- Orphaned Drive files after a crash between upload and CAS (accepted precedent; logged).
- Race where a member is deactivated between the check and the write (existing pattern: row lock).
- Photo remove by Manager+ for another member must be audited with both actor and target.

### Open questions (for the plan gate; defaults exist)
1. Accept the OQ-56 default (PNG or JPEG, square, 64-512 px, at most 256 KB)? Allow progressive JPEG? Reject or strip EXIF?
2. Accept the OQ-57 default (shell avatar, Members list and card, seat panel occupant row, Profile tab; fallback is the pixel head or initials)? Is the pixel head available before SIM-047 (the character), or is the fallback initials only in this ticket?
3. Accept the OQ-61 default (own upload only, Manager+ can remove another's, audited)? Can an Admin-only vs Manager boundary be confirmed (Manager+ = manager and admin)?
4. Who may fetch another member's photo: every tier (as the default OQ-57 implies) or only those who can see that member (a User sees only members tied to their seats under SEA-05/MEM-02)?
5. Route shape: `/api/me/photo` plus `/api/members/[id]/photo`, or a single `/api/members/[id]/photo` where `me` is resolved by id?
6. Is raising `DRIVE_MAX_BYTES` (shared client) acceptable in this ticket, or should it become a per-call limit?
7. Should SIM-046 wait for SIM-044.1 to merge before touching `manage.ts` and `seats/**` DTOs?
