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
