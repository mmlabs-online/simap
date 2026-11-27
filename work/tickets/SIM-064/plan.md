Status: READY

# Plan — SIM-064: Layout editor warning for unreachable chairs

## Scope summary
`docs/spec-v1.md` PRE-07 (line 789): "The layout editor (LAY-05) may warn the Admin when a chair cannot be reached
from any door, or a room with seats has no door (warning only, never blocks a save)."
PRE-07 line 786: "A room with no door, or a chair with no path from a door, falls back to a short fade-in (fade-out) at
the chair." LAY-01 block rules (line 448) decide which tiles block; the SIM-061 module already applies them.
Ticket Out of scope: "Changing block rules or save validation."

No entry in `work/decisions.md` was needed.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | The layout editor warns when a chair cannot be reached from any door. | Unit: `reachability.test.ts › lists a seat walled off from the door`; component: `EditorWarnings.test.tsx › shows the unreachable seats`; manual: wall off a chair, warning appears. |
| 2 | It warns when a room with seats has no door. | Unit: `reachability.test.ts › flags noDoor when seats exist and no door`; component test for the no-door text. |
| 3 | The warning never blocks a save. | Unit: `reachability.test.ts › a warned draft still passes savePayload / flags.canSave` (draft with warnings gives `canSave` true, `savePayload` ok); code review: warnings are not read by `editorFlags`, `savePayload` or `save()`. Manual: save works with the warning shown. |
| 4 | Unit tests cover reachability on editor drafts (reachable, unreachable, no door). | `pnpm test` runs `src/lib/layout-editor/reachability.test.ts`. |

## Ming verification after merge
None.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/layout-editor/reachability.ts` | Create: pure `draftWarnings(draft, lookup)` returning `{ noDoor: boolean; unreachable: { key: string; code: string \| null }[] }`. Uses `draftToRoomLayout` (draft.ts:53), `walkGrid` and `pathFromDoor` (`src/lib/sprites/walk-path.ts:39,123`). | Reuse of the SIM-061 path module on a draft (Scope). | No |
| `src/lib/layout-editor/reachability.test.ts` | Create: unit tests (see below). | AC 4. | No |
| `src/ui/roomlayout/EditorWarnings.tsx` | Create: small presentational component rendering the warning list (non-blocking, `role="status"`, nothing when no warnings). | AC 1, 2. | No |
| `src/ui/roomlayout/EditorWarnings.test.tsx` | Create: `renderToStaticMarkup` tests, like `LayoutEditorViews.test.tsx`. | AC 1, 2. | No |
| `src/ui/roomlayout/LayoutEditor.tsx` | Modify: `useMemo` `draftWarnings(draft, state.footprints)` near line 86; render `<EditorWarnings>` after `<EditorStatusLine>` (line 188). Do not touch `save`/`canSave`. | Show the warning. | No |
| `src/ui/copy/roomlayout.ts` | Modify: add `editor.warnings` copy (heading, `noDoor`, `unreachable(codes)` ) near line 135-159 (D36). | UI copy rule. | No |

No High path is touched (no migrations, auth/config, build/deploy files).

## Data model / migration
None.

## API contract
None.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `reachability.test.ts › reachable chair gives no warnings` | A door, open floor, desk with chair: `noDoor` false, `unreachable` empty. |
| `reachability.test.ts › chair walled off is unreachable` | Wall items around the chair tile: seat listed. |
| `reachability.test.ts › seats but no door sets noDoor` | No door fixture, seats exist: `noDoor` true; per-seat list stays empty (one room-level warning). |
| `reachability.test.ts › no seats and no door gives no warning` | Empty or fixture-only room. |
| `reachability.test.ts › door fully blocked in counts as no door/unreachable` | Door whose neighbours are all blocked: still warns (via `no_door` reason). |
| `reachability.test.ts › unplaced new desk uses key and null/empty code` | Draft seat with `seatId null`: reported by its `key`. |
| `reachability.test.ts › chair outside the room is unreachable` | `no_chair` reason is reported as unreachable. |
| `reachability.test.ts › warned draft still saves` | `savePayload`/`editorFlags` unaffected (AC 3). |
| `EditorWarnings.test.tsx › renders nothing without warnings` | Empty state. |
| `EditorWarnings.test.tsx › shows no-door and unreachable seat codes` | Copy output. |

## Approach
1. Pure module first: convert the draft with `draftToRoomLayout`, build `walkGrid(layout, lookup)`, then for each seat
   call `pathFromDoor`. Map reasons: `no_door` (entries empty) with at least one seat -> `noDoor: true` only;
   `unreachable` and `no_chair` -> add to `unreachable`. Return seat `key` plus `code` (null/"" for new desks).
   Look up `lookup` from `state.footprints` (same as the validator). No change to block rules (R4, Out of scope).
2. Add copy in `src/ui/copy/roomlayout.ts`; render with `EditorWarnings`.
3. Wire in `LayoutEditor.tsx` with `useMemo` on `draft` and `state.footprints`; keep it read-only (no dispatch, no
   effect on `flags`). Layers (R1): `src/lib/layout-editor` imports lib only; UI imports lib via `@/`.
4. Run checks: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`.

## Specialist input used
None (fast lane).

## Assumptions
- A door whose neighbouring tiles are all blocked produces empty `entries`; it is reported as "no door" for the room
  (the same state the walk-in treats as a fade-in). Copy says "no usable door" to cover both.
- A chair tile outside the room counts as unreachable.
- The warning is shown always (also on read-only and while saving); it is informational only.
- Hotspot: `src/ui/roomlayout/LayoutEditor.tsx` and `src/ui/copy/roomlayout.ts` may also be edited by SIM-071
  (IN_PROGRESS, whole-app restyle); expect a rebase. No other open ticket is known to edit the new files.

## Blocking questions
None.

## Split proposal
None. Estimated ~200 changed lines including tests.
