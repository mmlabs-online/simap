# SIM-007.3: First-visit profile screen

| Field | Value |
|---|---|
| State | IN_PROGRESS |
| Priority | P0 |
| Size | S |
| Areas | ui |
| Gate | none |
| Depends on | SIM-007, SIM-007.2 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-20 |
| Claimed by | claude@2026-11-20T17:05Z |
| PR | — |

## Goal
On the first visit to an org the user confirms or edits a display name before using the app; slice S3 of the approved SIM-007 plan.

## Scope reference
`work/tickets/SIM-007/plan.md` § Split proposal, S3 (approved 2026-11-20, batch 2026-11-20-4). Spec AUT-06, §2; D17.

## Scope
- Everything listed under S3 in `work/tickets/SIM-007/plan.md` (`readMeResult` reads `member`, `needsProfile` → profile view, `src/ui/org/ProfileView.tsx`, `PATCH /api/me` from the gate, `src/ui/copy/profile.ts`, client validation via `normalizeDisplayName`).

## Out of scope
- Member management by Managers (SIM-011).

## Acceptance criteria
- [ ] SIM-007 AC3 (UI half): a display name is required on the first visit, prefilled with the server default, stored in NFC.
- [ ] All loop checks green; copy follows the SIM-022 convention.

## Technical notes
- Builds on SIM-007 (server, `needsProfile`) and SIM-007.2 (gate org flow).

## Test plan
- As in the source plan's slice.

## Notes / answers from Ming
- 2026-11-20 (batch 2026-11-20-4): created from the split Ming approved ("duyệt hết theo đề xuất", Q11).

- Plan approved (2026-11-20, batch 2026-11-20-5): "ok hết" — every assumption takes its default.
- Merge approved (2026-11-20, batch 2026-11-20-5): "ok hết" on the round that asked "cho merge" per Medium ticket.

## Handoff
