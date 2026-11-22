# Security review — SIM-032

## Attempt 1

Verdict: REWORK

Security review of SIM-032, attempt 1. There are 2 blockers, both in the Windows stop path: the launcher can exit while the app still runs with the production `DATABASE_URL`. I read the code only and ran nothing, so the PowerShell and process behaviour below is reasoned, not observed.

### Findings

#### 🔴 S1. A failed process snapshot means the app is never killed
- **Where:** `d:\project\simap-game-ui\scripts\dev-process.mjs:245-246`, `:266-267`, `:273-274`; reached from `d:\project\simap-game-ui\scripts\dev-prod.mjs:308-310`.
- **Risk:** if the root identity was not recorded, or a snapshot returns null (WMI error, 20 s timeout, PowerShell killed), `stopTree` returns `[child.pid]` without any kill. No code path calls `child.kill()`.
- **Scenario:** the snapshot right after spawn fails, so `rooted` is false. The launcher prints "could not identify the app process: stopped", then "could not confirm...", and exits 1. `next dev` keeps running on the port with the production credentials and the dev-token identity. The word "stopped" is false, and the plan (section 5, step 1) requires stopping the child here. A second Ctrl-C that kills the helper PowerShell during a sweep can reach the same path.
- **Fix:**
  - On any snapshot failure, call `child.kill()` while `!exited`. Node's held handle makes this safe from PID reuse.
  - Retry the snapshot, so the worker that holds the port is also found and stopped.
  - Return unconfirmed PIDs only after that, and change the message so it does not say "stopped".
  - Add a test with a failing snapshot. The current stop-failure test only stubs `stopLeft`.

#### 🔴 S2. An empty snapshot counts as "everything stopped"
- **Where:** `d:\project\simap-game-ui\scripts\dev-process.mjs:193-198`, `:33`, `:268-269`.
- **Risk:** the script sets `$ErrorActionPreference='SilentlyContinue'` and always prints `END`. If `Get-CimInstance` fails, the output is just `END`, PowerShell exits 0, and the parser accepts it as `{procs: [], listeners: []}` (`dev-process.test.ts:27` asserts this).
- **Scenario:** on a readiness or owner failure, `winTree` returns `[]`, so `stopTree` reports success with no kill and no warning. The app stays up on production data. This is worse than S1 because nothing tells Ming.
- **Fix:** in `winSnapshot`, treat a table that does not contain the launcher's own `process.pid` as failed (null). This also catches most partial enumerations. Keep the parser test, and add one for this rule.

#### 🟡 S3. The stop logic can kill an unrelated process after PID reuse
- **Where:** `d:\project\simap-game-ui\scripts\dev-process.mjs:70-74`.
- **Risk:** the reuse guard works only while the process that reused the PID is still alive.
- **Scenario:** root R (PID 10) exits. Unrelated process F gets PID 10, starts G, and exits. G now has `ppid=10`, a start time after R, and no current holder of PID 10, so it is treated as R's orphan and killed. `winKill` confirms G's own identity, but not that G belongs to our tree. The window is short (root exit to the last sweep, a few seconds), but the ticket says this must never happen.
- **Fix:** record a FILETIME in the `child.once("exit")` handler. Node holds the process handle until then, so the PID cannot be reused earlier. Accept direct children of a dead root only when `p.start <= rootExitedAt`, and add the F/G case to the `descendantsOf` tests.

#### 🟡 S4-W. `CDPATH` can make the wrapper run another project's launcher
- **Where:** `d:\project\simap-game-ui\scripts\start-dev.sh:5`.
- **Scenario:** with `CDPATH=~/project` and a `~/project/scripts` directory, running `scripts/start-dev.sh` makes `cd "scripts/.."` resolve to `~/project`. The wrapper then runs `~/project/scripts/dev-prod.mjs`, and Ming types their Identity and production DB passwords into the wrong script.
- **Fix:** `CDPATH= cd -- "$(dirname -- "$0")/.."`

