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

## Attempt 2
Verdict: REWORK

Reviewed at `3f19f50`, 2026-11-21.

### Checks (run by reviewer)
Node v22.23.5, on `ticket/SIM-032`.
- `pnpm format:check` — exit 0, "All matched files use the correct format."
- `pnpm typecheck` — exit 0
- `pnpm check:layers` — exit 0, "check-layers: 234 files, no violations"
- `pnpm test` — exit 0, Test Files 98 passed (98), Tests 1030 passed | 3 skipped (1033)
- `pnpm build` — exit 0
- `pnpm check:dev-bundle` — exit 0, "no dev-token strings in .next/static"
- `bash -n scripts/start-dev.sh` — exit 0
- `pnpm test:db` — not run, left to CI as instructed. shellcheck — unavailable, not downloaded (AC7 allows this).

The implementer's reported check results match this run.

### Attempt 1 issues
| Issue | Result | Evidence |
|---|---|---|
| 1 / S1 failed snapshot | PARTLY FIXED | Root is killed by handle (`dev-process.mjs:274-278`, test `:252`). A failed first snapshot still leaves descendants running: Issue 2 below |
| 2 / S2 empty snapshot | FIXED | `parseWindowsSnapshot(text, selfPid)` at `:36`, used at `:207` |
| 3 / N1 hard 30 s deadline | FIXED | Total timer at `dev-process.mjs:156`; trickling-server test `:142` |
| 4 / S3 PID-reuse bound | FIXED | `:79`; scratch run: child started after the root's exit is dropped, orphan started before it is kept |
| 5 AC1 full-flow test | FIXED | `dev-prod.test.ts:307`, exact trace plus last two output lines |
| 6 / N2 POSIX stop | PARTLY FIXED | `EPERM`, `ESRCH` and confirmation after `SIGKILL` are fixed; the group is re-probed after `ESRCH`: Issue 3 below |
| 7 comment and README order | FIXED | `dev-prod.mjs:2-3`; README preflight paragraph and step 3 |
| S4-W `CDPATH` | FIXED | `start-dev.sh:5`; `start-dev.test.ts:58` |
| S5 single login check | FIXED | See below |

**Pre-fix proof.** The current `dev-process.test.ts` was run in a scratch copy against the `a7e61b2` version of `dev-process.mjs`: 4 failed, 12 passed. The failures are the snapshot parser, the PID-reuse rule, the trickling server and `snapshot unreadable: the real child is still killed...`. All pass on the current code.

**Login check.** The real `checkDb` source was run against fake Postgres servers on ephemeral loopback ports. Every case made exactly 1 connection and the server saw it close: wrong password (`28P01`, 3 ms), other error (`53300`), success, server ignoring Terminate, silent server (5.0 s), stall after the password (5.0 s). A refused port returned `ECONNREFUSED`. `run()` maps every failure to a fixed message with no app start (`dev-prod.mjs:284-298`, tests around `dev-prod.test.ts:343`).

### Acceptance criteria
- [x] AC1 Full flow — `dev-prod.test.ts:307`.
- [x] AC2 Preflight refusals — unchanged from Attempt 1, tests still pass.
- [x] AC3 Failed sign-in starts nothing — unchanged, tests still pass.
- [x] AC4 Org flow — unchanged, tests still pass.
- [ ] AC5 Failed readiness stops the child — PARTLY MET. Deadline, early exit and owner paths pass; the stop can leave a descendant (Issues 1 and 2).
- [ ] AC6 Ctrl-C leaves no child — NOT MET, Issue 1 reproduced on the Ctrl-C grace path. The tunnel part is met.
- [x] AC7 No secret in output, argv or a repo file — the login check uses fixed messages and passes the password only in the `pg` client config. Checks are green.

