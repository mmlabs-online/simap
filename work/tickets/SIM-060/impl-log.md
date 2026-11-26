## Attempt 1 — 2026-11-26

Built on main after SIM-059 merged. No commit made (the orchestrator commits).

### Commit split
Commit A (map presence and tags, opt-in props, nothing wired yet) builds green on its own; commit B wires it.

**Commit A**
- `src/lib/presence/seat-presence.ts`, `src/lib/presence/seat-presence.test.ts`
- `src/lib/sprites/tag-layout.ts`, `src/lib/sprites/tag-layout.test.ts`
- `src/lib/sprites/placement.ts`, `src/lib/sprites/placement.test.ts`
- `src/ui/roomlayout/paint.ts`, `src/ui/roomlayout/paint.test.ts`
- `src/ui/roomlayout/SeatOverlay.tsx`, `src/ui/roomlayout/SeatOverlay.test.tsx`
- `src/ui/roomlayout/RoomMap.tsx`, `src/ui/roomlayout/RoomMapSection.tsx`
- `src/ui/copy/roomlayout.ts`

(`SeatOverlay`, `RoomMap` and `RoomMapSection` also carry the open-tag and `focusSeat` props; they are unused until B, which is fine since every prop is optional.)

**Commit B (Who's here, polling, move)**
- `src/lib/presence/open-tags.ts`, `open-tags.test.ts`, `poll.ts`, `poll.test.ts`, `whos-here.ts`, `whos-here.test.ts`, `move.ts`, `move.test.ts`
- `src/ui/copy/presence.ts`
- `src/ui/checkin/PixelHead.tsx`, `WhosHere.tsx`, `WhosHere.test.tsx`, `usePresencePoll.ts`, `usePresenceMove.ts`
- `src/ui/checkin/CheckinView.tsx`, `CheckinView.test.tsx`
- `src/ui/checkin/CheckinPage.tsx`
- `src/ui/checkin/useRoomPresence.ts`, `src/ui/checkin/useMyPresence.ts`
- `work/tickets/SIM-060/impl-log.md`

### Files touched
| File | Required because |
|---|---|
| `src/lib/presence/seat-presence.ts` | present/away choice (AC 2) |
| `src/lib/presence/open-tags.ts` | `myMemberId`, `openTagSeats` (AC 4); split out of seat-presence.ts so commit A is self-contained |
| `src/lib/presence/poll.ts` | polling rule, injected timers (AC 5) |
| `src/lib/presence/whos-here.ts` | list rows, UTC+7 time (AC 1, 3) |
| `src/lib/presence/move.ts` | move outcome, no retry (AC 4) |
| `src/lib/sprites/tag-layout.ts` | non-overlapping tags (AC 6) |
| `src/lib/sprites/placement.ts` | `screen` op, `presence` option, away skips avatar (AC 2) |
| `src/ui/roomlayout/paint.ts` | paints `screen` ops |
| `src/ui/roomlayout/SeatOverlay.tsx` | `tags="always"`, presence tags, open tags; default markup unchanged (D50) |
| `src/ui/roomlayout/RoomMap.tsx` | `presenceView` prop, focus effect |
| `src/ui/roomlayout/RoomMapSection.tsx` | forwards `presenceView`, renders `notice` |
| `src/ui/copy/roomlayout.ts` | map copy block `presence` (D36) |
| `src/ui/copy/presence.ts` | list and move-error copy (D36) |
| `src/ui/checkin/PixelHead.tsx`, `WhosHere.tsx` | pixel head and list view (AC 3) |
| `src/ui/checkin/usePresencePoll.ts`, `usePresenceMove.ts` | thin hooks over `createPoller` and `presenceApi.move` |
| `src/ui/checkin/CheckinView.tsx` | `whosHere` slot replaces the placeholder |
| `src/ui/checkin/CheckinPage.tsx` | wiring |
| `src/ui/checkin/useRoomPresence.ts`, `useMyPresence.ts` | `refresh()` resolves to a success flag (see Differences) |

### Tests added / changed
- `seat-presence.test.ts` (3), `open-tags.test.ts` (3), `poll.test.ts` (9), `whos-here.test.ts` (5), `move.test.ts` (4), `tag-layout.test.ts` (7)
- `placement.test.ts` › presence view (4); `paint.test.ts` › screen op
- `SeatOverlay.test.tsx` › presence view (6, incl. default mode keeps D50 markup)
- `WhosHere.test.tsx` (4); `CheckinView.test.tsx` › whosHere slot

### Checks (actual output summary)
- format:check: All matched files use the correct format (1013 files).
- typecheck: next typegen + tsc, no errors.
- check:layers: `check-layers: 958 files, no violations`.
- test: `Test Files 364 passed | 1 skipped (365)`, `Tests 3549 passed | 9 skipped (3558)` (includes `no-photo-on-map.test.ts`).
- build: `Compiled successfully`, 25 static pages generated.
- test:db (local Postgres): `Test Files 23 passed (23)`, `Tests 365 passed (365)`.

### Differences from the plan (follow what merged)
- SIM-059 `refresh()` of `useMyPresence` and `useRoomPresence` returned nothing; both now resolve to `true` when the read worked and still keep the data on failure (plan's allowed change, Assumption 1).
- `useRoomPresence` stays "loading" for a null room id: `CheckinPage` shows "loading" while rooms resolve and the list error (retry reloads rooms) when the room did not resolve. A `ready` answer for another room id shows as loading.
- `openTagSeats`/`myMemberId` live in `src/lib/presence/open-tags.ts` (plan: `seat-presence.ts`), so commit A does not need B code.
- `openTagRect(seat, area, text)` takes the label text (lib cannot import the ui copy); `tagWidth` returns `{width, truncated}`.
- `layoutTags` tries up to two rows further out (plan: one) so a dense row of long names needs no dot.
- `moveOutcome` has no `refresh` flag; the page refreshes from an effect on the member's active seat id (covers check-in, check-out and move).
- The members key in `CheckinPage` keeps the draw list stable when a poll returns the same answer.

### Out-of-plan files
None (besides the `open-tags` split above).

### Follow-ups (noticed, not done)
- Typing idle is a static seated pose (plan Assumption 3); the animation and dedicated monitor-on art belong to SIM-061 / art follow-up.
- Visual check for Ming: head crop in `PixelHead`, screen glow position, tag look at zoom 1-4 and 390 px.
- Poll cost: two GETs per visible tab every 45 s; ETag/304 later if needed.

### Scope self-check
- Could the diff be smaller? No; the files are the plan's, tests mirror the plan's list.
- Diff size: about +1500 lines including tests (split across commits A and B).
