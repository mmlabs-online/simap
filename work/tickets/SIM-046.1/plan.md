Status: READY

# Plan — SIM-046.1: Profile photo in the Profile tab and the shell avatar

## Scope summary
This is slice 2 of SIM-046. Slice 1 (server, `/api/me/photo`) is merged. The ticket says the parent's acceptance criteria
and spec references apply.

- Ticket scope (`work/tickets/SIM-046.1/ticket.md` l.24-28):
  - "Profile tab photo section: preview, upload / replace / remove, client pre-check with `validatePhoto`, error copy
    in `src/ui/copy/portal.ts`."
  - "`src/ui/portal/photo-api.ts` and an own-photo context in `src/ui/AppShell.tsx` (blob URL by `photoVersion`,
    refresh after a change, reset on session change)."
  - "`Avatar.tsx` optional `src`; `AppShellView.tsx` passes the shell photo; initials when there is no photo."
  - "Guard test: `src/ui/roomlayout/**` and `src/lib/sprites/**` never reference a photo path."
- Parent split (`work/tickets/SIM-046/plan.md` l.372-381) lists the same items and "Covers AC4 (shell avatar, Profile
  tab)".
- `docs/spec-v1.md` POR-05 (quoted in the parent plan l.10-16): "The member uploads a real image as their profile
  photo, replaces it or removes it." and "The photo is never drawn on the room map (LAY-06)."
- OQ-56 default (parent plan l.17-18): "PNG or JPEG (no APNG or other animation), square, 64 × 64 to 512 × 512 px, at
  most 256 KB".
- OQ-57 default (parent plan l.19-20): "the photo shows in the shell avatar, ... and the Profile tab; without a photo
  those places show the pixel character's head (or initials)". Parent A8 (l.326-327): "Slice 2 uses initials; the pixel
  head becomes a follow-up once SIM-047 ships."
- Parent A10 (l.331-333): no client-side crop or resize. "slice 2 only shows the limits and pre-checks with the same
  `validatePhoto`."
- `work/tickets/SIM-046/security-review.md` l.33 (finding 4): "Slice 2's copy and client pre-check should say 're-save
  or crop the image' for this case". l.56: "keep the photo out of `src/ui/roomlayout/**` and `src/lib/sprites/**` (AC4
  guard test)".
- `work/decisions.md` D71 ("Amends D44 ('no photos': the map still never shows photos)") and D36 (UI copy in
  `src/ui/copy/<feature>.ts`).