Ming verification after merge (not verified here; carry on the PR):
1. Take a `pg_dump` of `simap`, kept outside the repo, before the first run.
2. In Git Bash (mintty), run `scripts/start-dev.sh` with no token file: email, password and DB password hidden, URL, warning, red badge, `/api/readyz` = 200.
3. Ctrl-C: port free, no `next dev` node process remains, `pg-tunnel-pg-tunnel-1` still running.
4. Repeat once in PowerShell or Windows Terminal.

### Issues
#### Issue 1 — 🔴 blocker — stop reports success while a descendant is still running
- **Where**: `scripts/dev-process.mjs:292-314` (first snapshot at `:301` comes after the grace wait at `:294`; nothing is remembered between snapshots); `descendantsOf` at `:69-87`.
- **Expected**: AC6: Ctrl-C leaves no child, and a stop is confirmed only when the tree is gone.
- **Actual**: A process whose parent has exited is unreachable unless that parent is the root. With a fake tree root → mid → leaf, a full snapshot was taken, `stop({ grace: true })` started and mid exited during the grace period. Result: `stop() unconfirmed [] ... mid alive: false leaf alive: true`. The launcher would report a clean stop while a process that inherited the production `DATABASE_URL` keeps running. The same result occurs when mid exits shortly before the stop. Control with no early exit: both stopped.
- **Fix instruction**: In `startApp`, keep a `known` map of `pid:start` for tree members. Add to it from every successful Windows tree read: the owner check, a new snapshot at the start of `stopTree` **before** the grace wait, and each sweep. In each sweep, `left` is the current tree plus `known` entries still in the table with the same PID and start. Kill them through `winKill` (it re-checks identity). Do not traverse from a dead `known` member, so the PID-reuse rule stays intact. Add a real-tree test: root → mid → leaf, `owner()`, `stop({ grace: true })`, mid exits during the grace wait, then assert the leaf is gone and the stop returns `[]`.

#### Issue 2 — 🔴 blocker — a failed first snapshot leaves the app's descendants running
- **Where**: `scripts/dev-process.mjs:266-267`, `:295-298`.
- **Expected**: Attempt 1 S1: after the handle kill, retry the snapshot so the worker holding the port is also found and stopped.
- **Actual**: With `root` null, `stopTree` kills the root and returns without another snapshot. Reproduced with only the first snapshot failing and later ones working: `rooted false`, `stop() unconfirmed [<root pid>]`, `leaf alive: true`. The exit is non-zero, but the reported PID is the dead root, not the survivor.
- **Fix instruction**: In `stopTree`, when `root` is null and `!exited`, retry the snapshot **before** killing and take the root's `start` from it (Node's held handle means that PID is still our child). If that works, continue with the normal sweeps. If it fails, use `killRoot()` and report unconfirmed as now. Make `root` assignable for this. Add a Windows real-tree test: unreadable snapshot during `startApp`, restored before `stop()`, whole tree gone and `[]` returned.

#### Issue 3 — 🟡 should-fix — POSIX stop probes the group again after `ESRCH`
- **Where**: `scripts/dev-process.mjs:283-285`.
- **Expected**: Plan §5: "After the first `ESRCH`, never signal that group again."
- **Actual**: When the poll loop ends because the group is gone, `:284` probes again, and a `true` result sends `SIGKILL`. If the PID was reused as a new group leader in that gap, an unrelated group is killed. The window is very small. Found by reading; not reproduced.
- **Fix instruction**: Record the first "gone" result in a local variable, return `[]` immediately, and send `SIGKILL` only if no probe has reported the group gone.

### Examined and accepted
- **Size**: confirmed +583/-59 = 524 net non-test lines (537 with README). Not a verdict factor. Nothing large is clearly removable; the only easy saving is the repeated signal/exit handling at `dev-prod.mjs:345-349` and `:357-361` (about 5 lines). The fixes above add a small amount. A split would still separate the launcher from its stop guarantees.
- **Scope (R4)**: every changed file is in the plan; no High path changed; `package.json` and the lockfile are unchanged (`pg` is an existing dependency).

