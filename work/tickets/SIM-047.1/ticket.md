# SIM-047.1: Pixel character picker in the Profile tab

| Field | Value |
|---|---|
| State | IN_PROGRESS |
| Priority | P3 |
| Size | M |
| Areas | ui |
| Gate | none |
| Depends on | SIM-047, SIM-045.1 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-26 |
| Claimed by | claude@2026-11-26T11:02Z |
| PR | — |

## Goal
A member picks their pixel character in the My Portal Profile tab with a live preview, saves it, or resets to the derived look (SIM-047 slice B, AC3).

## Scope reference
- Split off from the parent plan (batch 2026-11-26-1, Ming 2026-11-26: "duyệt hết theo mặc định"). See the parent's
  plan.md "Split proposal" for the exact files; the parent ticket's acceptance criteria and spec references apply.

## Scope
- Profile tab "Pixel character" section: four preset pickers (swatches for skin / hair colour / shirt, three hair styles).
- Live preview front and back at 1× and 2× (reuse `useAtlas` and `tintedFrame` from `src/ui/roomlayout/`).
- Save (PUT `/api/me/pixel-look`), Reset (DELETE; preview returns to `derivedChoice(me.id)`), 422 and error notices, copy in `copy/portal.ts`.
- Lands after SIM-046.1 if that is still open (shared Profile tab and copy files).

## Out of scope
- Anything the parent slice already ships; server, schema and API changes (none needed).

## Acceptance criteria
- [ ] The picker offers only the presets; the preview updates live front and back at 1× and 2×.
- [ ] Save stores the look; the room map shows it on the next layout load.
- [ ] Reset returns to the derived look (seeded from `members.id`) and the preview matches the map.
- [ ] All Checks pass.

## Notes / answers from Ming
- Plan approved (2026-11-26, batch 2026-11-26-3): "duyệt hết theo mặc định"; Q1 default: build after SIM-046.1 is merged (rebase first).

## Handoff

### 2026-11-26 — claude — PLANNING (waiting)
- Agent calls: 2, ~131k tokens (frontend-developer×1 default 39k, planner×1 default 93k; batch 2026-11-26-3).
- Done: consult and plan (READY, approved 2026-11-26).
- In progress / next: waits for Ming to merge PR #131 (SIM-046.1); then rebase this branch onto main and implement (`/run-batch --resume`).
- Gotchas: picker mounts in SIM-046.1's `sections` slot; Reset seed is `members.id` via `readMeResult` (`src/lib/identity/flow.ts`, not a High path).
