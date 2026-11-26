Consult report for SIM-069 (My devices redesign). Read-only; no files changed.

## Findings

- **Current structure:**
  - `MyDevicesTab.tsx` is the container. It owns the hooks, the handoff and notice state, and the dialogs.
  - `MyDevicesView.tsx` is a pure view with an `h2`, the notice, the banner and incoming slots, loading/error/empty states, a shared `DeviceTable` and Load more.
  - `useMyDevices.ts` pages through `api.listMine`, 50 items per page by default, with a `nextCursor`.
- **`DeviceTable` is shared with the Manager/Admin Devices page.** `src/ui/devices/DevicesView.tsx` and `DevicesPage.tsx` use it, and the ticket puts that page out of scope. Restyling `DeviceTable` in place would change that page. It also renders a hidden `md:block` table plus an `md:hidden` card list, and the ticket wants one table that scrolls horizontally.
- **Row building blocks are reusable as they are.** `src/ui/devices/device-labels.tsx` already has the pieces the mockup needs:
  - `DeviceNameLink` links to the detail page.
  - `OwnerLabel` shows the "You" chip, expiry text or "No expiry", the Overdue chip and the pending chip.
  - `PlacementLabel` shows "At seat X" plus the Primary/Secondary chip, or "In inventory".
  - `Mac` and `Details` cover those two columns.
- **Row actions already match the rules.** `DeviceRowActions` and `rowActions` in `device-actions.ts` implement today's owner actions, and `portalHandlers` limits them to place, transfer, return, extend and cancel.
  - The mockup's "Return" is the place-mode `return` (back to my inventory), labeled `devicesCopy.actions.return`.
  - The mockup's "Give back to org" is the `giveBack` action.
  - Reusing `DeviceRowActions` keeps the "none while pending except cancel" rule, because `placeModes` and the `canTransfer`/`canReturn` server flags already handle it. I only read `rowActions`; confirm `placeModes` suppresses Move/Place while a handoff is pending.
- **The mockup matches the data.** The tiles, chips and "Showing N of M" are all derivable client-side from `DeviceDto`: `type`, `placement.role`, `overdue`, `holding.expiresOn`, `mine`.
- **Copy:** the `portalCopy.devices` block (portal.ts lines 29-37) has only a heading and state strings. Subtitle, tile labels, card title and subtitle, search placeholder, "All types", column headers and the footer all need new copy.
- **Existing test:** `MyDevicesView.test.tsx` uses `renderToStaticMarkup`, which renders only the initial `useState` values. Filter and search interaction therefore cannot be tested through the view.
- **SIM-066** (tab bar and card styles) is still PLANNING, so the shared card styles do not exist yet. `Card` today is `rounded-md3-lg border bg-surface-low`.

## Recommendations

1. **Add a new `src/ui/portal/MyDevicesTable.tsx`.** It should render one `<table>` inside `overflow-x-auto`, with columns Name, Type, Inventory no., MAC, Details, Owner, Placement, Actions. It reuses the `device-labels` components and `DeviceRowActions`. Do not touch `DeviceTable`. This meets the "table scrolls inside its card at 390 px" and "same data and actions" criteria. A `min-w` on the table (about 960 px) ensures the scroll appears.
2. **Put the logic in a pure module, e.g. `src/ui/portal/my-devices-state.ts`, and unit-test it directly.** It should hold:
   - `deviceTypeCounts(devices)`, giving the per-type tile counts (see open question on order)
   - `filterDevices(devices, query, type)`, which trims and lowercases the query and matches name, inventory number and MAC, plus an exact match on type
   - `typeOptions(devices)`
   - the "Showing N of M" values

   This covers the tiles, search/filter and counts criteria even though static markup cannot drive state. Keep query and type in `useState` in the view or in a small `MyDevicesList` component. Add render tests for the row variants: placed primary, placed secondary, in inventory, overdue, pending handoff (only the cancel button), no expiry, and the "You" chip.
3. **Tile layout:** a `grid-cols-1 sm:grid-cols-3` row, or `repeat(auto-fit, minmax(...))` since the number of types varies. The first tile is the total; the rest are one per type present. Icons are optional, with a generic icon for unknown types. Stack at 390 px.
4. **Counts must be honest when `nextCursor` is not null.**
   - The tiles and "Showing N of M" are computed over the loaded items only. Define M as the loaded count (see open question), keep the existing Load more button, and avoid a total that implies completeness.
   - Show the "Showing" footer text with the loaded count, and put Load more beside or under it.
   - Counts should refresh after actions, since `refresh` replaces the first page.
