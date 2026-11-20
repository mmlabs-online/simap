# SIM-007.2: Org entry: org list, picker, switcher and org_access_denied

| Field | Value |
|---|---|
| State | DONE |
| Priority | P0 |
| Size | M |
| Areas | ui, security |
| Gate | none |
| Depends on | SIM-006.2, SIM-006.3 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-20 |
| Claimed by | claude@2026-11-20T16:25Z |
| PR | — |

## Goal
After sign-in a user enters one of their orgs (directly with one, via a picker with several), can switch orgs, and loses a revoked org cleanly; slice S2 of the approved SIM-007 plan.

## Scope reference
`work/tickets/SIM-007/plan.md` § Split proposal, S2 (approved 2026-11-20, batch 2026-11-20-4). Spec AUT-06; D12, D13, D16, D17, D47, D52.

## Scope
- Everything listed under S2 in `work/tickets/SIM-007/plan.md` (Identity `orgs()`, `token(accountId, orgId?)`, `org_access_denied`, pure `decideOrg`, remembered org per account, token store `selectOrg`, per-tab org in `authChannel`, gate views, `OrgPickerView`, switcher, `src/ui/copy/org.ts`).

## Out of scope
- First-visit profile screen (SIM-007.3). Server `/api/me` (SIM-007).

## Acceptance criteria
- [ ] SIM-007 ACs 1 and 4, and the picker decision part of AC5, as written in the SIM-007 plan's split proposal.
- [ ] A tab ignores a token minted for another org; a denied org cannot loop on auto-enter.
- [ ] All loop checks green; copy follows the SIM-022 convention.

## Technical notes
- Before planning: the `/auth/orgs` response shape is not in this repo (org-admin-api `docs/consumers.md` "Organizations"). Ming Q18 (batch 2026-11-20-4): if not supplied, a tolerant parser isolated in `identityClient.orgs()` plus a Ming check after merge.
- Hotspot: rebases after SIM-006.3 (`AuthGate.tsx`, `views.tsx`, `copy/auth.ts`).

## Test plan
- As in the source plan's slice. Manual: two orgs on one account (needs M-1).

## Notes / answers from Ming
- 2026-11-20 (batch 2026-11-20-4): created from the split Ming approved ("duyệt hết theo đề xuất", Q11); Q18 default.

- Plan approved (2026-11-20, batch 2026-11-20-5): "ok hết" — every assumption takes its default.
- Merge approved (2026-11-20, batch 2026-11-20-5): "ok hết" on the round that asked "cho merge" per Medium ticket.

## Handoff