Out of scope (ticket l.30-31): server, schema and API changes. This slice also leaves out photos in member lists and the
seat panel (SIM-046.2), the pixel character picker and pixel-head fallback (SIM-047.1 and follow-up), and client-side
crop (A10).

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | The Profile tab shows the current photo (or initials) and can upload, replace and remove it. The server's 422 codes show readable messages. | `ProfilePhotoSection.test.tsx`: "no photo: initials, 'Upload photo', no remove button", "photo: img with the blob URL, 'Replace photo' and 'Remove photo'", "busy disables the file input and the remove button", "error renders role=alert, notice renders role=status", "file input accepts image/png,image/jpeg and sits inside its label". `ProfileTabView.test.tsx` › "sections slot renders between the heading and the name form". `own-photo-store.test.ts` › upload / replace / remove cases. `profile-photo.test.ts` › "photoErrorMessage: image_too_large, image_bad_size and image_not_supported use the photo copy; image_not_supported says 're-save or crop'" and "client pre-check refuses before any upload". `photo-api.test.ts` › "put 422 returns the server code". |
| 2 | The shell avatar shows the member's photo and updates after a change without a reload. | `AppShellView.test.tsx` › "photoUrl renders the header avatar as an img; no photoUrl keeps the initials". `Avatar.test.tsx` › "src renders an img with alt=''; null or missing src renders the initials". `own-photo-store.test.ts` › "upload success swaps the URL in place (no GET), revokes the old URL and calls onChange", "remove success clears the URL", "a GET that resolves after an upload does not overwrite it". The shell and the Profile tab read the same store through `useOwnPhoto()` (code read of `AppShell.tsx` and `ProfilePhoto.tsx`: one provider, one fetch). |
| 3 | The room map never draws a photo (guard test). | `src/ui/no-photo-on-map.test.ts` › "roomlayout and sprites never reference a photo or the Avatar". It scans every file under `src/ui/roomlayout/**` and `src/lib/sprites/**`. A self-check proves that the matcher flags a sample. Also `git diff --stat` shows no change under those two directories. |
| 4 | All Checks pass. | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`. `src/ui/copy/no-literals.test.ts` stays green (no literal `alt=""`; see Approach step 5). |

## Ming verification after merge
- On the hosted app (Drive configured), in My Portal → Profile:
  1. Upload a square JPEG photo. The preview and the header avatar change at once, with no reload.
  2. Replace it with a PNG, then remove it. Both places go back to the initials.
  3. Reload the page. The state you left is still shown.
- Try a large phone-camera photo. It is refused with the size or "re-save or crop" message, and no request is sent.
  Check this in DevTools → Network: there is no PUT.
- Sign out and back in as another member, or switch org. The previous member's photo never appears.

The local dev setup usually has no Drive, so a real round trip is not something the reviewer can check. The reviewer
uses the unit tests above.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/ui/portal/photo-api.ts` | New. `createPhotoApi(fetcher: ApiFetch)` returns `{ get, put, remove }` for `/api/me/photo`. Each method resolves to `PhotoApiResult<T> = { ok: true; value: T } \| { ok: false; code: string }` and never throws. The pattern is `src/ui/deviceTypes/device-types-api.ts` l.8-43, including the private `errorCode(res)` and the `ApiAccessError` mapping. `get(): Promise<PhotoApiResult<Blob \| null>>`: 200 with `blob.type` `image/png` or `image/jpeg` gives the blob, any other type gives `internal`, and 404 gives `{ ok: true, value: null }` (no photo, not an error). `put(bytes: Uint8Array<ArrayBuffer>, type: PhotoType): Promise<PhotoApiResult<MemberPhotoDto>>` sends PUT with `content-type: PHOTO_MIME[type]` and `body: new Blob([bytes], { type: PHOTO_MIME[type] })`, not multipart. `remove(): Promise<PhotoApiResult<null>>` sends DELETE and expects 204. | AC1, AC2 | No |
| `src/ui/portal/profile-photo.ts` | New, pure. (1) `checkPhotoFile(file: { size: number; arrayBuffer(): Promise<ArrayBuffer> })` returns `{ ok: true; bytes: Uint8Array<ArrayBuffer>; type: PhotoType } \| { ok: false; code: PhotoCode \| "read_failed" }`. The steps: `file.size > PHOTO_LIMITS.maxBytes` gives `image_too_large` before any read; then `arrayBuffer()` (a rejection gives `read_failed`); then `validatePhoto`; then `stripPhotoMetadata(bytes, type)` copied into a new `Uint8Array`. The pattern is `src/ui/deviceTypes/device-type-image.ts` l.11-25. (2) `photoErrorMessage(code: string): string` uses `portalCopy.profile.photo.errors[code]` for `image_too_large`, `image_bad_size`, `image_not_supported`, `image_changed` and `read_failed`, and `apiErrorMessage(code)` for anything else. | AC1 | No |
| `src/ui/portal/own-photo-store.ts` | New, pure (no React). `createOwnPhotoStore({ api: Pick<PhotoApi, "get" \| "put" \| "remove">, create: (b: Blob) => string, revoke: (url: string) => void, onChange: () => void })` returns `{ snapshot(): OwnPhotoSnapshot; load(): Promise<void>; upload(file): Promise<PhotoAction>; remove(): Promise<PhotoAction>; dispose(): void }`. `OwnPhotoSnapshot = { status: "loading" \| "ready" \| "failed"; url: string \| null }` and `PhotoAction = { ok: true } \| { ok: false; code: string }`. Details under Approach step 2. | AC1, AC2 | No |
| `src/ui/portal/useOwnPhoto.tsx` | New, `"use client"`. `OwnPhotoProvider` creates the store once per mount with `createPhotoApi(useApiFetch())`, `URL.createObjectURL` / `URL.revokeObjectURL` and a re-render bump. It calls `load()` once when `useSession() !== null` and calls `dispose()` on unmount. `useOwnPhoto(): OwnPhoto \| null` (null outside the provider), where `OwnPhoto = OwnPhotoSnapshot & { upload(file: File): Promise<PhotoAction>; remove(): Promise<PhotoAction> }`. The pattern is `src/ui/deviceTypes/useDeviceTypeImages.ts` and `src/ui/requests/useRequestBadge.tsx` l.19-39. | AC2 | No |
| `src/ui/portal/ProfilePhotoSection.tsx` | New, pure view (props only). It has a heading, an 80 px preview (`<Avatar name src size={80} />`), a label-wrapped `<input type="file" accept="image/png,image/jpeg" className="sr-only">` whose label text is "Upload photo" or "Replace photo", a "Remove photo" button shown only when there is a URL, the limits hint, `role="alert"` for errors and `role="status"` for notices. The pattern is `src/ui/deviceTypes/DeviceTypeImageField.tsx` l.14-88. Props: `{ name: string; url: string \| null; status: "loading" \| "ready" \| "failed"; busy: "upload" \| "remove" \| null; error: string \| null; notice: string \| null; onPick(file: File): void; onRemove(): void }`. | AC1 | No |
| `src/ui/portal/ProfilePhoto.tsx` | New, `"use client"` container. It holds `busy`, `error` and `notice` state and a mounted ref, calls `useOwnPhoto()`, maps a failed `PhotoAction` through `photoErrorMessage`, and renders `ProfilePhotoSection`. It returns null outside the provider. Props: `{ name: string }`. | AC1 | No |
| `src/ui/portal/ProfileTabView.tsx` | Add one optional prop, `sections?: ReactNode` (l.14-23). The doc comment says: "Self-contained sections rendered above the name form (photo; SIM-047.1 adds the character picker)." Render `{sections}` right after the `<h2>` (l.53). Nothing else changes. | AC1; gives SIM-047.1 a slot without touching the form | No |
| `src/ui/portal/ProfileTab.tsx` | Pass `sections={<ProfilePhoto name={load.name} />}` to `ProfileTabView` (l.86-94). One import. | AC1 | No |
| `src/ui/Avatar.tsx` | Add `"use client"` and an optional `src?: string \| null`. When `src` is set and has not failed, render `<img src={src} alt={DECORATIVE} width={size} height={size} draggable={false} className="h-full w-full rounded-full object-cover" onError={() => setFailed(src)} />` inside the existing span instead of the initials. Use `const [failed, setFailed] = useState<string \| null>(null)` and show the image when `src && failed !== src`. The outer span keeps `aria-hidden`, the size and the background. Without `src` the output is unchanged. | AC2 (shared with SIM-046.2, see Assumptions) | No |
| `src/ui/AppShellView.tsx` | Add the optional prop `photoUrl?: string \| null` (l.30-42) with the doc comment "The member's own photo (blob URL); initials when null". Pass `src={photoUrl}` to the header `Avatar` (l.186). | AC2 | No |
| `src/ui/AppShell.tsx` | Wrap the existing providers in `<OwnPhotoProvider>` (l.42-48). In `ShellWithBadge`, read `useOwnPhoto()?.url ?? null` and pass it as `photoUrl` (l.21-34). | AC2 | No |
| `src/ui/copy/portal.ts` | Add one sub-object, `profile.photo` (after `profile.errors`, l.43-47). Keys: `heading`, `hint` (built from `PHOTO_LIMITS`), `upload`, `replace`, `remove`, `uploading`, `removing`, `saved`, `removed`, `loadFailed`, and `errors.{image_too_large, image_bad_size, image_not_supported, image_changed, read_failed}`. Text under Approach step 6. | AC1, D36 | No |
| `src/ui/portal/photo-api.test.ts` | New. | AC1, AC2, R5 | No (Low) |
| `src/ui/portal/profile-photo.test.ts` | New. | AC1, R5 | No (Low) |
| `src/ui/portal/own-photo-store.test.ts` | New. | AC1, AC2, R5 | No (Low) |
| `src/ui/portal/ProfilePhotoSection.test.tsx` | New, static render (`renderToStaticMarkup`, as in `ProfileTabView.test.tsx`). | AC1 | No (Low) |
| `src/ui/portal/ProfileTabView.test.tsx` | One new case for the `sections` slot. | AC1 | No (Low) |
| `src/ui/Avatar.test.tsx` | New, static render. | AC2 | No (Low) |
| `src/ui/AppShellView.test.tsx` | One new case for `photoUrl`. | AC2 | No (Low) |
| `src/ui/no-photo-on-map.test.ts` | New guard test. It lives outside the scanned directories, so it never matches itself. | AC3 | No (Low) |

