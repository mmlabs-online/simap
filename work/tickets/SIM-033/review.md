# Review — SIM-033

## Attempt 1 — 2026-11-26
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format." (871 files)
- `pnpm typecheck` — exit 0 (`next typegen && tsc --noEmit` clean)
- `pnpm check:layers` — exit 0, "check-layers: 816 files, no violations"
- `pnpm test` — exit 0, "Test Files 311 passed | 1 skipped (312); Tests 3135 passed | 9 skipped (3144)". Matches impl-log.
- `pnpm build` — exit 0, route list includes `ƒ /credits`
- `pnpm test:db` — CI-only; no schema, query or endpoint change in this diff.

### Acceptance criteria
- [x] 1. Real art for every key with a source, placeholders for the rest. Evidence: `scripts/sprites/committed-atlas.test.ts` › "meta.version is the sha256 of office.png (first 12 hex)" and › "every sprite-map key is a map frame; every other key is placeholder or export" pass (they check both directions). `src/lib/sprites/bundled.test.ts` › "committed office.json: the set equals the sprite-map keys (55)" passes. `Dockerfile:25` `COPY --from=build /app/public ./public` is unchanged; `.dockerignore` has no `public` entry and is unchanged; `src/ui/roomlayout/loadAtlas.ts:14-15` loads `/sprites/office.json` and `/sprites/office.png`. Build is green. The reviewer did not open `pnpm dev` (no browser here), so the manual room-map check goes in the PR checklist with Ming's image check.
- [x] 2. Atlas committed, licence screenshot and credits row in place. Evidence: `git ls-files public/sprites` lists `office.json` and `office.png` (commit 4383539, M-63). `git ls-files assets/art/licences` includes `imersa-office.png`. The Imersa row is at `assets/art/CREDITS.md:8`, and the note at `CREDITS.md:16-22` now says the repo is private and why the atlas commit is allowed. Nothing under `assets/art/sources/` is committed: `git ls-files assets/art/sources` lists only `.gitkeep`, `git log origin/main..HEAD -- assets/art/sources` is empty (no branch commit ever touched it), and `.gitignore:17` ignores `assets/art/sources/imersa-office/`.
- [x] 3. Credits page shows the exact attribution. Evidence: `src/lib/credits.ts:13-18` has the author "Imersa Studios", the url `https://imersastudios.itch.io/office-pixel-art` and the attribution "Office Pixel Art by Imersa Studios (https://imersastudios.itch.io/office-pixel-art)", which is the same as `CREDITS.md:8` column 7. `src/lib/credits.test.ts` (parity with the CREDITS.md table in both directions, exact string, comshadow absent) passes. `src/ui/credits/CreditsPage.test.tsx` (attribution, `href`, `target="_blank"`, `rel="noopener noreferrer"`, empty state) passes. The header link is covered by `src/ui/AppShellView.test.tsx` › "Credits link in the header …".
- [x] 4. CI builds from the committed atlas without the original sheets. Evidence: `grep -rn "sprites:pack" .github/workflows` finds nothing. Sources are not committed (see AC2). The atlas tests read only committed files. CI on the PR still has to be green.
- [x] 5. The sprite list is exactly the bundled keys. Evidence: `src/lib/sprites/bundled.ts` (map/export only, null-safe) and its tests, `map-item-art.test.ts` › "spriteChoices with bundled keys …" and `SpriteBrowser.test.tsx` › "with an atlas that has meta.sources only bundled keys are listed" pass. `src/ui/mapItems/SpriteBrowser.tsx:36` is the only caller of `spriteChoices`.

Ming verification after merge (carry into the PR):
- Build and run the production image (or check the first SIM-021 deploy). Open a room map: sourced keys show real art and the rest show placeholders. Check a desk with devices for D61 slot overhang (architect K4). Open `/credits`.
- In `pnpm dev`, check `/map-items` › art dialog › sprite browser. It should not list `sofa` or `door`.
- M-77: make the repo private (Ming said it is not a blocker for this ticket).

### Issues
None.

### Scope
- All changed files are in the plan's file list, plus `work/ming-todo.md` (M-63/M-77/M-78 bookkeeping) and the ticket's work files.
- Out-of-plan `src/lib/sprites/placement.test.ts:509-510`: accepted. The test hardcoded the placeholder anchor of `plant.small` (x 64 ⇒ anchor x 0, y −16), which no longer holds for the real frame (anchor [-1, -31], `public/sprites/office.json:789-792`). The new expectation uses the formula from `src/lib/sprites/placement.ts:154-155` (`tile * TILE + anchor + offset`). It still asserts the bottom-left box position at all four rotations, and the shadow assertion is unchanged. The change is test-only, is recorded in impl-log, and plan step 1 expected this kind of change. It does not weaken the test.
- High paths: none touched (`Dockerfile`, `.dockerignore`, `next.config.ts` unchanged).

### Rules (CLAUDE.md)
No violations found. R1: page → `@/ui`, ui → `@/lib/credits` and `@/lib/sprites/bundled`, and `check:layers` is clean. R2/R6/R7: no schema, query or endpoint. R3: no config or secrets. R4: in plan, see Scope above. R5: checks green and new logic has tests. D36: the copy is in `src/ui/copy/credits.ts` and `shell.ts`, and `no-literals.test.ts` passes.

### Blockers from review agents
None.

### Nits (do not block)
- `SpriteBrowser.tsx:36`: while the atlas is still loading (`atlas` null), `bundledKeys` returns null and the full list shows, including placeholder-only keys. The list then shrinks once the atlas loads. This is the planned fallback (A3/R4), but the list can change size visibly on a slow load.
- `credits.test.ts`: the table parser splits on unescaped `|`. It works for today's row, but a future attribution with an escaped pipe would need the `\|` unescaped before comparing.

### Follow-ups (out of scope)
- As planned: device-type picker filtering (A7), `.dockerignore` hardening for `assets/art/sources` (A4, High), optional `LICENSE.txt` copy (A6), server-side bundled-key narrowing (A3).
- M-77: the atlas commit 4383539 was pushed while the repo was public. Whether history needs a purge is Ming's call.