#### 🟡 S5. A wrong DB password causes about 15 failed production logins per run
- **Where:** `d:\project\simap-game-ui\scripts\dev-prod.mjs:314-345`, with `src/app/api/readyz/route.ts:13`.
- **Risk:** every probe opens a new authentication attempt, and a 503 for `28P01` looks the same as a compile delay. The loop therefore retries every 2 s for 30 s, and each re-run adds about 15 more. The plan accepted this count, but it did not check for lockout or fail2ban rules on the shared mmlabs Postgres. The repo cannot answer that.
- **Fix:** preferably make one `pg` authentication check in the launcher before starting the app, and stop on `28P01`. If that is too much for this ticket, Ming should confirm no lockout applies, and this becomes a follow-up.

#### 🟢 Notes
- **N1. Probe deadline:** `dev-process.mjs:151,164` uses an idle timeout, so a server that drips bytes can hold a probe past the 30 s limit. No URL is printed. Next normally exits on a port conflict, so this is hard to reach. An absolute timer fixes it.
- **N2. POSIX stop:** `dev-process.mjs:256-261` returns `[]` after SIGKILL without confirming, and an ESRCH race surfaces as "unexpected error". This does not affect Ming's Windows path.

### Follow-ups (outside this ticket)
- **Tunnel port identity (pre-existing, SIM-029):** `dev-prod.mjs:265-269` checks only that TCP connects on the tunnel port. A local process holding `127.0.0.1:15432` would receive the DB login, and `pg` answers a cleartext password request. Consider verifying the listener or refusing non-SCRAM authentication.
- **Inherited shell variables:** helpers inherit the launcher's `process.env`. The prompted password and built URL are not in it, but a `DATABASE_URL` or `PGPASSWORD` already exported in the shell does reach `docker`, PowerShell and `dev-token`. Passing helpers a minimal env would close this.

### What I checked
1. **Secrets: pass.** The password and URL exist only in the `childEnv` object passed to the app. They are not in argv (`winpty`, PowerShell, `lsof`, `ps`, docker), stdout, stderr or a repo file. The readyz route logs only an error code.
2. **Process kill: S1, S2, S3.** The PowerShell strings contain only parsed integers, so I found no injection. The 10-microsecond tolerance is safe: a reused PID must start after the recorded process was seen alive, and `.Handle` pins the process before the comparison.
3. **Port and readiness: pass (N1).** The probe is `127.0.0.1` only, follows no redirects, sends no token or cookie, and bypasses env proxies. Mixed, foreign and unknown owners all fail closed. `--port` is always explicit, so Next's `allowRetry` is false (`next-dev.js:302`, `start-server.js:248`).
4. **Preflight: pass.** All refusals run before sign-in, and `DATABASE_URL` is matched in any letter case across the four files. The edit-during-session gap is the known S4; moving the checks earlier makes that window longer, because it now includes sign-in.
5. **Org flow: pass.** A typed org must be a canonical UUID and is only a request to Identity. The post-sign-in org must match, and the pin comes from that checked token. A case-variant `.env` key should not displace the org or issuer pin on Windows, because `@next/env` `expand` reads the existing `process.env` value first. That is from reading the code, not a run.
6. **Failure cleanup: S1, S2, S5.** Every path calls `stop`, and nothing calls `docker stop`, so the tunnel is left alone.
7. **Wrapper: S4-W.** Arguments are quoted and the launcher allowlists them. No secret passes through the wrapper.

### Limits
- I did not run the tests, PowerShell, `winpty`, real Ctrl-C, Next or the tunnel. The implementer's check results are from `impl-log.md`.
- Console-close behaviour under `winpty`/mintty is unverified and stays on Ming's manual list.
- I did not read any `.env*` file, the real dev-token file or `.next` output.
- SIM-028.1 S4, F4 and F6 were not re-reported as findings.

## Attempt 2

Verdict: REWORK

Security review of SIM-032, attempt 2. There is 1 blocker: S1 is only partly closed, so a failed process snapshot can still leave the Next.js server running on production credentials. The new `checkDb` is sound on secrets, target and login count, with 2 should-fix items. I read the code only and ran nothing.

### Findings

#### 🔴 R1. S1 is partly open: the fallback kills the Next parent and can orphan the server that holds the port
- **Where:** `d:\project\simap-game-ui\scripts\dev-process.mjs:266-267`, `:295-298`, `:302-305`, `:313`; reached from `d:\project\simap-game-ui\scripts\dev-prod.mjs:326-328`.
- **Why it happens:**
  - `child` is the Next CLI. The HTTP server is a forked process (`node_modules\next\dist\cli\next-dev.js:393`).
  - The CLI's cleanup is a `process.on('exit')` handler (`next-dev.js:205-206`). `child.kill()` on Windows is TerminateProcess, so I expect that handler not to run.
  - I found no `disconnect` handler in `start-server.js` or `router-server.js`, so the worker should keep serving after its parent dies.