No file under `src/server/**`, `src/app/**`, `src/lib/**`, `db/**`, `src/ui/roomlayout/**` or `src/lib/sprites/**`
changes. No High path is touched.

## Data model / migration
None.

## API contract
None. The UI calls the merged slice 1 endpoints unchanged (`src/app/api/me/photo/route.ts`):

| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| GET | `/api/me/photo` | bearer | 200 image bytes (`image/png` or `image/jpeg`, ETag) | 404 `not_found` (no photo, a normal case), 502 `drive_error`, 503 `images_unavailable` / `unavailable` | user |
| PUT | `/api/me/photo` | raw bytes, `content-type: image/png` or `image/jpeg` | 200 `MemberPhotoDto` `{ hasPhoto, photoVersion }` | 422 `image_too_large` / `image_not_supported` / `image_bad_size`, 409 `image_changed` / `not_allowed`, 502, 503 | user |
| DELETE | `/api/me/photo` | bearer | 204 (idempotent) | 409 `not_allowed`, 503 | user |

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `photo-api.test.ts` › "get 200 image/png and image/jpeg return the blob" | AC2 |
| `photo-api.test.ts` › "get 200 with another content type returns internal" | AC2 |
| `photo-api.test.ts` › "get 404 returns ok with null (no photo is not an error)" | AC1, AC2 |
| `photo-api.test.ts` › "get 503 returns images_unavailable; a throwing fetcher returns unavailable; ApiAccessError signed_out returns unauthenticated" | AC2 |
| `photo-api.test.ts` › "put sends PUT /api/me/photo with content-type image/jpeg and a Blob body, not multipart" | AC1 |
| `photo-api.test.ts` › "put 422 image_bad_size returns that code; put 409 image_changed returns that code" | AC1 |
| `photo-api.test.ts` › "remove sends DELETE and 204 returns ok; 409 not_allowed returns that code" | AC1 |
| `profile-photo.test.ts` › "file over 256 KB returns image_too_large without calling arrayBuffer" | AC1 |
| `profile-photo.test.ts` › "arrayBuffer rejects: read_failed" | AC1 |
| `profile-photo.test.ts` › "non-square 100x80 PNG: image_bad_size; 32x32 and 600x600 JPEG: image_bad_size" (`pngOf` / `jpegOf` from `src/test/photo-fixtures.ts`) | AC1 |
| `profile-photo.test.ts` › "GIF bytes and a JPEG with bytes after EOI: image_not_supported" | AC1 |
| `profile-photo.test.ts` › "valid JPEG with Exif: ok, type jpeg, returned bytes have no APP1 segment and still pass validatePhoto" | AC1 |
| `profile-photo.test.ts` › "valid 64x64 and 512x512 PNG: ok, type png" | AC1 |
| `profile-photo.test.ts` › "photoErrorMessage: the three 422 codes, image_changed and read_failed use portalCopy.profile.photo.errors; image_not_supported mentions phone photos and 're-save or crop'; not_allowed uses apiCopy; an unknown code uses apiCopy.errors.internal" | AC1 |
| `own-photo-store.test.ts` › "load 404: status ready, url null, create not called" | AC1, AC2 |
| `own-photo-store.test.ts` › "load 200: status ready, url from create, onChange called" | AC2 |
| `own-photo-store.test.ts` › "load error: status failed, url null" | AC2 |
| `own-photo-store.test.ts` › "upload success: put gets the stripped bytes and type; the URL swaps in place with no second get; the old URL is revoked" | AC1, AC2 |
| `own-photo-store.test.ts` › "upload refused by the pre-check: put not called, code returned, URL unchanged" | AC1 |
| `own-photo-store.test.ts` › "upload refused by the server (422): code returned, URL unchanged, nothing revoked" | AC1 |
| `own-photo-store.test.ts` › "remove success: url null, old URL revoked; remove 409: URL kept, code returned" | AC1, AC2 |
| `own-photo-store.test.ts` › "a get that resolves after an upload does not overwrite it (create called once for the upload only)" | AC2 |
| `own-photo-store.test.ts` › "dispose revokes the current URL; a get that resolves after dispose creates no URL and calls no onChange" | AC2 (session change) |
| `ProfilePhotoSection.test.tsx` › "no photo: initials, 'Upload photo', no remove button" | AC1 |
| `ProfilePhotoSection.test.tsx` › "photo: img with the blob URL, 'Replace photo' and 'Remove photo'" | AC1 |
| `ProfilePhotoSection.test.tsx` › "busy disables the file input and the remove button and shows the busy label" | AC1 |
| `ProfilePhotoSection.test.tsx` › "error renders role=alert, notice renders role=status" | AC1 |
| `ProfilePhotoSection.test.tsx` › "file input accepts image/png,image/jpeg and sits inside its label; the limits hint is shown" | AC1 |
| `ProfilePhotoSection.test.tsx` › "status failed shows loadFailed and still offers upload" | AC1 |
| `ProfileTabView.test.tsx` › "sections slot renders between the heading and the name form; absent when not given" | AC1 |
| `Avatar.test.tsx` › "src renders an img with alt='' inside the aria-hidden span and no initials; null or missing src renders the initials" | AC2 |
| `AppShellView.test.tsx` › "photoUrl renders the header avatar as an img; no photoUrl keeps the initials" | AC2 |
| `no-photo-on-map.test.ts` › "matcher flags samples ('/api/me/photo', 'hasPhoto', an Avatar import) and passes a clean sample" | AC3 |
| `no-photo-on-map.test.ts` › "roomlayout and sprites never reference a photo or the Avatar" (more than 5 files scanned) | AC3 |

