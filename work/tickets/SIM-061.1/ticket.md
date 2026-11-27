# SIM-061.1: Typing idle animation for present characters

| Field | Value |
|---|---|
| State | PLANNING |
| Priority | P1 |
| Size | S |
| Areas | ui |
| Gate | plan-approval |
| Depends on | SIM-061 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-27 |
| Claimed by | claude@2026-11-27T02:22:40Z |
| PR | — |

## Goal
Present characters at a desk with a monitor show a small "typing" idle on the check-in room map (PRE-06 / LAY-06),
split out of SIM-061 by its approved plan.

## Scope reference
`docs/spec-v1.md` PRE-06, LAY-06; SIM-060 carried item 1; SIM-061 plan (typing idle split); D52, D41/D46/D48.

## Scope
- A slow (about 2 frames per second) 1 px bob of the seated avatar for present characters with a monitor, drawn on
  SIM-061's walk overlay canvas; off under `prefers-reduced-motion`; no timer when nobody is present.
- No new art (SIM-062 may add real typing frames later).

## Out of scope
- New sprite frames; walk animation changes (SIM-061).

## Acceptance criteria
- [ ] Present characters with a monitor bob slowly; away/unassigned seats do not.
- [ ] Reduced motion: no idle animation.
- [ ] The timer runs only while at least one present character is on the map; all Checks pass.

## Technical notes
- Reuse SIM-061's `WalkLayer` / `paintWalkers` and `useReducedMotion`; keep pure timing in `src/lib/sprites/`.
- No "photo" in `src/ui/roomlayout/**` or `src/lib/sprites/**`.

## Test plan
- Unit: bob offset per tick, gating rules. Manual: check-in map in a browser.

## Notes / answers from Ming
- 2026-11-27: created from the approved SIM-061 plan (typing idle split).

## Handoff
