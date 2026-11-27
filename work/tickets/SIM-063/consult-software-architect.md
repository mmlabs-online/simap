## SIM-063 architecture consult (read-only)

### Findings
1. **The schema is ready, but the service is hardwired to `self`.** `presence_source_check` already allows `provider` (`db/migrations/20261126150000_presence.sql:4,24`) and `PresenceSource` already has `"provider"` (`src/lib/presence/types.ts:1`). So no migration is needed and R2 is not touched. However, `checkIn` writes the literal `'self'` in both the reopen and insert paths (`src/server/presence/presence.ts:154,164`). It also finds the member by the caller's `sub` (`presence.ts:75-87,115`).
2. **A background puller has no `OrgScope`.** `OrgScope` is "created only by `withAuth` from the verified token; no exported constructor" (`src/server/http/org-scope.ts:5-6`). R6 says org queries are scoped by the verified token's `org` claim. A timer, cron or `instrumentation.ts` loop would need a minted scope and a list of orgs. That breaks the current R6 design and needs a decision from Ming.
3. **First-source-wins does not match `decideCheckIn`.**
   - `decideCheckIn` (`src/lib/presence/rules.ts:6-15`) returns `same` or `refuse_other_room` when the member is already checked in. For the provider, both must be a silent no-op, not a 409.
   - It returns `reopen` when a row exists for today (D81). Each pull will likely return all of today's check-ins again. A member who checked out in simap would then be re-checked-in by the next pull, over and over. PRE-04 says nothing about checked-out-today members.
4. **Audit actor.** `audit_log.actor_sub` is `uuid not null` (`db/migrations/20261120150000_init.sql:212`). `writeAudit` needs `actorSub` (`src/server/audit/write.ts:11`). `members.sub` is `not null` (`init.sql:40`), so every member has a sub. `end.ts:18-19` sets the precedent: "the audit actor is the acting human".
5. **The popup and walk-in skip already work for any source.**
   - `autoOpen` opens the popup only when `active === null`, whatever the source (`src/lib/checkin-popup.ts:7-21`).
   - Walk-ins come from a diff against a baseline, and the first load only sets the baseline (`src/lib/sprites/walk.ts:100-114`, `src/ui/roomlayout/useWalks.ts:34-38`).
   - So AC3 holds if the provider row is already committed before the first `GET /api/me/presence` and the first room-presence GET return. If it lands later, the next room poll shows a walk-in. If it lands after `/api/me/presence` returns, the popup has already opened.
6. **Logging today is safe.** `withAuth` logs only `{event, code}` (`src/server/http/with-auth.ts:113-120`), and other modules use the same JSON event pattern (`src/server/drive/image-flow.ts:35-39`). Env config loaders validate values and never echo them (`src/server/identity/config.ts:7-49`).
7. **Super-admin GETs skip the access audit** (`with-auth.ts:99-110`). If a pull runs inside a GET, a super-admin page view can cause presence writes.

### Recommendations
- **R-1 (AC1, R6, R1): pull when presence is read, not from a background job.**
  - Trigger the pull from `GET /api/me/presence` and `GET /api/rooms/[id]/presence`, using `ctx.scope`.
  - Throttle per org (in-memory TTL, at least the SIM-060 poll interval) and run one pull at a time per org (single-flight). Both first-load GETs await the same in-flight pull. That keeps AC3 deterministic (finding 5).
  - Each pull is org-wide ("today's check-ins for this org"), so "Who's here" also shows members who never open simap. Name the alternative and its cost: a scheduler means minting an `OrgScope` outside `withAuth`, plus duplicate runs on multiple instances. Put it in follow-ups and do not build it.
- **R-2 (AC1): small interface in `src/server/presence/provider/`.**
  - `CheckInProvider { pull(scope, workDate, now): Promise<ProviderCheckIn[]> }`.
  - `ProviderCheckIn = { member: { kind: "email" | "sub"; value }, roomCode: string, at?: string }`.
  - Matching a provider record to a member goes through one resolver function, so OQ-69a/b can be swapped later. The mock matches by member email or sub; seat-level data (OQ-69a) maps seat to room later.
  - Ship only the mock. Do not write a speculative HTTP client: the REST shape is unknown (OQ-69).
  - Put pure payload validation in `src/lib/validate/` so it can be unit-tested (R1).
