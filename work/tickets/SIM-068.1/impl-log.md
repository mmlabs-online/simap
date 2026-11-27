
## Attempt 1 — 2026-11-27

### Files touched
| File | Required because |
|---|---|
| `src/lib/sprites/small-world-scenes.ts` (new) | Four 12x7 layouts, fixed seat views, standing avatars, `avatarDrawList` (plan step 2) |
| `src/lib/sprites/small-world-scenes.test.ts` (new) | R5 pure tests |
| `src/ui/auth/SmallWorld.tsx` (new) | Grid, atlas feed gated at 1280 px, vignettes, `CardAvatar` |
| `src/ui/auth/SmallWorld.test.tsx` (new) | Paint and server-markup and CSS-gate tests |
| `src/ui/auth/AuthLayout.tsx` | Landing renders `SmallWorld`; card avatar beside the intro; other screens unchanged |
| `src/ui/copy/auth.ts` | `world.rooms`, `world.notes` (D36) |
| `src/app/globals.css` | Appended `/* SIM-068.1 small world (aw-world) */` block at the end only (no animation/transition words, no token blocks) |
| `src/ui/auth/views.test.tsx` | One landing test |
| `src/ui/auth/world-palette.test.ts` | One `it` for the append-only marker |

### Tests added / changed
- small-world-scenes.test.ts: 7 tests (registry keys, 384x224 bounds, integer rects, 84 floor tiles, tile overlap, idle avatars, avatarDrawList)
- SmallWorld.test.tsx: paint 384x224 / 32x32 at zoom 1, no-2D-context false, server markup (rooms, notes, aria-hidden, no canvas, no controls, card slot not hidden, CardAvatar), CSS gate vs `WORLD_MEDIA`
- views.test.tsx › landing › renders the small world around the card, not the single vignette
- world-palette.test.ts › the aw-world block comes once, after the aw block

Layout moves made after the overlap/bounds tests (starting compositions in plan): bottom-row plants moved from y=6 to y=5 (their 4 px shadow widened bounds to 227 px high); `plant.small` is 35 px wide with a negative anchor, so it sits at x=1 (meeting) and x=10 (lounge, cafe) to keep bounds 384x224.

### Checks (actual output summary)
- typecheck: exit 0
- format:check: exit 0 (All matched files use the correct format)
- check:layers: exit 0, 963 files, no violations
- test: Test Files 367 passed | 1 skipped; Tests 3583 passed | 9 skipped
- build: exit 0
- test:db: Test Files 23 passed; Tests 365 passed

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- Visual check of the world at 1280/1366/1440/1920 px (light and dark) is Ming's step after merge; I could not view the deployed sign-in page.

### Scope self-check
- Could the diff be smaller? No; about half is tests and static layout data.
- Diff size: new files ~620 lines; edits to existing files ~+330 (CSS ~+200) / -20.
