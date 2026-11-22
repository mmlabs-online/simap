## Attempt 1 — 2026-11-22
Verdict: REWORK

### Checks (run by reviewer)
Run in `d:\project\simap-wt\SIM-024.1` on HEAD `87ed481`, Node 22.
- `pnpm format:check` — exit 0, "All matched files use the correct format", 351 files.
- `pnpm typecheck` — exit 0.
- `pnpm check:layers` — exit 0, "check-layers: 297 files, no violations".
- `pnpm test` — exit 0, 123 files, 1223 passed, 3 skipped. Matches impl-log.
- `pnpm build` — exit 0, `/dev/roommap` listed as dynamic.
- `pnpm check:dev-bundle` — exit 0, "no dev-token strings in .next/static".
- `pnpm test:db` — not run, by instruction (CI only; this ticket has no schema or server change).

Extra reviewer checks (scratch harness outside the repo, importing the real modules; the worktree stayed clean):
- Client bundle: 0 files in `.next/static` contain any of the fixture marker, `RoomMapDemo`, `sub-ann`, `seat-a1`,
  `Nguyễn Thị Ánh`, `Trần Bảo`, `floor.carpet`, `data-demo-fixture`, `state.mine.tint` or `/sprites/office.json`, so
  neither the demo nor the renderer ships. Scanner control: `findForbidden` detects the marker in a scratch chunk.
  `RoomMapDemo` appears on the server only in one source map, and 0 times in the route's client reference manifest.
- Loader: 17 bad inputs (404, rejected fetch, bad JSON, null, array, image error, small and zero-size image, unknown,
  `__proto__` and `constructor` keys, missing frame, tiles mismatch, null frame, float, bad meta, reordered layers) all
  returned `{ok:false}` without throwing; the valid control returned `ok:true`.
- Painter, with a recording fake context at 2x/3x/4x on an overhanging swapped manifest: size, then smoothing off, then
  `scale(z,z)`, then `translate(-bounds)`. No op falls outside bounds.

Not verified (no real browser, by instruction): actual pixels, crispness, 125%/150% scaling, 390 px layout, themes, real
keyboard use, tag clipping and truncation, and the live 404 on a production server (covered by `page.test.tsx` and the
bundle scan only).

### Acceptance criteria
- [x] 1. Renders at 2x/3x/4x (spec; ticket said 1/2/3), no smoothing, every seat state — evidence: `paint.test.ts`,
  `fixture.test.ts`, `placement.test.ts` "ZOOM_LEVELS", reviewer painter trace. Visual result: Ming verification.
- [x] 2. Atlas swap without code changes — evidence: `placement.test.ts` "a different valid manifest...", `loadAtlas.test.ts`
  "string version", reviewer swap run (bounds moved from y -16 to y -32 with no code change).
- [x] 3. Bad manifest or atlas reaches the error state — evidence: `loadAtlas.test.ts`, `RoomMap.test.tsx`, 17 reviewer cases.
- [x] 4. Avatar colours stable and different — evidence: `avatar.test.ts`, `fixture.test.ts` "pairwise"; ramps match style guide §5.
- [ ] 5. Name tags on hover or focus only, every seat keyboard reachable — tag visibility and tab order are met
  (`SeatOverlay.test.tsx`; compiled `group-hover:flex` and `group-focus-visible:flex`), but the required hover and focus
  outline never renders. FAILED, see Issue 1.
- [x] 6. Demo absent from production, atlas placeholder-only — evidence: `page.test.tsx`, `check:dev-bundle`, reviewer
  bundle scan, `scripts/sprites/committed-atlas.test.ts`, no diff under `public/` or `assets/`.
- [x] 7. Unit tests cover hash, placement, draw order, rotation, overlay — evidence: all planned test names found and
  passing (77 tests in the touched suites).