### Rules (CLAUDE.md)
- R5: not satisfied until Issues 1 and 2 are fixed (the stop logic has an untested failing path).
- R1, R2, R3, R4, R6, R7: no violations found.

### Nits (do not block)
- `dev-prod.mjs:364-369`: a root exit or signal during the blocking owner check can still print the URL just before the stop (carried from Attempt 1).
- `dev-process.mjs:220`: `rootEnd` has millisecond resolution, so a direct child started in the same millisecond as the root's exit could be dropped.

### Not verified
- Real `winpty` path and real Ctrl-C in mintty or a Windows console.
- Windows console stdin handoff from the raw-mode org prompt to the `dev-token` child.
- Real `next dev` process shape, so how often Issue 1 occurs with real Next workers is unknown; the defect itself is shown with a fake tree.
- Real sign-in, tunnel, production login and `/api/readyz` (forbidden here).
- POSIX real-tree behaviour on this Windows machine (CI covers Linux). `pnpm test:db` (CI).

### Follow-ups (out of scope)
- Tunnel port identity check and a minimal helper env, as already excluded by the orchestrator.

### Blockers from review agents (added by orchestrator, 2026-11-21)
From `security-review.md` Attempt 2. Fix these in REWORK attempt 3, together with the reviewer's issues above:
- 🔴 R1: same defect as reviewer blocker 2. Also keep the last known survivors, and say the app may still be running on port N when a stop is unconfirmed.
- 🟡 R2: bound the `checkDb` close with a timer.
- 🟡 R3: remove every `PG*` key (any letter case) from the child and check environments, and refuse those keys in the `.env*` preflight.
- 🟢 N3: a permanent `error` listener and a guarded `killRoot`.

Not in attempt 3: N4, N5, tunnel port identity and minimal helper env.

## Attempt 3 — 2026-11-21
Verdict: REWORK

Reviewed at `cb3135f`.

### Checks (run by reviewer)
Node v22.23.5, on `ticket/SIM-032`.
- `pnpm format:check` — exit 0, "All matched files use the correct format."
- `pnpm typecheck` — exit 0
- `pnpm check:layers` — exit 0, "check-layers: 234 files, no violations"
- `pnpm test` — exit 0, Test Files 98 passed (98), Tests 1034 passed | 3 skipped (1037)
- `pnpm build` — exit 0
- `pnpm check:dev-bundle` — exit 0, "no dev-token strings in .next/static"
- `bash -n scripts/start-dev.sh` — exit 0
- `pnpm test:db` — not run, left to CI as instructed. shellcheck — unavailable, not downloaded (AC7 allows this).

The implementer's reported check results match this run.

### Attempt 2 issues and review-agent blockers
| Issue | Result | Evidence |
|---|---|---|
| 1 mid-tree exit during or before stop | PARTLY FIXED | Root -> mid -> leaf is fully stopped in both timings (real fake tree). A remembered survivor's newer child is missed: Issue 1 below |
| 2 / R1 failed first snapshot | FIXED | First snapshot unreadable, later ones work: `rooted false`, stop `[]`, root, mid and leaf gone |
| R1 last known survivors | PARTLY FIXED | When every stop snapshot fails, only the dead root is reported while mid and leaf live: Issue 2 below |
| R1 unconfirmed message with port | FIXED | `dev-prod.mjs:320`, test `dev-prod.test.ts:960` |
| 3 POSIX `ESRCH` | FIXED | Real stop logic with `process.kill` stubbed: `ESRCH` first gives calls `0`; after SIGTERM gives `0,SIGTERM,0`, with no later probe or SIGKILL. `EPERM` stays unconfirmed after SIGKILL |
| R2 bounded `checkDb` close | FIXED | Real source against fake Postgres on ephemeral loopback ports: normal 37 ms; server ignoring Terminate and close 2012 ms, `ok`, socket closed; `28P01` 2 ms; silent server 5015 ms. One connection each |
| R3 `PG*` removal and refusal | FIXED | `dev-prod.mjs:98-99`, `:197-204`, `:441`; tests from `dev-prod.test.ts:602`, including lowercase keys |
| N3 error listener, guarded `killRoot` | FIXED | `dev-process.mjs:262`, `:292-298`; a late child `error` event caused no uncaught exception |

