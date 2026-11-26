Status: READY

# Plan — SIM-033: Ship the bundled art package and the in-app Credits page

## Scope summary
- Ticket goal: "Production shows the real sprites of the bundled package (the library behind the map item catalog, D66) instead of placeholders, and credits its authors as the licence requires."
- Ticket scope:
  - "Commit the packed atlas of the licensed pack so the production build shows real sprites; placeholders stay for keys without a source."
  - "The package sprite list (used by the SIM-039.6 sprite browser) is exactly the bundled keys."
  - "An in-app Credits page listing each pack's author, source and licence from `assets/art/CREDITS.md`."
- D66 (5): "The packed atlas of the licensed bundled pack is committed to the repo; SIM-033 becomes 'ship the bundled art package + Credits page'."
- D45: "Sources and `CREDITS.md` in `assets/art/`, exported atlas in `public/sprites/`; the repo stays private. An in-app Credits page lists authors, sources and licences."
- D54: "Keys with no source keep placeholders."
- Spec `docs/spec-v1.md:402`: "Every bundled third-party package is credited on the in-app Credits page (D45)."
- D58 ("until then the committed atlas stays placeholder-only") is superseded by D66 (5) for this ticket.

State on this branch: the real Imersa atlas is already committed (`4383539`, M-63): `public/sprites/office.png` + `office.json`, 55 `map` frames, 42 `placeholder` frames. This plan therefore adds **no runtime art-loading code**. It covers tests, licence wording, the sprite-list filter and the Credits page.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | A production image shows the real art for every key that has a source, and placeholders for the rest. | `scripts/sprites/committed-atlas.test.ts` › "every sprite-map key is a map frame; every other key is placeholder or export" and › "meta.version is the PNG hash" pass. `Dockerfile:25` (`COPY --from=build /app/public ./public`) and `.dockerignore` are unchanged and do not exclude `public/`. `pnpm build` is green. In `pnpm dev`, open a room map: desks, chairs, floors, walls and plants show Imersa art, and keys like `door`, `sofa` and avatars show placeholders. The full image run is under Ming verification. |
| 2 | The packed atlas is committed to the repo (D66 point 5) and the pack's licence screenshot and credits row are in place. | `git ls-files public/sprites` lists `office.json` and `office.png`. `git ls-files assets/art/licences` includes `imersa-office.png`. The `CREDITS.md` Imersa row is present, and line 16 now says the repo is private and why the atlas commit is allowed. `git ls-files assets/art/sources` lists only `.gitkeep`. |
| 3 | The Credits page shows the exact attribution text for every third-party pack in use. | `src/lib/credits.test.ts` (parity with `CREDITS.md`, exact Imersa string, no rejected pack) and `src/ui/credits/CreditsPage.test.tsx` (renders the attribution, the link and `rel`) pass. In `pnpm dev`, the header "Credits" link opens `/credits` and shows "Office Pixel Art by Imersa Studios" with a link to https://imersastudios.itch.io/office-pixel-art. |
| 4 | CI builds from the committed atlas without the original sheets. | Grepping `.github/workflows` for `sprites:pack` finds nothing. `git ls-files assets/art/sources` lists only `.gitkeep`. `committed-atlas.test.ts` reads only committed files. CI on the PR is green. |
| 5 | (scope bullet 2) The package sprite list is exactly the bundled keys. | `src/lib/sprites/bundled.test.ts`, `src/ui/mapItems/map-item-art.test.ts` › "spriteChoices with bundled keys lists only bundled keys" and `SpriteBrowser.test.tsx` › "with an atlas that has meta.sources only bundled keys are listed" pass. In `pnpm dev` on `/map-items`, the art dialog's sprite browser does not list placeholder-only keys such as `sofa` or `door`. |

