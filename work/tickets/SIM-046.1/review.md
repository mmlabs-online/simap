# Review — SIM-046.1

## Attempt 1 — 2026-11-26
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check`: exit 0. "All matched files use the correct format."
- `pnpm typecheck`: exit 0. "Types generated successfully", tsc clean.
- `pnpm check:layers`: exit 0. "check-layers: 876 files, no violations".
- `pnpm test`: exit 0. "Test Files 334 passed | 1 skipped (335); Tests 3327 passed | 9 skipped (3336)". No failures.
- `pnpm build`: exit 0. "Compiled successfully".
- `pnpm test:db` (local docker Postgres): exit 0. "Test Files 22 passed (22); Tests 342 passed (342)".

These match the numbers in impl-log.md.

### Acceptance criteria
- [x] The Profile tab shows the current photo (or initials) and can upload, replace and remove it. The server's 422 codes show readable messages. Evidence:
  - `ProfilePhotoSection.test.tsx`: all 6 planned cases.
  - `ProfileTabView.test.tsx` › "sections slot renders between the heading and the name form; absent when not given".
  - `own-photo-store.test.ts`: the upload, refusal and remove cases.
  - `profile-photo.test.ts`: the pre-check cases, including the empty file, and the `photoErrorMessage` mapping. The `image_not_supported` text says "re-save or crop" (SIM-046 security finding 4).
  - `photo-api.test.ts` › "put 422 image_bad_size returns that code; ...".
  - Wiring: `src/ui/portal/ProfileTab.tsx` passes `sections={<ProfilePhoto name={load.name} />}`.
- [x] The shell avatar shows the member's photo and updates after a change without a reload. Evidence:
  - `AppShellView.test.tsx` › "photoUrl renders the header avatar as an img; no photoUrl keeps the initials".
  - `Avatar.test.tsx`: the `src` case and the null/missing case.
  - `own-photo-store.test.ts`: "upload success ... URL swaps in place with no second get; the old URL is revoked", "remove success: url null, old URL revoked", and "a get that resolves after an upload does not overwrite it".
  - Code read: there is one `OwnPhotoProvider` in `src/ui/AppShell.tsx`. `ShellWithBadge` and `ProfilePhoto` both read `useOwnPhoto()`, so they share one store and one fetch.
- [x] The room map never draws a photo (guard test). Evidence:
  - `src/ui/no-photo-on-map.test.ts`: the matcher self-check, plus a scan of more than 5 files under `src/ui/roomlayout` and `src/lib/sprites`.
  - `git diff --name-only origin/main...HEAD -- src/ui/roomlayout src/lib src/server src/app db` is empty.
- [x] All Checks pass. Evidence: the Checks section above.

Ming verification after merge (not verified by the reviewer; carry these in the PR):
- On the hosted app, in Profile: upload a JPEG, replace it with a PNG, then remove it. The preview and the header avatar change together, with no reload. Reload the page and the state you left is kept.
- Upload a large phone photo. It is refused with the size or "re-save or crop" message, and DevTools shows no PUT.
- Sign out and in as another member, or switch org. The previous member's photo never appears.

### Requested checks
- **Deviation 1 (the store is created in `useEffect`):** accepted. In `src/ui/portal/useOwnPhoto.tsx` the effect creates the store, calls `load()`, and in cleanup calls `dispose()` and `setStore(null)`.
  - Under StrictMode's mount, unmount, mount, the first store is disposed. Its late GET is dropped by the `disposed` flag, and the second mount gets a fresh store. Reusing a store created at render time would have left a disposed store live, so this is the right call.
  - The deps are `[apiFetch, signedIn]`. `apiFetch` is stable per gate runtime (`AuthGate.tsx` l.98 takes it from the runtime object; `DevGate.tsx` l.115 creates it once in a lazy initializer), so the store is not recreated on re-render.
  - The cost is that StrictMode sends two GETs in dev, and `useOwnPhoto()` is null for the first render, so the Profile photo section appears one tick later. Both are acceptable.
- **Deviation 2 (the `PhotoActor` type):** accepted. It is a one-line exported type in the pure `own-photo-store.ts` (`() => Promise<PhotoAction>`), used only by `ProfilePhoto.tsx`. There is no behaviour change.
- **Blob URL revoke and stale results:** correct. In `src/ui/portal/own-photo-store.ts`:
  - `swap()` publishes the new state, calls `onChange`, then revokes the old URL, so every replace or remove revokes exactly the previous URL.
  - A failed PUT or DELETE returns before `swap`, so the current URL is kept and nothing is revoked.
  - `load()` drops its result when `disposed || seq !== mine`, and upload and remove bump `seq`, so a late GET cannot overwrite a newer photo or leak a URL.
  - `upload` and `remove` create no URL after `dispose()`. `dispose()` revokes the current URL.
  - `ProfilePhoto.tsx` guards its state updates with a mounted ref and ignores a second action while one is busy.
  - The old URL is revoked before React re-renders with the new one. An already-decoded `<img>` keeps showing, and if it errors, `Avatar` falls back by `failed !== src` and recovers on the next `src`. This was noted and accepted in plan Approach step 2.
- **The photo is rendered only through `<img>` (SIM-046 security review note 3):** confirmed.
  - The only consumer of the URL is `Avatar.tsx`, which renders `<img src={src} alt="" ...>` inside an `aria-hidden` span. `ProfilePhotoSection.tsx` l.35 and `AppShellView.tsx` l.189 pass it to `Avatar`.
  - There is no `<a href>`, `window.open`, iframe, `dangerouslySetInnerHTML` or CSS `url()` use of the blob URL (grep of `src/ui/portal/`).
  - Blob types are always `image/png` or `image/jpeg`. The GET path refuses any other `blob.type` (`photo-api.ts`, `get`). The upload path builds the blob with `PHOTO_MIME[check.type]` from the magic-byte check, not from `File.type`.
  - No server serving headers changed: no file under `src/app/**` or `src/server/**` is in the diff.

### Issues
None.

### Rules (CLAUDE.md)
No violations found.
- R1: ui imports only `@/lib/*` and ui; check:layers is clean.
- R3: no env or config.
- R4: every changed file is in the plan's file list, and there are no out-of-plan files.
- R5: the new logic is in pure modules with tests.
- R7: no route change.
- D36: all copy lives in `src/ui/copy/portal.ts`, and `no-literals.test.ts` is green.

### Blockers from review agents
None.

### Nits (do not block)
- The test `own-photo-store.test.ts` › "upload success: put gets the stripped bytes ..." checks only the type argument, not that the bytes were stripped. Stripping is covered by `profile-photo.test.ts` › "valid JPEG with Exif ...".
- No test covers an upload or remove that resolves after `dispose()` (create must not be called). The code handles it (`if (!disposed)`), but only the GET case is tested.
- `useOwnPhoto.tsx`: `store.snapshot() ?? LOADING` can never use `LOADING`, because `snapshot()` never returns null. That fallback is dead code.
- `ProfilePhoto.tsx`: the `if (busy) return` guard reads render-time state, so two picks within one frame could both pass. The disabled input makes this practically unreachable.

### Follow-ups (out of scope)
- A4: add `hasPhoto` and `photoVersion` to `/api/me` to avoid the first-load 404 GET (server change).
- A pixel-head fallback instead of initials once SIM-047.1 ships (parent A8).
