Status: READY

# Plan — SIM-069: Redesign My Portal → My devices layout (summary tiles and device table)

## Scope summary
- `docs/spec-v1.md` POR-03 (lines 576-586):
  - "Lists the devices the member holds, from the 'my devices' endpoint (DEV-12): name, type, inventory number,
    placement (seat code and role, or 'in my inventory'), expiry date and **Overdue** (DEV-10)."
  - "Per device, the owner actions that already exist: move / place at a seat or back to my inventory (DEV-03 to
    DEV-05), transfer to a member (DEV-08), return to the org inventory (DEV-09), request an extension (DEV-10), and
    cancel a pending handoff they started. Each action shows only when the rules allow it (e.g. none while a handoff
    is pending, except cancel)."
  - "A 'Waiting for my confirmation' list shows transfers to the member … with Confirm and Decline (DEV-08)." and
    "The overdue banner of DEV-10 shows here."
- Spec §8 / DSH-02 (line 626): "Search ignores case and Vietnamese diacritics: 'nguyen' finds 'Nguyễn'." The
  client-side search reuses the same fold (`src/lib/search/fold.ts › foldText`).
- D36: all user-facing text lives in copy files. D52: a clean UI kit for the portal.
- Ticket scope:
  - A page header ("My devices", "Your everyday tools, right where you need them.").
  - Summary tiles: the total, then one tile per type present, computed client-side.
  - A "Your assigned devices" card with a count chip, a subtitle, a text search (name, inventory no., MAC) and a type
    filter.
  - Table columns: Name (link, DEV-11), Type, Inventory no., MAC, Details, Owner, Placement, Actions.
  - A "Showing N of M" footer and horizontal scroll at narrow widths.
  - Actions are exactly today's owner actions under today's rules.
  - "Waiting for my confirmation" and the overdue banner stay.
- Ticket out of scope: any API, schema or rule change; new actions; the "Demo data" badge; the Manager/Admin Devices
  page.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Header, summary tiles (total + per type) and device table render as in the mockup at desktop width; at 390 px tiles stack and the table scrolls horizontally inside its card. | `MyDevicesView.test.tsx › header has the h2 heading and subtitle; tiles and the devices card render below banner and incoming`. `MyDevicesTiles.test.tsx › grid is grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`. `MyDevicesTable.test.tsx › table sits in an overflow-x-auto wrapper with min-w-[960px]; no md:hidden card list`. The look itself is under `## Ming verification after merge`. |
