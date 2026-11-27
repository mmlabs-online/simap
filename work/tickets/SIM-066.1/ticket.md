# SIM-066.1: Pixel character card polish (stage, Front/Back toggle, hairstyle cards)

| Field | Value |
|---|---|
| State | DONE |
| Priority | P2 |
| Size | S |
| Areas | ui, ux |
| Gate | none |
| Depends on | SIM-066 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-26 |
| Claimed by | claude@2026-11-27T08:08:20Z |
| PR | — |

## Goal
Finish the pixel character card of Ming's Profile mockup (`../SIM-066/mockup-profile.png`): the part split out of
SIM-066 (batch 2026-11-26-7, question 1).

## Scope reference
`docs/spec-v1.md` POR-06; SIM-066 plan (slice 2); batch 2026-11-26-7 questions 1 and 6 (defaults approved by Ming).

## Scope
- Dotted "A little you" stage with one large figure and a Front/Back toggle; small 1× and 2× previews in the corner
  (keeps POR-06's "front and back at 1× and 2×", question 6 default).
- Hairstyle option cards with a small preview of each style (names stay "Style 1/2/3").
- Swatch selected state with a check mark (not colour alone) and 44 px touch targets.

## Out of scope
- New avatar parts or colours; any API change.

## Acceptance criteria
- [ ] The character card shows the dotted stage with a large figure and a working Front/Back toggle, plus 1×/2×
  previews.
- [ ] Hairstyle options are cards with a preview; with no atlas they fall back to text.
- [ ] Selected swatches show a check mark; touch targets are at least 44 px.
- [ ] Render tests cover the toggle, the hairstyle cards and the selected state.

## Notes / answers from Ming
- 2026-11-26: created from the SIM-066 split approved in batch 2026-11-26-7.

## Handoff