- **Scenario:**
  1. The first snapshot hits the 20 s PowerShell timeout on a busy machine, so `root` is null. Next has had time to fork.
  2. `stopTree` calls `killRoot()` and returns `[child.pid]` with no retry, although attempt 1 asked for one.
  3. The CLI dies and the worker keeps listening with the production `DATABASE_URL` and the dev-token identity.
  4. Ming sees "could not confirm" with the PID of the dead parent, not the live worker, so the message gives them nothing to act on.
- **Same gap with a known root:** if all 4 sweeps fail, line 313 returns only `child.pid`, dropping any PIDs seen in an earlier sweep.
- **Test gap:** the test at `d:\project\simap-game-ui\scripts\dev-process.test.ts:251-274` uses a child with no grandchild and starts with `rooted === true`, so it cannot catch this.
- **Fix:**
  1. When `root` is null and `!exited`, retry the snapshot a bounded number of times **before** any kill. While `!exited`, Node's handle pins the PID, so a row with `pid === child.pid` is ours. Record its start time and use the normal sweep.
  2. Call `killRoot()` only after those retries fail.
  3. Keep the last known `left` and return it if later snapshots fail.
  4. In the unconfirmed case, say the app may still be running on port N and must be stopped before continuing.
  5. Add a Windows test with a real grandchild and a failing first snapshot.

#### 🟡 R2. `checkDb` close has no deadline
- **Where:** `d:\project\simap-game-ui\scripts\dev-prod.mjs:413`.
- **Risk:** `connectionTimeoutMillis` is cleared on login success and on a server error (`pg\lib\client.js:377`, `:406`). `client.end()` then waits for the socket `close` event with no timer (`client.js:826-834`).
- **Scenario:** the tunnel stalls right after the login reply. The launcher hangs at the check with a socket open and no message. It fails safe: no app has started, and Ctrl-C still ends it because no signal handler is registered yet.
- **Fix:** race `client.end()` against a timer of about 2 s, then call `client.connection.stream.destroy()`.

#### 🟡 R3. `PGOPTIONS` and other `PG*` values still reach the production session
- **Where:** `d:\project\simap-game-ui\scripts\dev-prod.mjs:33-44`, `:100`, `:397-405`.
- **Risk:** `pg` reads `PGOPTIONS`, `PGREPLICATION`, `PGCLIENT_ENCODING`, `PGBINARY`, `PGSSLNEGOTIATION` and `PGAPPNAME` when the config leaves them unset (`pg\lib\connection-parameters.js:9-23`, `:83`, `:104`, `:114-119`). `PGOPTIONS` is sent at startup (`client.js:567-569`). None of them is in `PG_VARS`.
- **Scenario:** a leftover `PGOPTIONS=-c search_path=...` in the shell or a `.env*` file makes the app read and write a different schema on production. A value in `.env*` reaches only the app, because Next loads it there, so the login check does not exercise the same session settings.
- **Windows detail:** line 100 deletes exact names from a plain object copy, so `pgsslmode` survives and Windows then treats it as `PGSSLMODE`.
- **Fix:** remove every key matching `/^PG/i` from the child env and from the launcher's `process.env` before `checkDb`. Refuse those keys in the `.env*` preflight, naming only the file and key.

#### 🟢 Notes
- **N3. Repeated kill error:** `child.once("error")` at `dev-process.mjs:259` handles one event. A second non-ESRCH `child.kill()` error would throw through `stop`, and Ming would see "unexpected error" with no warning that the app may be up. Use a permanent no-op `error` listener and a `try/catch` in `killRoot`. This relies on my knowledge of Node's `kill` behaviour.
- **N4. POSIX PID reuse:** `posixStop` signals `-pid` after the child may already be reaped (`dev-process.mjs:281-282`). A new group leader with the same PID could receive the signal. The window is very small and this is not Ming's Windows path.
- **N5. Clock step:** `root.end` uses the wall clock (`dev-process.mjs:220`). A backward clock step in the seconds around root exit could weaken the F/G rule. I accept this.

