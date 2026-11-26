# SIM-046.1 — consult: frontend-developer (read-only)

## Findings

**Server contract (merged SIM-046, `src/app/api/me/photo/route.ts`)**
- PUT: raw image bytes; `readBytes` allows only `image/png` / `image/jpeg` (matching `Content-Type` required, else 422 `image_not_supported`); returns `{hasPhoto:true, photoVersion}`, `no-store`.
- DELETE: 204, idempotent. GET: bytes with `ETag "<memberId>-<version>"`, or 404 `not_found` with no photo. 409 `image_changed` = lost race; 409 `not_allowed` = deactivated member.
- 422 codes: `image_too_large`, `image_not_supported`, `image_bad_size`. Drive failures likely `images_unavailable` / `drive_error` (via `mapDriveFailure`, not read).
- **`/api/me` does not return `hasPhoto` / `photoVersion`.** The client must GET `/api/me/photo` on mount; 404 = no photo (initials), not an error. After PUT use the returned `photoVersion`; after DELETE none.

**Copy bug to avoid**
- `src/ui/copy/api.ts` l.66-67 build `image_bad_size` / `image_too_large` from device-type `IMAGE_LIMITS` (24-100 px, 100 KB, `src/lib/validate/png.ts`); photos are 64-512 px, 256 KB. Put photo messages in `portalCopy.profile.photo.errors` built from `PHOTO_LIMITS`; leave `apiCopy` alone.

**Existing patterns**
- `ProfileTab.tsx` container (`useApiFetch`, `useSession`, `mounted` ref, `profileOutcome`); `ProfileTabView.tsx` pure with tests. Add a separate pure `ProfilePhotoSection`.
- `src/ui/deviceTypes/device-type-image.ts` (`checkImageFile`: size first, then bytes) is the model for a client pre-check using `validatePhoto` (`@/lib/validate/photo`); needs a `read_failed` code; don't trust `file.type`.
- `createImageUrlCache` (`src/ui/deviceTypes/image-url-cache.ts`) is overkill for one photo; a small hook with one blob URL (revoked on replace, session change, unmount) is simpler.
- `Avatar.tsx` has no `src` (aria-hidden, initials). Add optional `src`: `<img alt="" aria-hidden>` `object-cover rounded-full`, same size, `draggable={false}`; fall back to initials when absent or `onError`.
- `AppShellView.tsx` l.186 renders `<Avatar name={session.email.split("@")[0]} size={40}/>`; add optional `photoUrl?: string | null`; `AppShell.tsx` `ShellWithBadge` passes it from the new context.
- `apiFetch` re-sends once on 401/403: pass a `Uint8Array` / `Blob`, not a stream. `withAuth` runs before side effects, so a retry is safe (R7).
- Auth reset: clear the URL and cancel in-flight loads on session change (key on `session?.sub` and org); ignore late responses (request id / abort); revoke blob URLs.

## Recommendations
1. `src/ui/portal/photo-api.ts` (pure, takes `apiFetch`): `getOwnPhoto()` → `{kind:"none"} | {kind:"ok", blob, etag} | {kind:"error"}` (404 → none); `putOwnPhoto(bytes, type)` → `{ok:true, photoVersion} | {ok:false, code}` (unknown → `internal`); `deleteOwnPhoto()`. Tests with a fake `apiFetch`: 404, each 422, network error, Content-Type.
2. Own-photo context (`useOwnPhoto` + provider in `AppShell.tsx` inside the session): `{status, url, version, refresh(), set(bytes, type), remove()}`; load on mount and session change; after PUT build the blob from the uploaded bytes only after 200 (or refetch); after DELETE revoke and set none; revoke on unmount. Shared by Profile tab and shell (AC2).
3. Profile tab section: preview or initials (`Avatar` ~96); file input `accept="image/png,image/jpeg"` with a keyboard-reachable label button; "Upload photo"/"Replace photo" and "Remove photo" (only when a photo exists); hint "PNG or JPEG, square, 64 x 64 to 512 x 512 px, up to 256 KB"; `role="status"` / `role="alert"`; disable while busy; reset `input.value` after each pick; messages for `image_changed`, `not_allowed`, `unavailable`, `drive_error`, `images_unavailable`, `internal` in `portalCopy`; clear old notices before upload.
4. Avatar and shell as above; tests with `src`, without, and `onError`.
5. Guard test (Vitest, node `fs`): walk `src/ui/roomlayout/**` and `src/lib/sprites/**` (skip tests), fail on `/photo`, `photoUrl`, `photoVersion`, `hasPhoto`, `api/me/photo`, `api/members`; assert the walk finds files.
6. Checks: format, typecheck, check:layers, test, build. New tests: photo-api, pre-check (too large by size, bad magic, non-square, animated/invalid PNG, JPEG ok), context reset on session change, Avatar, AppShellView, section view.

## Risks
- Blob URL leaks and stale-photo races (late GET after PUT or session change): revoke everywhere; guard with a request sequence number.
- Wrong limit text if `apiErrorMessage` is reused.
- `photoVersion` from PUT is unknown on initial load; don't assume sources agree.
- Large phone photos (>256 KB or non-square) are refused (A10 accepts; client crop/resize is a follow-up); the hint must state the limits.
- `AppShell.tsx` / `AppShellView.tsx` are shared hotspots; SIM-046.2 reuses the Avatar `src` prop — keep it stable.
- CSP `img-src` must include `blob:` (not checked by the consult; production CSP shows `img-src 'self' data: blob:`).
- Revoking a blob URL while an `<img>` renders causes a flash: swap state first, then revoke.

## Open questions
1. Shell loads the photo eagerly on every page or lazily? (recommended: eager)
2. Initial state from a new `/api/me` field (server change, out of scope) or 404-on-GET? (recommended: 404-on-GET)
3. Cache across reloads? (no: `apiFetch` forces `no-store`; acceptable for one small image)
4. Auto-send on file pick or a separate Save? (recommended: auto-send after the pre-check)
5. `src/ui/copy/portal.ts` or `copy/photo.ts`? (ticket names `portal.ts`)
