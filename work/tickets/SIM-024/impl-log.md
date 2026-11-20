## Attempt 1 — 2026-11-20

Slice 1 only (atlas pipeline), per plan.md. The renderer, compositor, name tags and demo page are not touched.

Sheet check (plan step 1): all 12 PNGs in `assets/art/sources/imersa-office/` are colour type 6, 8-bit, non-interlaced.
No Adam7 or 16-bit support was needed in `png.mjs`.

### Files touched
| File | Required because |
|---|---|
| `src/lib/sprites/keys.json` | Key registry, 97 frame keys (generated once from a throwaway script, then hand-maintained). |
| `src/lib/sprites/types.ts` | Manifest, frame, layer and registry types. |
| `src/lib/sprites/registry.ts` | Typed wrapper: `REGISTRY`, `FRAME_KEYS`, `LAYERS`, `isFrameKey`. |
| `src/lib/validate/sprite-manifest.ts` | Manifest validator (R1: validators live in `src/lib/validate/`). |
| `src/lib/validate/sprite-manifest.test.ts` | AC 1. |
| `scripts/sprites/png.mjs` | PNG codec on `node:zlib`. |
| `scripts/sprites/raster.mjs` | RGBA helpers (crop, nearest scale, blit, outline). |
| `scripts/sprites/placeholders.mjs` | Code-drawn placeholders for every key. |
| `scripts/sprites/pack.mjs` | Packer core: export > map > placeholder, anchors, shelf packer, overwrite guard. |
| `scripts/sprites-pack.mjs` | CLI (`--out`, `--no-map`, `--force`). |
| `scripts/sprites/{png,raster,pack,registry,committed-atlas}.test.ts` | Tests listed in the plan. |
| `public/sprites/office.png`, `public/sprites/office.json` | Committed placeholder atlas (`--no-map` build, A1). |
| `package.json` | `sprites:pack` script. |
| `.prettierignore` | `public/sprites/` so oxfmt leaves the generated JSON alone. |
| `docs/art/style-guide.md` | §7 accepted extra keys, §8 anchor fix and `meta`, §8b placement by anchor (D55). |
| `CLAUDE.md` | One Commands entry for `pnpm sprites:pack`. |

### Tests added / changed
- `src/lib/validate/sprite-manifest.test.ts`: 8 tests (all plan cases).
- `scripts/sprites/registry.test.ts`: 3 tests (directional groups, §7 coverage, sprite-map agreement).
- `scripts/sprites/png.test.ts`: 5 tests. `scripts/sprites/raster.test.ts`: 2 tests.
- `scripts/sprites/pack.test.ts`: 10 tests (anchor conversion, export anchor, priority, placeholders-only, unknown export key, wrong canvas, undecodable sheet, shelf packer, byte-stable, overwrite guard).
- `scripts/sprites/committed-atlas.test.ts`: 3 tests.

### Checks (actual output summary)
- typecheck: exit 0 (`Types generated successfully`, tsc clean).
- check:layers: `check-layers: 194 files, no violations`.
- format:check: exit 1, **only** `assets/art/sprite-map.json`. The same file fails on a clean `main` (verified with `git stash -u`), so it is not from this ticket. I did not reformat it (not in the plan's file list).
- test: `Test Files 73 passed (73)`, `Tests 679 passed | 3 skipped (682)`.
- build: exit 0.
- Manual AC 3, with the sheets present: `pnpm sprites:pack --out <tmp>` printed `97 frames (0 export, 55 map, 42 placeholder)`. `desk.single.s` gave `anchor [-2, -21]`, `tiles [2, 1]`, `w 68, h 53`. I opened the PNG and it shows the Imersa art. That output was not committed.
- Committed atlas: `pnpm sprites:pack --no-map` printed `97 frames (0 export, 0 map, 97 placeholder)`; PNG 6.5 KB, JSON 24 KB.
- AC 2 manual rename of the sources folder was not done; `pack.test.ts › packs placeholders only when sheets are missing` covers it with a temp root (9 warnings, one per sheet in use; the kitchen sheet has no mapped key).

### Out-of-plan files
None. (`assets/art/sprite-map.json` was reformatted by `pnpm format` once; I reverted it with `git checkout`.)

### Follow-ups (noticed, not done)
- `assets/art/sprite-map.json` fails `format:check` on `main` already. Either format it or add it to `.prettierignore`.
- Placeholder art is plain shapes; real Phase 2 art will replace it through `assets/art/export/`.
- Slice 2 (SIM-024.1) as in plan.md.

### Scope self-check
- Could the diff be smaller? No; the committed atlas needs the codec, placeholders and packer together, as the plan says.
- Diff size: about +2,000 lines, mainly the tests and the generated `office.json`/`keys.json`.
