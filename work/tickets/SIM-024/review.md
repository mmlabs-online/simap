## Attempt 1 — 2026-11-20
Verdict: PASS

Scope reviewed: slice 1 only (atlas pipeline), as plan.md defines. Renderer, compositor, name tags and demo page are
slice 2 (proposed SIM-024.1) and were not expected in this diff.

### Checks (run by reviewer)
- `corepack pnpm format:check` — exit 0, "All matched files use the correct format." (231 files). The earlier
  `assets/art/sprite-map.json` failure is gone after the rebase onto main.
- `corepack pnpm typecheck` — exit 0 ("Types generated successfully", tsc clean).
- `corepack pnpm check:layers` — exit 0, "check-layers: 194 files, no violations".
- `corepack pnpm test` — exit 0, "Test Files 73 passed (73)", "Tests 679 passed | 3 skipped (682)". The sprite files
  alone (`vitest run scripts/sprites src/lib/validate/sprite-manifest.test.ts`): 6 files, 31 tests passed.
- `corepack pnpm build` — exit 0.
- `pnpm test:db` — CI-only, needs Postgres. This diff does not touch the DB.
- Extra: `corepack pnpm sprites:pack --no-map --out <tmp>` printed "97 frames (0 export, 0 map, 97 placeholder)". Its
  `office.png` and `office.json` are byte-identical (`cmp`) to the committed `public/sprites/*`, so the committed atlas
  is the reproducible placeholder build.
- Extra: `corepack pnpm sprites:pack --out <tmp>` with the local Imersa sheets: exit 0, "97 frames (0 export, 55 map,
  42 placeholder)". `meta.sources` has 55 `"map"` keys. `desk.single.s` =
  `{"x":242,"y":111,"w":68,"h":53,"anchor":[-2,-21],"tiles":[2,1],"blocks":true}`. I opened the PNG and it shows the
  Imersa art. Nothing was written into the repo (`git status` clean).

These results match the implementer's claims in impl-log.md. The one difference is format:check, which now passes
because main was fixed and the branch rebased.

### Acceptance criteria
- [x] 1 Validator accepts the placeholder manifest. It rejects an unknown key, an out-of-bounds frame, a missing
  direction or frame, a wrong tile, wrong layers and non-integer geometry. Evidence:
  `src/lib/validate/sprite-manifest.test.ts` (8 tests, all pass) and `committed-atlas.test.ts › committed manifest
  validates against the PNG size` (pass).
- [x] 2 With no sheets, the pack is valid and has every key, with one warning per missing sheet and no error. Evidence:
  `pack.test.ts › packs placeholders only when sheets are missing` (pass; 9 warnings, validated with
  `validateSpriteManifest`, keys equal `FRAME_KEYS`). The CLI exit path is `scripts/sprites-pack.mjs:20-23`, which
  exits 1 only when `!r.ok`. I did not rename the sheets folder for a manual run; the temp-root test covers it.
- [x] 3 Map keys are cut and placed by anchor, and priority is export > map > placeholder. Evidence:
  `pack.test.ts › anchor conversion`, `› priority export > map > placeholder` (pass), plus my manual full pack above
  (55 map keys, `desk.single.s` anchor `[-2,-21]`).
- [x] 4 An unknown export key, a wrong canvas size or an undecodable sheet makes the run exit 1. Evidence:
  `pack.test.ts › rejects unknown export key`, `› rejects wrong export canvas size`, `› fails on an undecodable sheet`
  (pass). Error paths: `pack.mjs:67-78`, `pack.mjs:100-102`.
- [x] 5 Committed atlas is the placeholder build, validates, keys equal the registry, and frames fit the IHDR. Evidence:
  `scripts/sprites/committed-atlas.test.ts` (3 tests, pass) and the byte-identical reproduction above.
- [x] 6 Deterministic output. Evidence: `pack.test.ts › output is byte-stable` (pass), and the `cmp` reproduction of the
  committed files.
- [x] 7 Sprite map and registry agree. Evidence: `registry.test.ts › sprite-map keys and footprints match the registry`
  (pass). The packer enforces the same rule at `pack.mjs:108-118`.
- [x] 8 Checks are green (see above).

Ming verification after merge: none for slice 1 (plan). The PR should carry the plan's three open Ming defaults:
1. The committed atlas is placeholder-only (A1 / M-10).
2. `window.single` and `window.single.top` are accepted as keys (A2).
3. A hand-written PNG codec is used instead of `pngjs`.

### Issues
None.

### Scope
Every changed file is in the plan's Files table. The ticket's files are `ticket.md`, `consult-*.md`, `plan.md` and
`impl-log.md` under `work/tickets/SIM-024/`, which is workflow. No High path is touched, no dependency is added, and
`package.json` gains only the `sprites:pack` script. No review-trigger path changed, so the security auditor is not
required.

### Rules (CLAUDE.md)
No violations found.
- R1: `src/lib/sprites/*` and `src/lib/validate/sprite-manifest.ts` are pure, with no I/O and no imports from
  `scripts/` or `src/ui`. `check:layers` is clean.
- R3: no env and no secrets.
- R4: within the plan.
- R5: the new logic has tests and the checks are green.

### Blockers from review agents
None.

### Nits (do not block)
- `scripts/sprites/pack.mjs:234`: `pack({ root })` loads the registry with `loadRegistry()` from the repo `ROOT`, not
  from `root`. This is harmless today but inconsistent with the `root` option. Use `loadRegistry(root)` or document the
  behaviour.
- `scripts/sprites/pack.test.ts:25`: the `mkdtempSync` temp roots are never removed, so each test run leaves folders in
  the OS temp directory. Add an `afterEach` that calls `rmSync(..., { recursive: true, force: true })`.
- `scripts/sprites/raster.mjs` `crop`: a sprite-map `rect` that falls partly outside its sheet is padded with
  transparent pixels and no error. A bounds check in `resolveSources` would catch typos in the map.
- `scripts/sprites/pack.test.ts:100`: `toHaveLength(9)` depends on the current contents of the real
  `assets/art/sprite-map.json`, so it breaks whenever a sheet is added to the map. Derive the expected count from the
  map instead.
- `scripts/sprites-pack.mjs:9`: `--out --no-map` treats `--no-map` as the output directory.
- `docs/art/style-guide.md` §8 and §8b: the new sentences are not wrapped to the file's usual line width.

### Follow-ups (out of scope)
- Slice 2, SIM-024.1: renderer, avatar compositor, name tags and dev demo page, which cover ticket AC 2–5 and the hash
  and placement parts of AC 6. The defaults are recorded in plan.md `## Split proposal`.