### Answers to your questions

**1. Status of earlier findings**

| Item | Status | Evidence |
|---|---|---|
| S1 | **Partly open (R1)** | Kill now happens, but the worker can survive and the wrong PID is reported |
| S2 | Closed | Snapshot needs the launcher's own PID (`dev-process.mjs:36`, `:207`) |
| S3 | Closed | `root.end` rule (`:79`); non-root members are always live rows |
| S4-W | Closed | `start-dev.sh:5` |
| S5 | Closed | One check, no retry, no app on failure (`dev-prod.mjs:284-298`) |
| N1 | Closed | Hard timer (`dev-process.mjs:156`) |
| N2 | Closed | Only ESRCH means gone; polls after SIGKILL (`:223-238`, `:284-288`) |

Every failure path calls `stop` or reports non-zero. The gap is that the unconfirmed report in R1 names the wrong process.

**2. `child.kill()` and `root.end`**
- The kill cannot hit a foreign process. It goes through Node's held handle and is skipped after `exit`.
- The `root.end` rule holds, because the time is recorded in the exit callback while the handle still pins the PID.
- A root that exits before the first snapshot gives `root = null`, which stops and reports unconfirmed. No foreign process is touched, but any orphan is not found (R1).

**3. `checkDb`**
- **Secrets:** the password is not in argv, logs or errors. Only `e.code` is kept, and messages are fixed. No URL is built for the check.
- **Target:** host, port, user, database and password are explicit and truthy, so `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE` and `PGPASSWORD` are ignored.
- **`.pgpass`:** read only when the password is null (`client.js:295-306`), which cannot happen here.
- **`PGSSLMODE`:** ignored because `ssl: false` is explicit.
- **Other `PG*` values:** these change session settings, not the target (R3).
- **Closing:** closed on connect failure and on timeout, because the timeout destroys the stream. Only the stalled-peer wait is unbounded (R2).
- **Login count:** exactly one attempt per run.
- **`ssl:false`:** consistent with the app, whose URL has no SSL parameter and whose inherited `PGSSLMODE` is removed. An exact-case `.env*` value or a case variant can still differ (R3).

**4. Same target?** Yes for host, port, user, database and password. Both use `127.0.0.1`, `ports.primary` and `simap`. The password round-trips through `encodeURIComponent` and `pg-connection-string`. Only session options can differ (R3).

**5. Regressions:** none beyond R2 and R3, which come with or are exposed by the new check. `pg-native` is not installed, so `NODE_PG_FORCE_NATIVE` fails closed.

### Limits
- I did not run the tests, PowerShell, `winpty`, Ctrl-C, Next, Postgres or the tunnel.
- Worker survival in R1 is reasoned from Next's source. `impl-log.md` records that in the sandbox a Windows grandchild died with its parent unless detached, so real behaviour needs a test outside that sandbox.
- I did not read any `.env*` file, the real dev-token file or `.next` output.
- Tunnel port identity, minimal helper env, SIM-028.1 S4, F4 and F6 were not re-reported.

## Attempt 3

Verdict: REWORK

Security review of SIM-032, attempt 3. There is 1 blocker, in the new first-snapshot retry: after the child exits, its freed PID can be adopted as our root. That can kill an unrelated process and report the app as stopped. The fix is two lines. R2, R3 and N3 are closed, and R1 is closed except for this path. I read the code only and ran nothing.

### Findings

#### 🔴 T1. The retry can adopt a reused PID as the root
- **Where:** `d:\project\simap-game-ui\scripts\dev-process.mjs:320-323`, with `rootOf` at `:268-271`; reached from `d:\project\simap-game-ui\scripts\dev-prod.mjs:333-335` or `:332`.
- **Cause:** `!exited` is checked before `await sleep(300)`, but the snapshot runs after it with no second check. The sleep is the first time the event loop can deliver the child's exit, and Node then releases the handle that pins the PID.
- **Scenario:**
  1. The Next CLI crashes at startup, or Ctrl-C reaches it, while the snapshot at `:272` runs. `spawnSync` blocks the loop, so `exited` stays false. The row is missing or the snapshot fails, so `root` is null.
  2. `halt` calls `stopTree`. Try `i=0` also finds no row, still with `exited === false`.
  3. Try `i=1` passes the check and sleeps. The exit event fires, `exited` becomes true and the PID is free.
  4. Windows gives that PID to an unrelated process F, or to the helper PowerShell. Line 322 finds the row and sets `root` to it.
