Status: READY

# Plan — SIM-012.5: Room switcher in the app shell

## Scope summary
Quoted from `ticket.md`:
- "A thin bar between the header and main content, with a native `<select>` of the org's rooms and a **Go** button."
- "A `roomSwitcher?: ReactNode` prop on `AppShellView`, rendered only when there is a session and a switcher. Remove the empty `room-switcher` slot from the header."
- "A pure `roomCodeFromPath` for `/rooms/<code>` and `/rooms/<code>/edit`, with no `decodeURIComponent`."
- "Refetch rooms when the path changes, compared with a `lastPath` ref. Keep the last good list after a failed refetch."
- Out of scope: any server/API/schema change and any change to `useRooms`; seat actions; floor map or pixel skin.

Settled defaults from `work/tickets/SIM-012.3/plan.md` `### Settled for SIM-012.5` (applied, not reopened):
- Bar is `flex-none`, between `</header>` and `<main>` (`AppShellView.tsx:155-157`); remove the slot at l.124-125; render only when `session && roomSwitcher`.
- Go does not use `disabled`; it does nothing when the target is empty, current, or a dot code (`roomDetailHref` returns null, `src/lib/nav.ts:59`).
- `roomCodeFromPath` has no `decodeURIComponent` (`validate/room.ts:13`).
- Refetch compares `pathname` with a `lastPath` ref initialised to the first path (no "skip first run" ref, because of StrictMode).
- `useRooms` clears rooms on failure (l.29), so the switcher keeps its own last good list.
- Native select, visually hidden label, no navigation on `change`, `<button type="button">` outside any form.

Also: D36 (copy in `src/ui/copy/`), D47 (no pixel skin).

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Lists the org's rooms on every signed-in page and preselects the current room on a room page | Unit: `RoomSwitcherView` static markup has one `<option>` per room and `selected` on the current code. Manual: open `/`, `/rooms`, `/rooms/<code>`, `/rooms/<code>/edit` in `pnpm dev`. |
| 2 | Opens a room only on Go; changing the select (incl. arrow keys on the closed select) does not navigate | Code review: the select has no `onChange` that navigates (it only sets local state); only the Go `onClick` calls `router.push`. Manual: arrow keys on the closed select. |
| 3 | Go stays focusable and does nothing for empty, current or dot target | Unit: `goTarget` cases. Unit: the Go markup has no `disabled` attribute. Manual: Tab to Go, press with the current room selected. |
| 4 | A new room appears after navigation; a failed refetch keeps the last good list | Manual: create a room, then navigate to it or to `/rooms`, and check the list. Manual: block `/api/rooms` in devtools, navigate, list unchanged. (Effects are not run by static markup.) Unit: `keepLastGood` helper if extracted (see Tests). |
| 5 | Accessible label; fits at 390 px without crowding the header | Unit: markup has `<label>` linked to the select by `htmlFor`/`id` with the copy text and `sr-only`. Manual: 390 px viewport, bar has `min-w-0` on the select and no horizontal scroll. |
| 6 | Unit tests cover `roomCodeFromPath`, the Go decision and the shell with/without a switcher | `pnpm test` (files below). |

