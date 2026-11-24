# SIM-017.3: Search page UI

| Field | Value |
|---|---|
| State | IN_PROGRESS |
| Priority | P2 |
| Size | M |
| Areas | ui |
| Gate | none |
| Depends on | SIM-017.2 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-24 |
| Claimed by | claude@2026-11-24T12:37:14Z |
| PR | — |

## Goal
A search page that shows seats, devices and members for a query.

## Scope reference
spec DSH-02; D36. Split out of SIM-017 by its plan (`work/tickets/SIM-017/plan.md` → Split proposal, item 3).

## Scope
- `/search?q=` page with grouped results (Seats, Devices, Members), per-group Load more, 300 ms debounce and a stale-drop reducer (model: `src/ui/seats/member-picker.ts`).
- A "Search" nav entry (icon `search`). No live dropdown in the shell header.

## Out of scope
- Any server or API change.

## Acceptance criteria
- [ ] Typing a query shows grouped results that link to the seat's room, the Devices page and the Members page.
- [ ] Each group pages with Load more; empty and error states per group.
- [ ] Static-render and pure-logic tests (no jsdom) cover the reducer and the view.

## Test plan
- Unit: search-state reducer; static render of the view.
- Manual: search Vietnamese names with and without diacritics.

## Notes / answers from Ming
—

## Handoff