- **Impact:**
  - **Unrelated process killed:** F is `alive` at `:278`, so `winKill` at `:350` kills it. Its identity check passes because the recorded identity is F's own.
  - **False "stopped":** the real orphan worker does not match the adopted root. The next clean sweep returns `[]` at `:348`, so no "could not confirm" warning prints while the worker can keep serving on production credentials.
- **Fix:**
  ```js
  for (let i = 0; i < 3 && !root && !exited; i++) {
    if (i) {
      await sleep(300);
      if (exited) break;
    }
    root = rootOf(winSnapshot(0));
  }
  ```
  `spawnSync` blocks the loop, so the handle stays held from this check through `rootOf`. After `break`, `root` is null and the existing path reports unconfirmed with the port.
- **Test gap:** the test at `d:\project\simap-game-ui\scripts\dev-process.test.ts:306-337` keeps the child alive through the retry. Add a case where the child exits during the retry sleep and a later snapshot shows a different process on that PID. It must not be killed, and `stop` must return non-empty. This likely needs an injectable snapshot function.

#### 🟡 T2. Children of a live remembered member are not traversed
- **Where:** `d:\project\simap-game-ui\scripts\dev-process.mjs:281-288`.
- **Scenario:** root -> M -> K is remembered, then M exits, so K is reachable only through `known`. K starts child C after the last read. `winTree` adds K but not C. K is killed, C is orphaned under a dead PID, and the next sweep returns `[]`. C keeps the production env while the stop is reported as clean.
- **Why not 🔴:** it needs a mid-tree exit and a new spawn inside a window of about 1.5 s, and Next's port-holding worker is a direct child of the CLI.
- **Fix:** after adding live remembered members, also add `descendantsOf(snap.procs, m)` for each of them, and record the results in `known`. These are verified live rows, so this does not traverse from a dead member.

#### 🟢 Notes
- **N6. Stale PID in the warning:** when the child has exited and `root` is null, `survivors` is still `[child.pid]` (`dev-process.mjs:324`, `:336-338`). Ming could stop that PID by hand after it was reused. Say the PID has exited, or name only the port in this case.
- **N7. Exception path drops the result:** `dev-prod.mjs:388` discards what `stop()` returns, so an unexpected throw after spawn prints no PIDs or port. I found no reachable throw. Print the same unconfirmed message there.
- **N8. Residual fork race:** a child forked between a read and its parent's kill stays invisible. A final listener check on the app port before reporting success would catch the case that matters most.

### Answers to your questions

**1. Earlier findings**

| Item | Status | Evidence |
|---|---|---|
| R1 | Closed except T1 | Retry before kill, `known`, last survivors, port in message |
| R2 | Closed | `dev-prod.mjs:421-422` |
| R3 | Closed | `dev-prod.mjs:34`, `:98-99`, `:197-204`, `:441` |
| N3 | Closed | `dev-process.mjs:262`, `:294-296` |

**2. Remembered members**
- An entry is killed only if its PID and start time still match, and `winKill` re-checks through a held process handle. A correctly recorded `pid:start` cannot hit a reused PID.
- The exception is T1, where the wrong identity is recorded as root.
- No traversal starts from a dead remembered member. The only dead seed is the root, limited by `root.end`.

**3. Retried first snapshot**
- Adoption at `:272` is safe because the exit cannot have been processed yet. Adoption at `:322` after a sleep is not (T1).
- The retry is bounded to 3 tries, at most about 61 s (3 x 20 s plus 2 x 300 ms).
- Ctrl-C during it is only recorded while `spawnSync` blocks. It may also kill the helper, which counts as a failed try. If it ends the child, it leads into T1.

**4. Unconfirmed stop**
Every `halt` path with a non-empty result prints the PIDs and port and exits non-zero (`code || 1`). The exceptions are T1 (a false empty result), N6 and N7.

