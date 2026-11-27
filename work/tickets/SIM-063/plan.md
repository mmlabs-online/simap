Status: READY

# Plan — SIM-063: Third-party check-in provider: REST pull adapter and mock

## Scope summary
`docs/spec-v1.md` PRE-04 (lines 746-755):
> A server-side adapter behind a provider interface (`src/server/**`) **pulls** check-ins from the third-party
> system's REST API; there is no webhook into simap (D83). When and how often it pulls is a plan choice. The first
> version ships only a **mock provider** for dev and tests; a real provider waits for OQ-69a–c.
> A provider check-in counts exactly like a self check-in, with source `provider`. If the member is already
> checked in, nothing changes (first source wins).
> If the member is already checked in by the provider when they open simap, the popup is skipped and their
> character is shown seated, without the walk-in.
> Provider credentials and endpoints come from env only (R3), unless Ming decides otherwise for per-org
> credentials (OQ-69c). No provider payload, token or personal data is logged.

PRE-03 (line 729): "records presence with source `self` and the server time"; (741-742) the D81 reopen rule.
PRE-05 (760-761): "a record whose work date is before 'today' (UTC+7) counts as ended when read. Check-in always
writes today's UTC+7 work date."
PRE-06 (775-777): presence polled every 30–60 s.
`work/decisions.md` D83: "The third-party check-in provider is a REST API that simap pulls from a server-side adapter;
no webhook into simap. Per person vs per seat, the member identifier, and one provider vs per-org credentials (and R3)
stay open in OQ-69." OQ-69a–c (spec 1027-1031) stay open and block only the real provider.
CLAUDE.md R1, R3, R6, R7, R4, R5.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | A server-side adapter behind a provider interface pulls check-ins; no webhook; only a mock ships | `src/server/presence/provider/types.ts` defines `CheckInProvider`; the only implementation is `mock.ts`; no new route under `src/app/api/**` (diff shows only the two existing GET handlers changed). Tests `pull.test.ts › pulls from the provider and applies each valid item`, `config.test.ts › *`. |
| 2 | Provider check-in counts like a self check-in with source `provider`; already checked in = nothing changes (first source wins) | `rules.test.ts › decideProviderCheckIn matrix`; `presence.db.test.ts › provider: inserts source provider on the lowest seat`, `› provider: active self check-in is left unchanged`, `› provider: applying twice writes one row and one audit`, `› provider: a self check-in after a provider check-in to the same room is a no-op 200, another room 409`, `› provider: does not reopen a row checked out today` (CI `pnpm test:db`). |
| 3 | A member already checked in by the provider skips the popup and is shown seated without the walk-in | Existing `checkin-popup.test.ts › autoOpen` (line 37: `active("provider")` gives false) and `walk.test.ts › a member already present in the first answer does not walk in` (line 95) stay green; new `pull.test.ts › concurrent callers share one in-flight pull and resolve after it is applied` and route tests `› GET syncs the provider before reading` prove both first-load GETs read after the pull is committed. Manual: `pnpm dev` with the mock (see Approach step 9). |
| 4 | Credentials/endpoints from env only (names in `.env.example`, no values); no payload, token or personal data logged | `.env.example` diff adds names only; `config.test.ts › refuses mock in production`, `› error messages never carry the value`; `pull.test.ts › failure logs only event, provider and a fixed code` (spy log; asserts serialized calls contain none of the thrown message, email, room code or the mock entries). Reviewer greps the diff for `console.` (none outside the injected logger). |
| 5 | Unit tests cover the mock pull, first-source-wins and the popup/walk-in skip | `pnpm test` green with the tests listed in `## Tests to write`. |

