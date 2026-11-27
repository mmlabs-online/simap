# Review — SIM-063

## Attempt 1 — 2026-11-27
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format."
- `pnpm typecheck && pnpm check:layers` — exit 0 / exit 0, "check-layers: 1014 files, no violations"
- `pnpm test` — exit 0, "Test Files 388 passed | 1 skipped (389), Tests 3770 passed | 9 skipped (3779)". Targeted run of
  the new and AC3 client files (provider/**, lib/presence, provider-checkin, both presence route tests,
  checkin-popup, walk): "Test Files 17 passed (17), Tests 134 passed (134)".
- `pnpm build` — exit 0.
- `pnpm test:db` (local compose Postgres) — exit 0, "Test Files 23 passed (23), Tests 373 passed (373)", first run
  (the known flaky `history.db.test.ts › holderSince` did not fail this time). This matches the impl-log rerun count.
- `.env.example`: not read (deny rule). Checked through `git show 7d194aaa -- .env.example`: it adds only the two comment
  lines and `SIMAP_PRESENCE_PROVIDER=` / `SIMAP_PRESENCE_PROVIDER_MOCK=` with no values. The impl log's
  "NOT DONE" for `.env.example` is superseded by the orchestrator's commit 7d194aaa (Ming authorized it), so this is not a
  mismatch.

### Acceptance criteria
- [x] Adapter behind a provider interface pulls check-ins, no webhook, only a mock ships. Evidence:
  `src/server/presence/provider/types.ts:10` `CheckInProvider`; the only implementation is `mock.ts`. No new route
  (the diff changes only the two existing GET handlers, `src/app/api/me/presence/route.ts:18`,
  `src/app/api/rooms/[id]/presence/route.ts:16`). Tests `pull.test.ts › pulls from the provider and applies each valid
  item with providerCheckInAt` and `config.test.ts` (5) pass.
- [x] Counts like a self check-in with source `provider`; first source wins. Evidence: `rules.test.ts ›
  decideProviderCheckIn` (5 cases). `presence.db.test.ts › provider: inserts source provider…`, `› active self check-in is
  left unchanged`, `› applying twice writes one row and one audit`, `› does not reopen a row checked out today`,
  `› a self check-in after a provider check-in … 409` all pass in test:db. The shared `writeCheckIn`
  (`presence.ts:135-166`) binds `source` as a parameter, and the reopen/insert placeholders are correct after the
  `org_id` prefix.
- [x] A provider-checked-in member skips the popup and is shown seated without the walk-in. Evidence:
  `checkin-popup.test.ts:35-38` (`active("provider")` → false) and `walk.test.ts:95` stay green. Both route tests
  assert the order `["sync","read"]` with `orgId` from `ctx.scope`. `pull.test.ts › concurrent callers share one in-flight
  pull and resolve after it is applied` passes.
- [x] Env-only config, names only, nothing sensitive logged. Evidence: commit 7d194aaa (names only).
  `config.ts:505-529` messages are static (`config.test.ts › … throw without echoing the value`). `pull.ts:907-908`
  logs only `{event, provider, code}` (`pull.test.ts › failure logs only event, provider and a fixed code`,
  `› … apply_error …`). The only `console.` in non-test diff code is the injected logger at `provider/index.ts:14`. The
  audit meta has no email (db test asserts no `@`).
- [x] Unit tests cover the mock pull, first-source-wins and the popup/walk-in skip. Evidence: `mock.test.ts` (3),
  `rules.test.ts`, `pull.test.ts` (8), `index.test.ts` (3), and the existing popup/walk tests are all green.

Ming verification after merge: none (plan says none).

### Scope
All changed `src/**` files are in the plan's file list. The one addition is `src/server/presence/provider/index.test.ts`,
which the impl log justifies (the plan's "provider off -> no-op" test). The High paths touched (`.env.example`,
`provider/config.ts` and its test) are the ones named in the plan, and Ming approved them (M-95). `work/ming-todo.md`
only adds M-95 (board bookkeeping). There is no migration and no UI change.

### Issues
None.

### Rules (CLAUDE.md)
No violations found. R1: check:layers is clean, and every new non-test server file starts with `import "server-only"`.
The lib files import lib only. R3: names only, and no value is echoed or logged. R6: every query goes through `orgQuery`
with `ctx.scope`, the member lookup is org-scoped, and the provider payload carries no org. R7: no new auth codes, and
the sync runs inside the handler after `withAuth`, so its writes are never followed by a 401/403. R2: no migration (the
`provider` source is already allowed). R5: green checks and new logic has tests.

### Blockers from review agents
None.

### Nits (do not block)
- 💭 `presence.db.test.ts › provider: a member of another org with the same email is not matched`: `addMember` makes a
  unique `${sub}@simap.example` email, so org A has no member with B's email. The test proves "a B-only member is not
  found from A" but not "same email in both orgs picks A's member". A future touch could give an A member the same
  email (different case) and expect `applied` for A's member only.
- 💭 `pull.ts:935-943`: the 2 s timeout covers only `provider.pull`. Applying up to 1000 items (one transaction each)
  runs inside the GET with no time bound. This is harmless with the mock (at most 200 entries); the real-provider ticket
  should bound or batch it.

### Follow-ups (out of scope)
- Real provider ticket (OQ-69a–c): bound total apply time per GET, filter the pull by org (already in plan
  Assumptions).
- `history.db.test.ts › holderSince` timing flake (impl-log follow-up; passed here on the first run).

### Blockers from review agents
- 🔴 security-review.md Attempt 1, finding 1: `src/server/presence/provider/config.ts:24` refuses mock only when `NODE_ENV === "production"`. `pnpm dev:prod` runs with `NODE_ENV=development` and `SIMAP_DB_TARGET=production`, so `SIMAP_PRESENCE_PROVIDER=mock` in `.env.local` would insert fake provider check-ins and audit rows into production. Fix: also refuse when `env.SIMAP_DB_TARGET === "production"`, and add a `config.test.ts` case. This turns the PASS above into REWORK.

## Attempt 2 — 2026-11-27
Verdict: PASS

Scope of this attempt: rework commit 60fb3917 (attempt 1 REWORK from security-review.md Attempt 1, finding 1). Attempt 1's evidence for the other acceptance criteria still applies. The rework touches only `config.ts` (one condition plus its doc comment), `config.test.ts` (one new case) and `impl-log.md`.

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format." (1069 files)
- `pnpm typecheck` — exit 0
- `pnpm check:layers` — exit 0, "check-layers: 1014 files, no violations"
- `pnpm test` — exit 0, "Test Files 388 passed | 1 skipped (389), Tests 3771 passed | 9 skipped (3780)"
- `pnpm build` — exit 0
- `pnpm test:db` (local compose Postgres) — exit 0, "Test Files 23 passed (23), Tests 373 passed (373)"
- All numbers match impl-log.md Attempt 2.

### Acceptance criteria
- [x] Attempt 1 blocker (mock provider must not run against production data under `pnpm dev:prod`) — evidence: `src/server/presence/provider/config.ts:24` now refuses when `NODE_ENV === "production" || SIMAP_DB_TARGET === "production"`, with the same fixed message (no value echoed, R3). `scripts/dev-prod.mjs:104` sets `SIMAP_DB_TARGET: "production"` on the child env (asserted by `scripts/dev-prod.test.ts:638`), and `provider/index.ts:20` reads `process.env`, so the guard sees it. A refused config fails closed: `index.ts:18-25` logs `presence_provider_config_invalid` and returns off.
- [x] Regression test — `config.test.ts:40-53` (mock + `NODE_ENV=development` + `SIMAP_DB_TARGET=production` throws `ProviderConfigError` with "not allowed in production"). Against the attempt 1 code the call would not throw, `message` would stay `""`, and the `toContain` assertion would fail. `config.test.ts:34-38` still covers plain `NODE_ENV=production`.
- [x] Other criteria — unchanged since attempt 1; the full suite and test:db are green.

### Issues
None.

### Rules (CLAUDE.md)
No violations found. The changes stay in `src/server/**` and are covered by the existing `server-only` import (R1). The error message carries no value (R3). Only the planned files changed (R4). The new logic has a test (R5).

### Blockers from review agents
None. security-review.md Attempt 2 (in the working tree, uncommitted) gives PASS and marks finding 1 fixed.

### Nits (do not block)
- 💭 The check matches `"production"` exactly (also security-review Attempt 2, 💭 2). This is enough for the only launcher today.

### Follow-ups (out of scope)
- None new. Attempt 1 follow-ups still stand.
