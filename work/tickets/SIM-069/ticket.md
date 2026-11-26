# SIM-069: Redesign My Portal → My devices layout (summary tiles and device table)

| Field | Value |
|---|---|
| State | IN_PROGRESS |
| Priority | P2 |
| Size | M |
| Areas | ui, ux |
| Gate | none |
| Depends on | SIM-066 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-26 |
| Claimed by | claude@2026-11-26T17:14:13Z |
| PR | — |

## Goal
The My devices tab of My Portal follows the look of Ming's mockup (`mockup-my-devices.png` in this folder): a page
header, summary tiles and one clean table of the member's devices, with the same device actions as today.

## Scope reference
`docs/spec-v1.md` POR-03 (My devices), DEV-03 to DEV-05 (place/move), DEV-08 (transfer), DEV-09 (return), DEV-10
(expiry, overdue, extension), DEV-12 ("my devices" endpoint); decisions D63, D69, D70, D72, D36, D52. Request: Ming
2026-11-26 with the mockup image. Same principle as SIM-068: take the visual idea; keep today's buttons and features.

## Scope
- **Page header:** "My devices" and the subtitle "Your everyday tools, right where you need them."
- **Summary tiles:** total devices the member holds, then one tile per device type present (e.g. Monitors, PCs),
  computed client-side from the already-loaded list.
- **"Your assigned devices" card** with a count chip, a subtitle, a text search (name, inventory no., MAC) and a type
  filter, both client-side over the loaded list.
- **Table** with columns Name (link to the device detail page, DEV-11), Type, Inventory no., MAC, Details, Owner
  ("You" chip, expiry or "No expiry", **Overdue** chip when overdue), Placement ("At seat <code>" with a
  Primary/Secondary chip, or "In my inventory"), Actions; a footer "Showing N of M" and horizontal scroll on narrow
  screens.
- **Actions: exactly today's owner actions and their rules** (POR-03): move/place at a seat or back to my inventory,
  transfer to a member, return to the org inventory, request an extension, cancel a pending handoff; each shown only
  when the rules allow it. The "Waiting for my confirmation" list (Confirm/Decline) and the overdue banner stay, in
  the new visual style.
- Copy in `src/ui/copy/portal.ts`; visual language matches SIM-066/SIM-067.

## Out of scope
- Any API, schema or rule change; new actions. The mockup's "Return" and "Give back to org" are not two new actions:
  the table shows today's actions with today's labels.
- The mockup's "Demo data · Saved on this browser" badge (data comes from the server).
- The Manager/Admin Devices page.

## Acceptance criteria
- [ ] Header, summary tiles (total + per type) and the device table render as in the mockup at desktop width; at
  390 px tiles stack and the table scrolls horizontally inside its card.
- [ ] Search and type filter narrow the table client-side; the count chip and "Showing N of M" stay correct.
- [ ] Every row shows the same data as today plus the "You"/expiry/Overdue and Primary/Secondary chips; the name
  links to the device detail page.
- [ ] Row actions are exactly today's actions, shown under today's rules (none while a handoff is pending except
  cancel); "Waiting for my confirmation" and the overdue banner still work.
- [ ] No API change; existing My devices tests pass or are updated only for markup; new render tests cover tiles,
  search/filter and the row variants.

## Technical notes
- Files: `src/ui/portal/MyDevicesTab.tsx`, `MyDevicesView.tsx`, `useMyDevices.ts`, `src/ui/copy/portal.ts`.
- Depends on SIM-066 for the shared tab bar and card styles (same folder, avoids conflicts).

## Test plan
- Unit: tile counts, search/filter, row variants (placed primary/secondary, in inventory, overdue, pending handoff).
- Manual: 1280 px and 390 px, light/dark.

## Notes / answers from Ming
- 2026-11-26: requested with the mockup image `mockup-my-devices.png`.

- Plan approved (2026-11-26, batch 2026-11-26-7): Ming "duyệt hết, theo mặc định hết" — all batch questions 1–12 take their defaults.
- Merge approved (2026-11-26, batch 2026-11-26-7): Ming "cho merge SIM-066, SIM-067, SIM-069".

## Handoff