### Acceptance criteria
- [x] AC1 Full flow — `dev-prod.test.ts:307`, passes.
- [x] AC2 Preflight refusals — tests pass; `PG*` refusal names file and key only.
- [x] AC3 Failed sign-in starts nothing — tests pass.
- [x] AC4 Org flow — tests pass.
- [ ] AC5 Failed readiness stops the child — NOT MET in the Issue 1 case (same stop path).
- [ ] AC6 Ctrl-C leaves no child — NOT MET, Issue 1. The tunnel part is met.
- [x] AC7 No secret in output, argv or a repo file — fixed messages; Checks green.

Ming verification after merge (not verified here; carry on the PR):
1. Take a `pg_dump` of `simap`, kept outside the repo, before the first run.
2. In Git Bash (mintty), run `scripts/start-dev.sh` with no token file: email, password and DB password hidden, URL, warning, red badge, `/api/readyz` = 200.
3. Ctrl-C: port free, no `next dev` node process remains, `pg-tunnel-pg-tunnel-1` still running.
4. Repeat once in PowerShell or Windows Terminal.

### Issues
#### Issue 1 — 🔴 blocker — stop confirms success while a child of a remembered survivor runs
- **Where**: `scripts/dev-process.mjs:277-290` (`winTree` adds live `known` members but not their descendants).
- **Expected**: AC5 and AC6: every process in the tree is stopped, and `[]` is returned only when that is true.
- **Actual**: Root -> mid -> leaf, `owner()`, leaf starts a new child, mid exits, `stop()`. Result in 3 of 3 runs: `stop []`, new child alive. Control with mid still running: new child stopped. That process inherits the production `DATABASE_URL`, and the launcher reports a clean stop.
- **Fix instruction**: In `winTree`, for each `known` member still in the table with the same PID and start, add it and `descendantsOf(snap.procs, member)` to the tree (deduplicated by `pid:start`), then record the whole tree in `known`. Do not traverse from dead members. Add a real-tree test for the sequence above. A scratch copy with this change stopped the new child in 3 of 3 runs, and the mid-exit and failed-snapshot scenarios still passed.

#### Issue 2 — 🟡 should-fix — unconfirmed stop omits the known survivors
- **Where**: `scripts/dev-process.mjs:324`.
- **Expected**: Security R1: keep the last known survivors when a stop cannot be confirmed.
- **Actual**: After `owner()` saw root, mid and leaf, with every stop snapshot failing, stop returned only the root PID. The root was dead; mid and leaf were alive. The exit is still non-zero and the message names the port, so this is not a false success.
- **Fix instruction**: Initialise `survivors` from the `known` PIDs when `known` is not empty, else `[child.pid]`. Extend a failed-snapshot test to assert that the live members are listed.

### Examined and accepted
- **Scope (R4)**: every changed file is in the plan; no High path, `package.json` or lockfile change.
- **Size**: not a verdict factor, as instructed.

### Rules (CLAUDE.md)
- R5: not satisfied until Issue 1 is fixed.
- R1, R2, R3, R4, R6, R7: no violations found.

### Nits (do not block)
- `dev-prod.mjs:371-375`: a root exit or signal during the blocking owner check can still print the URL just before the stop (carried).
- `dev-process.mjs:220`: `rootEnd` has millisecond resolution (carried).

### Not verified
- Real `winpty` path, real Ctrl-C in mintty or a Windows console, and the stdin handoff from the org prompt to `dev-token`.
- Real `next dev` process shape, so how often Issue 1 occurs with real Next workers is unknown; the defect is shown with a fake tree.
- Real sign-in, tunnel, production login and `/api/readyz` (forbidden here).
- POSIX real-tree behaviour on this machine (CI covers Linux; the POSIX stop sequence was run with a stubbed `process.kill`). `pnpm test:db` (CI).