| 2 | Search and type filter narrow the table client-side; count chip and "Showing N of M" stay correct. | `my-devices-filter.test.ts` (all `filterDevices`, `typeSummary` and `effectiveType` cases). `MyDevicesTable.test.tsx › query and type props narrow the rows; chip shows loaded total; footer "Showing 1 of 3 assigned devices"; no-match row with Clear filters`. |
| 3 | Every row shows today's data plus the "You"/expiry/Overdue and Primary/Secondary chips; the name links to the device detail page. | `MyDevicesTable.test.tsx` row-variant cases (placed primary, placed secondary, in my inventory, overdue, no expiry, You chip, name href = `deviceDetailHref(id)`, MAC and Details). |
| 4 | Row actions are exactly today's actions under today's rules (pending → cancel, see Assumption 6); "Waiting for my confirmation" and the overdue banner still work. | `MyDevicesTable.test.tsx › action buttons equal rowActions(d, handlers, busyId) labels for every variant; pending transfer shows Cancel transfer and no Transfer / Give back / Extend; busy row disabled; no Actions column when no row has an action`. `MyDevicesTab.tsx`, `DeviceRowActions.tsx`, `device-actions.ts`, `OverdueBanner.tsx` and `IncomingTransfers.tsx` are unchanged in the diff. The existing `OverdueBanner.test.tsx` and `IncomingTransfers.test.tsx` pass. `MyDevicesView.test.tsx › banner and incoming slots render above the list` is kept. |
| 5 | No API change; existing My devices tests pass or change only for markup; new render tests cover tiles, search/filter and row variants. | `git diff --stat` shows no file under `src/app/api/**`, `src/server/**`, `src/lib/devices/**` or `db/**`, and `useMyDevices.ts` is unchanged. The `MyDevicesView.test.tsx` diff only adds cases or adjusts markup. `pnpm test` is green. |
| — | Checks | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build` all pass. |

## Ming verification after merge
- Compare with `mockup-my-devices.png` at 1280 px and 390 px, in the light and dark themes:
  - the tiles' icon colours
  - the card header (title, count chip, search and type select wrapping below the title at 390 px)
  - the table scroll inside the card
  - the action buttons wrapping
  - contrast of the links and chips in dark mode
- With real data (`pnpm dev` with the dev token):
  - place / move / return to my inventory, transfer, give back, extend and cancel each still work from the new
    table
  - the overdue banner's "show all" still focuses the "My devices" heading
  - Confirm and Decline in "Waiting for my confirmation" still update the table and tiles

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/ui/portal/my-devices-filter.ts` (new) | Pure helpers: `typeSummary`, `filterDevices`, `effectiveType`, `tileValue`, `typeIcon` (below). | Planner rule 6 (pure logic first); tiles, search and filter. | No |
| `src/ui/portal/my-devices-filter.test.ts` (new) | Unit tests. | R5. | No |
| `src/ui/portal/MyDevicesTiles.tsx` (new) | Pure tile grid: total tile, then one tile per `typeSummary` entry. | Summary tiles. | No |
| `src/ui/portal/MyDevicesTiles.test.tsx` (new) | Render tests. | R5. | No |
| `src/ui/portal/MyDevicesTable.tsx` (new) | Pure "Your assigned devices" `SectionCard`: chip, search, type select, one `<table>` at every width, no-match row, footer (Showing N of M, scroll hint, Load more, load-more error). Reuses `device-labels` and `DeviceRowActions`. | Table card. The shared `DeviceTable` stays untouched (the Devices page is out of scope). | No |
| `src/ui/portal/MyDevicesTable.test.tsx` (new) | Render tests (row variants, filter, footer). | R5. | No |
| `src/ui/portal/MyDevicesView.tsx` | `PageHeader` (heading ref kept), then notice, banner, incoming, loading/error/empty states, then `MyDevicesTiles` and `MyDevicesTable`. Owns `query` and `type` `useState`. Drops the `DeviceTable` import and the bottom Load more block (moved into the card footer). | Layout. | No |
| `src/ui/portal/MyDevicesView.test.tsx` | Keep all 8 cases (markup-only adjustments if any); add header, tile and card cases. | R5, AC5. | No |
| `src/ui/devices/device-labels.tsx` | `PlacementLabel` gets an optional `inventoryLabel?: string` (default `devicesCopy.inInventory`, so the Devices page is unchanged). | POR-03 "in my inventory". | No |
| `src/ui/PageHeader.tsx` (from SIM-066) | Add optional `headingRef?: Ref<HTMLHeadingElement>`. When it is given, the heading also gets `tabIndex={-1}` and `outline-none`. | `MyDevicesTab` focuses the heading after actions and from the overdue banner. | No |
| `src/ui/SectionCard.tsx` (from SIM-066) | Add optional `flush?: boolean` (default false): the body has no padding, so the table runs edge to edge as in the mockup. If the header row does not already use `flex-wrap`, add it so the `aside` wraps below the title on mobile. | Table card layout. | No |
| `src/ui/layout-blocks.test.tsx` (from SIM-066) | Add two cases: `PageHeader headingRef` and `SectionCard flush`. | R5. | No |
| `src/ui/copy/portal.ts` | New keys inside `portalCopy.devices`, in one block marked `// SIM-069: My devices layout` (below). Existing keys are kept. | D36. | No |

