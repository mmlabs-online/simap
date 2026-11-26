## Attempt 1 — 2026-11-26
Verdict: REWORK

### Checks (run by reviewer)
- `pnpm format:check`: exit 0, "All matched files use the correct format."
- `pnpm typecheck`: exit 0, "Types generated successfully", tsc clean.
- `pnpm check:layers`: exit 0, "check-layers: 808 files, no violations".
- `pnpm test`: exit 0, "Test Files 308 passed | 1 skipped (309)", "Tests 3126 passed | 7 skipped (3133)".
- `pnpm build`: exit 0, "Compiled successfully", 21 static pages.
- The results match impl-log.md attempt 1.

### Acceptance criteria
- [x] AC1 Ordered checklist 0-14 covers the ticket scope: `docs/go-live.md:23-119`. Identity is item 1 (:28), the
  tunnel is item 3 (:42), the DB is item 4 (:48), the first release is item 8 (:75), the first org and admin is item 11 (:96).
- [x] AC2 Tick boxes 15, `Owner:` 15, `Check:` 15 (greps run by reviewer).
- [x] AC3 Rollback `docs/go-live.md:121-141`: no-previous with its four options, automatic restore, restore-unpushed,
  revert of `release.env`, "migrations stay applied". `down -v` appears only as a "never" (:124). It matches
  `deploy/deployment-repo/README.md` (rollback paragraph) and `deploy-simap.yml:184-213`. One case is missing, see Issue 4.
- [x] AC4 Links resolve. `README.md#release-and-deploy` is `README.md:165` and `README.md#production-image` is
  `README.md:148`. `deploy/deployment-repo/README.md` exists. `ops/backup/RESTORE.md` is named as a deployment-repo path
  (:19, :131), the same path `deploy-simap.yml:166` uses. The release steps are linked, not restated.
- [x] AC5 The email/UUID grep finds nothing in either file. The CODEOWNERS handle is not quoted. Secrets are named
  only (:56-59). The names match `.github/workflows/release.yml:46-48` and the deployment README's Drive paragraph.
  The app-side names `GOOGLE_*`/`DRIVE_FOLDER_ID` in `.env.example` are correctly not listed as repo secrets.
- [x] AC6 Assumptions A2-A8 are at `docs/go-live.md:157-171`, each marked "default until Ming says otherwise".
- [ ] AC7 `flow-run.md` has the header, F1-F11 tables with the required columns (71 rows), and the Summary. Every
  Expected cell cites an ID, and every cited AUT/ROO/SEA/LAY/DEV/REG/MEM/DSH/SYS/SHL ID and D-number exists in
  `docs/spec-v1.md` / `work/decisions.md`. Result/Notes/BUG id are empty. Not met: the F6 rows cannot be run in
  order (Issue 1), and several citations or expected results contradict the spec (Issues 2, 3).
- [x] AC8 "How to record and file bugs" is at `flow-run.md:169-179` and covers every point in the plan.
- [x] AC9 Commit f45d7f2 adds only the M-77 line to `work/ming-todo.md` (no other line changes). The M-78 line in
  `origin/main...HEAD` is the orchestrator's plan-approval entry, not the implementer's.
- [x] AC10 Changed files: `docs/go-live.md`, `flow-run.md`, `impl-log.md`, `ming-todo.md`, plus orchestrator
  ticket files. Nothing under `src/`, `db/` or `.github/`, and no High path.
- [x] AC11 Checks green (above).

Facts checked against the repo, all correct:
- release naming per D57 and `README.md:167-170`;
- tunnel target `http://simap:3000`;
- `pg-backup` (`deploy-simap.yml:155`);
- Postgres 13+ (`ming-todo.md:24`);
- `/api/healthz` and `/api/readyz` exist (`src/app/api/`);
- single HSTS (`src/lib/security/headers.ts:14`) and CSP (`src/proxy.ts:16-18`);
- `members` columns `org_id`, `sub`, `status`, `updated_at` (`db/migrations/20261120150000_init.sql:37-51`);
- the deny-list reads `members.status` uncached on every call (`src/server/members/gate.ts:9-22`);
- D56 covers the pg-tunnel.

