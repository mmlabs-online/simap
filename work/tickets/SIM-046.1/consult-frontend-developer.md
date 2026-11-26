# Consult — frontend-developer — SIM-046.1

Consult report for SIM-046.1 (read-only; I ran no checks or tests).

## Findings
1. **No endpoint tells the client the photo state on first load.**
   - `/api/me` has no `hasPhoto` or `photoVersion` (grep finds neither in `src/app/api/me/route.ts`). `MemberPhotoDto` is only returned by PUT (`src/app/api/me/photo/route.ts`).
   - On first load the shell can only call `GET /api/me/photo`. A 404 means no photo (`getPhoto` returns `notFound` when `photo_drive_file_id` is null). A 200 gives bytes plus `ETag: "<memberId>-<version>"`.
   - The parent plan assumed a cache keyed by `photoVersion`, but the version is not known up front. Use the ETag, or the PUT response's `photoVersion` after a change, as the cache key.
   - A 404 on an app-wide fetch must not be treated as an error. It is the normal "no photo" case, and it should not trigger a retry or a toast.
2. **`apiFetch` uses `cache: "no-store"`** (per the parent plan, `src/lib/api/fetch.ts` l.52), so the browser HTTP cache will not help. A UI-side blob-URL cache is required, and it is the only caching layer.
3. **Reusable code.**
   - `src/ui/deviceTypes/image-url-cache.ts` (`createImageUrlCache`) is generic, but it is built for a list with a concurrency limit. Own photo is one entry. I'd write a small `useOwnPhoto` hook or provider instead, or call `createImageUrlCache` with one entry `{id: sub, hasImage, imageVersion}`. A hand-written hook is simpler and more testable.
   - `src/ui/Avatar.tsx` has no `src` yet. It is `aria-hidden`, and the shell wraps it in `<span title={session.email}>` (`AppShellView.tsx:185-187`).
4. **Where the context goes.**
   - `src/ui/AppShell.tsx` already stacks providers (`RequestBadgeProvider` > `HandoffBadgeProvider` > `ShellWithBadge`). Add an `OwnPhotoProvider` there.
   - `ProfileTab` is rendered inside the shell, so it can consume the same context. Do not give it a second fetch. One source of truth gives AC2 (the shell updates with no reload).
   - `ProfileTab` is a container and `ProfileTabView` is a pure view. Keep that split: put the photo section in a new pure `ProfilePhotoSection` view and keep the upload logic in the container or hook.
   - **Overlap with SIM-047.1.** Keep the photo section as its own component, in its own file, mounted as one line in `ProfileTabView`. That leaves SIM-047.1 a clean slot for the picker and avoids merge conflicts in the form markup. Also keep the `portalCopy.profile` additions in one sub-object (`copy.photo`) instead of mixing keys into `profile`.
5. **Error codes to map** (422, from `validatePhoto`):
   - `image_too_large`, `image_not_supported`, `image_bad_size`.
   - Also expect 409 `image_changed` (lost race) and 409 `not_allowed` (deactivated), plus 503 `unavailable` and Drive errors (`IMAGE_DRIVE_ERROR`, in `src/server/drive/image-flow.ts`).
   - Per the security review (finding 4), the `image_not_supported` copy must mention phone JPEGs and say "re-save or crop the image and try again". Many phone photos carry trailing data and are refused.
6. **Client pre-check.**
   - `validatePhoto` (`src/lib/validate/photo.ts`) is pure `Uint8Array` code and is importable from the UI, because lib is allowed for ui under R1.
   - Do the file → `arrayBuffer` → `validatePhoto` check before uploading. The pre-check also covers the size cap, which runs before parsing.
   - The server remains the authority, so the UI must still map the 422 codes.
7. **Upload request.**
   - Send the raw bytes as PUT with `Content-Type: image/png` or `image/jpeg`. `readBytes` allows only those two types.
   - Take the type from `validatePhoto`'s result, not `File.type`.
   - It is not multipart.
   - R7 note: `apiFetch` re-sends once on 401/403. PUT is idempotent here (a CAS write), so a repeat is acceptable.

## Recommendations
- **AC1 (Profile tab).**
  - Add `src/ui/portal/photo-api.ts` with `fetchOwnPhoto()`, `putOwnPhoto(bytes, type)` and `deleteOwnPhoto()`. Each returns a typed result and never throws on 404 or 422.
  - Add a section with a preview (64–96 px, `object-cover`, `rounded-full`), "Upload" / "Replace" and "Remove" buttons, and the limits hint ("PNG or JPEG, square, 64–512 px, up to 256 KB").
  - Use `<input type="file" accept="image/png,image/jpeg">` behind a Button. Give the input a real label so keyboard users reach it.
  - Disable the buttons while busy.
  - Show errors in `role="alert"` and success in `role="status"`, the same pattern as the name form.