Not modified: `MyDevicesTab.tsx` (it already passes everything the view needs), `useMyDevices.ts`, `DeviceTable.tsx`,
`DeviceRowActions.tsx`, `device-actions.ts`, `OverdueBanner.tsx`, `IncomingTransfers.tsx`, `src/lib/icons.ts` (no new
icon; see Assumption 10), `src/ui/index.ts`. No file matches a High path.

## Data model / migration
None.

## API contract
None. The tab still uses `GET` "my devices" through `useMyDevices` / `api.listMine` unchanged, plus the existing
handoff and device action calls through `useDeviceDetailActions`.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `my-devices-filter.test.ts › typeSummary groups by deviceTypeKey ("Monitor", "monitor", " Monitor " → one entry, label = first seen trimmed), sorts count desc then key, [] for no devices` | Tiles (AC1, AC2) |
| `my-devices-filter.test.ts › typeSummary keeps "Máy in" and "May in" apart (D61 keeps diacritics)` | Domain focus: diacritics |
| `my-devices-filter.test.ts › filterDevices: empty or whitespace-only query and type "" → all, same order` | Search |
| `my-devices-filter.test.ts › filterDevices: query ignores case and diacritics ("may do" and "MÁY ĐỖ" and NFD input find "Máy Đỗ 1")` | Search (spec §8 fold) |
| `my-devices-filter.test.ts › filterDevices: matches inventory number substring ("inv-2"); matches MAC with or without separators ("AA:BB", "aabb", "aa-bb" find "aa:bb:cc:dd:ee:ff"); mac null never matches a MAC-only query` | Search columns, null fields |
| `my-devices-filter.test.ts › filterDevices: type key filters exactly; query and type combine (AND); no match → []` | Filter |
| `my-devices-filter.test.ts › effectiveType: returns the key when present in options, "" when the type disappeared` | Stale filter after an action |
| `my-devices-filter.test.ts › tileValue: "5" without more; "50+" with more` | Paging honesty |
| `my-devices-filter.test.ts › typeIcon: "Monitor"/"monitor" → desktop_windows; "PC", "Laptop", "Máy in" → grid_view` | Icons |
| `MyDevicesTiles.test.tsx › total tile first with copy.totalTile and the count; then one tile per type in typeSummary order` | AC1 |
| `MyDevicesTiles.test.tsx › with hasMore every value has "+"; list has aria-label copy.tilesLabel; grid classes grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` | AC1, paging |
| `MyDevicesTable.test.tsx › header: h3 title, count chip = loaded total ("3", or "3+" with hasMore), labelled search input and labelled type select with "All types" plus one option per type` | AC2 |
| `MyDevicesTable.test.tsx › table: sr-only caption, eight th scope=col with visible headers, overflow-x-auto wrapper, min-w-[960px]; no md:hidden list` | AC1 |
| `MyDevicesTable.test.tsx › row placed primary: "At seat S-1" link and Primary chip; placed secondary: Secondary chip; unplaced: "In my inventory"` | AC3 |
| `MyDevicesTable.test.tsx › row owner: You chip; "No expiry" when expiresOn null; expiry date text; Overdue chip when overdue` | AC3 |
| `MyDevicesTable.test.tsx › name links to deviceDetailHref(id); MAC shown mono or "—"; Details text` | AC3 |
| `MyDevicesTable.test.tsx › action labels in each row equal rowActions(d, handlers, busyId).map(label) for: unplaced, placed, overdue, pending transfer (Cancel transfer; no Transfer/Give back/Extend), busy row (all disabled)` | AC4 |
| `MyDevicesTable.test.tsx › no Actions column when no row has an action` | AC4 (today's behaviour) |
| `MyDevicesTable.test.tsx › query "inv-2" → one row and "Showing 1 of 3 assigned devices"; type key → only that type; chip stays 3` | AC2 |
| `MyDevicesTable.test.tsx › no match → one row (colSpan) with copy.noMatches and a Clear filters button; footer "Showing 0 of 3…"` | AC2 |
| `MyDevicesTable.test.tsx › hasMore → "Showing N of M loaded devices" and Load more (disabled while loadingMore); load-more error alert in the footer` | Paging |
| `MyDevicesView.test.tsx › header has the h2 heading (tabIndex -1) and subtitle; tiles and card render below banner and incoming` | AC1, focus |
| `MyDevicesView.test.tsx › no tiles, search or table when empty, loading, or error without rows` | Empty states |
| `MyDevicesView.test.tsx` existing 8 cases | AC5 (kept) |
| `layout-blocks.test.tsx › PageHeader with headingRef renders tabIndex -1; SectionCard flush body has no p-5` | Shared block changes |

## Approach
1. **Pure module `src/ui/portal/my-devices-filter.ts`.** It imports only from `@/lib/*` and types.
   - `export type TypeOption = { key: string; label: string; count: number }`
   - `typeSummary(devices: DeviceDto[]): TypeOption[]`:
     - group by `deviceTypeKey(d.type)` (`@/lib/device-types/name`, the D61 match key)
     - the label is the first-seen `d.type.trim()`
     - sort by count desc, then by `key` (code point order, deterministic)
   - `filterDevices(devices, query, typeKey)`:
     - `q = foldText(query.replace(/\s+/gu, " ").trim())` (`@/lib/search/fold`)
     - `mc = macCompact(query.trim())`
     - A device passes when `typeKey === ""` or `deviceTypeKey(d.type) === typeKey`, AND one of:
       - `q === ""`
       - `foldText(d.name)` includes `q`
       - `foldText(d.inventoryNumber)` includes `q`
       - `d.mac !== null` and (`foldText(d.mac)` includes `q`, or `mc !== null` and the MAC without `:.-`, lowercased,
         includes `mc`)
     - Order is preserved.
   - `effectiveType(options, typeKey)`: `typeKey` if some option has that key, else `""`. This is derived, so no
     effect is needed when the last device of a type leaves.
   - `tileValue(n, more)`: `more ? copy.atLeast(n) : String(n)`. Pass the formatter in, or return `{ n, more }` and
     format in the view, so the module stays copy-free; the implementer picks one and tests it.
   - `typeIcon(type): IconName`: `deviceTypeKey(type) === "monitor"` → `"desktop_windows"`, else `"grid_view"`.
2. **Shared block additions (SIM-066 files, additive only).**
   - `PageHeader`: `headingRef` (with `tabIndex={-1}` and `outline-none` when given).
   - `SectionCard`: `flush`, and `flex-wrap` on the header row if missing.
   - Add the two `layout-blocks.test.tsx` cases.
3. **`PlacementLabel`** gets `inventoryLabel?: string`. The default stays `devicesCopy.inInventory`.
4. **`MyDevicesTiles`** (pure). Props: `{ devices: DeviceDto[]; hasMore: boolean }`.
   - Renders `<ul role="list" aria-label={copy.tilesLabel} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">`.
   - Each `li` is a `Card` with `flex items-center gap-4 p-5`:
     - a 44 px rounded icon square (decorative `Icon`)
     - the value (`text-2xl font-extrabold text-on-surface`)
     - the label (`text-sm text-on-surface-variant truncate`, `title` = full label)
   - Total tile: icon `category`, `bg-primary-container text-on-primary-container`, label `copy.totalTile`.
   - Type tiles: icon `typeIcon(label)`. The background alternates `bg-secondary-container` / `bg-tertiary-container`
     (with their `on-*` text tokens) by index. Use tokens only, no mockup hex values.
5. **`MyDevicesTable`** (pure).
   - Props:
     ```
     devices, hasMore, loadingMore, errorCode, actions, busyId,
     query, typeKey, onQueryChange, onTypeChange, onClear, onLoadMore
     ```
   - Computes:
     - `options = typeSummary(devices)`
     - `type = effectiveType(options, typeKey)`
     - `rows = filterDevices(devices, query, type)`
     - `showActions = hasAnyAction(devices, actions)`, over all loaded rows, so the column does not jump while
       filtering
   - `SectionCard`:
     - `headingId="my-devices-card"`, `title=copy.cardTitle`, `subtitle=copy.cardSubtitle`
     - `titleAdornment={<Pill tone="neutral" label={tileValue(devices.length, hasMore)} />}` (not decorative: the
       count is read with the title)
     - `flush`
     - `aside`: a `div.flex flex-wrap gap-2 w-full sm:w-auto` holding:
       - `FilledInput type="search" icon="search" aria-label={copy.searchLabel} placeholder={copy.searchPlaceholder}`
         with class `h-10 w-full sm:w-56`
       - a `<label className="sr-only" htmlFor="my-devices-type">` plus a native `<select id="my-devices-type">`
         styled like `RoomSwitcher` (lines 33-38), with options `""` → `copy.allTypes`, then `options` (value = key,
         text = label)
   - Body: `<div className="overflow-x-auto"><table className="w-full min-w-[960px] border-collapse">`:
     - `<caption className="sr-only">{copy.tableCaption}</caption>`
     - The header row is `bg-surface-container`, with `th scope="col"` and visible `devicesCopy.columns.*` (the Actions
       header becomes visible only when `showActions`).
     - Rows have `border-t border-outline-variant`; cells are `px-4 py-4 align-top text-sm`:
       - Name: decorative `Icon name={typeIcon(d.type)}` plus `DeviceNameLink`
       - Type: `d.type`
       - Inventory no.: `font-mono`
       - MAC: `Mac`
       - Details: `Details`
       - Owner: `OwnerLabel`
       - Placement: `PlacementLabel inventoryLabel={copy.inMyInventory}`
       - Actions: `DeviceRowActions`
     - When `rows.length === 0`: one `<tr><td colSpan={showActions ? 8 : 7}>` with `copy.noMatches` and a
       `Button variant="tonal" size="sm" type="button" onClick={onClear}` labelled `copy.clearFilters`.
   - `footer`: `flex flex-wrap items-center justify-between gap-3 text-xs text-on-surface-variant`:
     - `<p role="status">` showing `hasMore ? copy.showingLoaded(rows.length, devices.length) : copy.showing(rows.length, devices.length)`
     - `<span className="lg:hidden">{copy.scrollHint}</span>`
     - When `errorCode !== null`: the existing load-more alert (`portalCopy.devices.loadMoreFailed` plus
       `apiErrorMessage`)
     - When `hasMore`: the Load more button (`disabled={loadingMore}`), the same as today's lines 106-112
6. **`MyDevicesView`.**
   - Replace the `h2` with `<PageHeader title={copy.heading} subtitle={copy.subtitle} headingRef={headingRef} />`.
   - Keep the `aria-live` notice block, `{banner}` and `{incoming}`, the skeleton, the error card and the empty card
     exactly as they are (lines 53-94).
   - When `devices.length > 0 && status !== "loading"`, render `<MyDevicesTiles>` and then `<MyDevicesTable>`.
     `useState` holds `query` (`""`) and `typeKey` (`""`); `onClear` resets both.
   - Remove the old load-more error and Load more blocks (lines 100-112); they now live in the card footer. Their
     conditions are the same: the footer error shows only when `status === "ready"`, which is passed in as the
     `errorCode` prop only in that case.
   - Props are unchanged, so `MyDevicesTab.tsx` is not edited.
7. **Copy.** Add these to `portalCopy.devices` in a `// SIM-069: My devices layout` block after `refreshFailed`:
   - `subtitle: "Your everyday tools, right where you need them."`
   - `tilesLabel: "Device summary"`, `totalTile: "Assigned devices"`, `atLeast: (n: number) => \`${n}+\``
   - `cardTitle: "Your assigned devices"`, `cardSubtitle: "Equipment assigned to you. Expiry and placement are shown for each device."`
   - `searchLabel: "Search your devices"`, `searchPlaceholder: "Search devices..."`
   - `typeLabel: "Filter by type"`, `allTypes: "All types"`
   - `tableCaption: "Your devices and where they are"`
   - `showing: (n: number, m: number) => \`Showing ${n} of ${m} assigned devices\``
   - `showingLoaded: (n: number, m: number) => \`Showing ${n} of ${m} loaded devices\``
   - `scrollHint: "Scroll horizontally to see all columns"`
   - `noMatches: "No devices match your search."`, `clearFilters: "Clear filters"`
   - `inMyInventory: "In my inventory"`
8. **Rules.**
   - R1: new code lives in `src/ui/**` and imports only `@/lib/*`; `pnpm check:layers` confirms this.
   - D36: no literals; `no-literals.test.ts` guards this.
   - R4: the Devices page, `DeviceTable` and the action rules are untouched.
   - R6, R7 and R2 are not affected (no route or schema change).
   - R5: the tests above.
9. Run `pnpm format`, then the four checks.

## Specialist input used
- ux-architect:
  - Adopted:
    - A new `MyDevicesTable` instead of restyling the shared `DeviceTable`.
    - Reuse of the `device-labels` components and `DeviceRowActions`.
    - A pure module for the tiles, filter and counts.
    - One table at every width with `min-w` and `overflow-x-auto`.
    - Honest counts while paging (M = loaded, "+" suffix, Load more kept).
    - `headingRef` and the `aria-live` notice kept.
    - A no-match state.
    - Tiles and card only when devices exist.
    - Labelled search and select, a `role="status"` count, an `sr-only` caption and `th scope`.
    - Diacritic-insensitive search, via the existing `foldText`.
    - MAC search that ignores separators, via the existing `macCompact`.
  - Checked: `placeModes` does not suppress Move/Place while a handoff is pending (`place-device.ts:16-19`). That is
    deliberate on the server (`handoffs.db.test.ts:155`, "placement while pending is allowed") and is pinned by
    `device-actions.test.ts:153-157`. See Assumption 6.
  - Adopted with a change: the per-type tile order is count desc, then type key.
- frontend-developer:
  - Adopted:
    - The `filterDevices` / `typeSummary` / `typeOptions` split, merged into `typeSummary`.
    - A static card subtitle.
    - The optional `PlacementLabel` label prop for "In my inventory".
    - The count chip shows the total held, and the filtered count goes in the footer.
    - The filter resets when its type disappears (derived via `effectiveType`).
    - No new icon dependency.
    - An `aria-live`/status footer.
    - Updates to `MyDevicesView.test.tsx` only for markup.
  - Adapted: query and type state live in `MyDevicesView`, and `MyDevicesTable` takes them as props. Static-markup
    render tests can then drive filtering directly (the consult's limitation).
  - Rejected: restyling `OverdueBanner` and `IncomingTransfers`, because they are shared with the out-of-scope
    Devices page (see Assumption 8).

## Assumptions
For Ming's approval round; each can be overturned at plan approval or at PR.
1. **Builds on SIM-066.** This plan reuses SIM-066's shared blocks `PageHeader`, `SectionCard` and `Pill`, its card
   and token styling, the tab bar (unchanged here), and the `desktop_windows` icon SIM-066 adds to `src/lib/icons.ts`.
   It adds only two optional props: `PageHeader.headingRef` and `SectionCard.flush`. Implementation starts after
   SIM-066 merges. If SIM-066's final block API differs, the implementer adapts to it and records this in the
   impl-log; no duplicate card or header styles are created.
2. **Count chip** = the number of loaded devices the member holds, not the filtered count. The footer carries the
   filtered count, "Showing N of M".
3. **Paging honesty.** The list is cursor-paged (50 per page). The tiles, chip, search and filter work over the loaded
   devices only.
   - With more pages, the values show "N+" and the footer reads "Showing N of M loaded devices".
   - Load more stays, in the card footer.
   - No auto-loading of all pages (that is out of scope).
4. **Search** matches name, inventory number and MAC. It ignores case and Vietnamese diacritics (same `foldText` as
   server search) and ignores MAC separators (`:`, `-`, `.`). It does not search type, owner or note.
5. **Tiles:** the total first, then one tile per type present, ordered by count desc, then name. They wrap in a 1/2/3
   column grid with no cap. The **tile label is the type name as stored** ("Monitor", not "Monitors"): types are free
   text (D61, may be Vietnamese), so there is no automatic plural. Types are grouped with the D61 key, so "Monitor" and
   "monitor" form one tile.
6. **Actions are today's, unchanged** (`rowActions` and `portalHandlers` are reused as they are).
   - While a handoff is pending: Transfer, Give back and Extend are hidden, and Cancel shows.
   - Move/Place/Return to my inventory still show, because the server allows placement while a handoff is pending
     (`handoffs.db.test.ts:155`).
   - POR-03's "e.g. none while a handoff is pending, except cancel" is read as the holding actions. Changing this
     would be a rule change, which is out of scope. If Ming wants placement hidden too, that is a follow-up ticket
     (UI plus server rule).
7. **Labels:** the mockup's "Return" is today's `return` placement mode, shown with its existing label. "Give back to
   org" is today's `giveBack`. Buttons keep `DeviceRowActions` (tonal, small). It is shared with the Devices page, so
   the mockup's outlined button look is not applied.
8. **Overdue banner and "Waiting for my confirmation"** keep their components unchanged (`OverdueBanner`,
   `IncomingTransfers`). They already use the shared `Card` and sit between the page header and the tiles. Restyling
   them would change the out-of-scope Devices page, which uses them too.
9. **Mobile:** at 390 px the table scrolls horizontally inside its card, as the ticket says. This replaces today's
   stacked card list on this tab only; the Devices page keeps its list. The "Scroll horizontally…" hint shows below
   `lg` only.
10. **Icons, no new names:**
    - total `category`
    - Monitor `desktop_windows` (from SIM-066)
    - every other type `grid_view`
    - search `search`

    So `src/lib/icons.ts` is not touched by this ticket, and SIM-067 is free to edit it.
11. **Card subtitle is static**, "Equipment assigned to you. Expiry and placement are shown for each device.". The
    mockup's "Equipment assigned to Ming. No expiry." is data-dependent. Expiry is shown per row.
12. **"In my inventory"** (POR-03 wording) applies on this tab only, via an optional `PlacementLabel` prop. The
    Devices page keeps "In inventory".
13. **The Actions column header is visible** ("Actions", as in the mockup) and is still shown only when some loaded
    row has an action, as today.
14. **No "Demo data" badge** (out of scope). The page header has no aside.
15. **Hotspots.** No ticket is `IN_PROGRESS`, `REVIEW` or `DONE` on the board. Expect rebases with SIM-066 and SIM-067
    (same batch):
    - `src/ui/copy/portal.ts`: SIM-069 adds keys only inside `portalCopy.devices`, in one `// SIM-069` block; SIM-067
      edits `seat` and SIM-066 edits `profile`/`tabChips`.
    - `src/ui/PageHeader.tsx`, `src/ui/SectionCard.tsx` and `src/ui/layout-blocks.test.tsx` (created by SIM-066). If
      SIM-067 needs the same `headingRef` or `flush` props, the first to land adds them and the other reuses them.
    - `src/lib/icons.ts`: not touched by SIM-069.

## Blocking questions
None.

## Split proposal
None. The estimate is about 400 product lines (filter module ~80, tiles ~50, table card ~170, view ~40, copy ~25,
shared-block props ~15, `PlacementLabel` ~3) and about 350 test lines. That fits one implement/review cycle.