## Ming verification after merge
- Build and run the production image (or check the first deploy under SIM-021). Open a room map: there is real art for sourced keys, with placeholders for the rest. Check a desk with devices, where the D61 slot offsets may overhang differently with real frames (architect K4). Open `/credits`.
- **Before the PR opens:** the repo must be private (M-77, ticket note 2026-11-26). The atlas commit `4383539` was pushed while the repo was public. Whether that needs any further action (for example, history) is Ming's call, outside this ticket.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `scripts/sprites/committed-atlas.test.ts` | Delete the test at lines 27-32 ("placeholder-only (M-10 default)"). Add two tests: (a) `meta.version === sha256(office.png).slice(0,12)`; (b) every key in `assets/art/sprite-map.json` `.sprites` has `meta.sources[key] === "map"`, and every other key is `placeholder` or `export`. | The old test fails on the committed atlas (R5). The new tests make "real art for every key with a source" and the JSON/PNG pairing checkable in CI (AC1, AC4). | no (low: `*.test.ts`) |
| `assets/art/CREDITS.md` | Rewrite the note at lines 16-20. The repo is private (D45, D60, M-77). The packed atlas in `public/sprites/` is built output that ships inside the app (D66 point 5), which the licence allows. The atlas commit assumes a private repo, so making the repo public would redistribute the pack: ask Ming first. The raw sheets stay git-ignored. | The current note says "this repo is public" (architect F8, Ming's answer on Q1). | no |
| `assets/art/sprite-map.json` | Change only the `_doc` line 6 wording: "and the repo is public" becomes "the repo is private but the sheets still must not be committed". | Same stale wording. The packer ignores `_doc`. | no |
| `src/lib/sprites/bundled.ts` (new) | `bundledKeys(manifest: { meta?: unknown } \| null \| undefined): ReadonlySet<string> \| null` returns the frame keys whose `meta.sources[key]` is `"map"` or `"export"`. It returns `null` when `meta` or `meta.sources` is missing or not an object. It reads defensively, because `validateSpriteManifest` does not deep-check `meta`. | Scope bullet 2, as pure lib logic (rule 6). | no |
| `src/lib/sprites/bundled.test.ts` (new) | Unit tests, see below. | R5 | no (low) |
| `src/ui/mapItems/map-item-art.ts` | `spriteChoices(item, dir, bundled?: ReadonlySet<string> \| null)` (line 46). When `bundled` is non-null, skip keys not in it. When it is null or omitted, keep today's behaviour. | Scope bullet 2 | no |
| `src/ui/mapItems/map-item-art.test.ts` | Add a `spriteChoices` test with a bundled set (after line 133). | R5 | no (low) |
| `src/ui/mapItems/SpriteBrowser.tsx` | Line 35: `spriteChoices(item, dir, bundledKeys(atlas?.manifest))`. | The browser lists only bundled keys once the atlas is loaded. | no |
| `src/ui/mapItems/SpriteBrowser.test.tsx` | Add a test with an atlas whose `manifest.meta.sources` marks some keys `placeholder`. The existing tests pass atlases without `meta`, so they stay valid. | R5 | no (low) |
| `src/lib/credits.ts` (new) | `export type CreditEntry = { pack; author; url; licence; attribution }` and `export const CREDITS: readonly CreditEntry[]` with the one Imersa entry. Pack is "Office Pixel Art (Free v1.0)", author "Imersa Studios", url `https://imersastudios.itch.io/office-pixel-art`, attribution exactly "Office Pixel Art by Imersa Studios (https://imersastudios.itch.io/office-pixel-art)" (copied from `CREDITS.md:8`), and a one-line licence summary: "Custom itch.io licence (free tier): personal and commercial use, edit and recolour allowed, credit required." | AC3. Typed data in lib. The app never parses Markdown at runtime (architect R3). | no |
| `src/lib/credits.test.ts` (new) | Parity test against `assets/art/CREDITS.md`, plus field checks. | AC3, R5 | no (low) |
| `src/ui/copy/credits.ts` (new) | `creditsCopy`: `title: "Credits"`, `intro: "simap uses these third-party art packs."`, labels `author: "Author"`, `source: "Source"`, `licence: "Licence"`, `attribution: "Attribution"`, and `empty: "No third-party packs in use."`. | D36: no literals in components. | no |
| `src/ui/credits/CreditsPage.tsx` (new) | A presentational page with an `h1` title and intro, then one `Card` per `CREDITS` entry. The card shows the pack, the author, a source link (`<a href={url} target="_blank" rel="noopener noreferrer">`), the licence line and the attribution text verbatim. It shows the empty text when the list is empty. It takes an optional `credits` prop (default `CREDITS`) so the empty state can be tested. | AC3 | no |
| `src/ui/credits/CreditsPage.test.tsx` (new) | Render tests, see below. | R5 | no (low) |
| `src/ui/index.ts` | `export { CreditsPage } from "./credits/CreditsPage";` (next to line 29). | Pages import only from `@/ui` (R1). | no |
| `src/app/(app)/credits/page.tsx` (new) | `import { CreditsPage } from "@/ui"; export default function Page() { return <CreditsPage />; }` | The route, inside `(app)`, behind `AuthGate` and in the shell (see Assumptions A2). | no |
| `src/ui/copy/shell.ts` | Add `credits: "Credits"` as a top-level key of `shellCopy` (not in `nav`), so `NavId` and the `satisfies` stay unchanged. | Header link text (D36). | no |
| `src/ui/AppShellView.tsx` | Inside the `session &&` header block (after the version span, lines 126-131), add a `next/link` `Link href="/credits"` with text `shellCopy.credits` and the same small text style as the version. Set `aria-current="page"` when `pathname === "/credits"`. | The Credits page is reachable from every page for every tier. No rail entry is added (frontend consult). | no |
| `src/ui/AppShellView.test.tsx` | Add a Credits link test. | R5 | no (low) |

**High paths touched: none.** `Dockerfile`, `.dockerignore` and `next.config.ts` are not changed. The gate stays plan-approval because the ticket is P1.

## Data model / migration
None.

## API contract
None.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `scripts/sprites/committed-atlas.test.ts` › "meta.version is the sha256 of office.png (first 12 hex)" | The JSON/PNG pair comes from one pack run (AC1, AC4) |
| `scripts/sprites/committed-atlas.test.ts` › "every sprite-map key is a map frame; every other key is placeholder or export" | Real art for every key with a source, and placeholders for the rest. A downgrade via `--force` is caught (AC1, architect K2) |
| `src/lib/sprites/bundled.test.ts` › "returns map and export keys, not placeholder" | Scope bullet 2 |
| `src/lib/sprites/bundled.test.ts` › "null when meta, meta.sources missing or not an object; ignores non-string values" | Edge cases (empty/null fields) |
| `src/lib/sprites/bundled.test.ts` › "committed office.json: the set equals the sprite-map keys (55)" | Ties the helper to the committed atlas |
| `src/ui/mapItems/map-item-art.test.ts` › "spriteChoices with bundled keys lists only bundled keys; null or omitted keeps the full list" | Scope bullet 2, backward compatible |
| `src/ui/mapItems/SpriteBrowser.test.tsx` › "with an atlas that has meta.sources only bundled keys are listed" | The browser wiring |
| `src/lib/credits.test.ts` › "every CREDITS.md table row has an entry with the same pack, author, URL and verbatim attribution, and the reverse" | AC3: exact text, no drift. The parser reads the table rows of `assets/art/CREDITS.md` (lines starting with `\|` after the header and separator rows, before "Rejected"), columns 1, 2, 3 and 7 |
| `src/lib/credits.test.ts` › "Imersa entry has the exact attribution string; URLs are https; no field empty; comshadow not listed" | AC3, the rejected pack stays out |
| `src/ui/credits/CreditsPage.test.tsx` › "renders title, one card per entry, author, licence, verbatim attribution, link with target _blank and rel noopener noreferrer" | AC3, the ticket's "Unit: Credits data rendering" |
| `src/ui/credits/CreditsPage.test.tsx` › "empty list shows the empty text" | Empty state |
| `src/ui/AppShellView.test.tsx` › "Credits link in the header for user, manager and admin; absent signed out; aria-current only on /credits; nav hrefs unchanged" | Reachability. The existing 10-link nav test stays green, because the link sits outside `<nav>` |
| Existing `src/ui/copy/no-literals.test.ts` | No literals in the new `.tsx` files (D36) |

## Approach
1. **Atlas tests.** In `committed-atlas.test.ts`, delete lines 27-32 and add the two tests. Read `assets/art/sprite-map.json` `.sprites` keys and use `node:crypto` `createHash("sha256")`, the same way as `scripts/sprites/pack.mjs:245`. Run `pnpm test` and confirm the committed atlas has 55 `map` keys equal to the sprite-map keys. If the counts differ, record the difference in the impl-log and stop. Do not repack. Also run the full suite once, because `SeatOverlay.test.tsx` reads the committed `office.json` (architect K4). If it depends on placeholder sizes, update that test only and record why.
2. **Licence wording.** Edit the `CREDITS.md` note and the `sprite-map.json` `_doc` line. In the impl-log, record the Free v1.0 zip sha256 (already in CREDITS.md) and the committed `meta.version` (architect R7).
3. **Bundled keys.** Add `src/lib/sprites/bundled.ts` (pure lib, R1) with its tests. Add the optional `bundled` parameter to `spriteChoices`. Wire `SpriteBrowser` to `bundledKeys(atlas?.manifest)`. Leave the server alone: `spriteAllowedFor` and `src/server/map-items/edit.ts` are unchanged (A3). A saved pick of a non-bundled key still renders, and the art panel still shows it; it is just not offered in the list.
4. **Credits.** Add `src/lib/credits.ts` and its test, `src/ui/copy/credits.ts`, `src/ui/credits/CreditsPage.tsx` and its test, the `src/ui/index.ts` export and `src/app/(app)/credits/page.tsx`. Layers: page → ui (via `@/ui`), and ui → lib (`@/lib/credits`), so R1 holds. Check it with `pnpm check:layers`.
5. **Shell link.** Add `shellCopy.credits`, the header `Link` in `AppShellView` and its test.
6. **Checks.** Run `pnpm typecheck`, `pnpm check:layers`, `pnpm test`, `pnpm format:check` and `pnpm build`. Run `git ls-files assets/art/sources` and expect only `.gitkeep`. Run the manual `pnpm dev` checks (room map, `/map-items` sprite browser, `/credits`).

Rules: R1 is met by the layering above. R2, R6 and R7 do not apply, since there is no schema, query or endpoint. R3: no config or secrets. R4: device-type picker filtering, `.dockerignore` hardening and copying `LICENSE.txt` are follow-ups. R5: tests listed above.

## Specialist input used
- Frontend: no runtime art-loading change is needed. Adopted: `loadAtlas` already uses `no-cache` plus `?v=<hash>`, and the Dockerfile copies `public/`.
- Frontend and architect F3/R1: replace the placeholder-only test with positive tests. Adopted, including the architect's version-hash test.
- Architect R1: add a `guard()` test if it is missing. Not needed, because `pack.test.ts:172` already covers it.
- Frontend 3: header link instead of a rail entry. Adopted. It is the smallest change and does not crowd the mobile bottom bar.
- Frontend 3: Credits page inside `(app)`. Adopted. Architect R6 (a public `src/app/credits` page plus a sign-in link) was not adopted, because it is larger and the licence only requires credit "in your credits" (A2).
- Architect R3: typed credits data in lib plus a parity test against CREDITS.md, with no runtime Markdown parsing. Adopted.
- Architect R4: UI-only sprite filter from `atlas.manifest.meta.sources`, falling back to the full list without meta. Adopted. The stronger server-side `BUNDLED_KEYS` was not adopted (A3).
- Architect R2: `.dockerignore` hardening. Not adopted here, because it is a High path (A4).
- Architect R5: commit a copy of `LICENSE.txt`. Not adopted, because it is optional and the screenshot already meets AC2 (A6).
- Architect Q4: an in-house sprites line. Not adopted (A5).

## Assumptions
For Ming to confirm at plan approval:
- **A1 Repo visibility.** The repo becomes private (M-77) before the PR opens. CREDITS.md is written for a private repo and states that the atlas commit assumes one.
- **A2 Credits placement and access.** There is a small "Credits" link in the app header for every signed-in tier, and no nav rail entry. `/credits` lives in `(app)`, so signed-out visitors see the sign-in gate. There is no link from the sign-in screen.
- **A3 Sprite list.** The list is filtered in the UI only (map-item sprite browser), based on the loaded atlas's `meta.sources` (`map` or `export`). The server still accepts any registry key for the group, so saved picks of placeholder-only keys stay valid and keep rendering. Server-side narrowing is a follow-up if Ming wants it.
- **A4 `.dockerignore` hardening.** Adding `assets/art/sources` to `.dockerignore` (High) is a follow-up. Today the sheets can only enter the build stage of a local `docker build` from Ming's tree. They never reach the runtime stage, and CI checkouts never have them.
- **A5 In-house sprites.** The Credits page lists only third-party packs, which is what the licence requires. There is no "other sprites: simap" line.
- **A6 Licence evidence.** `LICENSE.txt` is not copied into the repo. The screenshot `assets/art/licences/imersa-office.png` plus the CREDITS.md row is the committed evidence. Copying it is an optional follow-up.
- **A7 Device-type picker.** The device-type sprite picker (`src/ui/deviceTypes/device-type-sprite.ts`, `DEVICE_SPRITE_FAMILIES`) is not filtered. The scope bullet names only the SIM-039.6 browser, so filtering it is a follow-up (spec line 398 also mentions device types).
- **A8 "Bundled" means non-placeholder.** Keys with source `map` or `export` count as bundled. Today the committed atlas has no `export` frames, so the set equals the 55 Imersa keys.
- No hotspot: the only other open ticket, SIM-021 (IN_PROGRESS), lists none of these files.

## Blocking questions
None.

## Split proposal
None. The estimate is about 300 changed lines, mostly tests and small new files, which is size S–M.
