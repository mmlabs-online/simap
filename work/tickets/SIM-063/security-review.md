# SIM-063 security review (security-ai-generated-code-auditor)

## Attempt 1

Read-only review of `ticket/SIM-063` against `origin/main`. The auditor read every file in scope, plus `with-auth.ts`, `org-scope.ts`, `audit/write.ts`, the members/rooms/audit schema in `init.sql`, `scripts/dev.mjs` and `scripts/dev-prod.mjs`. It did not open any `.env*` file. It had no shell, so it ran no checks and no `git diff`.

### Findings

**🔴 1. The mock provider runs against production data under `pnpm dev:prod`.**
- **Where:** `src/server/presence/provider/config.ts:24`. The production guard only checks `env.NODE_ENV === "production"`.
- **Why it fails:**
  - `pnpm dev:prod` (`scripts/dev-prod.mjs:95-111`, D56) runs `next dev` against the production database.
  - It goes through `devEnv`, which forces `NODE_ENV: "development"` (`scripts/dev.mjs:58`) and sets `SIMAP_DB_TARGET: "production"`.
  - Next dev then loads `.env.local`, and the plan's manual step 9 tells developers to put `SIMAP_PRESENCE_PROVIDER=mock` and a mock list in `.env.local`.
- **Risk:**
  - One such session makes every presence GET from the dev's token org insert fake `source='provider'` presence rows into production. The mock list can name any member of that org.
  - Each insert also writes an audit row with `actor_sub` set to that member's own sub (`presence.ts:287-293`). Production audit would then show check-ins that never happened.
  - The dev:prod preflight (`dev-prod.mjs:172-205`) does not refuse this variable.
  - The stated guarantee "fake check-ins never reach real orgs" (`config.ts:16`, test `refuses mock in production`) therefore does not hold.
- **Fix:**
  - In `loadProviderConfig`, also refuse when `env.SIMAP_DB_TARGET === "production"`.
  - Add a `config.test.ts` case for it.
  - Optional follow-up: have the dev:prod preflight refuse `SIMAP_PRESENCE_PROVIDER*` lines, and have `childEnv` drop them.
- **Severity:** 🔴, because the finding breaks a stated guarantee through a documented workflow. If Ming treats dev:prod as out of scope it drops to 🟡, but the fix is one line.

**🟡 2. Provider records carry no org, so one record can be applied in several orgs.**
- **Status:** accepted design G7. It matters only once a real provider exists.
- **Where:** `pull.ts:70-78`, `presence.ts:244-269`.
- **Behaviour:** every org applies the single global provider list by `(sub or email, roomCode)` within its own scope. All SQL is org-scoped, so R6 holds for the queries.
- **Risk:** a person who is a member of two orgs, each with a room of the same code, gets checked in to both orgs.
- **Action:** a precondition for the real-provider ticket (OQ-69c). Either the payload names the org, or the provider account is bound to one org.

**🟡 3. Applying the pulled items has no time limit and blocks the first presence GET.**
- **Where:** `pull.ts:57-60` puts the 2 s timeout only on `provider.pull`. The loop at `pull.ts:70-78` then runs up to 1000 sequential transactions inside the request.
- **Effect:** concurrent GETs for that org wait on the loop (`pull.ts:85`). Even skipped items take row locks, which contend with users' own check-ins.
- **Severity:** fine with the mock, which is limited to 200 entries and runs only in dev.
- **Action for the real-provider ticket:** add an overall deadline, cap the number of items, or stop awaiting the pull once a baseline exists.

**💭 4. No length cap on `at`** (`provider-checkin.ts:37`). There is no ReDoS risk and the value never reaches SQL as text. A 64-char cap is optional hardening.

**💭 5. A super-admin GET can trigger provider inserts in another org with no access-audit row** (`with-auth.ts:99` audits non-GET only). This was accepted at the gate (G6) and the risk is low.

### Verified clean (🟢)
- **R6 org scoping:**
  - The org comes only from the verified token (`with-auth.ts:83-90`).
  - All new SQL goes through `orgQuery` (`presence.ts:244-293`).
  - An email that matches more than one member is refused (`presence.ts:248-253`).
  - Throttle state is keyed by `scope.orgId` (`pull.ts:84-89`).
  - The payload cannot pick an org.
- **R3:**
  - Log entries are fixed codes only (`pull.ts:8,42-43`; `index.ts:21-22`).
  - Error messages carry no values.
  - Every new server file imports `server-only`.
  - Audit meta holds no email or name.
- **Mock refused in production:** correct for the deployed image (`Dockerfile:21`, guard checked at runtime). The gap is finding 1.
- **Failure isolation and R7:**
  - `sync` never throws.
  - It runs after `withAuth`, and no 401/403 can follow it.
  - Write methods do not sync.
  - The bad-uuid 404 comes before the sync.
  - Single-flight is race-free.
  - A failing provider is still throttled.
- **Input validation:**
  - The envelope and items are strictly shaped, with at most 1000 items.
  - `sub` must be a canonical uuid and `email` is bounded.
  - The room code is normalised.
  - `at` must have an explicit offset, is clamped to now, and must fall on today's UTC+7 work date.
  - All values are bound parameters, and nothing is merged.
- **Audit attribution:**
  - `actor_sub` is the member's own sub.
  - The action is `presence.check_in` with `meta.source: "provider"` and `meta.provider` (G4).
  - Rows are insert-only and never reopened (G1).

### Follow-ups (out of scope)
1. dev:prod preflight: refuse `SIMAP_PRESENCE_PROVIDER*` lines and drop them in `childEnv`.
2. Preconditions for the real-provider ticket: an org binding (finding 2), a deadline or item cap on the apply loop (finding 3), and a capped response body and `at` length (finding 4).
3. Optional: decide whether a super-admin GET should skip the pull or log access (finding 5, G6).
