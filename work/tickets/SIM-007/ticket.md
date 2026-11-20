# SIM-007: Org picker, org switcher and first-visit member profile

| Field | Value |
|---|---|
| State | PLANNING |
| Priority | P0 |
| Size | M |
| Areas | api, ui, security |
| Gate | plan-approval |
| Depends on | SIM-006.2, SIM-008 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-20 |
| Claimed by | claude@2026-11-20T09:46Z |
| PR | — |

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
—

## Handoff