### Follow-ups (out of scope)
- Known limit of parent-PID tracking on Windows: if a middle process exits before any full snapshot has seen its child, that child cannot be found and stop returns `[]` (reproduced with a fake tree). Closing this needs a different mechanism, such as a Windows Job Object; Ming should decide whether it is worth it.
- Tunnel port identity check and a minimal helper env, as already excluded by the orchestrator.

### Rework requested by Ming (added by orchestrator, 2026-11-21)
Escalation option 1, REWORK attempt 4: security Attempt 3 T1 and T2 (same defect as reviewer Issue 1), reviewer Issue 2, security N6, and a final app-port check before a stop is reported clean. Other notes stay follow-ups.

## Attempt 4 — 2026-11-21
Verdict: REWORK

Reviewed at `ae897a2` (code from `64717cc`), Ming's approved extra rework (escalation option 1).

### Checks (run by reviewer)
Node v22.23.5, on `ticket/SIM-032`.
- `pnpm format:check` — exit 0, "All matched files use the correct format."
- `pnpm typecheck` — exit 0
- `pnpm check:layers` — exit 0, "check-layers: 234 files, no violations"
- `pnpm test` — exit 0, Test Files 98 passed (98), Tests 1037 passed | 3 skipped (1040)
- `pnpm build` — exit 0
- `pnpm check:dev-bundle` — exit 0, "no dev-token strings in .next/static"
- `bash -n scripts/start-dev.sh` — exit 0
- `pnpm test:db` — not run, left to CI as instructed. shellcheck — unavailable, not downloaded (AC7 allows this).

The implementer's reported check results match this run.

### Approved scope
| Item | Result | Evidence |
|---|---|---|
| T1 retry cannot adopt a reused PID | FIXED | `dev-process.mjs:333-339`; the test passes when the child exits during the retry sleep, and nothing is killed. The test itself is load-sensitive: Issue 2 |
| Reviewer Issue 1 / T2 | FIXED | Attempt 3 reproduction, real fake tree, 5 of 5: `stop []`, leaf and new child gone |
| Reviewer Issue 2 | FIXED | Tree seen once, every stop snapshot failing: stop lists the live child `[29812]` |
| N6 exited root not listed | FIXED | Same run: root PID not listed, root dead |
| Final port check, listener remains | MET | Listener outside the tree: stop `[0]`, listener untouched |
| Final port check, undeterminable | NOT MET | Issue 1 |
| Nothing killed for holding the port | MET | No kill path uses the port result; the foreign listener survived every run |
| `[0]` sentinel | SAFE | Only `dev-prod.mjs:317-321` consumes it, and `filter(Boolean)` removes it from the message. It never reaches `kill`: injected kill saw only the app PID. No test asserts the port-only message (Follow-ups) |
| README limit line | MET | `README.md:57` |

### Acceptance criteria
- [x] AC1 Full flow — `dev-prod.test.ts`, passes.
- [x] AC2 Preflight refusals — tests pass.
- [x] AC3 Failed sign-in starts nothing — tests pass.
- [x] AC4 Org flow — tests pass.
- [ ] AC5 Failed readiness stops the child and exits non-zero — NOT MET when the listener query fails: Issue 1 (same stop path).
- [ ] AC6 Ctrl-C leaves no child — NOT MET under Ming's option 1 condition (clean only if the port has no listener): Issue 1. The tunnel part is met.
- [x] AC7 No secret in output, argv or a repo file — fixed messages; Checks green.

Ming verification after merge (not verified here; carry on the PR):
1. Take a `pg_dump` of `simap`, kept outside the repo, before the first run.
2. In Git Bash (mintty), run `scripts/start-dev.sh` with no token file: email, password and DB password hidden, URL, warning, red badge, `/api/readyz` = 200.
3. Ctrl-C: port free, no `next dev` node process remains, `pg-tunnel-pg-tunnel-1` still running.
4. Repeat once in PowerShell or Windows Terminal.