5. **Keep the existing behavior inside the new layout:**
   - Keep the `h2` ref and focus (`headingRef`), because `requestFocus` and the focus-after-action logic depend on it.
   - Keep `aria-live` for the notice.
   - Keep the banner and incoming slots, restyled with SIM-066 card tokens.
   - Keep the loading skeleton, error and empty states.
   - Add a "no matches" state when a filter yields zero rows, so the table does not render with an empty body.
6. **Empty-state precedence:** show the tiles and the table card only when `devices.length > 0`, as today.
7. **Accessibility:**
   - Give the table a `sr-only` caption and `th scope="col"`.
   - Give the search input a label (a visually hidden label or `aria-label`) and the select a label.
   - Announce the result count politely, e.g. with `role="status"`.
   - Keep `aria-label` on action buttons as in `rowActions`.
   - Use `text-primary` links with sufficient contrast in dark mode.
8. **Copy:** add everything to `portalCopy.devices` in `src/ui/copy/portal.ts` (D36). That means subtitle, `assignedDevices` tile label, per-type plurals, card title, a subtitle function such as `Equipment assigned to {name}.` and `searchPlaceholder`.
   - Dropping the "No expiry" part of the mockup's card subtitle is safe, because the per-row owner text already shows expiry.
   - Also needed: `allTypes`, `noMatches` and `showing(n, m)`. Reuse `devicesCopy.columns` where it exists.
9. **Merge order:** implement after SIM-066 merges, or consume its shared tokens or classes as they land. Introduce no duplicate card or table styles. If SIM-066 is not merged when this is implemented, restyle with existing tokens and flag it as a follow-up.
10. **Layers (R1):** everything stays in `src/ui/portal` and `src/ui/copy`, with no server imports. No API, schema or migration change.
11. **Checks:** run `pnpm typecheck`, `pnpm check:layers`, `pnpm format:check` and `pnpm test`. The existing `MyDevicesView.test.tsx` mostly asserts text and should keep passing. Update only markup-dependent assertions.

## Risks

- **Search and filter apply to the loaded page(s) only.** A device beyond the first 50 is not found until Load more is used. This is a limitation of the ticket's "client-side over the loaded list" scope. Accept it and state it, or auto-load all pages (more requests, not in scope).
- **Tiles with an unfiltered per-type count could mislead** when `hasMore` is true, for the same reason.
- **Changing `DeviceTable` would be a regression for the Manager/Admin Devices page.** The separate table component avoids that.
- **Rows with a long `Owner` or `note`** can widen the table. Keep the clamp styling from `OwnerLabel`.
- **The wide action column** (up to Move, Return, Transfer, Give back, Cancel, Extend) wraps via `flex-wrap`. Verify the visual at 1280 px in light and dark mode.
- **SIM-066 dependency:** if its card or tab styles change after this is planned, this plan can conflict.

## Open questions

1. **Per-type tile order and cap:** order by count desc, then alphabetically? How should many types (for example more than 5) be handled: wrap, or "+N more"? Proposal: count desc, wrap to a grid.
2. **M in "Showing N of M" when `hasMore` is true:** use the loaded count and show "Showing N of M loaded", or the total? There is no total from the API, and an API change is out of scope. Proposal: M is the loaded count, with Load more kept.
3. **Search match rules:** should it be case- and diacritic-insensitive? Test data uses Vietnamese names, so proposal is case-insensitive and diacritic-insensitive via `normalize("NFD")`. Does MAC match ignore `:` and `-` separators?
4. **Mockup's card subtitle "Equipment assigned to Ming. No expiry."** Use the member's display name from the session, and drop "No expiry"?
5. **Mobile (390 px):** the ticket says the table scrolls. Confirm this replaces today's stacked-card list, which the old `DeviceTable` shows below `md`. This is a real change in mobile behavior.

Relevant files:
- /home/user/simap/work/tickets/SIM-069/ticket.md
- /home/user/simap/src/ui/portal/MyDevicesView.tsx
- /home/user/simap/src/ui/portal/MyDevicesTab.tsx
- /home/user/simap/src/ui/portal/useMyDevices.ts
- /home/user/simap/src/ui/portal/MyDevicesView.test.tsx
- /home/user/simap/src/ui/devices/DeviceTable.tsx
- /home/user/simap/src/ui/devices/device-labels.tsx
- /home/user/simap/src/ui/devices/DeviceRowActions.tsx
- /home/user/simap/src/ui/devices/device-actions.ts
- /home/user/simap/src/ui/copy/portal.ts
