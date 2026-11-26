## Attempt 1 — 2026-11-26

### Files touched
| File | Required because |
|---|---|
| `scripts/sprites/committed-atlas.test.ts` | Replaced the placeholder-only test (fails on the committed real atlas) with the version-hash test and the sprite-map-keys-are-`map` test (AC1, AC4). |
| `assets/art/CREDITS.md` | Note rewritten: repo is private, atlas commit allowed and assumes a private repo (plan). |
| `assets/art/sprite-map.json` | `_doc` line 6 wording only ("repo is public" was stale). |
| `src/lib/sprites/bundled.ts` (new) | `bundledKeys(manifest)`: keys whose `meta.sources` is `map` or `export`; null without usable meta. |
| `src/lib/sprites/bundled.test.ts` (new) | Tests for it, including the committed office.json (55 keys). |
| `src/ui/mapItems/map-item-art.ts` | `spriteChoices` takes an optional `bundled` set. |
| `src/ui/mapItems/map-item-art.test.ts` | Test for the bundled filter. |
| `src/ui/mapItems/SpriteBrowser.tsx` | Passes `bundledKeys(atlas?.manifest)`. |
| `src/ui/mapItems/SpriteBrowser.test.tsx` | Test with `meta.sources`. |
| `src/lib/credits.ts` (new) | Typed credits data (one Imersa entry). |
| `src/lib/credits.test.ts` (new) | Parity with `CREDITS.md`, exact string, no comshadow. |
| `src/ui/copy/credits.ts` (new) | Credits page copy (D36). |
| `src/ui/credits/CreditsPage.tsx` (new) | The page. |
| `src/ui/credits/CreditsPage.test.tsx` (new) | Render and empty-state tests. |
| `src/ui/index.ts` | Export `CreditsPage`. |
| `src/app/(app)/credits/page.tsx` (new) | `/credits` route inside `(app)`. |
| `src/ui/copy/shell.ts` | `credits` label. |
| `src/ui/AppShellView.tsx` | Header "Credits" link with `aria-current` on `/credits`. |
| `src/ui/AppShellView.test.tsx` | Credits link test. |

### Tests added / changed
- committed-atlas.test.ts › meta.version is the sha256 of office.png (first 12 hex); every sprite-map key is a map frame; every other key is placeholder or export (old placeholder-only test deleted)
- bundled.test.ts › three tests (map/export only; null cases; committed office.json equals the 55 sprite-map keys)
- map-item-art.test.ts › spriteChoices with bundled keys
- SpriteBrowser.test.tsx › with an atlas that has meta.sources only bundled keys are listed
- credits.test.ts › parity; exact Imersa string
- CreditsPage.test.tsx › render; empty list
- AppShellView.test.tsx › Credits link
- placement.test.ts › "package sprite smaller than the box is bottom-left aligned" changed (see Out-of-plan files)

### Checks (actual output summary)
- typecheck: `next typegen && tsc --noEmit` clean.
- check:layers: "816 files, no violations".
- format:check: "All matched files use the correct format."
- test: Test Files 311 passed | 1 skipped (312); Tests 3135 passed | 9 skipped (3144).
- build: `pnpm build` succeeded; `/(app)/credits/page` is in the app manifest.
- `git ls-files assets/art/sources` lists only `.gitkeep`. Committed atlas has 55 `map` keys equal to the sprite-map keys (no count mismatch). Free v1.0 zip sha256 (from CREDITS.md): `bac93deafbf82181262539fbf2339590f88c68ab16033dff37de2fffc1f3bfcd`. The `meta.version` is asserted equal to the PNG hash by the new test (not printed here).
- Not run: manual `pnpm dev` visual checks (room map, `/map-items`, `/credits`); left for the reviewer / Ming.

### Out-of-plan files
- `src/lib/sprites/placement.test.ts` — the full suite failed on "package sprite smaller than the box is bottom-left aligned" because it hardcoded the placeholder anchor of `plant.small` (x 64, y -16). The real frame has anchor [-1, -31]. The test now reads the anchor from the committed manifest. Test-only change (plan step 1 anticipated such a dependency, but named `SeatOverlay.test.tsx`; that one passed unchanged).

### Follow-ups (noticed, not done)
- As planned: device-type picker filtering (A7), `.dockerignore` hardening for `assets/art/sources` (A4, High path), optional `LICENSE.txt` copy (A6), server-side narrowing (A3).
- Repo must be private before the PR opens (M-77); the atlas commit was pushed while public (Ming's call).

### Scope self-check
- Could the diff be smaller? No.
- Diff size: about +330 / -10 lines, mostly tests and small new files.
