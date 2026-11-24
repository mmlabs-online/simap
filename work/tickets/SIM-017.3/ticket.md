# SIM-017.3: Search page UI

| Field | Value |
|---|---|
| State | DONE |
| Priority | P2 |
| Size | M |
| Areas | ui |
| Gate | none |
| Depends on | SIM-017.2 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-24 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/73 |

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

### 2026-11-24 — claude — DONE
- Agent calls: 3, tokens ~221k total (planner×1 default 94k, implementer×1 default 74k, reviewer×1 default 53k); consult reused from SIM-017 (same design).
- Done: /search page with grouped results, per-group Load more, URL state and Search nav entry; 19 files +1435/−6; review PASS with no issues; PR #73 opened. With it, SIM-017 (.1–.3) is complete.
- In progress / next: Ming merges PR #73 and decides A2 (one first-page error vs per-group). Next runnable: SIM-018 (CSV export).
- Gotchas: none new.
