# SIM-007: Org picker, org switcher and first-visit member profile

| Field | Value |
|---|---|
| State | DONE |
| Priority | P0 |
| Size | M |
| Areas | api, ui, security |
| Gate | plan-approval |
| Depends on | SIM-006.2, SIM-008 |
| Needs Ming | — |
| Attempts | 1 |
| Created | 2026-11-20 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/23 |

## Goal
After sign-in a user enters one of their orgs, can switch orgs, and on their first visit to an org gets a member profile with a display name.

## Scope reference
spec AUT-06, §2 Member = org account; D12, D13, D16 (a), D17.

## Scope
- Client: `GET /auth/orgs` → enter the only org, picker for several, "You are not in any organization yet" for none; remember the chosen org id; switch re-mints with the new `org_id` and clears all cached data.
- Server: `GET /api/me` creates the member on first call for (`org`, `sub`) and returns member + tier; `PATCH /api/me` sets display name.
- First-visit screen asking for the display name (default: email local part).
- Shell shows org name and switcher (SIM-003 slot).

## Out of scope
- Member management by Managers (SIM-011). Invitations (SIM-009).

## Acceptance criteria
- [ ] A user with one org enters it directly; with two sees a picker; switching shows only the new org's data.
- [ ] The first `/api/me` in an org creates exactly one member, even under concurrent calls.
- [ ] A display name is required on the first visit and stored in NFC.
- [ ] `org_access_denied` drops the remembered org and returns to the picker.
- [ ] Unit tests cover the picker decision and display-name defaults.

## Technical notes
- Files: `src/server/members/*`, `src/app/api/me/route.ts`, `src/ui/org/*`.
- Risks / open questions: Concurrency on first insert (use `on conflict do nothing`).

## Test plan
- Unit: picker decision, display-name default/validation.
- Manual: two orgs on one account (needs M-1).

## Notes / answers from Ming
- Plan approved (2026-11-20, batch 2026-11-20-4): "duyệt hết theo đề xuất" — Q11–Q18 take the proposals; split into SIM-007 (server, this ticket), SIM-007.2, SIM-007.3. High tier: no merge approval (Ming merges).

## Handoff

### 2026-11-20 — claude — IN_PROGRESS (plan approved, build not started)
- Agent calls: 3, ~279k tokens (api-platform-engineer×1 39k, frontend-developer×1 53k, planner×1 139k; ×1 share of batch)
- Done: consult, plan (slice 1 of 3: /api/me server + migration), plan approved by Ming (batch 2026-11-20-4); SIM-007.2/007.3 created on main
- In progress / next: batch stopped before IMPLEMENT (GitHub Actions not running → no auto-merge); resume with `/run-batch --resume`
- Gotchas: High tier (db/migrations) → Ming merges; needs `pnpm schema:check` against a local DB

### 2026-11-20 — claude — DONE (PR #23, High: waiting for Ming's merge)
- Agent calls: 6, ~301k tokens (implementer×2 67k+50k, reviewer×2 61k+46k, security-ai-generated-code-auditor×2 46k+31k; all default model — High path, no small-diff downgrade)
- Done: slice 1 built (GET /api/me create-on-first-visit, PATCH display name, migration `members.profile_confirmed_at`); review attempt 1 REWORK (no DB evidence: ci.yml runs only on PRs/main, so a draft PR was opened), attempt 2 PASS with CI green (test:db 20/20, migrate + smoke + schema check); security 0 🔴 0 🟡 after fixing 2 🟡 (invisible/bidi chars in names, blank default name / whitespace email → 500)
- In progress / next: Ming reviews and merges PR #23 (High, never agent-merged), then SIM-007.2 and SIM-007.3
- Gotchas: CI does not run on `ticket/**` pushes — open a draft PR before REVIEW for DB evidence; `gh pr edit` fails on this repo (Projects classic GraphQL) → use `gh api -X PATCH repos/mmlabs-online/simap/pulls/<n>`; node/pnpm/gh/python live in WSL Ubuntu-24.04 (`bash -ic`)