### Issues
#### Issue 1 — 🔴 blocker — flow-run F6 rows cannot be run in order
- **Where**: `work/tickets/SIM-021/flow-run.md:93-104`
- **Expected**: The template is run top to bottom, and every FAIL becomes a `/bug`, so each row must be possible in
  the state the earlier rows leave.
- **Actual**:
  - F6.9 has User B confirm the transfer, so B owns the device. User A then cannot start the transfers in F6.10
    (decline) or F6.11 (cancel), because only the owner or a Manager+ can start one (spec DEV-08, `docs/spec-v1.md:318-319`).
  - F6.12 returns the device to the org, so it has no owner. F6.13 "Admin takes a device back" then has nothing to
    take back (DEV-09, :332).
  - F6.14 "Delete a device that is placed" is impossible after that, because an org-inventory device is never placed
    (DEV-03, :292).
  - F6.4 assumes User A occupies a seat, and no row before it guarantees that (F5.3 clears the seat).
  - Run as written, these rows give false FAIL/BLOCKED results and could lead to bogus BUG tickets.
- **Fix instruction**: Reorder or reword the F6 rows so every step is possible in sequence:
  - State the precondition at the top of F6 (User A occupies a seat, e.g. assigned in F5 and not cleared, or
    re-assigned).
  - Run the decline (F6.10) and cancel (F6.11) transfers before the confirmed transfer (F6.9).
  - Make the return in F6.12 started by the current owner (User B after the transfer) and confirmed by the Admin.
  - Before F6.13, assign a device to a member again (or use a second device) so the Admin has something to take back.
  - In F6.14, use a device that is assigned and placed at a seat (e.g. a second device), then F6.15 deletes it after
    it is back in the org inventory.
  - Keep the Tier column consistent with who acts.

#### Issue 2 — 🟡 should-fix — decision and spec citations point to the wrong rule
- **Where**: `work/tickets/SIM-021/flow-run.md:73-75, 93, 102-104`
- **Expected**: The cited ID is the rule that defines the expected result, so whoever records a FAIL can quote it in
  the `/bug`.
- **Actual**:
  - F6.3 cites D31. D31 is "a placed device cannot be deleted". Assign with an expiry is DEV-07 / D63.
  - F6.12 and F6.13 cite D68. D68 is the device-type image size rule. Return and take-back are DEV-09 / D63.
  - F6.14 cites D61 (device images and desk slots). The placed-device delete rule is D31 (`docs/spec-v1.md:282-284`).
  - F4.6 and F4.7 cite D62. D62 is "fixture on a desk is refused". It belongs on F4.3.
  - F4.5 cites LAY-06 (seat and device overlays), which says nothing about a stale-save conflict.
  - F4.7's 390 px rule is in "Room view (all roles)" (`docs/spec-v1.md:486-488`), not LAY-06/D62.
- **Fix instruction**:
  - F6.3: `DEV-07, D63`. F6.12 and F6.13: `DEV-09, D63`. F6.14: `DEV-01, D31`, with Expected "refused; the warning
    offers Move to inventory".
  - F4.3: add D62. F4.6: `LAY-07`. F4.7: `Room view (spec §4 LAY), LAY-06`.
  - F4.5: cite the ticket or decision that defines the layout conflict, or LAY-01 alone.

#### Issue 3 — 🟡 should-fix — F10.3 expected result contradicts SYS-03
- **Where**: `work/tickets/SIM-021/flow-run.md:146`
- **Expected**: Per `docs/spec-v1.md:546-547`, the audit screen filters by actor, entity type and date range,
  newest first, paginated.
