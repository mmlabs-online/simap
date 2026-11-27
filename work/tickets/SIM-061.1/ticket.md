# SIM-061.1: Typing idle animation for present characters

| Field | Value |
|---|---|
| State | IN_PROGRESS |
| Priority | P1 |
| Size | S |
| Areas | ui |
| Gate | plan-approval |
| Depends on | SIM-061 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-27 |
| Claimed by | claude@2026-11-27T03:34:53Z |
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
- Waiting for Ming: plan approval (P1, gate `plan-approval`; M-93).
- 2026-11-27: Plan approved (Ming: "duyệt plan SIM-061.1"; M-93).

## Handoff

### 2026-11-27 — claude — BLOCKED
- Agent calls: 2, tokens ~100k total (frontend-developer×1 default model 39k; planner×1 default model 61k).
- Done: consult (`consult-frontend-developer.md`); `plan.md` Status READY, no blocking questions, no High path, ~120 prod + ~130 test lines.
- In progress / next: waiting for Ming's plan approval (M-93); then `/run SIM-061.1` resumes at IMPLEMENT.
- Gotchas: plan adds AC "pause while the tab is hidden" (from SIM-061 plan) and "`onDone` only for walk completion"; `buildDrawList` gets a boolean `art.idle` option instead of the consult's passed-in seat set. M-91/M-92 numbers also exist on the SIM-043 cloud branch (renumber on merge).
