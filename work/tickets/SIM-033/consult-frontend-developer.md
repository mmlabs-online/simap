## Findings

**Sprite loading needs no code change.**
- `src/ui/roomlayout/loadAtlas.ts` fetches `/sprites/office.json` and `/sprites/office.png` with `cache: "no-cache"`, so the new atlas is picked up as is.
- `paint.ts` draws frames from the atlas, and the manifest keys and `blocks` flags are validated against the registry.
- The `Dockerfile` already does `COPY . .` and then `COPY --from=build /app/public ./public`, so the committed atlas ships. `.gitignore` ignores only `assets/art/sources/imersa-office/`, not `public/sprites`.
- `src/proxy.ts` excludes only `api/`, `_next/static`, `_next/image` and `favicon.ico`. `/sprites/*` goes through the CSP proxy but is a plain static file, which is how it works today.
- Nothing needs checking in `.dockerignore` or the Dockerfile (High path) unless a test says otherwise.

**One test now fails.** `scripts/sprites/committed-atlas.test.ts` lines 27-32 ("committed atlas is placeholder-only (M-10 default)") allow only `placeholder` or `export` sources. The comment on that test says to delete it if Ming allows committing the Imersa build. The committed atlas has 55 `map` frames, so it fails on `pnpm test`.
- The other three tests in that file (manifest validates against the PNG size, keys equal the registry, blocks equal the registry) stay valid.
- Docs and comments still say "placeholder-only". D58 says "the committed atlas stays placeholder-only" until SIM-033. D66 point 5 supersedes that.

**CI and the original sheets.**
- Sheets in `assets/art/sources/imersa-office/` are git-ignored, so CI cannot repack.
- `pack.test.ts` runs the packer on its own fixtures, and `committed-atlas.test.ts` only reads the committed files. So CI builds from the committed atlas alone, as the fourth acceptance criterion requires.

**Credits data and licence evidence.**
- `assets/art/CREDITS.md` has one row. It lists the pack, author, URL, licence, attribution text and screenshot `licences/imersa-office.png`. The attribution text is "Office Pixel Art by Imersa Studios (https://imersastudios.itch.io/office-pixel-art)".
- `assets/art/licences/imersa-office.png` is in place. The comshadow pack is listed as rejected and must NOT appear on the Credits page.
- The note in CREDITS.md says built output inside the app is allowed. It also says the licence forbids redistributing the asset files. The Imersa pack's raw sheets stay ignored. The packed atlas is the allowed "built output", which D66 point 5 confirms.

**App shell.**
- Nav lives in `src/lib/nav.ts` (`NavId` and `NAV_ITEMS`, tier-filtered, `placement: "rail"`). Its labels are in `src/ui/copy/shell.ts` as `nav: Record<NavId, string>` (satisfies-checked) and `pages`.
- `AppShellView.tsx` has no footer. The header shows the brand, the version, the org and the theme toggle.
- The rail already has 6 to 10 entries, so adding a 7th to 11th entry hurts the mobile bottom bar.
- `src/app/(app)/layout.tsx` wraps all `(app)` pages in `AuthGate` and `AppShell`. Pages are thin: `export default function Page() { return <XPage /> }` with the component imported from `@/ui`.
- `src/ui/copy/no-literals.test.ts` enforces D36, so the Credits strings must live in a copy file.

## Recommendations

**1. Production art (acceptance criteria 1, 2, 4).**
- No runtime code change.
- Delete or replace the placeholder-only test in `committed-atlas.test.ts` and update its comment. Better: replace it with a positive check that every `meta.sources` value is one of `placeholder`, `export` or `map`, and that at least one is `map`.
- Optionally assert that the `map` frames equal the keys with an `imersa-office` source in `assets/art/sprite-map.json`. That ties "real art for every key with a source" to the map.
- Update the stale wording in comments, docs and the D58 mention (README or CREDITS if they say placeholder-only). Check `scripts/sprites-pack.mjs` header text too.
- Check `office.json` for exactly 55 map and 42 placeholder frames.