### Issues
#### Issue 1 — 🔴 blocker — a failed listener query is reported as a clean stop
- **Where**: `scripts/dev-process.mjs:204` with `:259-262` and `:381`; POSIX equivalent at `:242`.
- **Expected**: Option 1: clean only when the port has no listener; a remaining or undeterminable listener gives a non-zero exit naming the port.
- **Actual**: The Windows script runs `Get-NetTCPConnection` under `$ErrorActionPreference='SilentlyContinue'`, then prints `END`. A failed query therefore looks the same as "no listener": `listeners` is `[]` and stop returns `[]`. Reproduced with a scratch copy changing only that cmdlet name to a failing command, with a real listener on the port: stop `[]`, listener still up. The unmodified code returns `[0]` for the same listener. The injected `() => null` test does not cover this, because the real query never returns null here. A natural cmdlet failure was not reproduced (removing the module path did not disable it). On POSIX, `run()` accepts `lsof` status 1, which is both "no match" and an error (by reading; not run).
- **Fix instruction**: Make the default final check use the existing fail-closed `portBusy`: `listeners = async (port) => ((await portBusy(port)) ? null : [])`, and at `:381` use `if ((await listeners(port))?.length === 0) return [];`. Keep `owner()` unchanged. Add a test where the port is held and the process-table read succeeds with no `L` line, expecting `[0]`. A scratch copy with this change returned `[0]` with the failing query and a live listener, and `[]` on a free port.

#### Issue 2 — 🟡 should-fix — the new T1 test fails under CPU load
- **Where**: `scripts/dev-process.test.ts`, "the child exits during the first-snapshot retry".
- **Expected**: The test passes regardless of machine load.
- **Actual**: 12 of 12 passed idle; 8 of 12 passed with 32 CPU spinners (`expected [ 31964, 31964, 31964 ] to deeply equal []`). The test assumes the child exits within the 300 ms sleep. When it is still alive, adopting it is correct, so this is a test defect and not a product defect.
- **Fix instruction**: Make the order deterministic: on the second injected snapshot, wait (bounded, about 10 s) until the child PID is gone before returning `null`, so the exit lands during the retry sleep. Repeat the test under load.

### Rules (CLAUDE.md)
- R5: not satisfied until Issue 1 is fixed.
- R1, R2, R3, R4, R6, R7: no violations found. Every changed file is in the plan; no High path changed.

### Blockers from review agents
Not assessed here: `security-review.md` has an uncommitted Attempt 4 update from a parallel run, which this review did not read. The orchestrator merges its findings.

### Nits (do not block)
- `dev-prod.mjs:371-375`: a root exit or signal during the blocking owner check can still print the URL just before the stop (carried).
- `dev-process.mjs:220`: `rootEnd` has millisecond resolution (carried).
- `dev-process.mjs:340`: when every stop snapshot fails, the listed PIDs may include members that already exited.

### Not verified
- Real `winpty`, real Ctrl-C in mintty or a Windows console, and the stdin handoff from the org prompt to `dev-token`.
- Real `next dev` process shape, sign-in, tunnel, production login and `/api/readyz` (forbidden here).
- POSIX final port check on a real host. `pnpm test:db` (CI).

### Follow-ups (out of scope)
- Accepted limit (option 1): a hidden child holding no port that no snapshot saw can survive. A Windows Job Object would close it if a real run shows survivors.
- Add a `run()` test for the port-only message (`[0]`, no `PIDs:` text).
- `dev-prod.mjs:389`: the `finally` stop passes no port and ignores the result; that path already exits 1.
- N4, N5, N7, N8, tunnel port identity, minimal helper env (unchanged).

### Rework requested by Ming (added by orchestrator, 2026-11-21)
Second escalation, option 1, REWORK attempt 5: security Attempt 4 U1 (same defect as the reviewer's Attempt 4 blocker) and the flaky T1 test. N9, N10 and other notes stay follow-ups.