**5. `PG*` removal**
- **App child:** every case variant is removed from the copied env.
- **`checkDb`:** keys are deleted from `process.env` in `main()` before `pg` is lazily loaded. `db/target.js` and the `dev*.mjs` scripts do not import `pg` at the top level.
- **`.env*` refusal:** it matches the `@next/env` 16.4.6 line parser for export, spacing, colon form, BOM and case. Keys such as `PG.X` parse but are not `pg` settings.
- **`dev-token` and docker:** `dev-token` reads no `PG*` variable. The docker calls are only `inspect` and `start`, so removal does not affect them.

**6. Regressions:** T1 is new in this attempt. T2 is a gap in the new `known` logic.

### Limits
- I did not run tests, PowerShell, `winpty`, Ctrl-C, Next, Postgres or the tunnel. Check results are the implementer's, from `impl-log.md`.
- T1 relies on Node closing the child handle when it delivers `exit`. That is from my knowledge of Node, not from reading its source here. How quickly Windows reuses a PID was not observed.
- Console-close behaviour is unverified, and a long stop may not finish before Windows ends the process.
- I did not read any `.env*` file, the real dev-token file or `.next` output.
- Tunnel port identity, minimal helper env, N4, N5, SIM-028.1 S4, F4 and F6 were not re-reported.

## Attempt 4

Verdict: REWORK

Security review of SIM-032, attempt 4. There is 1 blocker: the new final port check reads a failed listener query as "no listener", so a stop can be reported clean while the app still serves on production credentials. T1, T2 and root-PID N6 are closed. The fix is about 3 lines plus one test. I read the code only and ran nothing.

### Findings

#### 🔴 U1. A failed listener query counts as "port is free"
- **Where:** `d:\project\simap-game-ui\scripts\dev-process.mjs:201`, `:204`, `:206`, `:261`, `:381`. POSIX variant: `:242`, `:262`.
- **Cause on Windows:**
  - The script sets `$ErrorActionPreference='SilentlyContinue'`, runs `Get-NetTCPConnection`, then always prints `END`.
  - "No matching connection" and a real failure (NetTCPIP module fails to load, `root/StandardCimv2` provider error) therefore produce the same output: no `L` lines, `END`, exit 0.
  - The self-PID guard at `:36` does not help, because the process list comes from a separate query (`Win32_Process`) that can still succeed.
  - The result is `listeners: []`, and `:381` returns `[]`, which means clean.
- **Scenario:**
  1. Root -> M -> W, where W holds the app port. M exits before any snapshot saw W, which is the fork race option 1 documents.
  2. Ming presses Ctrl-C. The sweeps kill what they know, and the next sweep returns empty.
  3. The final check is the only remaining protection, and `Get-NetTCPConnection` fails silently.
  4. `stop` returns `[]`, `halt` prints no warning, and the launcher exits with the plain signal code (130). W keeps serving with the production `DATABASE_URL` and the dev token.
- **Why 🔴:** it needs a hidden survivor plus a query failure, so it is not frequent. But this check is the guarantee Ming approved in option 1 ("report a clean stop only if the app port has no listener"), and here an undeterminable result fails open.
- **POSIX variant:** `lsof` exits 1 both for "no match" and for errors. `run` accepts status 1 (`:242`), so empty stdout becomes `[]`.
- **Test gap:** `dev-process.test.ts:379-381` only injects `() => []` on a free port. No test has an empty listener result while the port is really held.
- **Fix:** require an independent check before reporting clean. `portBusy` (`:146`) already fails closed, never kills, and covers the app's bind, because `-H 127.0.0.1` is always passed (`dev.mjs:33`).
  ```js
  // startApp parameter: busy = portBusy
  for (let i = 0; i < 3; i++) {
    if (listeners(port)?.length === 0 && !(await busy(port))) return [];
    if (i < 2) await sleep(200);
  }
  return [0];
  ```
  Add a test with `listeners: () => []` and a real listener on the port. It must return `[0]` and leave that listener running.

#### 🟢 Notes
- **N9. Stale non-root PIDs can still be printed** (`dev-process.mjs:340`, `:343`, `:350`). Only the exited root is filtered. If W is killed, its PID is reused, and the last snapshot fails, the warning lists that PID and says to stop it. Nothing is killed automatically, but Ming could stop the wrong process by hand. Wording such as "last seen PIDs, verify before stopping" is enough.
- **N10. The port check is point-in-time.** A hidden process that binds after the check is not caught. This falls under the accepted option 1 limit, but the README line at `README.md:57` could say "at the time of the stop".

