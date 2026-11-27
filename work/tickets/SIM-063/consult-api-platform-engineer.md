## Findings
- Presence service (src/server/presence/presence.ts) is self-only. checkIn(db, scope, sub, roomId, now) at :106 hardcodes source 'self' (:154 reopen, :164 insert) and audit action "presence.check_in" with actorSub = caller sub (:170-176). Locks the member by `sub` (:75-87), requires an active member (:83). Seat is the lowest-seq seat in the room (:124-130).
- DB is ready: migration db/migrations/20261126150000_presence.sql:24-26 already allows source 'provider' and checked_out_by 'provider'. No schema change is needed (README.md:84). R2 is not triggered.
- Decision logic is pure in src/lib/presence/rules.ts:6-15. `active` set returns "same" (same room) or "refuse_other_room". So first-source-wins already holds for the same room. For a different room it is a 409 refusal; a provider pull must treat that as "skip", not as an error.
- The routes use withAuth (src/app/api/me/presence/route.ts). A pull has no user token, so it cannot go through withAuth, `ctx.scope` or `ctx.sub`. The adapter must build an OrgScope itself, and R6 says the org comes from a verified source, not from the provider payload.
- Outbound HTTP precedent: src/server/drive/client.ts:90-157 has per-call timeouts, a fetch with a timeout covering headers and body, a capped body read, and no retry of non-idempotent calls (:338). Reuse this pattern for the provider REST client.
- Env access is centralised (src/server/identity/config.ts, drive.ts, db/pool.ts). Follow that and do not read process.env inline.
- Spec: PRE-04 (spec-v1.md:746-755) and ticket AC. OQ-69a-c (:1027-1031) are open: per person or per seat, member identifier, and one provider or per-org credentials. These block only the real provider. The mock must not bake in an answer.
- Gaps: no provider-specific code exists. The popup and walk-in skip (AC3) depend on `source`, which MyPresenceDto already carries (presence.ts:55,64). The UI may already show a provider-checked-in member as active with no popup, because the popup keys on "no check-in today". Verify in src/ui/checkin and the SIM-061 walk-in code. If the UI has no "already present on load, no walk-in" path, that is the real work for AC3.

## Recommendations
1. Put the contract in src/server/presence/provider/types.ts (each file starts with `import "server-only"`):
   - `interface CheckInProvider { readonly id: string; pull(req: { since?: string; cursor?: string; signal: AbortSignal }): Promise<PullPage> }`.
   - `PullPage = { items: ProviderCheckIn[]; nextCursor: string | null }`.
   - `ProviderCheckIn = { externalId: string (provider's event id, dedupe key); memberRef: string; at: string; room?: string }`.
   - Keep `memberRef` an opaque string, and make the member matcher a separate injected function. That leaves OQ-69b open and the mock can use email or sub.
   - Make `room` optional so both the person and the seat answers to OQ-69a fit.
2. Typed errors, never raw strings: `ProviderError` with kind `timeout | network | auth | rate_limited(retryAfterMs) | bad_response | unavailable`. Messages must be static. Never include the URL, body, token or member data (AC4). Log only provider id, kind and counts.
3. REST client rules:
   - Timeout per request via AbortSignal.timeout, as in drive/client.ts:157. Suggested 10 s, with a capped response size.
   - Retry only the idempotent GET, at most 2 times with backoff plus jitter, only on 429 (honour Retry-After), 5xx and network errors. No retry on 4xx or auth.
   - Pagination loop with a hard page cap and an item cap per run. Reject a repeated cursor to prevent an infinite loop.
   - Validate each item with a validator in src/lib/validate/ (pure, R1). Drop invalid items, count them, and never log their content.
