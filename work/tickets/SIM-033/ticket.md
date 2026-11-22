# SIM-033: Ship the real room art and an in-app Credits page

| Field | Value |
|---|---|
| State | BACKLOG |
| Priority | P1 |
| Size | S |
| Areas | ui, architecture |
| Gate | none |
| Depends on | SIM-015.3 |
| Needs Ming | M-10 |
| Attempts | 0 |
| Created | 2026-11-22 |
| Claimed by | — |
| PR | — |

## Goal
Production shows the licence-checked room art instead of placeholders, and credits its authors as the licence requires.

## Scope reference
- D45 (in-app Credits page), D54, D55, D58; M-9, M-10; `assets/art/CREDITS.md`.

## Scope
- Deliver the real atlas to the production build in the way Ming chooses in M-10.
- An in-app Credits page listing each pack's author, source and licence from `assets/art/CREDITS.md`.

## Out of scope
- Recolouring or drawing new sprites (phase 2, D54).
- Changing the repository's visibility, which is Ming's step (M-10).

## Acceptance criteria
- [ ] A production image shows the real art for every key that has a source, and placeholders for the rest.
- [ ] The way the art reaches the build follows the M-10 decision and the pack's licence.
- [ ] The Credits page shows the exact attribution text for every third-party pack in use.
- [ ] CI still passes on a machine without the original sheets, unless M-10 makes them available.

## Technical notes
- The planner re-reads M-10 first, because the delivery depends on its answer.
- Files: to be set by the plan.

## Test plan
- Unit: Credits data rendering.
- Manual: build the image and open a room map and the Credits page.

## Notes / answers from Ming
- 2026-11-22 (D58): created from the art review. Waits for M-10.

## Handoff
