# SIM-007.3: First-visit profile screen

| Field | Value |
|---|---|
| State | MERGED |
| Priority | P0 |
| Size | S |
| Areas | ui |
| Gate | none |
| Depends on | SIM-007, SIM-007.2 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-20 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/26 |

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

### 2026-11-21 — claude — DONE (PR #26, Medium, merge pre-approved in batch 2026-11-20-5)
- Agent calls: 4, ~284k tokens (planner×1 sonnet 124k incl. one resume, implementer×1 63k, reviewer×1 50k, security-ai-generated-code-auditor×1 47k)
- Done: first-visit profile screen (`profile` view from `needsProfile`, `ProfileView`, PATCH /api/me via apiFetch, copy); review attempt 1 PASS; CI green; security 0 🔴 1 🟡
- In progress / next: auto-merge under the batch merge rule, then SIM-019.2
- Gotchas: security 🟡 (AuthError during PATCH → inline retry dead end) must be fixed before go-live; the plan was written against the SIM-007.2 plan, adapted to merged code (deviations in impl-log)