- **Actual**: "events filter by actor and action". There is no action filter in the spec, so a tester would record a
  false FAIL.
- **Fix instruction**: Change the Expected to "SYS-03: newest first; filters by actor, entity type and date range".

#### Issue 4 — 🟡 should-fix — Rollback omits `restore-failed`
- **Where**: `docs/go-live.md:135-139`
- **Expected**: Every rollback outcome of `deploy-simap` is covered. `deploy-simap.yml:199-202` has `restore-failed`:
  the new image failed its health check and restoring the previous image failed too. Nothing is pushed, and the app
  may be down.
- **Actual**: Only "Automatic", `restore-unpushed` and "Deliberate rollback later" are listed.
- **Fix instruction**: Add one bullet. `restore-failed` means neither image is healthy and nothing was pushed. Use the
  first-release options (fix forward with a new release, take the tunnel route down) and check the run log. Link the
  deployment README, without restating workflow steps.

### Rules (CLAUDE.md)
- R3: no secret values, emails, UUIDs or quoted handles. The Docker Hub namespace is a nit, see below.
- R4: in scope. Only the planned files changed.
- R1, R2, R6, R7: not affected (no code). The recovery SQL is a documented Ming step, scoped by `org_id`.
- R5: checks green. No new logic.

### Blockers from review agents
None.

### Nits (do not block)
- `flow-run.md:116`: F7.4 cites REG-02, but the second pending request is REG-01. `flow-run.md:119`: F7.7 cancel is
  REG-02 / D24, not REG-01.
- `flow-run.md:37`: "Continue as" is AUT-01 / D33 rather than AUT-02.
- `flow-run.md:130`: F8.4 reactivation is MEM-01 (D34); MEM-02 is the member overview.
- `flow-run.md:128`: the counts warning appears only if User B occupies a seat or owns a placed device
  (`docs/spec-v1.md:360-361`). Say so in the Step.
- `go-live.md:30-31`: D14 also lists the app-scope default role `simap:member`. Item 1 could include it so Ming
  checks the full set.
- `go-live.md:56`: names the Docker Hub account `mingming21400`. Plan Approach step 5 asks for it and `README.md:167`
  already publishes it, but plan AC5 says "no account names". Fine as is. Writing "the release image repository (see
  README)" would satisfy both.

### Follow-ups (out of scope)
- Stale Turnstile comment in `src/lib/identity/config.ts` (High path, A2). Already in impl-log.

## Attempt 2 — 2026-11-26
Verdict: REWORK

### Checks (run by reviewer)
- `pnpm format:check`: exit 0, "All matched files use the correct format."
- `pnpm typecheck`: exit 0, "Types generated successfully", tsc clean.
- `pnpm check:layers`: exit 0, "check-layers: 808 files, no violations".
- `pnpm test`: exit 0, "Test Files 308 passed | 1 skipped (309)", "Tests 3126 passed | 7 skipped (3133)".
- `pnpm build`: exit 0, "Compiled successfully", 21 static pages.
- Plan greps: tick boxes 15, `Owner:` 15, `Check:` 15; `^| F` rows 76; the email/UUID grep finds nothing in either
  file; `down -v` appears once, as a "never" (`docs/go-live.md:130`); no Docker Hub account name or CODEOWNERS handle.
- No changes under `src/`, `db/` or `.github/` in `origin/main...HEAD`.
- The results match impl-log.md attempt 2. Attempt 2 did not record `check:layers` or `build`; both are green here.

### Acceptance criteria
- [x] AC1-AC6, AC8-AC11: still met (evidence as in attempt 1). Nothing regressed.
- [x] Attempt-1 Issue 2 (citations): fixed as instructed, `flow-run.md:71-75, 94-108`. One citation I supplied in
  attempt 1 is itself wrong, see Issue 3.