## Ming verification after merge
None. The manual dev run (Approach step 9) is local and the reviewer can do it; no real provider exists.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/presence/rules.ts` | Add `decideProviderCheckIn` (pure) | AC2 first-source-wins, insert-only (G1) | No |
| `src/lib/presence/rules.test.ts` | Matrix tests for `decideProviderCheckIn` | AC2, AC5 | No |
| `src/lib/presence/provider-time.ts` (new) | `providerCheckInAt(at, now)` pure clamp (G2) | Timestamp rule, UTC+7 day bounds | No |
| `src/lib/presence/provider-time.test.ts` (new) | Edge cases (UTC+7 midnight, future, missing, bad) | Domain focus: UTC vs UTC+7 | No |
| `src/lib/validate/provider-checkin.ts` (new) | `parseProviderPull(raw)`: validates the pull payload, drops bad items, caps count | Input validation at the boundary (R1: pure in lib) | No |
| `src/lib/validate/provider-checkin.test.ts` (new) | Validator tests | R5 | No |
| `src/server/presence/provider/types.ts` (new) | `CheckInProvider` interface, `ProviderCheckIn`, `MemberRef`, `ProviderPullError` | AC1 | No |
| `src/server/presence/provider/mock.ts` (new) | Deterministic in-memory mock with failure injection | AC1 (only provider that ships) | No |
| `src/server/presence/provider/mock.test.ts` (new) | Mock returns its entries; failure modes | AC5 mock pull | No |
| `src/server/presence/provider/config.ts` (new) | `loadProviderConfig(env)`: `SIMAP_PRESENCE_PROVIDER`, `SIMAP_PRESENCE_PROVIDER_MOCK`; refuses mock in production; never echoes values | AC4, R3 | **Yes** (`**/config.*`) |
| `src/server/presence/provider/config.test.ts` (new) | Config tests | AC4 | **Yes** (`**/config.*`) |
| `src/server/presence/provider/pull.ts` (new) | `createProviderPuller(deps)` → `sync(db, scope)`: throttle, single-flight, timeout, apply, redacted failure log; never throws | AC1, AC3, AC4 | No |
| `src/server/presence/provider/pull.test.ts` (new) | Throttle, single-flight, timeout, redaction, outcome handling | AC3, AC4, AC5 | No |
| `src/server/presence/provider/index.ts` (new) | `syncProviderCheckIns(db, scope)`: lazy env load (once per process, `globalThis`), wires mock + `applyProviderCheckIn`; off when unset or invalid | The one entry the routes call | No |
| `src/server/presence/presence.ts` | Extract shared private helpers from `checkIn` (lines 106-179): lowest-seat lookup, today-row lookup, insert/reopen SQL with `source` as a parameter; add `lockMemberById`, `resolveProviderMember`, export `applyProviderCheckIn` | AC2: one shared check-in core, not a copy | No |
| `src/server/presence/presence.db.test.ts` | Provider cases (`pnpm test:db`, CI) | AC2 against real SQL and locks | No |
| `src/app/api/me/presence/route.ts` | GET (lines 13-21): `await syncProviderCheckIns(pool, ctx.scope)` before `getMyPresence` | AC3 (popup reads post-pull state) | No |
| `src/app/api/me/presence/route.test.ts` | Mock `@/server/presence/provider`; assert sync is called with `ctx.scope` before the read; PUT/PATCH/DELETE never call it | AC3 | No |
| `src/app/api/rooms/[id]/presence/route.ts` | GET (lines 9-20): sync after the uuid and pool checks, before `listRoomPresence` | AC3 (walk baseline reads post-pull state) | No |
| `src/app/api/rooms/[id]/presence/route.test.ts` | Same assertions; a bad id returns 404 without a sync | AC3 | No |
| `.env.example` | Add `SIMAP_PRESENCE_PROVIDER=` and `SIMAP_PRESENCE_PROVIDER_MOCK=` with a comment, no values | AC4, R3 | **Yes** (`.env.example`) |

No changes to `src/ui/**`, `src/lib/checkin-popup.ts`, `src/lib/sprites/walk.ts` (SIM-059/061 already skip for any
source; see Specialist input). No change to `src/server/http/**`.

## Data model / migration
None. `presence_source_check` already allows `provider` (`db/migrations/20261126150000_presence.sql:24`, comment line
4: "`provider` ... allowed now so the provider source (SIM-063) needs no contract migration"). `PresenceSource`
already includes `"provider"` (`src/lib/presence/types.ts:1`). R2 not triggered.

## API contract
| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| GET | `/api/me/presence` | unchanged | unchanged | unchanged (200/503; auth codes only from `withAuth`) | user |
| GET | `/api/rooms/[id]/presence` | unchanged | unchanged | unchanged (200/404/503) | user |

Only side effect added: before reading, the handler may run a throttled provider pull for `ctx.scope`'s org. A pull
failure or timeout never changes the response (it is caught and logged). R7: the 401/403 codes still come only from
`withAuth` before the handler runs; the handler adds no auth code after the pull. No new endpoint, no webhook.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/presence/rules.test.ts › decideProviderCheckIn: active in the same room -> skip_active` | AC2 first source wins |
| `… › active in another room -> skip_active (never a refusal)` | AC2 |
| `… › no active, row for today (checked out) -> skip_today_row` | G1 (no reopen after check-out) |
| `… › no row today, no seat in the room -> skip_no_seat` | No hot-desking (PRE-02) |
| `… › no row today, seat -> insert` | AC2 |
| `src/lib/presence/provider-time.test.ts › missing at -> now` | G2 |
| `… › at earlier today (UTC+7) -> at; at at 17:00Z of the previous UTC day that is today in UTC+7 -> kept` | G2, UTC vs UTC+7 |
| `… › at on yesterday's UTC+7 date -> null (dropped); at later than now but same work date -> now; at on tomorrow's date -> null` | G2 |
| `… › unparsable or offset-less string -> null` | Validation |
| `src/lib/validate/provider-checkin.test.ts › accepts { checkIns: [{ member: { kind: "email"\|"sub", value }, roomCode, at? }] }` | Boundary validation |
| `… › non-object / missing array -> null (bad_response)` | Validation |
| `… › drops items with bad kind, empty or over-long value or roomCode (> ROOM_LIMITS.code), non-uuid sub, non-string at; counts dropped` | Validation, empty/null fields |
| `… › more than 1000 items -> null (bad_response)` | Pagination/size bound |
| `… › keeps Vietnamese diacritics in values untouched (no normalisation beyond trim)` | Domain focus |
| `src/server/presence/provider/mock.test.ts › returns its entries in the payload shape` | AC5 mock pull |
| `… › fail: "error" rejects with ProviderPullError("provider_error"); fail: "hang" honours the abort signal` | Error paths |
| `src/server/presence/provider/config.test.ts › unset or empty -> off` | AC4 |
| `… › "mock" outside production -> mock with parsed entries (email=ROOM, uuid sub=ROOM, comma-separated)` | AC4, manual test seed |
| `… › "mock" with NODE_ENV=production -> ProviderConfigError` | Fake data never reaches real orgs |
| `… › unknown kind, malformed mock entry, > 200 entries -> ProviderConfigError whose message contains neither the value nor any entry` | AC4 redaction |
| `src/server/presence/provider/pull.test.ts › pulls from the provider and applies each valid item with providerCheckInAt` | AC1 |
| `… › a second sync within 30 s does not pull again; after 30 s it does` | Throttle |
| `… › concurrent callers share one in-flight pull and resolve after it is applied` | AC3 determinism |
| `… › throttle and in-flight state are per org` | R6 |
| `… › provider rejects / times out (2 s) / bad payload -> sync resolves, logs { event: "presence_provider_pull_failed", provider: "mock", code } only` | AC4, never fails the GET |
| `… › failure logs only event, provider and a fixed code` (thrown message with a fake token, an email and a room code; asserts JSON of every log call contains none) | AC4 redaction |
| `… › an apply that throws for one item is logged with code apply_error and the other items still apply` | Robustness |
| `… › provider off -> sync is a no-op and never calls apply` | Default off |
| `src/server/presence/presence.db.test.ts › provider: inserts source provider on the lowest seat, today's work date, audit presence.check_in with meta.source provider, actor = member sub` | AC2 |
| `… › provider: active self check-in is left unchanged (same room and other room); no audit` | AC2 first source wins |
| `… › provider: applying twice writes one row and one audit` | Idempotence |
| `… › provider: does not reopen a row checked out today` | G1 |
| `… › provider: a self check-in after a provider check-in to the same room returns the provider row (200, no write); another room -> 409 already_checked_in` | AC2 "counts exactly like" |
| `… › provider: unknown member, ambiguous email, deactivated member, unknown room code, no seat in room -> skipped, no row` | Edge cases |
| `… › provider: a member of another org with the same email is not matched` | R6 |
| `… › provider: room presence lists the member with source provider` | PRE-06 |
| `src/app/api/me/presence/route.test.ts › GET syncs the provider with ctx.scope before reading; PUT/PATCH/DELETE do not sync` | AC3, scope |
| `src/app/api/rooms/[id]/presence/route.test.ts › GET syncs before reading; non-uuid id -> 404 without a sync` | AC3 |

Existing tests that stay green and cover AC3's client side: `src/lib/checkin-popup.test.ts › autoOpen` (line 37) and
`src/lib/sprites/walk.test.ts › a member already present in the first answer does not walk in` (line 95).

## Approach
1. **Pure rules (lib).** In `src/lib/presence/rules.ts` add
   `decideProviderCheckIn({ active, todayRowExists, lowestSeatId }): "skip_active" | "skip_today_row" | "skip_no_seat" | "insert"`
   in that order (active first, like `decideCheckIn` line 12). Add `src/lib/presence/provider-time.ts`
   `providerCheckInAt(at: string | undefined, now: Date): Date | null` using `workDateUtc7` (G2). Add
   `src/lib/validate/provider-checkin.ts` `parseProviderPull(raw: unknown): { items: ProviderCheckInInput[]; dropped: number } | null`
   (member kind `email` (trimmed, 1-320 chars, contains `@`) or `sub` (`isCanonicalUuid`), `roomCode` 1-`ROOM_LIMITS.code`
   chars, optional `at` string with an explicit offset; at most 1000 items). R1: lib imports lib only.
2. **Interface** `src/server/presence/provider/types.ts` (`import "server-only"`):
   `interface CheckInProvider { readonly id: string; pull(req: { workDate: string; signal: AbortSignal }): Promise<unknown> }`
   — the raw payload goes through `parseProviderPull`, so a future REST provider is validated the same way. Paging, auth
   and retries live inside a provider's `pull` (none needed for the mock). `MemberRef = { kind: "email" | "sub"; value }`
   keeps OQ-69b open; `roomCode` per person fits OQ-69a "per person" (a per-seat provider maps seat to room later).
   `class ProviderPullError extends Error` with a fixed `code` (`timeout` | `provider_error` | `bad_response`) and a
   static message.
3. **Mock** `mock.ts`: `createMockProvider(entries, opts?: { fail?: "error" | "hang" })`; returns
   `{ checkIns: entries }`; `hang` waits for the abort signal. Pure in-memory, no network.
4. **Config** `config.ts` (High): `loadProviderConfig(env)` → `{ kind: "off" } | { kind: "mock"; entries }`.
   `SIMAP_PRESENCE_PROVIDER`: unset/empty = off, `mock`, anything else = `ProviderConfigError`. `mock` with
   `NODE_ENV === "production"` = `ProviderConfigError`. `SIMAP_PRESENCE_PROVIDER_MOCK`: comma-separated
   `<email or sub>=<ROOM_CODE>` (max 200), parsed with the same field rules as step 1. Messages never carry the value
   (pattern of `src/server/identity/config.ts:7-49`). No endpoint/token names yet (G5).
5. **Shared check-in core** in `src/server/presence/presence.ts`. Extract from `checkIn` (lines 117-169) private helpers:
   `lowestSeat(c, scope, roomId, memberId)` (lines 124-130), `todayRow(c, scope, memberId, today)` (131-136),
   `writeCheckIn(c, scope, { reopenId | null, memberId, seatId, today, at, source })` (149-169, `'self'` literals become
   a bound parameter). `checkIn` keeps its signature, lock order, responses and audit meta exactly (existing
   `presence.db.test.ts` cases are the guard). Add `applyProviderCheckIn(db, scope, item, at, now)` returning an
   outcome (`applied` | `skip_active` | `skip_today_row` | `skip_no_seat` | `unknown_member` | `ambiguous_member` |
   `inactive_member` | `unknown_room`), one short transaction per item via `inTx`/`withTx`:
   resolve member in the org (`select id, sub, status from members where org_id = $1 and lower(email) = lower($2)`, or
   `sub = $2`; 0 rows = unknown, >1 = ambiguous) → lock it by id `for no key update` (same lock as `lockOwnMember`
   line 79) and re-check `status = 'active'` → room by code `for share` → `loadActive` → lowest seat `for share` →
   today row → `decideProviderCheckIn` → on `insert` call `writeCheckIn` with `source 'provider'` and `at`, then
   `writeAudit` (`actorSub` = the member's `sub`, action `presence.check_in`, meta
   `{ room, seat, reopened: false, source: "provider", provider: <id> }`; no email, no name). Skips write nothing.
   Presence rows are locked last (rooms.ts lock order note, line 72). All queries via `orgQuery` (R6).
6. **Puller** `pull.ts`: `createProviderPuller({ provider, apply, log, clock, minIntervalMs = 30_000, timeoutMs = 2_000 })`
   → `sync(db, scope): Promise<void>`. Per `scope.orgId`: if a pull is in flight, await it; else if the last start is
   < `minIntervalMs` ago, return; else start: `provider.pull({ workDate, signal: AbortSignal.timeout(timeoutMs) })`,
   also raced against the timeout; `parseProviderPull`; for each item compute `providerCheckInAt` (null = drop) and
   `apply` it, catching per item. The last start is set at start, so a failing provider is also throttled. HTTP (or
   the mock call) never runs inside a transaction. `sync` never throws; any failure logs exactly
   `{ event: "presence_provider_pull_failed", provider, code }` with `code` from a fixed set (`timeout`,
   `provider_error`, `bad_response`, `apply_error`); never `err.message`, the payload, an email, a sub or a room code.
   Nothing is logged on success.
7. **Wiring** `index.ts`: `syncProviderCheckIns(db, scope)`; on first call loads `loadProviderConfig(process.env)`
   (lazy, like `getAuthDeps`, so `next build` needs no env), caches the puller on `globalThis`; config error → provider
   off and one `{ event: "presence_provider_config_invalid" }` log per process (presence keeps working); `off` → no-op.
8. **Routes.** `GET /api/me/presence` and `GET /api/rooms/[id]/presence` call `await syncProviderCheckIns(pool, ctx.scope)`
   after the existing pool / id checks and before the read. Write methods are untouched. R1: only `src/app/api/**`
   imports `src/server/**`; `pnpm check:layers` confirms. Pull-on-read (G3) runs for every access type (G6).
9. **Docs/env.** `.env.example`: the two names, empty, with a comment ("off | mock; mock is refused in production" and
   the entry format). Manual run: in `.env.local` set `SIMAP_PRESENCE_PROVIDER=mock` and
   `SIMAP_PRESENCE_PROVIDER_MOCK=<your dev email>=<a room code where you have a seat>`, `pnpm dev`, open simap: no
   popup, character seated, "Who's here" shows source provider; check out, reload after 30 s: not re-checked-in.
10. Checks: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`; `pnpm test:db`
    locally if Postgres is up, else CI.

Rules: R1 (lib/server/api layering, `import "server-only"` in every new non-test server file), R3 (names only, values
never logged or echoed), R6 (org only from `ctx.scope`; the provider payload never names an org; member lookup is
org-scoped), R7 (no new auth codes; pull happens inside the handler after `withAuth`), R2 (no migration), R4 (no UI
change, no REST client), R5 (tests above).

### Gate decisions (defaults the plan applies; Ming may override at plan approval)
- **G1 Reopen after self check-out.** A provider record for a member who already has a row today (checked out by self,
  system or day end) is ignored: the provider only inserts, never reopens. Otherwise every pull would undo a check-out
  (D81 reopen). D81 still applies to self check-ins.
- **G2 Check-in timestamp.** Use the provider's `at` when present, clamped to "not after now", and only when it falls on
  today's UTC+7 work date (otherwise the item is dropped as stale/future). With no `at`, use server time. Reason:
  pull-on-read can be minutes or hours after arrival. The work date is always today's (PRE-05). Alternative: always
  server time.
- **G3 Pull trigger and cadence.** Pull on read: the two presence GETs run a throttled, single-flight, org-wide pull
  for the caller's org (minimum 30 s per org per process, fixed constant, matching the PRE-06 poll lower bound; 2 s
  timeout). No background job/scheduler (it would need an `OrgScope` outside `withAuth`, against R6's current design,
  and duplicate runs per instance). Cost: provider check-ins appear only while someone in that org has simap open, and
  Who's-here may be up to ~30 s + one poll behind.
- **G4 Audit actor.** `actor_sub` = the checked-in member's own `sub`, action `presence.check_in`, meta
  `source: "provider"`, `provider: "mock"`. No new action, no migration (`actor_sub` is `uuid not null`,
  `init.sql:212`).
- **G5 Env names.** `SIMAP_PRESENCE_PROVIDER` (`off`/unset, `mock`) and `SIMAP_PRESENCE_PROVIDER_MOCK` (dev seed list).
  No endpoint, token or interval names until a real provider exists (OQ-69); they are added with that ticket.
- **G6 Super-admin views.** A super-admin GET also triggers the pull (the writes come from the provider, not the
  viewer, and are audited as the member). Alternative: skip when `ctx.access === "super_admin"`.
- **G7 Which org / one provider (OQ-69c).** One env-configured provider for all orgs; each pull is applied only within
  the requesting org, matching members by the provider's reference inside that org. Per-org credentials stay out of
  scope.
- **G8 Mock member key (OQ-69b, mock only).** Email (case-insensitive, must match exactly one member in the org) or a
  uuid `sub`. The real identifier stays open.
- **G9 Provider check-out.** Not in scope: the provider only checks in (ticket Scope). `checked_out_by 'provider'`
  stays unused.

## Specialist input used
- software-architect R-1 (pull on read from both presence GETs, per-org throttle, single-flight, no scheduler): adopted as G3; it makes AC3 deterministic.
- software-architect R-2 / api-platform-engineer rec. 1 (small interface, member resolver kept separate): adopted, merged: `pull` returns raw payload validated by `parseProviderPull`; `MemberRef` keeps OQ-69b open. Rejected `externalId`/cursor/`nextCursor` from rec. 1: dedupe is by the `(org, member, work_date)` key and paging belongs inside a real provider's `pull`.
- api-platform-engineer rec. 3 (REST client with retries, backoff, pagination) and rec. 6 `rest` kind / `CHECKIN_PROVIDER_BASE_URL` / `_TOKEN` / `_ORG_ID`: rejected for this ticket. Ticket and PRE-04 say "only a mock provider ships" and the REST shape, auth and identifier are unknown (OQ-69a–c); a speculative client would be untested dead code (R4). Its rules (per-request timeout, capped size, no logging of URLs) are recorded in Assumptions for the real-provider ticket.
- architect R-3 (one shared core, `decideProviderCheckIn` insert-only, member sub as actor): adopted (G1, G4). api-platform-engineer rec. 4 event-time guard ("apply if `at` is later than checked_out_at"): rejected in favour of insert-only, which is simpler and cannot undo a check-out; Ming can choose otherwise at the gate.
- api-platform-engineer rec. 2 (typed errors with static messages): adopted as `ProviderPullError` codes. Rec. 4 "HTTP outside tx, one short tx per item": adopted. Rec. 4 "only today's work date": adopted via G2.
- architect R-4 / api rec. 7 (refuse mock in production; env names only; dev seed via env): adopted (G5).
- architect R-5 / api Risks (failed pull never fails the request; fixed-code logging; spy-logger test): adopted.
- architect Risks timestamp clamp: adopted as G2. Latency 2 s timeout: adopted.
- architect finding 5 / R-7 (popup and walk skip already source-agnostic, no UI change): adopted, confirmed at `src/lib/checkin-popup.ts:7-21`, `src/lib/sprites/walk.ts:95-114`, and existing tests `checkin-popup.test.ts:37`, `walk.test.ts:95`. Answers api open question 6.
- architect finding 7 / super-admin: G6.
- api rec. 5 pg advisory lock against stampede: rejected; the member row lock and `presence_org_member_date_key` keep concurrent pulls correct, the in-process single-flight limits load, and a per-org advisory lock adds a cross-request lock for no correctness gain.

## Assumptions
- AC3 holds because both first-load GETs await the same in-flight pull or read after it committed. If the provider is
  slow (> 2 s) the pull times out for that request and continues to be throttled; a check-in found by a later pull then
  shows as a walk-in on the next room poll and the popup may already be open. Acceptable degradation; the next page
  load is correct.
- Throttle/single-flight state is per process; several instances may pull the same org more than once per 30 s. The
  member lock and unique key keep this correct; it only costs extra provider calls. The map grows by one entry per org
  seen (small, bounded by org count).
- The puller pulls the whole provider list for the work date and filters to the requesting org's members; with the mock
  this is trivial. A real provider will need an org filter (OQ-69c) in its own ticket.
- Notes for the real-provider ticket (not built here): `AbortSignal.timeout` per request and capped body read as in
  `src/server/drive/client.ts:90-157`, retry only idempotent GETs on 429/5xx with Retry-After, page and item caps, and
  endpoint/token env names added then.
- Code size estimate: ~300 lines of product code, ~400 lines of tests; one cycle (Size M). No split.
- Hotspots: no other ticket is `IN_PROGRESS`/`REVIEW`; SIM-070 (`DONE`) is the Map items editor and does not touch
  presence files or `.env.example` per its title; a rebase conflict is not expected.
- High paths touched: `.env.example`, `src/server/presence/provider/config.ts` and its test (`**/config.*`). Gate
  `plan-approval` applies; the security auditor review trigger fires (`src/server/`, `.env.example`).
- I could not read `.env.example` (denied by permissions); the implementer appends the two names in its existing
  style.

## Blocking questions
None. All open points have defaults (G1–G9) for Ming to confirm at the plan-approval gate.

## Split proposal
None.
