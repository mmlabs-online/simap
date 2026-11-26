# SIM-047: Pixel character customisation

| Field | Value |
|---|---|
| State | DONE |
| Priority | P3 |
| Size | M |
| Areas | db, api, ui, ux |
| Gate | plan-approval |
| Depends on | SIM-045 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-26 |
| Claimed by | claude@2026-11-26T05:48:26Z |
| PR | — |

## Goal
A member chooses the look of their pixel character on the room map from preset parts, instead of only the look
derived from their account id.

## Scope reference
`docs/spec-v1.md` POR-06, LAY-06, Member entity (§4); decision D71 (amends D51).

## Scope
- Forward-only migration adding the stored look (skin, hair colour, hair style, shirt colour) to `members`.
- API to set / reset the caller's own look; preset values only.
- Profile tab picker with live preview; the room map uses the stored look, falling back to the derived one.
- Audit every change (SYS-03).

## Out of scope
- Profile photo (SIM-046); new art parts beyond the existing avatar ramps and frames.

## Acceptance criteria
- [ ] Migration is forward-only and the previous image keeps working (R2); existing members keep the derived look.
- [ ] The member picks one preset per layer (skin, hair colour, hair style, shirt colour); any non-preset value gets 422.
- [ ] A live preview shows front and back at 1× and 2×; "Reset" returns to the look derived from `sub`.
- [ ] The room map draws the stored look at the next layout load, for every viewer.
- [ ] Only the member changes their own look; every change writes an audit row; tests cover validation and fallback.

## Technical notes
- Files: `db/migrations/*`, `src/server/members/**`, `src/server/layout/**`, `src/lib/validate/**`,
  `src/lib/avatar*` (derived look), `src/ui/portal/**`, `src/ui/roomlayout/**`.
- Risks / open questions: High path (migration) → plan approval. Independent of SIM-044.

## Test plan
- Unit: preset validator, look resolution (stored vs derived), audit meta.
- DB: `pnpm test:db`; `pnpm schema:check`.
- Manual: change the look, open a room map in another session, reset.

## Notes / answers from Ming
- Plan approved (2026-11-26, batch 2026-11-26-1; Ming: "duyệt hết theo mặc định", assumptions 1–11 with defaults; split into SIM-047 slice A + SIM-047.1).

## Handoff