### Answers to your questions

**1. T1, T2, N6 and freed-PID adoption**
- **T1 closed.** `rootOf` runs only at `:285` and `:338`. At `:338`, `exited` is re-checked after the sleep (`:336`), and `spawnSync` blocks the event loop until the row is read.
- **T2 closed** (`:297-301`). Traversal starts only from members whose PID and start time match a live row.
- **N6 closed for the root** (`:343`). The non-root residual is N9.
- **`known` cannot adopt a freed PID,** because `live()` compares PID and start time, and `winKill` re-checks identity through a held handle.
- **Injectable paths:** production wiring passes none of them (`dev-prod.mjs:430`).

**2. Final port check**

| Case | Result |
|---|---|
| IPv4, IPv6 and wildcard binds | Covered, because the query filters by port only (from cmdlet knowledge, not run) |
| Wrong port | Not reachable: `validPort` allows 1-65535, so port 0 cannot skip the query |
| Helper timeout, non-zero exit, malformed or cut-short output | `null`, then `[0]`: fails closed |
| **Failed `Get-NetTCPConnection`** | **`[]`: fails open (U1)** |
| **`lsof` error with exit 1 and empty output** | **`[]`: fails open (U1)** |
| Kills anything | No, it only reads |

**3. `[0]` sentinel:** safe. It is only ever a return value. `kill` receives member objects from `look()`, and `halt` removes 0 with `filter(Boolean)` before printing (`dev-prod.mjs:319`).

**4. Stop reporting:** every `halt` path, including Ctrl-C, prints a warning and exits non-zero when the result is non-empty (`code || 1`). The exception is the false empty result in U1. The `finally` path is the known N7.

**5. Injectable parameters:** reachable only from tests. `spawnNext` passes a fixed set of fields, `run` deps are built in `main`, and argv goes through the port-only allowlist. No env value maps to them.

**6. Regressions:** U1 is the only blocking issue in the changed lines. `dev-prod.mjs` changes are limited to passing `port` and the message.

### What I checked
- `scripts/dev-process.mjs` and `scripts/dev-prod.mjs` in full.
- `validPort` and `nextDevArgs` in `scripts/dev.mjs`.
- The final-port and T1 tests in `scripts/dev-process.test.ts`.
- `ticket.md`, `escalation.md`, Attempt 3 of `security-review.md`, and Attempt 4 of `impl-log.md`.

### Limits
- I ran no tests, PowerShell, `lsof`, Ctrl-C, Next, Postgres or the tunnel. Check results are the implementer's, from `impl-log.md`.
- U1 is reasoned from the script and standard PowerShell error handling. I did not reproduce a `Get-NetTCPConnection` failure, and I cannot say how often one occurs on Ming's machine.
- The PID-pinning reasoning relies on my knowledge of Node and Windows handle behaviour.
- I did not read any `.env*` file, the real dev-token file or `.next` output.
- N4, N5, N7, tunnel port identity, minimal helper env, SIM-028.1 S4, F4 and F6 were not re-reported.

## Attempt 5

Verdict: PASS

Security review of SIM-032, attempt 5. U1 is closed: a stop is now reported clean only when `portBusy` finds the app port free, and a failed listener query can no longer clear it. I found no 🔴 or 🟡 issues, only 2 🟢 notes. I read the code and ran nothing.

### Findings

#### 🟢 V1. A slow refused connect reads as "busy", so a clean stop can show a false warning
- **Where:** `d:\project\simap-game-ui\scripts\dev-process.mjs:124`, `:126`, `:147`, `:377-382`
- **Scenario:** Windows can retry a refused TCP connect for a noticeable time. If a refusal takes 2 s or more on a loaded machine, the timeout at `:126` returns busy. After 3 tries, stop returns `[0]`, and Ming sees "could not confirm" although the port is free.
- **Impact:** this fails closed, with no leak and no kill. It can also make a normal stop take several seconds. The final-port test reportedly passes, so this is not happening routinely, but I did not measure the refusal time.
- **Fix (optional, follow-up):** measure it on Ming's machine. If it is near 2 s, use a longer connect timeout for the loopback probe. Keep timeout = busy.