- [x] Attempt-1 Issue 3: F10.3 now matches SYS-03 (`flow-run.md:150` vs `docs/spec-v1.md:548`).
- [x] Attempt-1 Issue 4: `restore-failed` is covered at `docs/go-live.md:144-146`. It matches
  `deploy-simap.yml:199-202, 236` ("Nothing was pushed").
- [x] Attempt-1 nits applied: F1.3, F7.4, F7.7, F8.2, F8.4, `simap:member` in item 1, image repository linked via the README.
- [x] Security items 5-8 and the 9/11 suggestions applied:
  - item 7 check for the deployment repo (`go-live.md:76-78`);
  - item 4 role and ownership/CONNECT SQL (`:50-55`), which is valid SQL;
  - guarded drop-and-recreate (`:138-142`);
  - the recovery SQL in a transaction (`:161-167`);
  - recording rules (`flow-run.md:184-185`);
  - F11.3 and F11.4.
  No secret values or personal data in any of them. Two of the additions need a correction, see Issues 4 and 5.
- [x] Every cited spec ID and D-number exists. I checked the D-numbers D11, D14, D16-D19, D23, D24, D27, D31, D33,
  D34, D53, D56, D57, D60, D62, D63, D65 and D68, and the spec IDs LAY-07, DEV-01 to DEV-11, SYS-03 and the
  "Room view (all roles)" heading (`docs/spec-v1.md:486`).
- [ ] AC7 / attempt-1 Issue 1: F6 is mostly fixed but not fully. Walking F6 top to bottom against DEV-01 to DEV-11:
  - The precondition (`flow-run.md:89`) holds.
  - F6.1-F6.13 and F6.15-F6.17 each work in the state the earlier rows leave:
    - after F6.8, A's seat has no primary, so F6.13 can place D2;
    - take-back clears the seat (`src/server/devices/handoffs.ts:444-445`).
  - F6.14 cannot be performed as written (Issue 1).
  - F6.18 has no device to check (Issue 2).

### Issues
#### Issue 1 — 🔴 blocker — F6.14 expects a warning the app cannot show
- **Where**: `work/tickets/SIM-021/flow-run.md:107`
- **Expected**: Each F6 row is possible in sequence and its Expected is what the app does by spec.
- **Actual**:
  - D2 is placed, so it has an owner (DEV-03: an org-inventory device is never placed).
  - The app offers Delete only for an unowned device with no pending handoff (`src/server/devices/devices.ts:106`,
    `canDelete: tier === "admin" && r.owner_id === null && !pending`). The server refuses `device_owned` before
    `device_placed` (`src/lib/devices/rules.ts:37-39`).
  - So the Admin finds no Delete action for D2, and the "warning offers Move to inventory" never appears. The tester
    would record a false FAIL or BLOCKED and could file a bogus bug. That is the same problem as attempt-1 Issue 1.
  - My attempt-1 fix instruction prescribed this Expected text. That was my error, not the implementer's.
- **Fix instruction**: Change F6.14 to:
  - Step: "Admin opens D2's actions while D2 is placed at A's seat".
  - Expected: "DEV-01, D63: no Delete action; only a device in the org inventory can be deleted".
  - Keep F6.16 as the delete. Do not cite D31 here (see Follow-ups).

#### Issue 2 — 🟡 should-fix — F6.18 has no device with an expiry at that point
- **Where**: `work/tickets/SIM-021/flow-run.md:111`
- **Expected**: The overdue check has an owned device with an expiry.
- **Actual**:
  - D1's expiry (F6.3) ends at the return in F6.12: a return clears the owner and `holding_expires_on`
    (`src/server/devices/handoffs.ts:444-445`).
  - D2 is deleted in F6.16.
  - The next-day check therefore finds nothing overdue, and the tester would record a false FAIL.
- **Fix instruction**: Change the F6.18 Step to "Manager assigns D1 (now in org inventory) to User A with an expiry of
  today; check the next day". Change its Expected to "DEV-07, DEV-10: D1 shows Overdue the next day; N-A on the run
  day". Keep the row after F6.17.