Domain focus: the Vietnamese name "Nguyễn Thị Ánh" is used for the initials fallback in `Avatar.test.tsx` and
`ProfilePhotoSection.test.tsx`. Empty or null: `src={null}`, the 404 "no photo" case, and an empty file (0 bytes gives
`image_not_supported`; add it to the GIF case).

## Approach
1. **`photo-api.ts`.** Copy the `call` / `errorCode` / `ApiAccessError` shape of `device-types-api.ts` l.10-43, but
   keep it private to this file and do not import from `deviceTypes`. `get` checks `res.status === 404` before
   `!res.ok` and returns `{ ok: true, value: null }`. `put` and `remove` match the table under Files.
2. **`own-photo-store.ts`.** The state is `{ status, url }` plus a `seq` counter and a `disposed` flag.
   - `load()`: `const mine = ++seq`, set `loading`, await `api.get()`. Drop the result if `disposed || seq !== mine`.
     Otherwise, for a blob, swap in `create(blob)`; for null, set ready with no URL; for an error, set `failed` with
     url null.
   - `upload(file)`: `checkPhotoFile(file)`; return the code on refusal. Then `api.put(bytes, type)`; return the code
     on refusal. On success, if not disposed: `++seq`, swap in `create(new Blob([bytes], { type: PHOTO_MIME[type] }))`,
     and return ok.
   - `remove()`: `api.remove()`; on success, if not disposed: `++seq` and swap to null.
   - The swap sets the new URL, calls `onChange`, then revokes the old URL. The old image is already decoded, and the
     next render uses the new URL.
   - `dispose()`: set `disposed`, revoke the current URL, and do nothing else afterwards.
   - The store never refetches after a change. It uses the bytes it just sent. Those bytes are already stripped by
     `checkPhotoFile`, so they match what the server stores (it runs the same strip again). This means the EXIF
     orientation is the same before and after a reload.