#### 🟢 V2. No test isolates the bind branch of `portBusy`
- **Where:** `d:\project\simap-game-ui\scripts\dev-process.mjs:137-143`, `:148`; `d:\project\simap-game-ui\scripts\dev-process.test.ts:373-378`
- **Scenario:** the busy and "blind query" tests use a healthy listener, so `connects` returns true and `bindFails` never runs. A later regression in `bindFails` would pass those tests, and it matters in the one case where connect is refused while a listener still exists (full backlog).
- **Fix (optional, follow-up):** extract the probes behind a test seam, or add a case where connect reports refused while the port is bound.

### Answers

**1. Is U1 closed? Yes.**
- **The clean path needs all of these** (`:376-379`): the tree stop returned empty, `port` is an integer, the listener query returned `[]`, and `portBusy` returned false. Any other result ends in `[0]`, and `halt` warns and exits non-zero (`dev-prod.mjs:318-323`).
- **The app's bind is covered.** `nextDevArgs` always passes `-H 127.0.0.1` and dev:prod always passes an explicit `--port` (`dev.mjs:33`, `dev-prod.mjs:149`). Next listens on that host and port (`start-server.js:430`), and an explicit port disables its port retry (`next-dev.js:302`).
- **A live listener cannot read as free.** A normal listener accepts the connect. If its backlog is full and connect is refused, the exclusive-address bind on `127.0.0.1:port` still fails.
- **Error paths fail closed:**

| Probe result | Outcome |
|---|---|
| Connect succeeds or times out | Busy |
| Any connect error except `ECONNREFUSED` | Busy |
| `EADDRNOTAVAIL` or `EAFNOSUPPORT` | Treated as free only for `::1`, and the `127.0.0.1` connect and bind must still pass |
| Any bind error | Busy |
| Synchronous throw on an invalid port | Not reachable, because `validPort` allows only 1-65535. If it did occur, the launcher exits 1 with "unexpected error", never a clean stop |

- **`bindFails` should not hang.** `close` runs in the `listening` callback, before the event loop can accept a connection.

**2. Effect on a foreign listener: none of concern.**
- **Sends:** a TCP connect and close only, with no application bytes, credentials or token.
- **Holds:** the bind runs only after both connects were refused, and closes at once. A process binding in that instant could get `EADDRINUSE`, which is harmless and very unlikely.
- **Kills:** nothing. The port result never feeds `kill`, and the test confirms a real listener stays up (`dev-process.test.ts:373-379`).

**3. No-op default `listeners`: no protection lost.**
- The parameter is read only at `:379`. The only production caller is `spawnNext` (`dev-prod.mjs:430`), which does not pass it.
- `owner()` does not use it. On Windows it reads `snap.listeners`, and on POSIX its own block-scoped `listeners` from `lsof` (`:402`).
- A silently empty result in `owner()` gives `"unknown"` through `classifyOwner` (`:91`), and `dev-prod.mjs:372` then stops the app. So U1's failure mode does not carry over there.

**4. Regressions in the changed lines: none blocking.** The `[0]` sentinel, retry bound and `halt` reporting are unchanged in behaviour. The T1 test change affects only the test. Its injected `kill` records PIDs, and the real kill targets only its own child.

### What I checked
- `scripts/dev-process.mjs` and `scripts/dev-prod.mjs` in full.
- `validPort` and `nextDevArgs` in `scripts/dev.mjs`.
- The `portBusy`, final-port and T1 tests in `scripts/dev-process.test.ts`.
- All `startApp`, `portBusy` and `.owner(` call sites under `scripts`, `src` and `db`.
- Next's listen and retry lines in `node_modules`.
- `security-review.md`, `escalation.md` and Attempt 5 of `impl-log.md`.

### Limits
- I ran no tests, PowerShell, `lsof`, Ctrl-C, Next, Postgres or the tunnel. The green checks are the implementer's, from `impl-log.md`.
- I had no git tool, so I reviewed the current code and the impl-log's description of the change, not a literal diff.
- Bind-conflict and refused-connect behaviour on Windows comes from my knowledge of Node, libuv and Winsock. I did not observe it.
- The accepted option 1 limit remains: a hidden child holding no port can survive, and the port check is point-in-time.
- I did not read any `.env*` file, the real dev-token file or `.next` output.
- N4, N5, N7, N9, N10, tunnel port identity, minimal helper env, SIM-028.1 S4, F4 and F6 were not re-reported.
