## Attempt 1 — 2026-11-26
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format."
- `pnpm typecheck` — exit 0
- `pnpm check:layers` — exit 0, "check-layers: 892 files, no violations"
- `pnpm test` — exit 0, "Test Files 341 passed | 1 skipped (342); Tests 3380 passed | 9 skipped (3389)" (includes `no-literals.test.ts`, `no-photo-on-map.test.ts`)
- `pnpm build` — exit 0
- `pnpm test:db` (local docker Postgres, throwaway DB) — exit 0, "Test Files 22 passed (22); Tests 344 passed (344)"

All results match impl-log.md attempt 1.

### Acceptance criteria
- [x] The picker offers only the presets; the preview updates live front and back at 1x and 2x — evidence:
  `pixel-look-state.test.ts` › "pickerOptions: exactly SKIN_RAMP, HAIR_RAMP, SHIRT_RAMP entries ..." and "choose ... ignores an index outside its ramp, a style outside 1..3, and calls while busy" (bounds -1, ramp length, style 0/4);
  `PixelLookPicker.test.tsx` (7 cases: radio counts from the ramps, four canvases role=img with labels, width = box x scale, atlas-missing/failed states);
  `pixel-look-preview.test.ts` (3 cases: body/shirt/hair order and tints via `avatarFrames(lookFromChoice(look))`, anchor box, missing frame → null).
  Live update by code read: `LookPreview.tsx` recomputes `box` in `useMemo([atlas, look, view])` and repaints in `useEffect([atlas, box, scale])`; all four previews receive `p.draft` (`PixelLookPicker.tsx`). Canvas painting itself is not testable under Vitest `environment: "node"`; see manual check below.
- [x] Save stores the look; the room map shows it on the next layout load — evidence: `pixel-look-api.test.ts` (PUT with exactly the four keys, content-type JSON, 200 parsed, 422/404 codes, ApiAccessError mapping); `pixel-look-state.test.ts` › "afterSave ok ..."; map side from slice A (`src/server/layout/layout.ts:80-84` reads `o.pixel_look`, `src/lib/sprites/placement.ts:447-449` `resolveLook(view.look, view.avatarSeed)`), `layout.db.test.ts` green in my `test:db` run.
- [x] Reset returns to the derived look (seeded from `members.id`) and the preview matches the map — evidence:
  - Seed chain: `GET /api/me` returns the member DTO with `id: r.id` (`src/server/members/members.ts:29`) → `readMeResult` keeps `id` only when a string (`src/lib/identity/flow.ts:119-128`, tested by `flow.test.ts` › "readMeResult keeps member.id only when it is a string; a member without id is still kept" and the updated `id: "m"` expectation) → `ProfileTab.tsx` takes `read.me?.member?.id` (never `sub`; grep of the new UI files finds no `sub` use) → `PixelLookSection memberId` → `initialPicker` / `afterReset` use `derivedChoice(s.memberId)`.
  - Map seed: `layout.ts:212` `occupantId: s.occupant_id` (= `members.id`, joined `o.id = s.occupant_id`) → `seat-view.ts:21` `avatarSeed: s.occupantId` → `resolveLook(null, seed)` = `avatarFor(seed)`.
  - Equality: `pixel-look-state.test.ts` › "afterReset ok: ... lookFromChoice(draft) equals resolveLook(null, memberId) and avatarFor(memberId)" with fixed UUID `3f2a9c1e-...`. Preview frames/tints come from the same `avatarFrames` and `tintedFrame` the map uses.
  - DELETE without body: `pixel-look-api.test.ts` › "reset sends DELETE with no body; 200 returns ok null".
- [x] All Checks pass — see Checks above.

### Ming verification after merge
- Hosted app, My Portal → Profile: pick a character; the four previews (front/back, 1x/2x) all change at once on each click and look crisp (no smoothing). Save; from another account open a room map where you sit and reload: the new look is drawn.
- Reset: the previews go back to the automatic look ("Automatic look" line shown), and after a map reload the map shows the same character as the preview.
- Narrow phone screen (about 320 px wide): the section stacks with no horizontal scroll.

### Issues
None.

### Rules (CLAUDE.md)
No violations found. R1: new files are in `src/ui/portal/**` and import only `@/lib/*`, `../roomlayout/*`, `../auth/*`, `../copy/*` (check:layers green). R4: every changed file is in the plan's file list; no High path touched. R5: new logic has tests. R6/R7/R2: no server, route or schema change. D36: all strings in `src/ui/copy/portal.ts`.

Recorded deviations accepted: `LookPreview` has no `failed` prop (plan said it adds nothing for it anyway; the picker shows the single `previewUnavailable` line), and `PixelLookSection` calls `useAtlas()` and passes `atlas`/`failed` down, as the plan's picker props already required.

### Blockers from review agents
None.

### Nits (do not block)
- `pickerErrorMessage("unavailable")` returns "Could not save your character. Try again." also for a failed Reset (`pixel-look-state.ts` `failed` used by `afterReset`). Wording could be neutral ("Could not update your character").
- After a failed GET, `saved` is null, so if a look is actually stored and the draft equals the derived look, Reset stays disabled until the member changes a part. Rare; acceptable.
- The figcaption is built as `` `${copy.views[view]} ${scale}x` `` in `PixelLookPicker.tsx`; a copy function (like `previewLabel`) would keep the "x" in copy.

### Follow-ups (out of scope)
- None.