Ming verification after merge (plan, not verified here; the PR must carry them):
1. Crisp pixels at 2x, 3x, 4x, and states recognisable by shape.
2. 390 px and desktop, light and dark theme; map scrolls, tags not clipped.
3. Tab order row then column, focus ring visible, tag only on hover or focus.
4. 125% and 150% display scaling: record the result in the PR.
5. Rotation-0 desk shows the person from behind, facing the screen (A1).
6. With the local Imersa atlas (do not commit): tall plants not clipped, no desk tint seam; then `git restore public/sprites`.
7. `/dev/roommap` returns 404 in a production build or deployment.

### Issues
#### Issue 1 — 🔴 blocker — hover and focus outline never renders
- **Where**: `src/ui/roomlayout/SeatOverlay.tsx:40`
- **Expected**: hover and keyboard focus show the HTML outline, white 2 px plus teal ring (style guide §6 line 114; plan
  Approach step 6, "Selection, hover and focus use an HTML outline").
- **Actual**: the button combines `outline-none` with `hover:outline-2` and `focus-visible:outline-2`. The compiled CSS is
  `.outline-none{--tw-outline-style:none;outline-style:none}` and
  `.hover\:outline-2:hover{outline-style:var(--tw-outline-style);outline-width:2px}` (the focus rule is the same). The
  variable stays `none` on the element, so the outline style resolves to `none`. Hover has no outline at all. Focus has
  only the teal `box-shadow` ring, which forced-colors mode removes, leaving no focus indicator there.
- **Fix instruction**: remove `outline-none` from the button's `className` and keep the other classes. The variable then
  falls back to its registered initial value `solid`. Add a case to `SeatOverlay.test.tsx` asserting the button class list
  contains `hover:outline-2` and `focus-visible:outline-2` and does not contain `outline-none`.

### Rules (CLAUDE.md)
No violations found. R1 passes `check:layers`. R2, R6, R7 do not apply. R3: no config or secrets added. R4: every changed
file is in the plan's list and no High path changed. R5 is not met until Issue 1 is fixed and tested.

### Implementer deviations
- **Shadow band: correct, no change.** The code (`placement.ts:220-227`) matches the settled default literally: 4 px tall,
  starting 1 px above the bottom edge, inset 2 px (`SIM-024/plan.md:317`). Furniture covers the top pixel, so 3 px show
  under the object, which fits style guide §4 ("3–4 px tall under the object's bottom edge").
- **Diff size (+1601 / -3): not a real problem, note it in the PR.** Product code is 779 lines, under the 800 estimate. The
  overrun is tests (822 against an estimate of 450). Scope is exactly the plan's file list, so splitting would not help.
- **Other listed deviations: acceptable.** `seats` on the draw list, the `overlayFor` footprint argument, the exported
  `RoomMapStatus`, the demo zoom copy and `{ok:false}` on abort all stay inside plan files and serve the plan.
- **Zoom divergence: handled and flagged.** One constant `ZOOM_LEVELS = [2, 3, 4]` follows the spec (`docs/spec-v1.md:329,355`)
  over the ticket and style guide §2 (1/2/3). The plan records it for Ming; the PR must state it.

### Blockers from review agents
None. No review trigger matches this diff.

### Nits (do not block)
- `placement.ts:199` reads `frame.blocks` from the manifest, and the validator does not compare it with the registry. A
  swapped manifest marking a chair as blocking would make it a prop host, against the plan's "chairs do not block".
- `RoomMap` ignores `list.unknown`, so skipped sprites are silent. SIM-015.1 may want to log or show them.
- `check-dev-bundle.mjs:57` still says "no dev-token strings" although it now also covers the demo fixture.

### Follow-ups (out of scope)
- Plan A10 stands: align ticket AC 1 and style guide §2 with the spec zoom once Ming confirms; add `pnpm check:dev-bundle`
  to CI; fix the static import in `src/app/dev/shell/page.tsx`; SIM-015.1 device drawing.
- SIM-015.1 must cap zoom or room size (A8) and decide how touch users see tag information (A5).