- **R-3 (AC2): one shared check-in core, not a copy.**
  - Extract an internal `applyCheckIn(c, scope, { memberId, roomId, source, actorSub, now })` from `checkIn` (`presence.ts:106-179`). `self` keeps today's behaviour and responses.
  - The provider path calls a new decision `decideProviderCheckIn` in `src/lib/presence/rules.ts`. It returns `noop` if the member is active anywhere (first source wins), `insert` only if there is no row for today, and `noop` otherwise. A checked-out-today member is never reopened by a pull (finding 3; see OQ-1).
  - Reuse `lockOwnMember` (by member id) and its active-member check. Skip deactivated members, unknown members and room codes outside the org without an error.
  - Audit as `presence.check_in` with `meta.source = "provider"`, actor = the member's own `sub` (finding 4; no migration).
- **R-4 (AC4, R3): env config and guards.**
  - Env names: `SIMAP_PRESENCE_PROVIDER` (`off` | `mock`; unset = off) and, if wanted, a pull interval. Add the names to `.env.example` with no values.
  - Follow the `loadIdentityConfig` pattern: validate the value, never echo it, and **refuse `mock` when `NODE_ENV === "production"`**, so fake check-ins can never reach real orgs.
  - Add no endpoint or token env names until a real provider exists, or name them now with a comment and leave them unused. That is a plan choice.
- **R-5 (AC4): a failed pull never fails the request.**
  - Catch the error, log `{ event: "presence_provider_pull_failed", code }` with a fixed code only. Never log `err.message` (it can carry a URL or token), a payload, an email or a name.
  - Return the presence read as normal. A unit test with a spy logger checks the redaction.
- **R-6 (AC5) tests:**
  - Mock pull applied to a fake DB, and running it twice equals running it once.
  - `decideProviderCheckIn` matrix: active self, active other room, checked out today, no row.
  - Provider failure is logged without the payload, and the GET still returns 200.
  - `autoOpen` with an `active` whose `source` is `"provider"` keeps the popup closed, and a first `presenceStep` gives no intents.
  - One `presence.db.test.ts` case: a provider insert followed by a self check-in gives `same` or 409.
- **R-7 (R4):** expect few or no UI changes (finding 5). Keep the SIM-059/061 files untouched unless a test shows a gap.

### Risks
- **Provider wins after self-checkout (D81):** without R-3's `insert`-only rule, a pull undoes a check-out (High impact, easy to miss in review).
- **Timestamp:** with pull-on-read, server time can be hours after the real arrival, and "Who's here" shows that time. A provider timestamp could fall on another day or in the future. Proposal: use the provider's `at`, clamped to today's UTC+7 window and not after now, and drop anything outside it. If there is no `at`, use server time.
- **Latency:** a synchronous pull on first load adds the provider's response time. Use a short timeout (for example 2 s); on timeout, read what is stored and degrade.
- **Multiple instances:** the in-memory throttle is per process, so duplicate pulls can happen. The member row lock (`presence.ts:75-87`) plus `presence_org_member_date_key` keeps them correct; it only costs extra provider calls.
- **Super-admin GETs causing writes (finding 7):** acceptable if the reviewer agrees the write belongs to the provider, not the viewer. Otherwise skip the pull when `ctx.access === "super_admin"`.
- **High path:** `.env.example`, so plan-approval applies.

### Open questions
- OQ-1 (for Ming, PRE-04 and D81): if the member checked out in simap today and the provider still reports them as checked in, does simap ignore it? (Proposal: yes, ignore it, `insert` only.)
- OQ-2: is the provider's event time or the server's pull time used for `checked_in_at` (see Risks)?
- OQ-3: is pull-on-read (R-1) an acceptable "plan choice" under PRE-04, given that provider check-ins only appear while someone in the org has simap open? A scheduler waits for a decision on R6 and `OrgScope`.
- OQ-4: audit actor is the member's own `sub` with `meta.source = "provider"`, versus a distinct action such as `presence.provider_check_in`. This is a small choice and has no schema impact.
- OQ-69a–c stay open. The resolver in R-2 and the env-only config keep them reversible. Per-org credentials (OQ-69c) stay out of scope.

Key files:
- src/server/presence/presence.ts
- src/lib/presence/rules.ts
- src/server/http/org-scope.ts
- src/server/http/with-auth.ts
- src/app/api/me/presence/route.ts
- db/migrations/20261126150000_presence.sql
- src/lib/checkin-popup.ts
- src/lib/sprites/walk.ts
- src/server/identity/config.ts
