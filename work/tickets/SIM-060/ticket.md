# SIM-060: Present and away on the map, name tags, open desk tags, "Who's here" and polling

| Field | Value |
|---|---|
| State | BACKLOG |
| Priority | P1 |
| Size | M |
| Areas | ui, api |
| Gate | plan-approval |
| Depends on | SIM-057, SIM-058 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-26 |
| Claimed by | — |
| PR | — |

## Goal
Everyone in the org sees who is in the office today on the room map and in "Who's here", kept fresh by polling, and a
member with several seats in the room moves between them by clicking an open tag on the desk.

## Scope reference
`docs/spec-v1.md` PRE-06, LAY-06 (presence item); decisions D76 (polling amends D24 for this view), D77 (open tags),
D80 (name tags always shown, amends D50 for this view), D78.

## Scope
- Present/away rendering on the check-in room view; always-visible, non-overlapping name tags there only.
- "Who's here" list content and seat focus.
- Open desk tags wired to the SIM-058 move-seat call.
- Polling of the SIM-058 room presence endpoint every 30–60 s, paused while the tab is hidden.

## Out of scope
- Walk animations (SIM-061: until then changes show as the end state); other map views (keep D50).

## Acceptance criteria
- [ ] Every member of the org sees presence in every room: who is here, check-in time and source (self /
  third-party); no hidden presence.
- [ ] Checked in: the character sits at the chair with a typing idle and the monitor on; assigned but away: empty
  chair and a grey name tag; unassigned seats look as today. Present/away is never shown by colour alone.
- [ ] "Who's here" lists members checked in to the shown room (pixel character head, display name, seat code,
  check-in time, source); selecting an entry focuses their seat on the map.
- [ ] While checked in, each of the member's other seats in the same room shows an open tag on the desk; clicking or
  keyboard-activating it moves their presence there (PRE-03 move seat).
- [ ] The view polls every 30–60 s (no websockets) and pauses while the tab is hidden.
- [ ] In this view name tags are always visible and do not overlap on adjacent seats (offset, stack or truncate, full
  name on hover/focus); other map views keep hover/focus-only tags (D50).
- [ ] Unit tests cover the present/away overlay choice, name-tag layout for adjacent seats and the polling
  pause/resume rule.

## Technical notes
- Files: `src/lib/sprites/overlay.ts`, `src/ui/roomlayout/SeatOverlay.tsx` / `RoomMap.tsx`, `src/ui/checkin/**`,
  `src/ui/copy/`; API only if the SIM-058 read endpoint lacks a field the view needs.
- Gate `plan-approval` because of the `high-paths+P1` policy (P1).
- Risk: name-tag de-overlap and polling may push this to the top of M.

## Test plan
- Unit: overlay state per seat, tag layout, polling visibility rule.
- Manual: two browsers, one checks in/out/moves, the other sees it within 60 s; hidden tab stops requests.

## Notes / answers from Ming

## Handoff