3. **Session reset.** `Session` has no `sub` or `org` (`src/lib/session.ts` l.4), so the provider does not key on
   them. Sign-out, org switch and sign-in remount everything under the gate: `AuthGate.tsx` l.250-253 ("A switch
   passes through `checking`, so it always gets a new generation and remounts all data") and l.621
   `<Fragment key={view.generation}>`, and `DevGate.tsx` l.192 does the same. `AppShell` sits inside that Fragment
   (`src/app/(app)/layout.tsx` l.7-8). So `OwnPhotoProvider` unmounts, which calls `dispose()` and revokes the URL,
   and the next member gets a fresh store. The provider loads once per mount, not per route or focus.
4. **Wiring.** `AppShell` → `<OwnPhotoProvider><RequestBadgeProvider>…`. `ShellWithBadge` passes `photoUrl`.
   `ProfileTab` passes `sections={<ProfilePhoto name={load.name} />}`. `ProfilePhoto` uses the same context, so the
   shell and the tab share one source and AC2 needs no reload. `ProfilePhoto` handling:
   - `onPick`: if busy, return. Otherwise set `busy = "upload"`, clear the error and notice, and await
     `photo.upload(file)`. Then, if still mounted, set `notice = copy.saved` or `error = photoErrorMessage(code)`,
     and clear busy.
   - `onRemove`: the same, with `copy.removed`. There is no confirm step (Assumption A3).
5. **`Avatar`.** It becomes a client component because of the `onError` fallback state. It is imported only from
   `AppShellView` (rendered by the client `AppShell` and the server `/dev/shell` page), `KitGallery` (client) and
   `src/ui/index.ts`, and a server component may render a client one. To keep
   `src/ui/copy/no-literals.test.ts` green, use `const DECORATIVE = "";` and `alt={DECORATIVE}`, as
   `DeviceTypesView.tsx` l.10 does. A literal `alt=""` would match its `PROP_LITERAL`. The image stays decorative
   because the span is `aria-hidden`, and the shell's `title={session.email}` wrapper (AppShellView l.185) is
   unchanged.
6. **Copy (`portalCopy.profile.photo`).** Use English (D36) with no diacritics:
   - `heading: "Photo"`
   - `hint: \`PNG or JPEG, square, ${PHOTO_LIMITS.minPx} x ${PHOTO_LIMITS.minPx} to ${PHOTO_LIMITS.maxPx} x ${PHOTO_LIMITS.maxPx} pixels, up to ${PHOTO_LIMITS.maxBytes / 1024} KB.\``
   - `upload: "Upload photo"`, `replace: "Replace photo"`, `remove: "Remove photo"`, `uploading: "Uploading..."`,
     `removing: "Removing..."`
   - `saved: "Photo saved."`, `removed: "Photo removed."`
   - `loadFailed: "Could not load your photo. You can still upload a new one."`
   - `errors.image_too_large: \`The photo is too large. The limit is ${PHOTO_LIMITS.maxBytes / 1024} KB.\``
   - `errors.image_bad_size: \`The photo must be square, from 64 x 64 to 512 x 512 pixels. Crop or resize it and try again.\`` (built from `PHOTO_LIMITS`)
   - `errors.image_not_supported: "Use a PNG or JPEG photo that is not animated. Photos from a phone camera often carry extra data: re-save or crop the image and try again."` (security finding 4)
   - `errors.image_changed: "Your photo was changed in another window. Reload and try again."`
   - `errors.read_failed: "Could not read this file. Try another one."`

   The generic `apiCopy.errors.image_bad_size` and `image_too_large` use the device-type `IMAGE_LIMITS`
   (`src/ui/copy/api.ts` l.66-67), which differ from the photo limits. That is why the photo codes are mapped here and
   not through `apiErrorMessage`.
7. **Guard test.** Walk `src/ui/roomlayout` and `src/lib/sprites` recursively (the `walk` from `no-literals.test.ts`
   l.25-30, copied). Fail on `/photo/i` or on an import of the shell `Avatar` (`/["'](?:@\/ui|\.\.?(?:\/\.\.)*)\/Avatar["']/`).
   A grep today finds no "photo" in either directory, so there are no false positives. `lib/sprites/avatar.ts` is not
   matched, because the import pattern is for `/Avatar` with a capital A at the end of the specifier.
8. **Run the checks:** `pnpm format`, then all Checks.

Rules:
- R1: the ui layer imports only `@/lib/validate/photo`, `@/lib/members/photo` (type), `@/lib/api/fetch`, the ui
  layer itself, and `@/test/photo-fixtures` in tests only. There is no server import.
- R3: no env or config.
- R4: only the files listed.
- R5: the new logic lives in pure modules with tests.
- R7: no route change.
- D36: all text lives in `copy/portal.ts`.

## Specialist input used
From `consult-frontend-developer.md`:

- Adopted:
  - #1 Treat 404 as "no photo", not as an error (`get` returns null). No toast or retry.
  - #1 / Q1 Use a version-less cache per session, updated in place after a change. There is no `photoVersion` before
    the first fetch, and reading the ETag adds nothing.
  - #2 The UI-side blob URL is the only cache (`apiFetch` uses `no-store`).
  - #3 Write a hand-made store and provider instead of `createImageUrlCache` (one entry, simpler to test).
  - #4 One `OwnPhotoProvider` in `AppShell` that `ProfileTab` consumes. A pure `ProfilePhotoSection` in its own file.
    A separate `copy.photo` sub-object.
  - #5 Map the error codes, including the phone-JPEG "re-save or crop" copy.
  - #6 Pre-check with `validatePhoto`, with the size check before `arrayBuffer`.
  - #7 Send raw PUT bytes whose type comes from `validatePhoto`, not from `File.type`.
  - The Avatar `src` uses `alt=""` (through a constant), keeps `aria-hidden` and falls back on `onError`.
  - `AppShellView` stays pure with a `photoUrl` prop.
  - Stale-result guard through a sequence number.
  - The guard test scans file text.
- Adapted:
  - "Change the effect key to the session identity (`sub` and `org`)". `Session` has no `sub` or `org`, and the
    auth gate already remounts the subtree on every session change (Approach step 3). Unmount-dispose gives the same
    reset with no extra key.
  - "Mounted as one line in `ProfileTabView`". The view stays pure (static-render tests, no context). It gets a
    `sections?: ReactNode` slot, and the container `ProfileTab` mounts `<ProfilePhoto>` in it. SIM-047.1 adds its
    picker to the same slot in `ProfileTab.tsx`.
  - Revoke timing: the store revokes the old URL right after publishing the new one, not in a React cleanup, so the
    logic stays testable without React.
- Added (not in the consult): the client strips metadata (`stripPhotoMetadata`, pure lib) before upload. The preview
  and the stored file are then identical, including EXIF orientation, and GPS data never leaves the device. The server
  still strips again.
- Deferred:
  - Q2: the `/api/me` `hasPhoto` follow-up (see Assumption A4).
  - Q5: client crop and resize (parent A10).

## Assumptions
- **A1 Avatar prop shape, shared with SIM-046.2.** Both plans use `src?: string | null` on `src/ui/Avatar.tsx`:
  - The image is an `<img>` with `alt=""` (through a constant), `width` and `height` equal to `size`, and
    `className="h-full w-full rounded-full object-cover"`, inside the existing `aria-hidden` span.
  - On `onError` it falls back to the initials, through `useState` keyed on `src`.
  - The file gets `"use client"`.
  - Without `src`, the markup is unchanged.

  Whichever ticket merges second rebases and keeps the first one's `Avatar.tsx` as is (no textual difference if both
  follow this shape). `Avatar.test.tsx` is created by the first ticket to merge; the second adds its cases to it.
