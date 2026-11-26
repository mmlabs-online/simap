# Review — SIM-041

## Attempt 1 — 2026-11-26
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format." (871 files)
- `pnpm typecheck` — exit 0 (next typegen + tsc --noEmit)
- `pnpm check:layers` — exit 0, "check-layers: 816 files, no violations"
- `pnpm test` — exit 0, "Test Files 311 passed | 1 skipped (312); Tests 3136 passed | 9 skipped (3145)" (matches impl-log)
- `pnpm build` — exit 0
- `pnpm test:db` — CI-only, not relevant (no DB change)
- Extra: re-ran `pack({ root, outDir: <scratch> })` from `scripts/sprites/pack.mjs` with both packs' sheets present:
  ok, no errors, no warnings; the result is byte-identical to the committed `public/sprites/office.png` and
  `office.json` (version `8245e17cdb49`).

### Acceptance criteria
- [x] `pnpm sprites:pack` builds the atlas with every mapped 2dPig key as `map`; no Imersa key changes source —
  evidence: reviewer repack identical to committed atlas; `git diff origin/main...HEAD -- public/sprites/office.json`
  changes `meta.sources` only for `door.n`, `door.s`, `sofa`, `table.coffee`, `window.double` (placeholder -> map),
  plus frame sizes/anchors of those keys and `meta.version`; `committed-atlas.test.ts` and `bundled.test.ts` pass.
- [x] Each mapped sprite has rect, scale 2 and anchor, tiles match the registry, verified by crop — evidence:
  `assets/art/sprite-map.json` five new entries (scale 2, `tiles` [2,1]/[1,2]); packer reports no tiles error. Reviewer
  cropped each rect from `PixelOfficeAssets.png` with a 3 px margin (x8) and each packed atlas frame (x4): window
  (two-pane dark-framed window, matches the windows in the pack's `PixelOffice.png` scene), glass door leaf, grey
  sofa, plain orange table; all clean, no neighbour pixels in the rect. Anchors follow the plan rule (bottom-aligned,
  centred): e.g. window [-3,5] -> manifest [6,-10] for a 52x42 frame in a 64x32 footprint.
- [x] `CREDITS.md` 2dPig row (CC0 1.0, commercial yes, modify yes, derived keys); licence text in `assets/art/licences/`
  — evidence: `assets/art/CREDITS.md:9`; `assets/art/licences/2dpig-pixel-office.txt` tracked and byte-identical
  to `D:\project\PixelOffice\LICENSE.txt` (cmp); Screenshot column cites the licence file (M-81 waived by Ming).
  Zip sha256 in CREDITS.md matches `D:\project\PixelOffice.zip` (reviewer sha256sum).
- [x] Credits page lists 2dPig with an https link; parity passes; comshadow absent — evidence:
  `src/lib/credits.ts:20-26`; `src/lib/credits.test.ts` (exact 2dPig attribution, https, parity, "comshadow" not
  contained) and `CreditsPage.test.tsx` green in the full run.
- [x] Committed atlas test and all Checks pass — evidence: Checks above.

Ming verification after merge (not reviewer's): look at the new sprites in `/dev/roommap` and the "Map items" art
picker next to the Imersa art (different style, 16 px front view x2); drop any key that looks out of place.

### Issues
None.

### Scope
All changed files are in the plan's file list. Planned keys `elevator` and `device.pc` were dropped with reasons in
impl-log (single 16 px door leaf too narrow for 64x64; no PC on the sheet), which the plan allowed ("drops any key
whose crop does not look right, and records it"). The `pack.test.ts` warning count 9 -> 10 is a forced consequence of
the new source sheet. Committed sheet `PixelOfficeAssets.png` is byte-identical to the pack's and not git-ignored;
`.gitignore` only ignores `imersa-office/`. No High path touched.

### Rules (CLAUDE.md)
No violations found (R1/R2/R6/R7 not touched; R3 no config; R4 in plan; R5 checks green, new pack test added).

### Blockers from review agents
None.

### Nits (do not block)
- `sprite-map.json` `missing` still says "whiteboard (Premium; flip_chart is a free stand-in)" and "shelf.books (paid
  tiers)", which only describe Imersa; fine, but now that there are two packs the reasons could say "neither pack".
- `sofa` frame is 66 px wide in a 64 px footprint (2 px overhang right); documented, harmless.

### Follow-ups (out of scope)
- Elevator, PC, phone art need another pack or SIM-042.