4. Idempotency of applying (the main risk):
   - Add `applyProviderCheckIn(db, scope, memberId|ref, roomId, at, now)` in presence.ts next to checkIn, sharing the same tx, lock order and decideCheckIn. Do not copy-paste the SQL.
   - Parameterise the source as 'self' or 'provider' in the insert/reopen SQL (:154,:164).
   - Audit with actorSub "provider:<id>" (or a system actor) and meta.source = 'provider'.
   - For decision "same", "refuse_other_room" or "refuse_no_seat", return a typed skip and write nothing. Re-pulling an already-applied page is then a no-op.
   - A member who checked out by self and is then re-reported by the provider would reopen the row (D81). That is wrong for replays. Gate on the provider event time: apply only if `at` is later than the row's checked_out_at, or if no row exists for today. Otherwise a replay silently undoes the member's check-out.
   - Use the server time `now` for checked_in_at, as PRE-03 does, or the provider time if it is trusted and within today's UTC+7 work date. Decide this in the plan.
   - Only apply items whose work date is today (UTC+7). Ignore stale items.
   - Resolve the member by org-scoped lookup. Each org's provider config is the only source of org (R6).
5. Pull trigger. There is no background job in the stack (PRE-05 avoids jobs). Options:
   - (a) Lazy pull inside the existing polling reads (GET me/presence and rooms/[id]/presence), throttled by a per-org in-process timestamp plus a pg advisory lock to avoid a stampede.
   - (b) A secured internal route called by an external scheduler.
   - Recommend (a) with a minimum interval of about 30-60 s to match the polling cadence. It adds no new infrastructure. A pull failure must never fail the user's request: catch it, record the kind and continue.
6. Config, env-only (R3): `.env.example` (High path, gate) names only. For example `CHECKIN_PROVIDER` (`mock|rest`, default off), `CHECKIN_PROVIDER_BASE_URL`, `CHECKIN_PROVIDER_TOKEN`, `CHECKIN_PROVIDER_TIMEOUT_MS`, `CHECKIN_PROVIDER_ORG_ID`. Use a single org-to-provider mapping (the single-provider assumption of OQ-69c), flagged as a Ming decision. A missing or unknown value disables the provider. The 'rest' kind does not ship now and returns a typed "not_configured".
7. Mock provider, src/server/presence/provider/mock.ts:
   - Deterministic and in-memory, seeded with a list of check-ins and a page size to exercise pagination and cursors.
   - Failure injection (timeout, 429, bad item) for the error-path tests.
   - Enabled only when NODE_ENV is not production. Add a dev-only way to seed it so the manual test works: "open simap as a provider-checked-in member" (a dev seed list by email or sub from env, still names only in .env.example).
8. Tests (Vitest, R5):
   - Unit: mock pull and pagination, error kinds, a redaction test (a spy on console/logger sees no payload or token), and cursor-loop protection.
   - rules.ts: the pure decision, including first-source-wins and replay-after-self-checkout.
   - DB integration in the existing presence.db.test.ts pattern (pnpm test:db): provider insert, a second apply is a no-op, apply after a self check-in is "same", and cross-org isolation.
   - UI: provider-source active with no popup and no walk-in (see src/ui/checkin/presence-api.test.ts).

## Risks
- Replay or stale pull reopening a member's self check-out (D81 reopen) is the main correctness risk. Mitigate with the event-time guard and externalId dedupe.
- An applier running outside withAuth gives up the auth-wrapper guarantees. It must derive org from config only, and R7 does not apply since there are no 401/403 responses.
- Lazy pull on the request path adds latency and a thundering herd. Use a timeout, throttle and lock, and never fail the request.
- A provider outage or slow response can hold DB locks if HTTP is done inside the transaction. Do all HTTP before opening any tx, then apply each item in its own short tx.
- Personal data (names, emails) in logs or errors would violate AC4. Keep error text static.
- The mock enabled in prod, or a prod flag misconfigured, would write fake check-ins. Add a guard against that.
- The OQ-69a/b answers can change the item shape. Keep the shape minimal and the matcher injectable.

## Open questions
1. Pull trigger: lazy-in-poll (recommended) or an external scheduler? A plan choice per PRE-04.
2. Is the stored check-in time the provider's `at` or the server time?
3. Which org does the single env-configured provider belong to? Does it apply to all orgs (OQ-69c)? If it needs one provider per org, that needs Ming.
4. Mock matching key (email or sub) for the dev manual test, since OQ-69b is open.
5. Should the provider be able to check a member out (checked_out_by 'provider' is already allowed in the schema), or is it check-in only for v1? The ticket scope says check-in only.
6. Does the UI (SIM-059/061) already skip popup and walk-in for any active presence on load? If not, AC3 needs a UI change. Not verified: I did not read src/ui.
