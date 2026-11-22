## Attempt 1 — 2026-11-22

### Files touched
| File | Required because |
|---|---|
| `src/lib/sprites/layout.ts` | Provisional `RoomLayout`, `SeatView`, `Rotation`, `ZOOM_LEVELS = [2,3,4]` |
| `src/lib/sprites/placement.ts` | `ROTATION_TO_DIR`, `resolveFrameKey`, `chairFor`, `seatOrder`, `buildDrawList` with F1 (bounds) and F2 (prop host row) |
| `src/lib/sprites/avatar.ts` | FNV-1a over UTF-8, salted ramps, `avatarFor`, view choice, frame list |
| `src/lib/sprites/overlay.ts` | `overlayFor`, `STATUS_DOT`, `tagPlacement` |
| `src/lib/validate/sprite-manifest.ts` | F4: reject `frame.tiles` that differ from the registry |
| `src/ui/roomlayout/loadAtlas.ts`, `paint.ts`, `SeatOverlay.tsx`, `RoomMap.tsx`, `index.ts` | Loader, canvas painter and tint cache, seat buttons and tags, client component, public entry |
| `src/ui/copy/roomlayout.ts` | UI copy (English, no diacritics) |
| `src/app/dev/roommap/page.tsx`, `RoomMapDemo.tsx`, `fixture.ts` | Dev-only demo; the page has the exact foldable shape from the plan |
| `scripts/check-dev-bundle.mjs` | Added the fixture marker to `FORBIDDEN` |
| `README.md` | Bundle check sentence now mentions the demo fixture |
| Tests: `src/lib/sprites/{placement,avatar,overlay}.test.ts`, `src/lib/validate/sprite-manifest.test.ts`, `src/ui/roomlayout/{loadAtlas,paint,RoomMap}.test.ts(x)`, `SeatOverlay.test.tsx`, `src/app/dev/roommap/{page,fixture}.test.ts(x)`, `scripts/check-dev-bundle.test.ts` | Plan test list |

Small deviations inside plan files (no new files): `buildDrawList` also returns `seats` (desk pixel boxes in reading order) because `SeatOverlay` needs them; `overlayFor(state, footprint)` takes the desk footprint so `mine` can emit one tint per tile; `RoomMap.tsx` also exports `RoomMapStatus` (loading and error views) so the error view is testable without a DOM; copy has `zoomLabel` and `zoomOption` for the demo buttons; `loadAtlas` returns `{ ok: false }` for an abort (the caller checks `signal.aborted` before any state change).

### Tests added / changed
- `placement.test.ts`: every plan row is covered; "a chair never acts as a prop host" can only assert order (a 1x1 chair has the same row as the tile it covers, so it cannot distinguish hosting).
- `avatar.test.ts`, `overlay.test.ts`, `sprite-manifest.test.ts` (F4), `loadAtlas.test.ts`, `paint.test.ts`, `SeatOverlay.test.tsx`, `RoomMap.test.tsx`, `page.test.tsx` (production, test mode and development), `fixture.test.ts`, `check-dev-bundle.test.ts` (marker).

### Checks (actual output summary)
- format:check: pass ("All matched files use the correct format.", 351 files).
- typecheck + check:layers: pass ("check-layers: 297 files, no violations").
- test: pass (123 files; 1223 passed, 3 skipped). `pnpm test:db` not run (CI only, not affected).
- build: pass. `/dev/roommap` listed as dynamic.
- check:dev-bundle: pass on the final page ("no dev-token strings in .next/static").

### Bundle proof (AC 6, plan Approach step 7)
1. Negative control: `page.tsx` temporarily replaced by a static import of `RoomMapDemo`. `pnpm build` passed, `pnpm check:dev-bundle` exited 1 and named `.next/static/chunks/1nlmvtfkxr1w9.js: simap-roommap-fixture-9c41`. The scan detects the marker.
2. Restored the exact plan page (copy from a saved file; `git status` showed only the untracked route folder, and the committed `page.tsx` is the plan shape).
3. `pnpm build` then `pnpm check:dev-bundle`: pass. No `next.config.ts` change was needed.

### Out-of-plan files
None. `next.config.ts`, `.github/**`, `package.json`, `public/sprites/**`, `assets/art/**` are untouched (`git diff` against the plan commit shows no path under `public` or `assets`).

### Follow-ups (noticed, not done)
- The plan's A10 list stands (spec zoom wording in the ticket and style guide, CI wiring for `check:dev-bundle`, `src/app/dev/shell/page.tsx` static import, SIM-015.1 device drawing).
- Shadow band: implemented as starting 1 px above the footprint bottom and extending 4 px down (so 3 px below the footprint). The plan wording could also mean a band fully inside the footprint; the bounds already include it.
- Canvas size cap for large rooms at 4x (A8) is still open for SIM-015.1.

### Scope self-check
- Could the diff be smaller? Not without dropping planned tests or files.
- Diff size: +1601 / -3 lines against the plan commit (779 product, 822 test, by file name). **This passes the plan's ~1,500-line stop-and-report limit.** The work was already complete and green when the total was measured, so nothing further was added; reported for the orchestrator to decide (oxfmt line wrapping and the 5 UI test files account for most of the overrun versus the 800 + 450 estimate).
