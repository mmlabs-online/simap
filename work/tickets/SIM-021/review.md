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
