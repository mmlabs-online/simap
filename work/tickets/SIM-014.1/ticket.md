# SIM-014.1: Requests read API and decided badge

| Field | Value |
|---|---|
| State | DONE |
| Priority | P1 |
| Size | S |
| Areas | api |
| Gate | plan-approval |
| Depends on | SIM-014 |
| Needs Ming | M-34 |
| Attempts | 0 |
| Created | 2026-11-24 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/60 |

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
- 2026-11-24: Plan approved (all defaults, assumptions 1-9; Ming: "duyệt plan SIM-014.1, chạy luôn").

## Handoff

### 2026-11-24 — claude — BLOCKED (plan approval)
- Agent calls: 2, tokens ~115k total (api-platform-engineer×1 inherit 36k, planner×1 inherit ~80k; in/out split not reported)
- Done: consult saved; plan.md READY, one slice (list, mine, mark-seen; no migration, no new codes, no High path).
- In progress / next: Ming approves (M-34), then implement.
- Gotchas: `seenUpTo` must keep µs precision or badges stay stuck; plan refactors `loadRequest` into shared `REQUEST_SELECT`/`REQUEST_FROM`/`toRequestDto` (no behaviour change). No overlap with PR #59 (no error.ts / copy edits).

### 2026-11-24 — claude — DONE
- Agent calls: 4 this run (implementer×1 stopped (rebase conflict, restarted), implementer×1 inherit 80k incl. one resume after the 5-hour usage limit, reviewer×1 inherit ~55k, security-ai-generated-code-auditor×1 inherit 27k; in/out split not reported); 6 in total for the ticket (~290k).
- Done: list, mine, mark-seen API; review PASS on attempt 1 with CI `pnpm test:db` green (126 tests; read.db.test.ts 12/12, requests.db.test.ts 18/18); security no 🔴. PR #60 (draft first for CI, now ready).
- In progress / next: Ming merges PR #60. Then SIM-014.2 / SIM-014.3 (UI) or SIM-013.2 (Devices page).
- Gotchas: security 🟡 (pre-existing) — `decodeCursor` accepts impossible dates (Feb 30) via Date.parse, Postgres then 500s; fix with a round-trip check when the cursor module is renamed. `isUnseen` is for the UI slice.