## Ming verification after merge
None (all checks run locally in `pnpm dev`; no hosted service involved).

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/room-switcher.ts` | New. Pure: `roomCodeFromPath(pathname): string \| null`, `goTarget(selected, current): string \| null` (uses `roomDetailHref` from `./nav`), `keepGoodRooms(prev, status, rooms)` | Pure logic first (rule 6); lib layer, R1 | no |
| `src/lib/room-switcher.test.ts` | New. Unit tests | AC6 | no |
| `src/ui/RoomSwitcher.tsx` | New, `"use client"`. Stateful `RoomSwitcher` (uses `useApiFetch`, `useMemo(createRoomsApi)`, `useRooms`, `useRouter`, the `lastPath` ref refetch, last-good list, selected state) and presentational `RoomSwitcherView` (label, select, Go) exported for tests | AC1-5 | no |
| `src/ui/RoomSwitcher.test.tsx` | New. Static-markup tests of `RoomSwitcherView` | AC1, AC3, AC5 | no |
| `src/ui/AppShell.tsx` | Pass `roomSwitcher={session ? <RoomSwitcher pathname={pathname} /> : undefined}` | Wires the switcher; shell is under `ApiFetchProvider` in both gates | no |
| `src/ui/AppShellView.tsx` | Add `roomSwitcher?: ReactNode` prop; delete l.124-125 slot; render `{session && roomSwitcher && <div className="flex-none ...">…</div>}` between `</header>` and `<main>` | Scope | no |
| `src/ui/AppShellView.test.tsx` | Add tests: no switcher by default (and no bar), bar rendered with a switcher, not rendered when signed out; assert `data-slot="room-switcher"` gone | AC6 | no |
| `src/ui/copy/shell.ts` | Add `roomSwitcher: { label: "Room", placeholder: "Select a room", go: "Go" }` | D36 | no |

No change to `useRooms.ts`, `rooms-api.ts`, `/dev/shell` (it renders `AppShellView` with no switcher; confirm it still compiles via `pnpm typecheck`).

## Data model / migration
None.

## API contract
None. Reuses the existing `createRoomsApi(apiFetch).list()` (read `src/ui/rooms/rooms-api.ts:19`).

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/room-switcher.test.ts › roomCodeFromPath` | `/rooms/C302` → `C302`; `/rooms/C302/edit` → `C302`; `/rooms` → null; `/` → null; `/rooms/` → null; `/rooms/C302/x` → null; `/rooms/A%201` returns `A%201` undecoded; `/rooms/%` returns `%` without throwing; Vietnamese/diacritic-encoded code returned as is |
| `src/lib/room-switcher.test.ts › goTarget` | empty selected → null; selected equals current → null; `.` and `..` → null; `C302` with current null → `/rooms/C302`; `A 1` → `/rooms/A%201`; selected differs from current → href |
| `src/lib/room-switcher.test.ts › keepGoodRooms` | ready → new list; error/loading → previous list kept; empty ready list replaces (a deleted-all org shows none) |
| `src/ui/RoomSwitcher.test.tsx › view` | one option per room plus the placeholder; current `selected`; `<label>` tied to select, `sr-only`; Go is `type="button"`, has no `disabled`; room names with diacritics rendered escaped |
| `src/ui/AppShellView.test.tsx › roomSwitcher` | absent without prop; present between header and main (index order in markup) with prop; absent when signed out even with prop; empty slot gone |

## Approach
1. `src/lib/room-switcher.ts`: `roomCodeFromPath` with a regex `^/rooms/([^/]+)(?:/edit)?$` (no decode); `goTarget(selected, current)` returns null when `!selected || selected === current`, else `roomDetailHref(selected)`. Compare `selected` to `current` as raw codes, matching how the select values are the room codes (not encoded). `keepGoodRooms` is a tiny helper so the keep-last-good rule is unit tested.
2. `RoomSwitcher` (stateful): `api = useMemo(() => createRoomsApi(apiFetch), [apiFetch])`; `const { status, rooms, reload } = useRooms(api)`; `lastPath = useRef(pathname)` and an effect on `[pathname, reload]`: if `lastPath.current !== pathname`, set it and `void reload()`. Keep the last good list in state updated from `keepGoodRooms` in an effect on `[status, rooms]`. `current = roomCodeFromPath(pathname)`; `selected` state initialised to `current ?? ""` and reset when `current` changes (effect or `key`). `onGo` computes `goTarget(selected, current)` and calls `router.push(href)` when non-null.
3. `RoomSwitcherView`: `<label htmlFor id className="sr-only">`, native `<select>` (`min-w-0 flex-1`, max width on desktop, no navigation handler), `<button type="button">` Go using existing `Button` from `./Button` if it supports `type="button"` (check its props first; otherwise a plain button with the same classes). Bar classes: `flex-none flex items-center gap-2 px-4 lg:px-5 py-2 bg-surface border-b border-outline-variant`.
4. `AppShellView`: prop, remove the empty slot, render the bar wrapper only when `session && roomSwitcher`.
5. `AppShell`: pass the switcher only when a session exists.
6. Copy added to `shell.ts` (D36).
7. Rules: R1 (ui imports lib via `@/`, no server code); R3/R6/R7 not touched (read-only existing API, no new routes); R4 stay inside the file list.
8. Run `pnpm format`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`.

## Specialist input used
None (fast lane, no consult files).

## Assumptions
- The switcher fetches the room list itself with a separate `useRooms` instance, so the Rooms page and the shell do not share state. A room created on `/rooms` shows in the switcher after the next path change, as the ticket states ("appears after navigation").
- The bar renders even while the list is loading or after a first-load failure, with only the placeholder option, to avoid layout shift.
- Go does nothing visible (no message) when the target is empty or current.
- The room option label is the room's name plus code if `RoomDto` has both; implementer reads `src/lib/rooms/types.ts` and matches how `RoomCard.tsx` shows them. Option `value` is the room `code`.
- Hotspots: `AppShellView.tsx` and `AppShell.tsx` are edited by no other `IN_PROGRESS`, `REVIEW` or `DONE` ticket per the ticket's board context; SIM-012.4 (BACKLOG) touches `src/ui/seats` only.
- Estimate about 140 production and 75 test lines, within one cycle.

## Blocking questions
None.

## Split proposal
None.
