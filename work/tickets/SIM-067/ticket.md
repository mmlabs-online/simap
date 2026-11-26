# SIM-067: Redesign My Portal → My seat layout (seat cards and My requests list)

| Field | Value |
|---|---|
| State | REVIEW |
| Priority | P2 |
| Size | M |
| Areas | ui, ux |
| Gate | none |
| Depends on | SIM-066 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-26 |
| Claimed by | claude@2026-11-26T17:02:49Z |
| PR | — |

## Goal
The My seat tab of My Portal follows Ming's mockup (`mockup-my-seat.png` in this folder): the member's assigned seats
as cards and their seat requests as one filterable list, so a member sees their seats and request history at a glance.

## Scope reference
`docs/spec-v1.md` POR-02 (My seat), REG-02 (request status), REG-03 (release seat), SEA-05 ("View on map" URL);
decisions D24, D74 (requests live in My seat; opening the tab marks decisions seen), D70, D36, D52. Request: Ming
2026-11-26 with the mockup image.

## Scope
- **"Your assigned seats" section** with a count chip and one card per occupied seat (two columns on desktop, one
  at 390 px). Each card: seat icon tile, seat code, room (with icon), an "Assigned" status chip, a Group / Project
  panel ("None" when empty), and a footer with "View on map →" (opens `/rooms/<code>?seat=<code>`, SEA-05) and
  "Release seat" (existing REG-03 flow with its confirmation).
- **"My requests" card** with a count chip, subtitle "Keep track of your seat requests, all in one place." and a
  segmented filter (All / Pending / Approved / Cancelled, plus the other existing statuses: see open questions).
  Each row: status icon, "Seat <code> in room <room>", a status chip, "Requested <date time>", the decision line
  for decided requests ("Approved by <name> on <date time>", likewise for rejected), and "Cancel request" on pending
  rows (existing D24 cancel flow).
- Dates and times in UTC+7 (D35), copy in `src/ui/copy/portal.ts`; visual language matches SIM-066 (tabs, cards).
- Keep the current behaviour: opening My seat marks request decisions seen (D74); the empty state with no seat and
  no request still links to Rooms (POR-02).

## Out of scope
- Any API or schema change (requests already carry `decidedBy` and timestamps; seats carry group/project tags);
  the Approvals page; the My devices and Profile tabs (SIM-066).

## Acceptance criteria
- [ ] Assigned seats show as cards with seat code, room, "Assigned" chip, Group and Project (or "None"), "View on
  map" to the SEA-05 URL and "Release seat" with confirmation; the section header shows the count.
- [ ] My requests shows every request of the caller with status chip, requested time and, when decided, who decided
  and when; pending rows offer "Cancel request".
- [ ] The status filter narrows the list client-side; "All" is the default; the count chip shows the total.
- [ ] Two-column seat cards on desktop, one column at 390 px; filter and buttons are keyboard-operable.
- [ ] Opening the tab still marks decisions seen; the no-seat/no-request empty state still links to Rooms.
- [ ] Render/unit tests cover the cards, the filter and the row variants (pending, approved, rejected, cancelled).

## Technical notes
- Files: `src/ui/portal/MySeatTab.tsx`, `MySeatView.tsx`, `src/ui/copy/portal.ts`; reuse the request and seat
  types already loaded by the tab.
- Open questions (planner proposes a default, Ming confirms):
  1. The mockup filter lists All / Pending / Approved / Cancelled; requests can also be **Rejected**. Add a
     "Rejected" filter (default proposal) or fold it into another one?
  2. Long lists: show all, or paginate/collapse after N rows?

## Test plan
- Unit: row variants, filter state, empty states.
- Manual: 1280 px and 390 px, light and dark theme.

## Notes / answers from Ming
- 2026-11-26: requested with the mockup image `mockup-my-seat.png`.

- Plan approved (2026-11-26, batch 2026-11-26-7): Ming "duyệt hết, theo mặc định hết" — all batch questions 1–12 take their defaults.
- Merge approved (2026-11-26, batch 2026-11-26-7): Ming "cho merge SIM-066, SIM-067, SIM-069".

## Handoff
