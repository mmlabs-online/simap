Status: READY

# Plan — SIM-070.1: Map items page header, stats bar, group tabs, search and card grid

Slice 2 of SIM-070 (parent `plan.md` → `## Split proposal` slice 2, `## Assumptions` 9 and 11). Only the list page
changes. The Item editor, the page wiring (`MapItemsPage.tsx`) and the API stay as they are. **No High path is
touched** (every file is under `src/ui/**` or is `scripts/check-tokens.pending.json`; `src/app/globals.css` is not
edited).

## Scope summary
- `docs/spec-v1.md` LAY-07 l. 496-498: "An Admin has a "Map items" management page (clean UI kit, D52) …"
- LAY-07 l. 499-502: "Each item shows its library key (read only), name …, group …, **size in tiles, always visible as
  `w × h`**, shown in palette (yes/no) and its art per direction … previewed at 1× and 2×." (The 1×/2× preview is the
  editor's job, SIM-070 Assumption 1. The card is not that preview.)
- LAY-07 l. 503-504: "… Items are never deleted. Hiding only removes an item from the palette …" (footer sentence).
- Spec "Art per item" l. 434-437: fallback "custom image → chosen package sprite → the library's built-in frame"
  (the card's art source label and preview order).
- Spec DSH-02 l. 633: "Search ignores case and Vietnamese diacritics: "nguyen" finds "Nguyễn"", implemented once in
  `src/lib/search/fold.ts:5` `foldText` ("The single fold rule for search"). The item search reuses it.
- D52: management screens use the clean UI kit. D87: "workspace coral for main actions, **pixel green for
  pixel/library features**" (so the selected group pill is `pixel-primary`, as in the mockup). D36: copy in
  `src/ui/copy/mapItems.ts`. D67 (1): "catalog items are listed alphabetically by name" (`catalogGroups` order, no
  reorder). D66: Admin manages existing library items only.
- Ticket SIM-070.1 Scope bullets 1-7 and Out of scope (no API change, no placed-copies count, no "Local library"
  badge, no app shell, no reorder).
- Parent SIM-070 Assumption 9 (Ming-flagged defaults): "In palette" counts `!hidden` literally (chairs count); the
  card art source for mixed directions uses image > package sprite > library over the allowed directions;
  "customised" = `isCustomised`; a selected group tab that disappears falls back to "All".

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Header, stats bar, group tabs, search and card grid render as in the list mockup at desktop width; at 390 px the grid has one column and nothing scrolls sideways; stats are correct for a fixture with hidden, customised and fixed-size items. | `map-items-state.test.ts › mapItemStats` cases; `MapItemsView.test.tsx › ready: header`, `› stats`, `› grid classes`, `› 390 px layout classes`. Local run: `pnpm dev`, `/map-items` as Admin at 1280 px (4 columns) and at 390 px in devtools (1 column, `document.documentElement.scrollWidth === innerWidth`), light and dark. Class tests can only assert classes; the no-sideways-scroll check is this manual step. |
| 2 | Group tabs and search narrow the grid client-side; "All N" and "Showing N of M items" stay correct; an empty result shows a short message. | `map-items-state.test.ts › filterItems` and `› activeGroup` cases; `MapItemsView.test.tsx › MapItemsList group`, `› query no match`, `› vanished group falls back to All`, `› footer status`. Local run: click a group pill and type in search; the grid, the footer count and the selected pill update; "All" count does not change while typing. |
| 3 | Each card shows the preview, `w × h`, name, library key, group, "Fixed size" when fixed, the art source and a hidden mark; the pencil opens the Item editor for that item. | `MapItemCard.test.tsx` cases (base, fixed, hidden, custom image, package sprite, library frame, no atlas, non-directional, NS-only). Pencil → editor: `MapItemCard.test.tsx › pencil` checks `aria-label="Edit map item <name>"`; `MapItemsPage.tsx` is unchanged (`onEdit` still opens `MapItemEditor`, line 54). Local run: press a pencil, the editor for that item opens. |
| 4 | No API change; new tests cover stats, filter, art source and the card variants. | `git diff --stat main -- src/app src/server src/lib db` is empty. All Checks green: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test` (includes `scripts/check-tokens.test.ts` and `src/ui/page-container.test.ts`), `pnpm build`. |

## Ming verification after merge
- Visual comparison with `work/tickets/SIM-070/mockup-map-items-list.webp` at 1280 px and 390 px, light and dark
  (card spacing, green selected pill, tile-grid faintness in dark mode, readability of the 12 px mono key).
- The defaults marked **(Ming)** under `## Assumptions`.

## Files to create / modify
All under the ui layer (ui → lib only, R1). None matches a High path in `.claude/loop.config.md`.

| File | Change | Required because | High path? |
|---|---|---|---|
| `src/ui/mapItems/map-items-state.ts` | add `mapItemStats`, `filterItems`, `artSourceOf`, `activeGroup`, type `ArtSource`; imports `foldText` from `@/lib/search/fold` and `isCustomised`/`artDirs` from `./map-item-art` | ticket Scope bullet 1 (pure logic first) | no |
| `src/ui/mapItems/map-items-state.test.ts` | new `describe` blocks for the four helpers | AC 1, 2, 4 | no |
| `src/ui/mapItems/MapItemCard.tsx` (new) | one card: preview, `w × h` badge, 44 px pencil, name, key, group chip, "Fixed size", art source, "Hidden" | ticket Scope bullet 5 | no |
| `src/ui/mapItems/MapItemCard.test.tsx` (new) | static-markup card variants | AC 3, 4 | no |
| `src/ui/mapItems/MapItemsView.tsx` | rewrite: header, stats card, controls row (pill `TabBar` + search), tabpanel with card grid / no-match message, footer; loading/error/forbidden/not-ready kept; adds `"use client"` and `useState` for group and query; exports pure `MapItemsList` | ticket Scope bullets 2-7 | no |
| `src/ui/mapItems/MapItemsView.test.tsx` | rewrite (the grouped `<h2>` rows go away); keeps forbidden, loading, error, not-ready and one-pencil-per-item cases | AC 1-3 | no |
| `src/ui/TabBar.tsx` | optional `variant?: "underline" \| "pill"` (default `"underline"`, markup byte-identical) and optional `count?: number` on `TabBarItem` | ticket Technical notes; mockup pill tabs with "All 10" | no |
| `src/ui/layout-blocks.test.tsx` | add a `TabBar` pill-variant case; existing cases unchanged | AC 4, regression of the default | no |
| `src/ui/kit.test.tsx` | in the "no legacy alias or weight" scan (around l. 318), also render `TabBar variant="pill"` with a `count` | keeps the pill on Simap tokens (D87) | no |
| `src/ui/copy/mapItems.ts` | add `header`, `stats`, `tabs`, `search`, `grid`, `footer`, `card` groups; remove `intro`, `edit`, `list.customised` (only `MapItemsView.tsx` and its test use them, rg-checked) | D36 | no |
| `scripts/check-tokens.pending.json` | remove the `"src/ui/mapItems/MapItemsView.tsx": 1` entry (l. 33) once the rewrite has 0 violations (the ratchet test fails on a stale entry) | `scripts/check-tokens.test.ts` › "every scanned file matches its pending count" | no |

Not modified: `MapItemsPage.tsx` (props unchanged), `map-item-art.ts`, `FramePreview.tsx`, `src/app/globals.css`, the
editor files, anything under `src/app`, `src/server`, `src/lib`, `db`.

## Data model / migration
None.

## API contract
None (no endpoint change; the list keeps using `GET` through `useList(api.list)` in `MapItemsPage.tsx:32`).

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `map-items-state.test.ts › mapItemStats › [] → {total 0, inPalette 0, customised 0}` | empty |
| `map-items-state.test.ts › mapItemStats › fixture desk.single (fixed), chair.office, door hidden, plant.large with s sprite, clock.wall with an image on e (not allowed) → {5, 4, 1}` | AC 1 stats: chair counts in palette, hidden excluded, art in a disallowed direction is not customised |
| `map-items-state.test.ts › filterItems › null group + "" or "   " query returns the flat catalogGroups order` | order (D67 1) |
| `… › group narrows; unknown group gives []` | tabs |
| `… › query matches name or builtinKey, trimmed, case-insensitive ("  DOOR ", "desk.sin")` | search |
| `… › Vietnamese: "ban hop" and NFD "Bàn họp" both find name "Bàn họp"` | DSH-02 fold, Domain focus diacritics |
| `… › group + query combined` | AC 2 |
| `map-items-state.test.ts › activeGroup › selected group present → itself; null → null; vanished group → null (All)` | parent Assumption 9 fallback |
| `map-items-state.test.ts › artSourceOf › library default; sprite only; image wins over a sprite in another direction (mixed); plant.large (non-directional) image on n → library; clock.wall sprite on e → library, on n → sprite` | art source over `artDirs` |
| `map-items-state.test.ts › artSourceOf › (artSourceOf(i) !== "library") === isCustomised(i) for every fixture item` | stats and card agree |
| `layout-blocks.test.tsx › TabBar pill: wrapper has gap-2 overflow-x-auto and no border-b; selected bg-pixel-primary text-on-action; unselected text-text-secondary; both min-h-control shrink-0 rounded-lg; no border-b-2; count renders as a font-mono span inside the button; roving tabindex and aria-controls as underline` | `TabBar` variant |
| existing `layout-blocks.test.tsx › TabBar` cases and `PortalTabs` usage pass unchanged | default unchanged |
| `kit.test.tsx › no legacy alias or weight` also over `TabBar variant="pill"` | D87 tokens |
| `MapItemCard.test.tsx › base (door): h3 name with title attr, mono key, group chip, visible "1 × 2"-style badge with sr-only "<w> by <h> tiles", "Library sprite", exactly one button: type=button, aria-label "Edit map item <name>", size-control` | AC 3 |
| `… › fixed: desk.single shows "Fixed size"; door does not` | AC 3 |
| `… › hidden: "Hidden" pill after the name in DOM order; preview sprite wrapper has opacity-60; absent when not hidden` | AC 3, not colour alone |
| `… › custom image: thumbUrl returns blob → <img alt="" src="blob:t"> with image-rendering pixelated; "Custom image"` | preview step 1 |
| `… › package sprite + atlas with that frame → one <canvas>; "Package sprite"` | preview step 2 |
| `… › library frame: atlas holding libraryFrameKey(door, "s") → one <canvas>; atlas null → no canvas, no img, placeholder of the same height` | preview step 3, atlas not loaded |
| `… › non-directional plant.large with an image only on n renders "Library sprite" without throwing` | non-directional |
| `… › preview block is aria-hidden="true" and does not contain the button or the size badge` | a11y (name not read twice) |
| `… › Vietnamese name "Bàn họp" rendered unchanged` | Domain focus |
| `MapItemsView.test.tsx › forbidden: h1 "Map items", role=alert noAccess, no tablist, no "Edit map item"` | state kept |
| `… › loading: aria-busy grid of 4 skeleton cards; no stats, tablist or search; no "0 map items"` | no false zeros |
| `… › error: alert with apiErrorMessage + Retry` | state kept |
| `… › not ready (ready, 0 items): list.empty text; no tablist, search or footer` | "not-ready" state |
| `… › ready: header eyebrow, h1 with accessible text "Map items" and an aria-hidden ".", subtitle; no old intro` | header |
| `… › stats: "5 map items", "4 in palette", "1 customised", the note; stats card has flex-wrap` | AC 1 |
| `… › tabs: role=tablist with aria-label; "All" selected with count 5; one tab per group in catalogGroups order; every tab aria-controls="map-items-panel"; a single role=tabpanel id="map-items-panel" aria-labelledby = the selected tab id; tab ids unique and valid for groups with spaces/diacritics` | tab semantics |
| `… › search: role=search wrapper, input type=search with aria-label, autocomplete=off, name` | labelled search |
| `… › grid: <ul role="list"> with grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4; one li per item in catalog order; one pencil per item; no New/Move up/Move down` | AC 1, 3 |
| `… › footer: role=status "Showing 5 of 5 items" (outside the tabpanel) and the never-deleted sentence outside the status` | AC 2 |
| `… › MapItemsList group="Zeta": only Zeta cards; All count still 5; "Showing 1 of 5 items"; Zeta tab selected` | AC 2 |
| `… › MapItemsList query with no match: grid.noMatch inside the tabpanel, no <ul>, "Showing 0 of 5 items"` | empty result |
| `… › MapItemsList vanished group "Gone": All selected, all cards` | fallback |
| `… › 390 px classes: controls row flex-col sm:flex-row; tab container min-w-0; tablist overflow-x-auto; search wrapper w-full sm:w-72` | AC 1 (class level only) |

## Approach
1. **Pure helpers** in `map-items-state.ts` (rule 6):
   - `export type ArtSource = "image" | "sprite" | "library"`.
   - `artSourceOf(item)`: `const dirs = artDirs(item)`; `"image"` if any `item.art[d].hasImage`, else `"sprite"` if any
     `item.art[d].sprite !== null`, else `"library"`.
   - `mapItemStats(items)` → `{ total: items.length, inPalette: count(!hidden), customised: count(isCustomised) }`.
   - `filterItems(items, group: string | null, query: string)`: `catalogGroups(items).flatMap(g => g.items)`, keep
     `group === null || i.group === group`; `const q = foldText(query.trim())`; when `q` is empty keep all, else keep
     `foldText(i.name).includes(q) || foldText(i.builtinKey).includes(q)`.
   - `activeGroup(groups: readonly string[], selected: string | null): string | null` → `selected !== null &&
     groups.includes(selected) ? selected : null` (derived at render time, no effect).
2. **`TabBar` pill variant** (`src/ui/TabBar.tsx`): add `count?: number` to `TabBarItem` and `variant = "underline"`
   prop. Keep the underline wrapper string (l. 32) and button strings (l. 57-61) exactly as today. Pill wrapper:
   `"flex min-w-0 gap-2 overflow-x-auto"`. Pill button: `"state-layer min-h-control shrink-0 rounded-lg px-4
   whitespace-nowrap inline-flex items-center justify-center gap-2 text-label cursor-pointer"` + selected
   `"bg-pixel-primary text-on-action font-semibold"` / unselected `"text-text-secondary"`. After the label, render
   `count` (both variants; no current caller sets it) as `<span className="font-mono text-caption">{count}</span>`.
   Keys, roving tabIndex, ids, `aria-controls` untouched. `on-action` on `pixel-primary` is an AA-checked pair
   (`src/lib/color/tokens.test.ts:133`).
3. **Copy** (`src/ui/copy/mapItems.ts`, D36). Add:
   `header: { eyebrow: "Build your little world", subtitle: "Small details. A space that feels like yours. Manage
   your room's sprites and objects." }`;
   `stats: { label: "Map item totals", total: (n) => (n === 1 ? "map item" : "map items"), inPalette: "in palette",
   customised: "customised", note: "32 px tile system · 4 directional sprites" }`;
   `tabs: { label: "Item groups", all: "All" }`;
   `search: { label: "Search items or library key", placeholder: "Search items or library key…" }`;
   `grid: { heading: "Items", noMatch: "No items match. Try another group or search." }`;
   `footer: { showing: (n, m) => \`Showing ${n} of ${m} ${m === 1 ? "item" : "items"}\`, note: "Items are never
   deleted. Hide an item to remove it from the local palette." }`;
   `card: { size: (w, h) => \`${w} × ${h}\`, sizeLabel: (w, h) => \`${w} by ${h} tiles\`, source: { image: "Custom
   image", sprite: "Package sprite", library: "Library sprite" } satisfies Record<ArtSource, string> }` (import the
   type only, or type it as `Record<"image" | "sprite" | "library", string>` to avoid a copy → mapItems import cycle).
   Remove `intro`, `edit`, `list.customised`. Keep `list.empty`, `list.hidden`, `list.fixed`, `editLabel`, `noAccess`.
4. **`MapItemCard.tsx`** (props `item`, `thumbUrl?`, `atlas?`, `onEdit`); an `<article>` using `Card`
   (`rounded-xl border border-divider bg-surface shadow-card`) with `flex min-w-0 flex-col`:
   - Preview wrapper `relative` (no `overflow-hidden`, so the pencil's focus ring is not clipped). Inside it:
     - an `aria-hidden="true"` tile block `h-36 sm:h-40 flex items-center justify-center overflow-hidden rounded-t-xl
       bg-tile` with a local `TILE_GRID` style (`linear-gradient(var(--color-divider) 1px, transparent 1px),
       linear-gradient(90deg, var(--color-divider) 1px, transparent 1px)`, `backgroundSize: "32px 32px"`; same as
       `MapItemEditorAppearance.tsx:19-23` but on the Simap token, no hex, so the token guard stays at 0). Content, in
       order: `thumbUrl?.(item)` → `<img alt="" className="size-24 object-contain" style={{ imageRendering:
       "pixelated" }}>`; else if `atlas` and `thumbSprite(item) ?? libraryFrameKey(item, "s")` →
       `<FramePreview atlas frameKey box={96} label={item.name} />` (FramePreview renders nothing for a missing
       frame); else nothing (empty tile, same height). Wrap the sprite in a span with `opacity-60` when hidden.
     - the size badge, absolute `left-2 top-2`: `rounded-md border border-divider bg-surface px-2 font-mono
       text-caption text-text-secondary`, visible `card.size(w, h)` in an `aria-hidden` span plus `sr-only`
       `card.sizeLabel(w, h)`.
     - the pencil, absolute `bottom-1 right-1`: `<button type="button" aria-label={editLabel(name)} className="state-layer
       inline-flex size-control items-center justify-center rounded-full cursor-pointer">` with an inner `size-8
       rounded-full border border-divider bg-surface text-text-secondary` circle holding `<Icon name="edit"
       size={16} />` (44 px hit area, 32 px visual, as the mockup).
   - Body `flex min-w-0 flex-col gap-1 p-4`: a row `flex min-w-0 items-center gap-2` with `<h3 className="min-w-0
     truncate text-label font-semibold text-text-primary" title={name}>` then `{hidden && <Pill tone="warning"
     label={list.hidden} />}`; key `<p className="truncate font-mono text-caption text-text-secondary"
     title={key}>`; footer row `mt-2 flex flex-wrap items-center gap-x-2 gap-y-1`: group chip `rounded-md bg-tile
     px-2 text-caption font-medium text-text-pixel` (`text-pixel` on `tile` is AA-checked, `tokens.test.ts:130`),
     `{fixedSize && <span className="text-caption text-text-secondary">{list.fixed}</span>}`, and `<span
     className="ml-auto text-caption text-text-secondary">{card.source[artSourceOf(item)]}</span>`.
   - Spacing only from the guard scale (0, 1, 2, 3, 4, 5, 6, 8, 12; `scripts/check-tokens.mjs:24`): no `py-0.5`,
     `px-1.5`, no `text-[…]`, no arbitrary px, no `font-bold`/`font-extrabold` (SIM-071 weight rule), no legacy
     aliases (`on-surface*`, `outline-variant`, `primary-container`, `rounded-md3*`, `text-h2`).
5. **`MapItemsView.tsx`** (add `"use client"`; `MapItemsViewProps` unchanged, so `MapItemsPage.tsx` is untouched):
   - `Header` (all states): `flex flex-col gap-1` with eyebrow `<p className="font-mono text-caption font-medium
     uppercase tracking-widest text-text-secondary">`, `<h1 className="text-display text-text-primary">{shellCopy
     .pages.mapItems.title}<span aria-hidden="true" className="text-workspace-primary">.</span></h1>`, subtitle `<p
     className="text-label text-text-secondary">`.
   - Wrapper keeps `page-library flex flex-col gap-6` (required by `src/ui/page-container.test.ts:38-44`).
   - forbidden: header + existing alert card. loading: header + `aria-busy="true"` grid (same grid classes) of 4
     `Card`s `h-64 animate-pulse`; no stats/tabs/search. error: unchanged card + Retry. ready with 0 items
     ("not ready"): unchanged `list.empty` card; no stats/tabs/search/footer.
   - ready with items: `const [group, setGroup] = useState<string | null>(null)` and `const [query, setQuery] =
     useState("")`; render `<MapItemsList items group query onGroup onQuery onEdit thumbUrl atlas />`.
   - `export function MapItemsList(...)` (pure, used by tests): `groups = catalogGroups(items).map(g => g.group)`;
     `active = activeGroup(groups, group)`; `shown = filterItems(items, active, query)`; `stats = mapItemStats(items)`.
     - Stats: `<Card className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4" as="section">` with
       `aria-label={stats.label}`; three `<p>`s, each `<span className="text-subtitle text-text-primary">{n}</span>
       <span className="text-label text-text-secondary">{label}</span>` (DOM reads "10 map items"); the note `<p
       className="flex basis-full items-center gap-2 text-caption text-text-secondary sm:ml-auto sm:basis-auto">`
       with `<Icon name="grid_view" size={16} />`.
     - Controls row `flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`: `<div className="min-w-0
       flex-1">` holding `<TabBar variant="pill" ariaLabel={tabs.label} tabs={[{ id: ALL, label: tabs.all, count:
       stats.total }, ...groups.map(g => ({ id: g, label: g }))]} active={active ?? ALL} onSelect={id => onGroup(id
       === ALL ? null : id)} tabIdOf={id => \`map-items-tab-${index of id}\`} panelIdOf={() => PANEL_ID} />` where
       `ALL = ""` (a group name is 1-40 characters, `src/lib/validate/map-item.ts`, so `""` is never a group) and
       `PANEL_ID = "map-items-panel"`; then `<div role="search" className="w-full shrink-0 sm:w-72">` with
       `<FilledInput type="search" name="map-items-search" autoComplete="off" aria-label={search.label}
       placeholder={search.placeholder} value={query} onChange={e => onQuery(e.target.value)} />` (kit input, 48 px,
       search icon aria-hidden).
     - Panel `<div role="tabpanel" id={PANEL_ID} aria-labelledby={tab id of active ?? ALL}>` (no tabIndex: it holds
       buttons): `<h2 className="sr-only">{grid.heading}</h2>`; `shown.length > 0` → `<ul role="list" className="grid
       grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">` with `<li key={builtinKey}
       className="min-w-0"><MapItemCard …/></li>`; else `<Card className="px-6 py-8 text-center"><p
       className="text-label text-text-secondary">{grid.noMatch}</p></Card>`.
     - Footer `<p className="text-caption text-text-secondary">`: `<span role="status">{footer.showing(shown.length,
       stats.total)}</span><span aria-hidden="true"> · </span>{footer.note}`. One live region only.
   - Cards keyed by `builtinKey`; filtering does not remount the page, so the editor (modal) keeps its opener.
6. **Tests** as listed; delete the old grouped-row assertions in `MapItemsView.test.tsx`; build atlas fixtures as the
   existing test does (`MapItemsView.test.tsx:81-82`).
7. **Token guard**: run `node scripts/check-tokens.mjs --list`; `MapItemsView.tsx` and `MapItemCard.tsx` must show 0;
   remove the `MapItemsView.tsx` line from `scripts/check-tokens.pending.json`. If the editor files' counts are
   unchanged, leave their lines alone.
8. Run all Checks: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`.

Rules: R1 (only `@/lib/search/fold`, `@/lib/map-items/types` and ui modules are imported; `check:layers`); R3 n/a;
R4 (file list above; the editor's own tile grid in `MapItemEditorAppearance.tsx` is not touched); R5 (tests above);
R2/R6/R7 n/a (no schema, server or route change). D36: every visible string from `mapItemsCopy` / `shellCopy`
(`no-literals.test.ts` must stay green; "." and " · " contain no letter).

## Specialist input used
- frontend-developer: adopted additive `variant` with default unchanged, single panel id, `mapItemStats` /
  `filterItems` / `artSourceOf` shapes, card preview order with a null-safe library frame, `editLabel` kept, `Hidden`
  as a pill plus mild dimming, grid/stats responsive classes, `min-w-0` + `truncate`, copy in `mapItems.ts`, retiring
  `intro`, polite count, test list, "rebase on main before starting". Resolved "not-ready": it is today's
  `ready` + 0 items state (`list.empty` = "The map item catalog is not ready yet…", `MapItemsView.tsx:80-84`), kept
  unchanged. Rejected `bg-workspace-action` for the selected pill: D87 says pixel green for library features and the
  mockup is green; `bg-pixel-primary text-on-action` is an AA-checked pair. Rejected a bordered unselected pill: the
  mockup shows plain text.
- ux-architect: adopted `<ul role="list">` of cards with the pencil as the only control, aria-hidden preview with
  `alt=""`, sr-only `w by h tiles`, 44 px hit area with a 32 px visual circle, sr-only `<h2>` with `<h3>` card names,
  `role="search"` + labelled `type="search"` without debounce, one `role="status"` count (dynamic part only),
  no-match message inside the tabpanel separate from `list.empty`, hide stats/tabs/search while loading (4 card
  skeletons), derived group fallback, `count` field instead of `chip`, "Custom image / Package sprite / Library
  sprite" labels and no second "Customised" badge, `flex-col sm:flex-row` controls. Rejected its token names
  (`bg-primary-container`, `text-on-surface*`, `border-outline-variant`, `rounded-md3*`, `bg-accent-orange-soft`):
  they are compat aliases that `kit.test.tsx` LEGACY forbids and SIM-071 slice 7 deletes; mapped to `pixel-primary`,
  `text-text-*`, `border-divider`, `rounded-*`, `bg-tile text-text-pixel`. Rejected a global `@utility tile-grid` in
  `globals.css`: every SIM-071 slice edits that file; a local style constant avoids the conflict (follow-up below).
  Rejected counts on group tabs: the ticket names only "All N" and the mockup shows counts only on "All", which also
  settles UX Q1 (counts never change while typing).

## Assumptions
1. **(Ming)** Search folds case **and Vietnamese diacritics** with the shared `foldText` (spec DSH-02 l. 633 rule,
   `src/lib/search/fold.ts`), so "ban hop" finds "Bàn họp". The ticket only says "case-insensitive"; this is a
   superset and matches every other search in the app.
2. **(Ming)** The stats label is spelled "customised" (the project's existing copy, `list.customised`), not the
   mockup's "customized".
3. Group tabs show no count; only "All" shows the total, which stays fixed while searching. The footer carries the
   filtered number.
4. The selected group and the query are local component state (not in the URL, not kept across reloads).
5. Stats, tabs, search and footer are hidden while loading, on error and in the not-ready (0 items) state, so no false
   "0" shows.
6. Card preview direction: a chosen package sprite (`thumbSprite`, s first) else the library frame for `s`; a custom
   image (`thumbUrl`, as today) wins. While the atlas loads or if it failed, the tile stays empty at full height.
7. The mockup's "Local library · Browser preview" badge, placed-copies counts and the app shell are out of scope
   (ticket). The accent dot after the title uses `text-workspace-primary` (decorative, `aria-hidden`).
8. Focus: if an edit (rename/regroup) makes the opener card leave the current filter after the list reloads, focus
   handling stays with the editor's existing restore; no extra focus logic here.
9. Size: about 370 production lines plus about 400 test lines. Production stays under the ~400-line guide; no
   further split.
10. **Hotspots (SIM-071, IN_PROGRESS, slices 5-7 pending on main):** SIM-071 plan l. 312-313 lists
    `src/ui/mapItems/**` for slice 6 ("pixel green, library page `max-w-library`, sprite previews `bg-tile`"); this
    ticket already does that for the list page, so slice 6 should only need to check `MapItemsView.tsx` /
    `MapItemCard.tsx`, not restyle them. `scripts/check-tokens.pending.json`, `src/ui/kit.test.tsx`,
    `src/ui/layout-blocks.test.tsx` and `src/ui/TabBar.tsx` are SIM-071 files too (slice 3 merged; later slices may
    touch the JSON and tests). Run this ticket before slice 5/6 and rebase on `main` right before implementing; a
    conflict in the pending JSON is a one-line merge. No other IN_PROGRESS/REVIEW/DONE ticket edits these files
    (backlog: SIM-070 and SIM-066.1 are MERGED).
11. No `@testing-library`/jsdom (parent Assumption 11): interaction is tested through the pure helpers and the pure
    `MapItemsList` with explicit `group`/`query` props; views through `renderToStaticMarkup`.

Follow-ups (not in this ticket): share one tile-grid style between `MapItemCard` and `MapItemEditorAppearance` (or a
`@utility tile-grid` once SIM-071 slice 7 settles `globals.css`).

## Blocking questions
None.

## Split proposal
None (this is already slice 2 of SIM-070).
