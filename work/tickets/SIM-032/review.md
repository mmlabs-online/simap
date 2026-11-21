## Attempt 1 — 2026-11-21
Verdict: REWORK

### Checks (run by reviewer)
Node v22.23.5, on `ticket/SIM-032`.
- `pnpm format:check` — exit 0, "All matched files use the correct format."
- `pnpm typecheck` — exit 0
- `pnpm check:layers` — exit 0, "check-layers: 234 files, no violations"
- `pnpm test` — exit 0, Test Files 98 passed (98), Tests 1024 passed | 3 skipped (1027). The 3 skipped are in `scripts/deploy-envfile.test.ts`, not this ticket. The three launcher test files passed 3 more runs in a row (106 tests each).
- `pnpm build` — exit 0
- `pnpm check:dev-bundle` — exit 0, "no dev-token strings in .next/static"
- `bash -n scripts/start-dev.sh` — exit 0
- `pnpm test:db` — not run, left to CI as instructed.
- shellcheck — unavailable, not downloaded (AC7 allows this).

The implementer's reported check results match this run.

### Acceptance criteria
- [ ] AC1 Full flow in stubbed tests — NOT MET, see Issue 5. The steps are covered separately, but the planned test with sign-in through URL in one trace does not exist.
- [x] AC2 Refusals, missing tool and busy port before any sign-in, tunnel or password prompt — evidence: `dev-prod.mjs:166-212`; `dev-prod.test.ts:459,475,483,490,503`. Old messages and exit codes are kept (compared with `origin/main`). The only intended change: `DATABASE_URL` now covers four files, any letter case.
- [x] AC3 Failed sign-in starts nothing — evidence: `dev-prod.test.ts:357,812`.
- [x] AC4 Org flow — evidence: `dev-prod.test.ts:765-812` (reuse, one prompt, validation, no re-prompt, answer not printed). `git diff origin/main...HEAD -- scripts/dev-token.mjs` is empty, and `--org` is its existing interface.
- [ ] AC5 Readiness timeout, early exit or foreign owner stops the child — PARTLY MET. Early exit and owner paths pass (`dev-prod.test.ts:838,845`; real-tree owner test). The 30 s limit fails, see Issue 3. The stop itself can fail, see Issues 1 and 2.
- [ ] AC6 No child left, tunnel not stopped — NOT MET, see Issues 1, 2 and 4. The tunnel part is met: `dev-process.mjs` has no docker stop and `dev-prod.test.ts:856` asserts it. The normal real-tree stop and bystander tests pass.
- [x] AC7 No secret in output, argv or a repo file — evidence: `dev-prod.test.ts:612,887`. By inspection, PowerShell receives only literals and validated integers, it inherits the launcher env (the password exists only in the app child's env, `dev-prod.mjs:301-304`), the snapshot never reads `CommandLine`, and the wrapper handles no secret. Checks are not all closed until the issues below are fixed.

Ming verification after merge (not verified here; carry on the PR):
1. Take a `pg_dump` of `simap`, kept outside the repo, before the first run.
2. In Git Bash (mintty), run `scripts/start-dev.sh`: email, password and DB password hidden, URL, warning, red badge, `/api/readyz` = 200.
3. Ctrl-C: port free, no `next dev` node process remains, `pg-tunnel-pg-tunnel-1` still running.
4. Repeat once in PowerShell or Windows Terminal.

### Issues
#### Issue 1 — 🔴 blocker — process stop leaves the production app running
- **Where**: `scripts/dev-process.mjs:245-246`, `:266-267`, `:273-274`; reached from `scripts/dev-prod.mjs:308-310`.
- **Expected**: Plan §5 step 1: "If it cannot be recorded, stop the child and exit 1."
- **Actual**: When the identity snapshot fails, `root` is null and `stopTree` returns `[child.pid]` without killing anything. The launcher then exits while the app still holds the production `DATABASE_URL`. Reproduced with a fake child and PowerShell made unavailable: `rooted: false`, `stop() unconfirmed: 1`, `child alive 1 s after stop: true`.
- **Fix instruction**: In the Windows path, when `root` is null or a snapshot fails and the child has not exited, call `child.kill()` on the handle Node holds (this cannot hit a reused PID), wait for `exit` with a short limit, and keep reporting descendants as unconfirmed when the tree cannot be read. Add a test that makes the snapshot fail and asserts the real child is gone.

#### Issue 2 — 🔴 blocker — an empty snapshot counts as "everything stopped"
- **Where**: `scripts/dev-process.mjs:33`, `:193-199`, `:248-251`, `:268-269`.
- **Expected**: A snapshot that cannot prove the process table was read is treated as failed, so the stop is never confirmed from it.
- **Actual**: The script uses `$ErrorActionPreference='SilentlyContinue'`, so a failed `Get-CimInstance` still prints `END`. `parseWindowsSnapshot("END")` returns an empty table (asserted at `dev-process.test.ts:27`), `winTree` is then empty, and `stopTree` returns `[]`, meaning success, while the app may be running. Established from the code and the parser result; the CIM failure itself was not forced.
- **Fix instruction**: Treat a snapshot as valid only if it contains the launcher's own `process.pid`; otherwise return null. Add parser or stop tests for the `END`-only case, and apply Issue 1's fallback.

#### Issue 3 — 🔴 blocker — the 30 s readiness limit can be exceeded indefinitely
- **Where**: `scripts/dev-process.mjs:146-167`; `scripts/dev-prod.mjs:322-326`.
- **Expected**: At most 30 s, then the child is stopped and the run exits 1.
- **Actual**: The `timeout` option on `http.get` is a socket idle timeout. A listener that sends one byte every 500 ms keeps the probe pending, and the loop checks its deadline only between probes. Reproduced through the real `run()` and `probeReady`: after 40 s the result was still `pending` with 0 stop calls. It ended only when my test closed the server.
- **Fix instruction**: Give `probeReady` a hard total deadline: a `setTimeout(timeoutMs)` that destroys the request and resolves false, cleared on finish. Add a test with a trickling local server asserting the probe resolves false within its limit.

#### Issue 4 — 🔴 blocker — tree rule can select an unrelated process after PID reuse
- **Where**: `scripts/dev-process.mjs:64-81` (line 74 applies only while the PID has a holder).
- **Expected**: Ticket risk: "Stopping a process tree on Windows must never kill a process the launcher did not start."
- **Actual**: If the root exits, its PID is reused by process Y, Y starts Z and Y exits, then Z has the root's PID as `ppid`, a later start time and no holder to reject it. `descendantsOf([{pid:11, ppid:10, start:510n}], {pid:10, start:100n})` returns `[11]`, and the kill's start-time check passes because Z's own identity is correct. The window is short (root exit to the last sweep) but the result is killing a bystander.
- **Fix instruction**: Record a FILETIME upper bound when the root's `exit` event fires, pass it to `descendantsOf`, and do not accept a direct child of the dead root that started after it. Add a pure test for this sequence and keep the existing orphan test passing with a child that started before the exit.

#### Issue 5 — 🔴 blocker — planned AC1 test is missing
- **Where**: `scripts/dev-prod.test.ts:277` (`happy path` has no sign-in step).
- **Expected**: Plan test `full flow without .env files` with the exact trace: env check, tools, port, token check, dev-token, token check, docker inspect, probe, prompt, spawn, ready, owner, then URL and warning.
- **Actual**: No test has this name or this trace.
- **Fix instruction**: Add it using `drive({ tokens: [null, FRESH], orgAnswer: ORG })` with all env files absent, asserting the exact trace (including `org prompt`) and the last two output lines.

#### Issue 6 — 🟡 should-fix — POSIX stop reports success without confirming
- **Where**: `scripts/dev-process.mjs:211-218`, `:255-262`.
- **Expected**: An unconfirmed stop exits non-zero (plan §5), and a group that vanished between check and signal is not an error.
- **Actual**: `stopTree` returns `[]` after `SIGKILL` without re-checking; `posixAlive` treats `EPERM` as dead; an `ESRCH` from `process.kill` rejects the stop.
- **Fix instruction**: Treat only `ESRCH` as gone, catch `ESRCH` on both signals, poll briefly after `SIGKILL`, and return `[child.pid]` if the group remains.

#### Issue 7 — 🟡 should-fix — docs describe the old order
- **Where**: `scripts/dev-prod.mjs:2`; `README.md`, "Production database (dev)" step 3.
- **Expected**: The `.env*` refusals are described as preflight, before sign-in and tunnel.
- **Actual**: The header comment still says "token, tunnel, .env.local check", and the numbered list still places the `.env*` refusals after the tunnel.
- **Fix instruction**: Update the comment; keep only the password prompt in step 3 and move the refusal details into the preflight paragraph.

### Examined and accepted
- **10 microsecond start-time comparison** (`dev-process.mjs:202-208`): safe. Measured `StartTime` minus CIM on a real process: 6 ticks (0.6 microseconds) in 8 of 8 reads. A start 100 microseconds off was not killed; the matching start was. A reused PID cannot start within 10 microseconds of the recorded process, because that process had to exit first and was alive across a PowerShell snapshot. `.Handle` pins the process before the comparison. The PID-reuse problem is in the tree rule (Issue 4), not this tolerance.
- **Readiness**: `127.0.0.1` literal, fresh agent, no auth or cookie header, redirects not followed.
- **Port check**: refused connects on a released port took 0-3 ms on both loopback addresses, so the 2 s fail-closed timeout does not misreport a free port here.
- **Size**: code is +501/-58 = 443 net (455 with README, 519 gross with README). A split is **not warranted**: it is under the ~500 fallback threshold, and preflight, start and stop are only safe together. The fixes should add about 30-40 lines. If net non-test lines pass 500, stop and report.

### Rules (CLAUDE.md)
- R4: all changed files are in the plan; no High path changed.
- R5: not satisfied until Issues 1-5 are fixed (new stop and readiness logic has untested failure paths; a planned test is missing).
- R1, R2, R3, R6, R7: no violations found.

### Blockers from review agents
Left for the orchestrator to copy from `security-review.md`. That file appeared during this review with Verdict REWORK; its S1 and S2 overlap Issues 1 and 2 here, which were checked independently of it.

### Nits (do not block)
- `dev-prod.mjs:346-351`: a root exit or signal during the blocking owner check can still print the URL just before the stop.
- `start-dev.sh:5`: `cd` with `CDPATH` set can print a path; `CDPATH= cd --` avoids it.
- Plan assumption 3 stands: a cold `next dev` compile can exceed 30 s and fail closed.

### Not verified
- Real `winpty` path and real Ctrl-C in mintty or a Windows console.
- Windows console stdin handoff from the launcher's raw-mode org prompt to the `dev-token` child. Ming should run step 2 once with no token file so this path is exercised.
- Real `next dev` orphan behaviour, real sign-in, tunnel and production `/api/readyz` (forbidden here; Ming verification).
- POSIX real-tree behaviour on this Windows machine (CI covers Linux).

### Follow-ups (out of scope)
- None.

### Blockers from review agents (added by orchestrator, 2026-11-21)
From `security-review.md` Attempt 1. Fix these in REWORK attempt 2, together with the reviewer's issues above:
- 🔴 S1 and S2: same defects as reviewer blockers 1 and 2.
- 🟡 S3: same defect as reviewer blocker 4.
- 🟡 S4-W: clear `CDPATH` in `scripts/start-dev.sh`.
- 🟡 S5: a wrong database password must not cause repeated production logins. Make one authentication check before the app starts and stop on `28P01`.
- 🟢 N1 and N2: same defects as reviewer blocker 3 and the POSIX stop should-fix.

Not in attempt 2: tunnel port identity and minimal helper env are follow-ups.
