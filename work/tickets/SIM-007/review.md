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
None: `security-review.md` Attempt 1 has 0 🔴 (2 🟡: p{Cf}/filler code points in display names; `defaultDisplayName` can return whitespace → 500).

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

## Attempt 2 — 2026-11-20
Verdict: PASS

### Checks (run by reviewer)
Local run in WSL on `ticket/SIM-007` @ `2e55cb1` (code identical to `80f4215`: `git diff --stat 80f4215 HEAD` touches
only `impl-log.md` and `ticket.md`).
- `pnpm format:check`: exit 0, "All matched files use the correct format" (215 files).
- `pnpm typecheck`: exit 0, tsc clean.
- `pnpm check:layers`: exit 0, "189 files, no violations".
- `pnpm test`: exit 0, "Test Files 67 passed (67)". CI log for the same code: "Tests 651 passed (651)", which matches impl-log.
- `pnpm build`: exit 0.
- DB checks, verified by the reviewer with `gh` on draft PR #23 (`ticket/SIM-007` → `main`, isDraft true):
  - Run 44746052478 (ci, head `80f42156…`, code-bearing): conclusion success. Every step passed. Log lines:
    migrate CLI "applied 20261120150000_init", "applied 20261120190000_members_profile_confirmed_at", "up to date";
    migrate smoke "migrate smoke ok"; schema check all `pass:` lines; `pnpm test:db`
    "✓ src/server/members/members.db.test.ts (9 tests)", "Test Files 2 passed (2)", "Tests 20 passed (20)".
  - Run 44746547944 (ci, head `2e55cb17…`, latest push): conclusion success. Same migrate, smoke, schema-check and
    test:db lines (members.db.test.ts 9 tests, 20/20 passed). `gh pr checks 23`: ci pass, image pass, tier pass.
  - Earlier runs 44746497611/44746497663 were cancelled (superseded by the next push), so they don't affect the result.
- impl-log attempt 2's CI claims match the run data exactly.

### Acceptance criteria
- [x] AC2 one member per first `/api/me`, even under concurrent calls. Evidence: `members.db.test.ts` › "10 concurrent
  first calls create one row with one id and one member.create audit row" and › "same sub in two orgs …", green in
  runs 44746052478 and 44746547944. `route.test.ts` › "GET returns {sub,email,org,tier,member}" green.
- [x] AC3 (server half) display name required, stored in NFC. Evidence: `member.test.ts` › `normalizeDisplayName` /
  `validateMePatch` tables. `members.db.test.ts:88` › "setDisplayName stores NFC …" now passes NFD through
  `normalizeDisplayName` (attempt-1 nit fixed) and is green in CI. `route.test.ts` › invalid/valid PATCH cases.
- [x] AC5 (part) display-name defaults. Evidence: `member.test.ts` › `defaultDisplayName` cases, plus the new control,
  format and filler cases (`"\u0007 \u0007@x.vn"` → `"@x.vn"`, `"​a‮b@x.vn"` → `"ab"`, `"\u0007 \u0007"` → `"member"`).
- [x] S1-a needsProfile survives reloads and a returning member is not asked again. Evidence: `members.db.test.ts` › "second GET …",
  › "setDisplayName stores NFC and clears needsProfile …" (re-GET asserts `needsProfile` false), › "same name again
  is a no-op …", all green in CI.
- [x] S1-b the existing client keeps working. Evidence: `flow.test.ts` › "readMeResult reads tier and email from the SIM-007 body
  with member", plus typecheck and test green.
- [x] S1-c migration is forward-only and expand-only. Evidence: the file is a single `add column … null` (read in attempt 1,
  unchanged). CI "applied 20261120190000_members_profile_confirmed_at", "up to date", migrate smoke ok, schema check
  passes (every table org_id not null, every FK and unique key includes org_id).

Ming verification after merge (carry into the PR): with a real org token, `GET /api/me` twice → same `member.id`,
`needsProfile: true`; `PATCH /api/me {"displayName":"Nguyễn Văn A"}` → 200, `needsProfile: false`; `audit_log` has
one `member.create` and one `member.update` row for that `sub`.

### Re-check of attempt-1 items
- Issue 1 (🔴 DB evidence): resolved (see Checks).
- Nit NFC test: fixed (`members.db.test.ts:93` uses `normalizeDisplayName(nfd)!`).
- Nit `\p{Cf}`: fixed together with security 🟡 1 (below).
- Nit `rows: any[]` in `members.ts:8`: left as is. impl-log explains that `orgQuery<R>` needs `rows: R[]` for varying R. This is acceptable.
- Security 🟡 1: fixed. `src/lib/validate/member.ts:12-15,24` rejects `[\p{Cc}\p{Cf}]`, the fillers U+115F, U+1160,
  U+3164 and U+FFA0 (the literal characters in the regex source), and requires one `\p{L}|\p{N}|\p{S}|\p{P}`. Tests reject
  `"​"`, `"a‮b"`, `"ㅤ"`, `"́"` and `"a‍b"`.
- Security 🟡 2: fixed. `member.ts:31,34` strips the invisible set before `clean`, and the fallback falls back to `"member"`
  unless the result has a visible character, so the result can't be blank and can't hit `members_display_name_check`.
  `members.ts:15,84` (`ensure` and `getOrCreateMember`) treat a whitespace-only email as no email, so the result is
  403 with no insert. Evidence: `members.db.test.ts` › "no email and no row …" now asserts `who("  ")` → 403 and 0 members,
  green in CI.

### Issues
None.

### Rules (CLAUDE.md)
No violations found. R1: `check:layers` clean, and the DB test imports `@/lib/validate/member` (server test → lib is allowed).
R2: there is still one forward-only, expand-only migration. R4: the attempt-2 code changes only touch `member.ts`, `member.test.ts`,
`members.ts` and `members.db.test.ts`, all in the plan's file list. Out-of-plan files: none. R5: all checks are green,
including the DB checks in CI. R6: unchanged since attempt 1.

### Blockers from review agents

### Nits (do not block)
- `normalizeDisplayName` now rejects every `\p{Cf}`, including ZWJ and ZWNJ. Emoji ZWJ sequences (e.g. family emoji) and
  scripts that need ZWNJ (Persian, some Indic) can't be used in a display name. impl-log states this as a deliberate choice. Note it
  for SIM-011 (Manager edit) and the UI copy, so the error message doesn't confuse users.
- `ensure` inserts `who.email` without trimming, so the whitespace check covers only whitespace-only emails. Emails padded
  with spaces are stored as given. Identity emails are not expected to be padded, so this is cosmetic.

### Follow-ups (out of scope)
- Same as attempt 1: email refresh on later visits (A4); SIM-011 reuses `normalizeDisplayName`, keeps the
  `profile_confirmed_at` semantics and blocks deactivated members in `memberGate`. Possible later DB guard on
  `char_length(display_name) <= 80`.
- Kit/workflow: getting DB evidence through a draft PR worked. Making that the standard `/run` step before REVIEW
  for tickets with DB tests is still open (attempt-1 follow-up).
