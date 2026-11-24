# SIM-014.1: Requests read API and decided badge

| Field | Value |
|---|---|
| State | PLANNING |
| Priority | P1 |
| Size | S |
| Areas | api |
| Gate | plan-approval |
| Depends on | SIM-014 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-24 |
| Claimed by | claude@2026-11-24T05:00:59Z |
| PR | — |

## Goal
Slice 2 of 4 of seat requests: Managers list requests by status, members list their own requests and see how many were newly decided.

## Scope reference
spec REG-01, REG-02; D21, D23, D24, D26. Split out of SIM-014 by its approved plan (`work/tickets/SIM-014/plan.md` → Split proposal).

## Scope
- `GET /api/requests?status=&cursor=` (Manager+, default `pending`, keyset cursor like `src/server/audit/audit.ts`; joins seat, room, subject and current occupant).
- `GET /api/requests/mine` (own, newest first, `isNew` per item, `unseen` count of approved/rejected decided after `members.requests_seen_at`).
- `POST /api/requests/mine/seen` with `{seenUpTo}` (`requests_seen_at` only moves forward, capped at now).

## Out of scope
- Email notifications (D24). Polling or push.

## Acceptance criteria
- [ ] The Approvals list filters by status and pages with a cursor; Users get 403 from the auth wrapper.
- [ ] My requests shows only the caller's requests, with `isNew` and an `unseen` count of newly approved or rejected requests.
- [ ] Mark seen never moves `requests_seen_at` backwards and never past now.
- [ ] Unit, route and DB tests cover the filter, the cursor and the unseen count.

## Technical notes
- Builds on `src/lib/requests/*`, `src/server/requests/*` and `src/app/api/requests/**` from SIM-014. UI copy in `src/ui/copy/requests.ts` (D36).

## Test plan
- Unit: query validator, unseen predicate.
- DB (CI): list, cursor, mine, seen.

## Notes / answers from Ming
—

## Handoff
