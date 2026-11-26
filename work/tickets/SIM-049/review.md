## Attempt 1 — 2026-11-26
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format."
- `pnpm typecheck && pnpm check:layers` — exit 0; types generated, tsc clean; "check-layers: 826 files, no violations".
- `pnpm test` — exit 0, Test Files 316 passed | 1 skipped (317); Tests 3184 passed | 9 skipped (3193).
- `pnpm build` — exit 0, "Compiled successfully", 22/22 static pages.
- `pnpm test:db` (local Postgres, run twice) — exit 0 both times, Test Files 20 passed; Tests 310 passed.
- Matches the impl-log figures.

### Acceptance criteria
- [x] Editor placing/rotating `clock.wall` / `screen.projector` only gives s or n — evidence: `src/lib/layout-editor/draft.ts:187` uses `nextRotation`; `draft.test.ts` › "rotateItems toggles clock.wall and screen.projector between s and n" (180, 0, 180). `rotateItems` is the only rotate entry point (`editor-state.ts:226`; the inspector button and R key go through it). Placement is always rotation 0 (impl-log finding, consistent with grep: no other rotation setter in `src/ui` / `src/lib/layout-editor`).
- [x] 90/270 refused with 422 `layout_bad_rotation`, nothing written; 0/180 save and read back — evidence: `src/lib/validate/layout.ts:181`; `layout.test.ts` › "n/s-only items refuse 90 and 270 with layout_bad_rotation, accept 0 and 180" (includes a mixed layout refused whole); `layout.db.test.ts` › "90° clock.wall is refused 422 layout_bad_rotation and nothing is written" (fixture count 0) and "180° clock.wall and screen.projector save and read back".
- [x] "Map items" art lists only n and s for these two items — evidence: `src/ui/mapItems/map-item-art.ts:11-13`; `map-item-art.test.ts` › "artDirs for clock.wall and screen.projector is n,s"; `MapItemArtDialog.test.tsx` › "an n/s-only item renders two panels, North and South". Server side: `artDirAllowed` (`src/lib/map-items/art.ts:19-22`) is used by `src/server/map-items/edit.ts:237` and `image.ts:70,142`, so e/w art is refused 422 `not_allowed`; `art.test.ts` › "artDirAllowed refuses e and w for n/s-only items".
- [x] `bin.trash`, `chart.flip`, `cooler.water`, `lamp.desk` keep all four directions — evidence: `layout.test.ts` › "bin.trash, chart.flip, cooler.water, lamp.desk accept 0/90/180/270"; `rotations.test.ts` (allowedRotations/allowedDirs for FOUR); `draft.test.ts` › "rotateItems still cycles four directions for bin.trash".
- [x] All Checks pass — see above (test:db locally green twice; CI runs it on the PR).

Scope: every changed source file is in the plan's file list; no out-of-plan files; no High path touched (no migration, auth, config or deploy file). Atlas, `keys.json`, `sprite-map.json` and `registry.test.ts` untouched as planned.

Timing note: the ticket's "latest `v0.1.9`" is stale (tags now go to `v0.1.12`), but I checked `git merge-base --is-ancestor db51d0a v0.1.12` → SIM-042 (#120) is in no release tag, so the plan's "no saved 90/270 layouts in production" assumption still holds. Merge this before the next release.

### Issues
None.

### Rules (CLAUDE.md)
No violations found. R1: new module is pure `src/lib/sprites/rotations.ts`, imported via `@/`, `check:layers` clean. R7: refusal is a domain 422 from the validator before any write (DB test confirms nothing written). R4: inside plan. R5: new logic has tests.

### Blockers from review agents
None.

### Nits (do not block)
- 💭 `src/ui/copy/mapItems.ts:30` `rotationHint` ("east and west swap width and height") is shown for every directional item in `MapItemFormDialog.tsx:179`, including the two n/s-only items where e/w no longer applies. Harmless (still true of the footprint rule), could be hidden for n/s-only items later.
- 💭 `rotations.test.ts` casts `r as 0` in the map; `r as Rotation` would read better.

### Follow-ups (out of scope)
- If SIM-042 ships in a release before this merges, read stored 90/270 of these keys as 0/180 (already in impl-log follow-ups).
- Optional: drop the unused e/w frames of the two items from the atlas in a later sprite cleanup.
