# Implementation log — SIM-046.1

## Attempt 1

### Files touched
- New: `src/ui/portal/photo-api.ts`, `profile-photo.ts`, `own-photo-store.ts`, `useOwnPhoto.tsx`, `ProfilePhotoSection.tsx`, `ProfilePhoto.tsx` — required by plan (AC1, AC2).
- Modified: `src/ui/portal/ProfileTabView.tsx` (`sections` slot), `ProfileTab.tsx` (mounts `ProfilePhoto`), `src/ui/Avatar.tsx` (`src?: string | null`, A1 shape, `"use client"`, onError fallback), `src/ui/AppShellView.tsx` (`photoUrl`), `src/ui/AppShell.tsx` (`OwnPhotoProvider`, `photoUrl`), `src/ui/copy/portal.ts` (`profile.photo`) — required by plan.

### Tests added
`photo-api.test.ts`, `profile-photo.test.ts`, `own-photo-store.test.ts`, `ProfilePhotoSection.test.tsx`, `Avatar.test.tsx`, `no-photo-on-map.test.ts` (new); cases added to `ProfileTabView.test.tsx` and `AppShellView.test.tsx`. All listed in plan.

### Check results
- format:check: All matched files use the correct format.
- typecheck: types generated, tsc clean.
- check:layers: 876 files, no violations.
- test: Test Files 334 passed | 1 skipped; Tests 3327 passed | 9 skipped.
- build: success.
- test:db: Test Files 22 passed; Tests 342 passed.

### Out-of-plan files
None.

### Deviations (small)
- `useOwnPhoto.tsx` creates the store inside an effect (not once at render) so React StrictMode's mount/unmount/mount does not reuse a disposed store. Same reset behavior as planned.
- Added type `PhotoActor` in `own-photo-store.ts`: a `Promise<...>` generic in a `.tsx` arrow type tripped the `no-literals` JSX-text regex.

### Follow-ups
- A4: add `hasPhoto` and `photoVersion` to `/api/me` to avoid the first-load 404 GET per page load (server change).
- Pixel-head fallback (parent A8) after SIM-047.1.

### Scope self-check
Only plan files changed; nothing under `src/server`, `src/app`, `src/lib`, `db`, `src/ui/roomlayout`, `src/lib/sprites`.