- **AC2 (shell avatar).**
  - The provider holds `{status, url|null, version}` and exposes `{ url, busy, set(bytes, type), remove(), }`.
  - It fetches once when the session exists. Change the effect key to the session identity (`sub` and `org`) and reset to empty on session change.
  - After PUT or DELETE it updates in place. Revoke the old blob URL and create the new one from the PUT bytes. This avoids a second GET.
  - Revoke on unmount and on session change. Ignore stale results with a request counter or token, so a slow GET cannot overwrite a newer upload.
  - `Avatar` gets an optional `src`. Render `<img src alt="" className="rounded-full object-cover">` at the same size, and fall back to initials on `onError`. Keep `aria-hidden` and `alt=""`, since the initials are decorative too.
  - `AppShellView` takes an optional `photoUrl` prop that stays pure, and `ShellWithBadge` passes it.
- **AC3 (guard test).**
  - A Vitest test that reads every file under `src/ui/roomlayout/**` and `src/lib/sprites/**` (excluding the test file itself) and fails on `photo` (case-insensitive), `/api/me/photo` or `/photo`.
  - Check how `check:layers` or other existing guard tests scan files, and reuse that helper.
  - Watch for false positives, for example the word "photo" in an existing comment. Grep first, and scope the pattern if needed (`/api/(me|members)/.*photo`, `photoVersion`, `hasPhoto`).
- **AC4 (checks).**
  - Add unit tests for the pure parts: the error-code → copy map, `photo-api` result mapping with a mocked `apiFetch`, and the provider's update, reset and stale-result logic.
  - `src/ui/copy/portal.ts` is the home for copy (D36).
  - Run `pnpm test`, `pnpm typecheck`, `pnpm check:layers` and `pnpm format:check`.
- **Keep the strict serving headers** (`nosniff`, `CSP: sandbox`, Content-Type). This slice must not touch them, and it needs no server change. Render the blob only through `<img>`, never in an iframe or via navigation.

## Risks
- **Blob URL leaks and flicker.** Revoking a URL that is still in the DOM leaves a broken image. Create the new URL, set state, then revoke the old one in the effect cleanup.
- **Session change.** The photo of the previous user or org must not show for the next one. Clear it first, then fetch.
- **First-load 404 noise.** Every member without a photo triggers a 404 request on each page load. The server is not set up to return 200 with a "no photo" body, and it should not change in this ticket. Fetch once per session, not per route. The honest fix is a follow-up: add `hasPhoto` and `photoVersion` to `/api/me`, or to `MemberDto` (SIM-046.2 already adds them for lists).
- **Large uploads.** `File.arrayBuffer()` on a very large file reads it all into memory. Check `file.size > PHOTO_LIMITS.maxBytes` before reading it, so a 50 MB file is not loaded.
- **Phone photos.** They are often over 512 px or non-square, so `image_bad_size` and `image_not_supported` will be common. The parent plan (A10) leaves client-side crop and resize out of scope. Make the copy actionable (say what to do), and note that a crop follow-up would help.
- **SIM-047.1 conflict.** Both tickets touch `ProfileTabView.tsx`, `ProfileTab.tsx` and `portal.ts` copy. Keep your edits additive and isolated, as above, and merge this ticket first.
- **Dependency on SIM-045.1.** The ticket depends on it. Confirm it is merged, or that it does not edit `ProfileTab*` and `AppShell*`, before starting.

## Open questions
1. Use the ETag, or the 200's `ETag` header read via `res.headers`, as the first-load version key? The alternative is a version-less cache that refetches per session. I recommend the version-less per-session cache plus in-place update after a change. It is simpler and avoids reading headers.
2. Should the `/api/me` 404-noise follow-up be filed now, or left to SIM-046.2?
3. Does the Profile tab fallback stay initials? Yes per parent plan A8, with the pixel head to follow after SIM-047.
4. Should the remove action ask for confirmation? The parent spec does not say. I suggest no confirm step, since the action is cheap to undo (re-upload), but a Ming call is possible.
5. Should the client-side crop and resize (A10) be pulled in? I recommend not. It exceeds the M size.

Files read: `work/tickets/SIM-046.1/ticket.md`, `work/tickets/SIM-046/security-review.md`, `work/tickets/SIM-046/plan.md` (split section), `src/lib/validate/photo.ts`, `src/app/api/me/photo/route.ts`, `src/server/members/photo.ts`, `src/ui/AppShell.tsx`, `src/ui/AppShellView.tsx`, `src/ui/Avatar.tsx`, `src/ui/portal/ProfileTab.tsx`, `src/ui/portal/ProfileTabView.tsx`, `src/ui/deviceTypes/image-url-cache.ts`.