**2. Sprite list for the SIM-039.6 browser.**
- The scope says "the package sprite list is exactly the bundled keys". Expose it as a small pure `lib` helper. Give it a test.
- Use `meta.sources` `map`/`export` entries from the manifest. Alternatively use the registry keys that have a source in `sprite-map.json`.
- Keep it minimal. If SIM-039.x owns the browser, only add the helper if the plan wants it here (R4).

**3. Credits page (criterion 3).**
- Create `src/lib/credits/credits.ts` with a typed `CREDITS` list. Each entry has pack, author, url, licence summary and attribution text. Seed it from the CREDITS.md row, with the licence line trimmed to the sentence "Free tier: credit required, personal and commercial use, edit and recolour allowed".
- Pure `lib` code means it can be tested against CREDITS.md.
- Create `src/ui/copy/credits.ts` with the title, intro, field labels, the licence-screenshot note and an empty state. Put the attribution text here or in `lib/credits`. It must equal "Office Pixel Art by Imersa Studios" exactly, linking to https://imersastudios.itch.io/office-pixel-art.
- Create `src/ui/credits/CreditsPage.tsx`, exported via `@/ui`. Make it presentational and render one card per pack. Use an `<a href target="_blank" rel="noopener noreferrer">` for each URL. Make the pack author text the visible attribution string.
- Create `src/app/(app)/credits/page.tsx`. Place it in `(app)` for shell consistency. A signed-out visitor sees the gate, which is acceptable for an in-app page (D45).
- Navigation: do NOT add a rail item. Add a small "Credits" link in the shell. It could go in the `AppShellView` header next to the version, or in an overflow slot on the rail's bottom area on `lg` only. Alternatively, add a footer link in `main`. A header link is the smallest change, visible to all tiers, and fits the existing header layout. Add `shellCopy.credits = "Credits"` (a literal, not a `NavId`, so `nav.ts` and its `satisfies` stay unchanged).
- If you prefer an actual nav entry, then `NavId`, `NAV_ITEMS`, `shellCopy.nav`, `shellCopy.pages` and the nav tests all change. Make it `minTier: "user"`, placement `rail`, with an icon from `lib/icons`. That would crowd the bottom bar, so the header link is better.
- Add an `isActive`-style `aria-current="page"` on the link when `pathname === "/credits"`.

**4. Tests.**
- Unit: credits data. Every entry has non-empty author, https URL and attribution text. Include the exact Imersa string. Reject the rejected pack. Optionally parse `assets/art/CREDITS.md` and match the Imersa URL and attribution text to `CREDITS` so the two cannot drift.
- Unit: `CreditsPage` render via `renderToString` or the existing `AppShellView.test.tsx` pattern. Check the attribution text, the href and `rel`.
- Shell: a test that `AppShellView` renders the Credits link for a signed-in session.
- Committed-atlas test as in item 1.
- Run `pnpm test`, `pnpm typecheck`, `pnpm check:layers` (the page imports from `@/ui`, ui imports `lib`) and `pnpm format:check`.
- Manual: `pnpm build`, run the image, open a room map and `/credits`.

## Risks
- If the test in `committed-atlas.test.ts` is not changed, CI fails (R5).
- The Imersa licence forbids redistributing the asset files. The repo is public and now holds the packed atlas (D66 point 5 allows it, and CREDITS.md says built output is allowed). The raw sheets must remain git-ignored. Confirm `git ls-files assets/art/sources` is empty (apart from `.gitkeep`) before the PR.
- Atlas change after the browser has cached it: `no-cache` handles the manifest, but the PNG URL has no hash. Browsers revalidate through `loadAtlas`'s `imageUrl(json)`, which may add a version, so check it if users see stale art.
- Adding a nav rail entry would crowd the mobile bottom bar (the `overflow-x-auto` row already holds up to 10 entries).
- A High path may be touched if the Dockerfile changes. It is not needed.

## Open questions
- Header link vs rail entry vs footer for Credits? I recommend the header link.
- Should the Credits page be reachable while signed out (a public route outside `(app)`)? D45 just says "in-app". I assumed behind the gate. Check D45 text (decisions.md line 52).
- Should the Credits page list the licence summary text, or only author, source and the attribution line? The ticket says "author, source and licence", so I recommend a short licence summary line plus the full attribution text.
- Is the sprite-list helper (item 2) in scope here, or only for SIM-039.6?
