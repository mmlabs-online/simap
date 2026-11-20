# Review — SIM-007

## Attempt 1 — 2026-11-20
Verdict: REWORK

### Checks (run by reviewer)
Run in WSL on `ticket/SIM-007` @ `8932fd8`.
- `pnpm format:check` — exit 0, "All matched files use the correct format" (215 files).
- `pnpm typecheck` — exit 0 ("Types generated successfully", tsc clean).
- `pnpm check:layers` — exit 0, "189 files, no violations".
- `pnpm test` — exit 0, "Test Files 67 passed (67), Tests 642 passed (642)". Matches impl-log.
- `pnpm build` — exit 0.
- `pnpm test:db` (db integration) — **NOT RUN anywhere.** No local Postgres (Docker down, no native Postgres in WSL).
  GitHub CI has no run for this branch: `gh run list --branch ticket/SIM-007` returns nothing and
  `gh pr list --head ticket/SIM-007 --state all` returns `[]`. `.github/workflows/ci.yml:3-7` triggers only on
  `pull_request` to `main` and `push` to `main`, so pushing `ticket/SIM-007` alone never starts CI.
- `pnpm migrate` / `pnpm migrate:smoke` / `pnpm schema:check` (required by loop.config Prepare for tickets that change
  `db/migrations`) — **NOT RUN** (same reason). Impl-log says so honestly.

### Acceptance criteria
Plan covers slice S1 only (ACs 1, 4 and picker part of 5 moved to SIM-007.2 / SIM-007.3, approved by Ming).
- [ ] AC2 The first `/api/me` in an org creates exactly one member, even under concurrent calls — FAILED (no evidence),
  see Issue 1. The only evidence is `members.db.test.ts` › "10 concurrent first calls …" and › "same sub in two orgs …",
  which have never executed. Code reading supports it (`members.ts:52-74`: `on conflict (org_id, sub) do nothing
  returning id`, audit only for the winning insert, re-select in the same READ COMMITTED transaction), but reading is
  not evidence. Route half is green: `route.test.ts` › "GET returns {sub,email,org,tier,member}".
- [ ] AC3 (server half) display name required and stored in NFC — PARTIAL. Green: `member.test.ts` ›
  `normalizeDisplayName` (NFD → NFC, blank/whitespace/control/81 code points rejected), `validateMePatch` table,
  `route.test.ts` › "invalid bodies -> 400 invalid_request without a database" and › "valid body -> 200 … sub from the
  token" (passes `" An "`, service receives `"An"`). Storage half (`members.db.test.ts` › "setDisplayName stores NFC
  and clears needsProfile") has not run — Issue 1.
- [x] AC5 (part) display-name defaults — evidence: `member.test.ts` › `defaultDisplayName` cases (local part, `+tag`,
  last `@`, NFD → NFC, 100-char truncation to ≤ 80 code points without trailing space, whitespace collapse, empty local
  part, no `@`), green in `pnpm test`.
- [ ] S1-a needsProfile survives reloads, returning member never re-asked — FAILED (no evidence): DB tests only, not run.
- [x] S1-b existing client keeps working — evidence: `flow.test.ts` › "readMeResult reads tier and email from the
  SIM-007 body with member", `pnpm typecheck`, `pnpm test` green.
- [ ] S1-c migration forward-only and expand-only — read: `db/migrations/20261120190000_members_profile_confirmed_at.sql:4`
  is a single `alter table members add column profile_confirmed_at timestamptz null;` (no default, no backfill, no
  drop, no `begin`/`commit`), timestamp sorts after `20261120150000_init.sql`. The plan's command evidence
  (`pnpm migrate` then `pnpm schema:check`) is missing — Issue 1.

