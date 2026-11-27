## Attempt 1 — 2026-11-27
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format." (1018 files)
- `pnpm typecheck && pnpm check:layers` — exit 0; "check-layers: 963 files, no violations"
- `pnpm test` — exit 0; Test Files 367 passed | 1 skipped (368); Tests 3583 passed | 9 skipped (3592)
- `pnpm build` — exit 0
- `pnpm test:db` (local `postgres://simap@127.0.0.1:5432/simap`) — exit 0; Test Files 23 passed; Tests 365 passed

All match the impl-log numbers.

### Acceptance criteria
- [x] AC1a — at >= 1280 px four labelled rooms, paths, idle avatars, two notes around the card — evidence:
  `SmallWorld.test.tsx › has four labelled rooms, two notes and the path inside aria-hidden sides`;
  `views.test.tsx › landing › renders the small world around the card, not the single vignette`; CSS block
  `globals.css` `/* SIM-068.1 small world (aw-world) */` with grid `384px minmax(0, 400px) 384px` under
  `@media (min-width: 1280px)`. Visual match with the mockup is a Ming check (below).
- [x] AC1b — below 1280 px not rendered and the atlas not fetched — evidence: `SmallWorld.tsx` `useAtlas()` is called
  only in `AtlasFeed`, rendered only when `wide && !atlas`; `wide` comes from `useSyncExternalStore` with server
  snapshot `false` (SSR has no canvas: `› has no canvas`). Once loaded, `AtlasFeed` unmounts and the atlas is kept in
  `SmallWorld` state, so it is fetched once. CSS hides `.aw-world-side, .aw-world-path, .aw-card-avatar` outside the
  query; `› the CSS hides the world below the same media query the JS gate uses` asserts `WORLD_MEDIA` equals the CSS
  query. Landing below 1280 renders only hero + card (`aw-world-center` holds the frame; `px-scene` absent from the
  landing, asserted in views.test).
- [x] AC2a — every sprite key resolves — `small-world-scenes.test.ts › every room is 12x7 and every sprite resolves to a
  registry key`, `› draws with no unknown sprite and bounds exactly 384x224`, `› avatarDrawList uses only manifest avatar
  frames, 32x32`.
- [x] AC2b — whole-number scale — `paintVignette` = `paintRoom(…, 1)`; `SmallWorld.test.tsx › paints each room 384x224
  at zoom 1 with smoothing off first` (asserts `["scale", 1, 1]`), `› paints a path avatar 32x32 at zoom 1`;
  `small-world-scenes.test.ts › uses integer rects and only frames from the manifest`.
- [x] AC2c — decoration aria-hidden, no focusable/interactive control, one h1 — both sides, the path and `CardAvatar`
  carry `aria-hidden="true"`; `› decoration has no control, tabindex, heading or img`; `› the card slot is not inside an
  aria-hidden element`; existing `views.test.tsx` landing control-count and single-h1 tests still green unchanged.
  Labels/notes are `span`/`p`. Sides and path have `pointer-events: none`.
- [x] AC3 — atlas failure leaves placeholders, sign-in works — `› returns false without a 2D context so the placeholder
  stays`; code read: a failed `loadAtlas` never calls `onAtlas`, so the context stays null and `Vignette` returns null;
  `.aw-room` boxes are CSS placeholders; the form lives in `aw-world-center` and shares no state with the world.
- [x] AC4 — copy in `src/ui/copy/auth.ts` (`world.rooms` typed `satisfies Record<WorldRoomId, string>`, `world.notes`
  verbatim from the ticket); `SmallWorld.tsx` has no literal English strings; all Checks green.

Coordinator checklist:
- Other AuthLayout screens unchanged: non-landing branch renders the same `max-w-[816px]` row with
  `{scene && <SignInScene />}` and the identical frame markup (only extracted to a `frame` const). `SignInScene.tsx` and
  its tests untouched. `views.test` asserts `plain()` and a plain `AuthLayout` contain no `aw-world`.
- Sign-in form untouched: no diff in `views.tsx` or form components; `children` passed through unchanged.
- `globals.css`: diff is pure append (0 removed lines) after the end of the file, inside its own marker;
  no `animation`/`transition`/`@keyframes` (grep of the diff: none); no new token blocks; `world-palette.test.ts › the
  aw-world block comes once, after the aw block` passes.
- No "photo" anywhere in `src/lib/sprites` (grep: no match).
- No new art or fonts: no changes under `public/`, no font imports; labels use the existing sans.
- Recorded deviation (plant positions moved to keep 384x224 bounds, impl-log): accepted; the plan allowed one-tile moves
  and the bounds test enforces it.

### Ming verification after merge
(The real sign-in page only shows on a deployed build; DevGate replaces it under `pnpm dev`.)
- 1280 (with Windows scrollbar), 1366, 1440 and 1920 px, light and dark: four labelled rooms, dashed paths meeting
  behind the card, 2 path walkers, seated/standing idle avatars, two notes, card avatar beside "Player, ready?";
  nothing overlaps the card or hero; rooms read quieter than the card.
- The veil (20 % light / 35 % dark `--aw-bg` overlay): does it calm the office art enough without washing it out?
- Café look (filing cabinets + water cooler as counter/machine, Q6): reads as a café "in the spirit of" the mockup?
- 1024 and 390 px: only header, hero, card, footer; DevTools → Network shows no `office.png` / `office.json`.
- Resize across 1280 px: world appears/disappears; typed email stays in the field.
- Block `/sprites/office.png` → reload at 1440: calm placeholders, sign-in still works.

### Issues
None.

### Rules (CLAUDE.md)
No violations found. R1: new code in `src/lib/sprites` (pure) and `src/ui/auth` (ui → lib, `@/` alias); check:layers
clean. R3: no config. R4: every changed source file is in the plan's file list. R5: new logic tested.
R2/R6/R7 not touched.

### Blockers from review agents
None.

### Nits (do not block)
- `SmallWorld.tsx` `AtlasFeed`: if the window crosses 1280 px while the first load is in flight, or after a failed
  load, `AtlasFeed` remounts and `useAtlas` fetches again. "Once" holds for the normal case (success then resize);
  acceptable for decoration.
- `Vignette`: `painted` stays `true` when the canvas unmounts below 1280 and remounts above it, so the new canvas is
  visible (blank, transparent) for one frame before repainting. Harmless.

### Follow-ups (out of scope)
- None.