- **A2 Hotspots.**
  - **SIM-047.1** (planned next) edits `ProfileTab.tsx`, `ProfileTabView.tsx`, its test and `copy/portal.ts`. It
    should add its picker as a sibling inside the same `sections` fragment in `ProfileTab.tsx`, not as a new prop, and
    its copy as `portalCopy.profile.character` (or similar) next to `profile.photo`. Expected conflicts are adjacent
    lines only. SIM-046.1 should merge first.
  - **SIM-053** (PLANNING) edits `copy/portal.ts` (`seat.*` and `devices.*` keys). The lines are disjoint, so only a
    trivial rebase is expected.
  - **SIM-046.2** edits `Avatar.tsx` (A1). It does not touch `AppShell*` or `portal/**`.
- **A3 No confirm on remove.** Removing your own photo is cheap to undo (upload again), and the spec asks for no
  confirm (consult Q4). The Manager "remove another member's photo" flow in SIM-046.2 may use a confirm.
- **A4 First-load 404.** A member with no photo makes one GET that returns 404 per page load (once per mount, not per
  route). This is accepted for now. Follow-up candidate: add `hasPhoto` and `photoVersion` to `/api/me` (server
  change, out of scope here). The implementer records it under follow-ups in `impl-log.md`.
- **A5 Fallback.** The fallback is the initials (parent A8). In the Profile tab, the initials come from the display
  name; in the shell, they come from the email prefix, as today. The pixel-head fallback is a follow-up after SIM-047.1.
- **A6 Busy and errors.** A failed GET leaves the shell with the initials and shows `loadFailed` only in the Profile
  tab. Upload stays available.
- **A7 Size.** About 430 product lines (store about 80, view about 90, provider about 50, API about 70, helpers about
  50, container about 50, Avatar, shell and copy about 40) plus about 380 test lines. This is close to the guide, but
  it is one cohesive UI slice that the parent already split out, so it is not split further.
- **A8 Dependencies.** SIM-046 and SIM-045.1 are MERGED (`work/backlog.md` l.128-129).

## Blocking questions
None.

## Split proposal
None. See A7.
