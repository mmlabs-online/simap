# SIM-006.3: Account pages: sign-up, verify email, forgot and reset password

| Field | Value |
|---|---|
| State | MERGED |
| Priority | P1 |
| Size | M |
| Areas | security, ui |
| Gate | none |
| Depends on | SIM-006.2 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-20 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/22 |

## Goal
simap hosts its own sign-up, verify-email, forgot-password and reset-password pages, as ricotdin does, calling the org-admin-api auth endpoints (Ming, Q16); slice S3 of the approved SIM-006 plan.

## Scope reference
`work/tickets/SIM-006/plan.md` slice S3 (approved 2026-11-20, batch 2026-11-20-2): AC8–AC12. Ming Q16 (own pages) supersedes the D33 link targets; consumers.md (every registered origin serves /verify-email and /reset-password).

## Scope
- Everything listed under slice S3 in `work/tickets/SIM-006/plan.md`, with Q34: `Referrer-Policy: no-referrer` via `metadata.referrer` on these pages (no `next.config.ts` change).
- Record a decision in `work/decisions.md` superseding D33's link targets, and update spec AUT-01 (line ~164) and §Out of scope (line ~489) accordingly.

## Out of scope
- Resend button on `/verify-email` (Q35: none, as ricotdin).

## Acceptance criteria
- [ ] AC8–AC12 as written in `work/tickets/SIM-006/plan.md` slice S3.
- [ ] Referrer policy set via `metadata.referrer` on the four pages; no High path touched.
- [ ] Decision entry and spec lines updated.

## Technical notes
- Manual end-to-end needs M-1 with both production and dev origins registered (email links go to the calling origin).
- Split from an approved plan: the planner reuses that plan's slice; re-plan only what changed on `main` since.

## Test plan
- As in the source plan's slice.

## Notes / answers from Ming
- 2026-11-20 (batch 2026-11-20-2): created from the split Ming approved ("duyệt hết; câu 20 tách 3 phần; … còn lại theo đề xuất").
- Plan approved (2026-11-20, batch 2026-11-20-4): "duyệt hết theo đề xuất" — every proposal in the batch round taken.
- Merge approved (2026-11-20, batch 2026-11-20-4): "bật --auto-merge".

## Handoff

### 2026-11-20 — claude — DONE
- Agent calls: 5, ~386k tokens (frontend-developer×1 43k, planner×1 109k, implementer×1 79k, reviewer×1 70k, security auditor×1 45k; default models)
- Done: sign-up / verify-email / forgot / reset pages, Resend in the gate, D53 + spec; review PASS attempt 1; security 0 🔴 / 0 🟡 / 4 💭; PR https://github.com/mmlabs-online/simap/pull/22
- In progress / next: batch --auto-merge stopped: GitHub Actions jobs fail without a runner (CI not green) → Ming merges; manual checks in the PR
- Gotchas: branch synced with main by merge, not rebase (no force-push)