#### Issue 3 — 🟡 should-fix — F4.7 names the wrong spec section
- **Where**: `work/tickets/SIM-021/flow-run.md:75`
- **Expected**: "Room view (all roles)" is under LAY in spec §6 (`docs/spec-v1.md:151, 384, 486`). §4 is the domain model.
- **Actual**: "Room view (spec §4 LAY)". This was also my attempt-1 instruction.
- **Fix instruction**: Change it to "Room view (spec §6 LAY), LAY-06".

#### Issue 4 — 🟡 should-fix — the item 4 CONNECT check will also list `postgres`
- **Where**: `docs/go-live.md:54-55`
- **Expected**: The check passes on a correctly set-up server, so Ming does not chase a false alarm.
- **Actual**:
  - By default, Postgres grants `CONNECT` to `PUBLIC` on the `postgres` maintenance database as well as on the
    templates.
  - The query will return `postgres` too, unless the shared server revoked that grant. The text says "returns only
    `simap` (template databases aside)".
- **Fix instruction**: Use
  `select datname from pg_database where not datistemplate and datname <> 'postgres' and has_database_privilege('simap', datname, 'CONNECT');`
  with the expectation "returns only `simap`". Add one clause: "`postgres` and the templates hold no app data".

#### Issue 5 — 🟡 should-fix — the recreate step relies on re-running `add-app-db.sh`
- **Where**: `docs/go-live.md:140-142`
- **Expected**: Recreating only the empty database must not touch the `simap` role or its password.
- **Actual**:
  - `drop database simap;` keeps the role. The deployed password file `postgres/secrets/apps/simap.password`
    (`deploy-simap.yml:95-99`) must stay valid.
  - `add-app-db.sh` is the one-time setup script whose two outputs are committed (`deploy/deployment-repo/README.md:11`).
    Its code is not in this repo, so nothing here shows it is safe to re-run for an existing role. It may fail, or it
    may rotate the password and produce new outputs to commit.
- **Fix instruction**: Make the explicit SQL the primary path:
  `create database simap owner simap;` then `revoke connect, temporary on database simap from public;`, run as the
  admin role, then item 4's checks. Mention `add-app-db.sh` only as "if it is known to be safe for an existing role".

### Rules (CLAUDE.md)
- R3: no secret values, emails, UUIDs or quoted handles. The Docker Hub account name was removed.
- R4: in scope. The attempt-2 commit touches only `docs/go-live.md`, `flow-run.md` and `impl-log.md`.
- R1, R2, R6, R7: not affected (no code).
- R5: checks green.

### Blockers from review agents
None. `security-review.md` attempt 1 had no 🔴. Its 🟡 items 5-8 are applied, with corrections in Issues 4 and 5.

### Nits (do not block)
- `flow-run.md:122`: F7.6, the "My requests" badge, is REG-02 (`docs/spec-v1.md:505-506`), not REG-01.
- `docs/go-live.md:30, 60`: two lines are longer than the rest of the file (oxfmt does not wrap Markdown). Rewrap them
  by hand.
- `docs/go-live.md:139`: `drop database` fails while sessions are connected. One clause would help: "stop the
  `simap` container first".

### Follow-ups (out of scope)
- Spec conflict for Ming: DEV-01's last bullet and D31 (`docs/spec-v1.md:282-284`: placed-device delete warning,
  "Move to inventory", "then allow delete") cannot happen under D63:
  - a placed device always has an owner;
  - "Move to inventory" puts it in the owner's inventory;
  - only org-inventory devices can be deleted.
  A spec clean-up (`/solo` or a ticket) should amend DEV-01 and D31.
- Carried from attempt 1: the stale Turnstile comment in `src/lib/identity/config.ts` (High path, A2).
- Carried from the security review: remove the test accounts' `simap:*` roles after A5.
