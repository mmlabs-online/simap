# SIM-064: Layout editor warning for unreachable chairs

| Field | Value |
|---|---|
| State | PLANNING |
| Priority | P2 |
| Size | S |
| Areas | ui, ux |
| Gate | none |
| Depends on | SIM-061 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-26 |
| Claimed by | claude@2026-11-27T07:49:33Z |
| PR | — |

## Goal
The Admin sees a warning in the layout editor when a chair cannot be reached from any door or a room with seats has
no door, so walk-ins work.

## Scope reference
`docs/spec-v1.md` PRE-07 (editor warning), LAY-05, LAY-01 (block rules).

## Scope
- Reuse the SIM-061 path module to find unreachable chairs and the no-door case in the editor draft; show a warning.

## Out of scope
- Changing block rules or save validation.

## Acceptance criteria
- [ ] The layout editor warns when a chair cannot be reached from any door.
- [ ] It warns when a room with seats has no door.
- [ ] The warning never blocks a save.
- [ ] Unit tests cover the reachability check on editor drafts (reachable, unreachable, no door).

## Technical notes
- Files: `src/lib/layout-editor/**`, the SIM-061 path module, `src/ui/roomlayout/EditorInspector.tsx` or toolbar,
  `src/ui/copy/`.

## Test plan
- Unit: reachability on drafts.
- Manual: wall off a chair in the editor, see the warning, save still works.

## Notes / answers from Ming

## Handoff