Ming verification after merge (not reviewer's; carry into the PR): with a real org token, `GET /api/me` twice → same
`member.id`, `needsProfile: true`; `PATCH /api/me {"displayName":"Nguyễn Văn A"}` → 200, `needsProfile: false`;
`audit_log` has one `member.create` and one `member.update` row for that `sub`.

### Issues
#### Issue 1 — 🔴 blocker — evidence (R5: no PASS without green checks)
- **Where**: `src/server/members/members.db.test.ts` (all 9 cases), `db/migrations/20261120190000_members_profile_confirmed_at.sql`;
  loop.config Checks row "db integration" and Prepare (`schema:check` for migration tickets).
- **Expected**: `pnpm test:db` green including `members.db.test.ts`, and the migration applied by `pnpm migrate` /
  `pnpm migrate:smoke` with `pnpm schema:check` green, with the summary lines recorded in impl-log.
- **Actual**: none of these has executed locally or in CI; this ticket's core claims (AC2 concurrency, NFC storage,
  needsProfile lifecycle, deactivated handling, audit rows) rest on a test file that has never run. CI cannot run for
  the branch until a PR to `main` exists.
- **Fix instruction**: no code change is required by this review. Produce the DB evidence by either (a) starting
  Docker and running `docker compose -f compose.dev.yml up -d`, `pnpm migrate`, `pnpm migrate:smoke`,
  `pnpm schema:check`, `pnpm test:db`; or (b) having the orchestrator open the PR (draft is fine) so `ci.yml` runs
  `pnpm test:db` and the migrate steps against Postgres 17, then `gh run watch <id> --exit-status`. Record the run id or
  the summary lines ("Test Files … passed", schema:check result) in impl-log attempt 2. If any DB test fails, fix the
  code (not the assertion) and re-run.

### Rules (CLAUDE.md)
No violations found.
- R1: `members.ts` starts with `import "server-only"`; route is the only importer of `@/server/members/members`;
  `src/lib/validate/member.ts` and `src/lib/members/types.ts` import only lib; `check:layers` clean.
- R2: one new forward-only, expand-only migration; init migration untouched.
- R6: every query goes through `orgQuery` with `org_id = $1` (`members.ts:41-46, 57-64, 98-107`), inserts use the
  select-from-subselect form so `org_id` is always the scope org; `sub` and `org` come only from the verified token;
  PATCH body is strict (unknown keys rejected, `route.test.ts` passes `sub: "s2"` → 400).
- R3: no env reads or secrets added. R4: changed files match the plan's file list exactly (plus ticket work files).

### Blockers from review agents
To be filled by the orchestrator (security trigger applies: `src/server/`, `db/`, `**/*.sql`).

### Nits (do not block)
- `members.db.test.ts:89-104` "setDisplayName stores NFC …" passes an already-NFC string (`nfd.normalize("NFC")`) to
  the service, so it only proves the value round-trips; the plan described "NFD in, NFC out". NFC is enforced in the
  route via `validateMePatch` (unit-tested), and the service trusts its caller. Either pass NFD through
  `normalizeDisplayName` in the test or document on `setOwnDisplayName` that `displayName` must already be normalized
  (SIM-011 will be a second caller).
- `normalizeDisplayName` rejects `\p{Cc}` only; format characters (`\p{Cf}`: zero-width space/joiner, bidi overrides
  U+202E) pass. Matches plan A3, but bidi overrides in names shown to Managers are a spoofing nuisance; consider
  rejecting `\p{Cf}` except ZWJ/ZWNJ in a later ticket.
- `members.ts:8` `Query` uses `rows: any[]`; harmless, matches `tx.ts`.

### Follow-ups (out of scope)
- Email refresh on later visits (plan A4).
- SIM-011 must reuse `normalizeDisplayName` and must not set `profile_confirmed_at` on a Manager edit.
- Kit/workflow: `ci.yml` does not run on `ticket/*` pushes, so the reviewer cannot get DB evidence before a PR exists;
  either add `workflow_dispatch` / `push` on `ticket/**`, or have `/run` open a draft PR before REVIEW for tickets with
  DB tests.
