
# Impl log — SIM-069 attempt 1

## Files touched
- `src/ui/portal/my-devices-filter.ts` (+test): pure typeSummary, filterDevices, effectiveType, tileValue (formatter passed in, copy-free), typeIcon. Required by tiles, search, filter.
- `src/ui/portal/MyDevicesTiles.tsx` (+test), `src/ui/portal/MyDevicesTable.tsx` (+test): new tile grid and card table.
- `src/ui/portal/MyDevicesView.tsx` (+test): PageHeader, tiles, table; query/type state; Load more and its error moved into the card footer.
- `src/ui/PageHeader.tsx`: additive `headingRef` (tabIndex -1 and outline-none only when given).
- `src/ui/SectionCard.tsx`: additive `flush`; header row already lacked flex-wrap, added.
- `src/ui/layout-blocks.test.tsx`: two cases (headingRef, flush).
- `src/ui/devices/device-labels.tsx`: `PlacementLabel.inventoryLabel` (default unchanged).
- `src/ui/copy/portal.ts`: `// SIM-069` block in `portalCopy.devices`.

## Adaptations to merged SIM-066/067
- `Pill` lives in `src/ui/Chip.tsx` (not its own file); used as is, tone neutral. PageHeader `titleAdornment` exists but is unused (the count chip is on the SectionCard, which has its own `titleAdornment`).
- FilledInput has a fixed `h-12`; the table search overrides it with `h-10!` (Tailwind v4 important suffix).
- In status "error" with rows, Load more and its footer error stay hidden and tiles/chip show no "+" (same as the old view: they only showed at status "ready").

## Tests added
filter (pure), tiles, table (header, rows, actions vs rowActions, filter, footer), view (header/order, no tiles in empty/loading/error), layout-blocks (2).

## Checks
- format:check: exit 0. typecheck: exit 0. check:layers: 983 files, no violations.
- test: 374 files passed, 1 skipped; 3621 passed, 7 skipped. build: exit 0.

## Out-of-plan files
None.

## Follow-ups
None.

## Scope self-check
No API, server, lib/devices, db or useMyDevices changes; MyDevicesTab, DeviceTable, DeviceRowActions, device-actions, OverdueBanner, IncomingTransfers unchanged. No regression-test-first needed (not a bug ticket).
