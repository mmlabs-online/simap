Status: READY

# Plan — SIM-032: One-command local start on production data

## Scope summary
From `work/tickets/SIM-032/ticket.md`:

> Ming starts simap on production data with one command, `scripts/start-dev.sh`, without filling in `.env.local`. The
> command signs in, connects through the tunnel, starts the app, and prints the local URL with a clear production warning.

> Add `scripts/start-dev.sh` as a thin wrapper around `scripts/dev-prod.mjs`. Extend that launcher; do not replace it.

> Run every read-only preflight check before sign-in and before the tunnel starts: required tools and all `.env*` refusals.

> Refuse `DATABASE_URL` in any of the four `.env*` files, not only `.env.local`.

> Work without `--org`: reuse the org of the existing token, else ask for the org UUID once and pass it to `dev:token`.

> After start, wait for `/api/readyz` (30 s max), verify that the process we started is alive and owns the port, then
> print the local URL and `PRODUCTION DATA: every change is real.` A failed readiness check stops the child.

> Ctrl-C or any exit stops every child process, including on Windows, and leaves the tunnel running.

From `work/decisions.md` D56:

> The production DB is reachable from dev only through the pg-tunnel with the URL given at runtime, and dev scripts refuse it.

CLAUDE.md R3: "no secrets in code, logs or client bundles". Out of scope, per the ticket: a separate API process, a new
proxy, encryption keys, SIM-028.1 follow-ups S4/F4/F6, and migrations, seeds, resets or destructive SQL.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | With no `.env.local`, the command runs the full flow in stubbed tests: sign-in, tunnel, DB password, app, readiness, URL and warning | `dev-prod.test.ts › full flow without .env files`; `start-dev.test.ts › hands off to dev-prod.mjs with the arguments` |
| 2 | A `.env*` refusal, missing tool or busy port exits non-zero before any sign-in prompt, tunnel start or password prompt, names the file or port, prints no value | `dev-prod.test.ts › preflight` group (trace has no `org prompt`, `dev-token`, `docker`, `prompt`, `spawn`) |
| 3 | A failed sign-in starts no tunnel or app and asks for no DB password | existing `token still stale or dev-token fails`, plus `failed sign-in after the org prompt starts nothing` |
| 4 | No usable token and no `SIMAP_DEV_ORG`: asks once, validates, passes to `dev:token`; a fresh token's org is reused without asking | `dev-prod.test.ts › org flow` group |
| 5 | Readiness timeout, early child exit or a port owned by another process stops the child and exits non-zero | `dev-prod.test.ts › after start` group; `dev-process.test.ts › classifyOwner` |
| 6 | Ctrl-C leaves no child, including the Next.js tree on Windows, and does not stop the tunnel | `dev-prod.test.ts › stop signal`; `dev-process.test.ts › real tree` (real processes, on Windows locally and Linux in CI); real Ctrl-C is under Ming verification |
| 7 | No password, token or `DATABASE_URL` in stdout, stderr, process arguments or a repo file; Checks green; `bash -n` passes; shellcheck passes or is recorded unavailable | `dev-prod.test.ts › secrecy across every helper call`; existing `source has no file-write API` extended to the new module; all Checks; `bash -n scripts/start-dev.sh` using Git Bash; impl-log records "shellcheck unavailable, not downloaded" |

## Ming verification after merge
Needs M-1, M-3 and the real tunnel. Agents never run this.

1. Take a `pg_dump` of the `simap` database and keep it outside the repo before the first run.
2. In **Git Bash (mintty)**, run `scripts/start-dev.sh`. Confirm that the email, password and DB password are hidden
   (the `winpty` path), then the URL, `PRODUCTION DATA: every change is real.`, the red badge and `/api/readyz` = 200.
3. Press Ctrl-C. Confirm the port is free (`netstat -ano | findstr :3000` shows no `LISTENING`), no `next dev` node
   process remains, and `docker inspect -f '{{.State.Running}}' pg-tunnel-pg-tunnel-1` is still `true`.
4. Repeat steps 2 and 3 once in PowerShell or Windows Terminal (via Git Bash there, or `pnpm dev:prod`).

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `scripts/start-dev.sh` (new, mode 100755, `git add --chmod=+x`) | Thin wrapper: `cd` to the root, pick a terminal path, `exec` the launcher | Ticket scope | No |
| `scripts/dev-process.mjs` (new) | Process table, tree identity, owner check, tree stop, tool check, port-busy check, readiness probe, `startApp` | Keeps platform I/O testable and out of `run()` | No |
| `scripts/dev-process.test.ts` (new) | Pure parsers and tree rules, plus a real fake process tree | AC5, AC6 | No (Low) |
| `scripts/start-dev.test.ts` (new) | Runs the wrapper under bash with a stub `node` | AC1, AC2 | No (Low) |
| `scripts/dev-prod.mjs` | Lines 116-250 `run()` reordered and extended; lines 261-271 `spawnNext` replaced by `startApp`; lines 273-311 `main()` deps | Ticket scope | No |
| `scripts/dev-prod.test.ts` | Harness and the tests listed below | AC1-AC7 | No (Low) |
| `README.md` | Lines 49-68: short one-command section, updated order, manual list with `pg_dump`; line 25: Git Bash note | Ticket scope | No |

**No High path is needed; Gate stays `none`.** Checked against `.github/risk-tiers.yml`. No change to `.env.example`,
`package.json`, `scripts/dev.mjs`, `scripts/dev-token.mjs`, `src/**` or `/api/readyz`.

## Data model / migration
None.

## API contract
None. `/api/readyz` is only consumed, unchanged.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `dev-prod.test.ts › full flow without .env files` (exact trace: env check, tools, port, token check, dev-token, token check, docker inspect, probe, prompt, spawn, ready, owner, then URL and warning) | AC1 |
| `› preflight: DATABASE_URL in each of the four files, any letter case: exit 2, names the file, no value` | AC2 |
| `› preflight: every existing refusal (org, issuer variant, dev-prod flag, read failure) still exits 2 and now precedes token, docker and prompts` | AC2 |
| `› preflight: missing tool exits 1 and names it, nothing started` | AC2 |
| `› preflight: busy port exits 1 and names it, nothing started` | AC2 |
| `› preflight: explicit --port is always passed to next (argv, PORT env, default 3000); invalid PORT exits 1` | AC2 |
| `› org flow: fresh token reused, no prompt, no sign-in` | AC4 |
| `› org flow: stale token with valid org passes that org to dev:token, no prompt` | AC4 |
| `› org flow: no usable org prompts exactly once and passes the lowercased UUID` | AC4 |
| `› org flow: invalid or empty answer exits 1, no re-prompt, no sign-in, answer not printed` | AC4 |
| `› org flow: SIMAP_DEV_ORG set: no prompt, dev:token called with no org argument` | AC4 |
| `› org flow: token from sign-in for a different org than requested exits 1` | AC3, AC4 |
| `› failed sign-in after the org prompt starts nothing` | AC3 |
| `› after start: readiness timeout stops the child, exit 1, no URL` | AC5 |
| `› after start: 503 keeps polling at 2 s, then a 200 proceeds` | AC5 |
| `› after start: early child exit stops the tree, exit 1, no URL` | AC5 |
| `› after start: owner foreign or unknown stops the child, exit 1, no URL` | AC5 |
| `› stop signal: during readiness and while running: stop called once, exit 130/143/129, no docker stop` | AC6 |
| `› stop signal: arrives before the spawn resolves: child is still stopped` | AC6 |
| `› stop failure: unconfirmed stop exits non-zero and says so` | AC6 |
| `› secrecy across every helper call: no password, encoded password, URL or token in out, err or any helper argv` | AC7 |
| `dev-process.test.ts › parseWindowsSnapshot / parsePosix*: good, malformed and empty output` | AC5 |
| `› descendantsOf: stale ppid after PID reuse is excluded; orphan of a dead root is included; cycle terminates` | AC6 |
| `› classifyOwner: owned, foreign, mixed listeners = foreign, none = unknown, query failed = unknown` | AC5 |
| `› portBusy: real listener on 127.0.0.1 is busy; a free port is not` | AC2 |
| `› probeReady: real local server: 200 ok true; 503, wrong body, redirect false; request has no authorization or cookie header` | AC5, AC7 |
| `› real tree: stop kills parent and grandchild; an unrelated bystander process stays alive` | AC6 |
| `› real tree: root exits first; the orphan grandchild is still stopped` | AC6 |
| `› real tree: owner check is owned for the grandchild's port, foreign for a bystander's` (skip only when `lsof` is absent on POSIX) | AC5 |
| `start-dev.test.ts › hands off to dev-prod.mjs with the arguments` (TTY stub) | AC1 |
| `› no TTY and no usable winpty: exit 1, names a supported terminal, launcher not run` | AC2 |
| `› node missing: exit 1, names node` | AC2 |
| `› bash -n passes` (Git Bash at `C:\Program Files\Git\bin\bash.exe` on Windows, never the WSL `bash`; `bash` on POSIX) | AC7 |

**Existing tests in `scripts/dev-prod.test.ts` that must change:**

| Line | Test | Change |
|---|---|---|
| 48-93 | `drive` harness | Add stubs `checkTools`, `portBusy`, `promptOrg` (trace `org prompt`), `probeReady`, `onStopSignal`, `monoMs`; `spawnApp` returns a handle; `runDevToken` records its org argument |
| 212 | `happy path` | New trace order |
| 235, 266 | `SIMAP_DEV_ORG: token of another org…`, `token stale then refreshed` | `trace.slice(0, 3)` no longer starts at the token; compare the token steps only |
| 254 | `token without org is refreshed…` | Assert one `org prompt` for `env: {}` and none with `SIMAP_DEV_ORG` |
| 374 | `DATABASE_URL is still checked in .env.local only` | **Inverted**: rename, and expect exit 2 naming `.env` |
| 379 | `non-UUID org claims…` | Stays valid through the `promptOrg` stub; assert the rejected claim is never passed to `dev:token` |
| 480 | `source has no file-write API` | Also scan `dev-process.mjs` |
| 561 | `a read error on read %i (issuer loop)` | Reads become `[9, 10, 11, 12]`, file `FILES[n - 9]` (DATABASE_URL now reads 4 files, not 1) |

Line 202 (`cannot read .env.local`) stays exact because `.env.local` is still read first.

## Approach

### 1. Git Bash and hidden input (Question 1)
`promptPassword` (`scripts/dev-token.mjs:218-249`) calls `stdin.setRawMode(true)`, which exists only on a real Node TTY.
Under mintty, bash sees a pty but native Node sees a pipe, so `isTTY` is false and both `main()` guards exit
(`dev-prod.mjs:274`, `dev-token.mjs:252`). So the wrapper must ask **Node**, not `[ -t 0 ]`. `winpty.exe` ships with Git
for Windows and is present on this machine (`C:\Program Files\Git\usr\bin\winpty.exe`).

```bash
#!/usr/bin/env bash
set -eu
cd "$(dirname "$0")/.."
fail() { echo "start-dev: $*" >&2; exit 1; }
command -v node >/dev/null 2>&1 || fail "node not found (install Node 22)."
if env -u NODE_OPTIONS node -e 'process.exit(process.stdin.isTTY && process.stdout.isTTY ? 0 : 1)'; then
  exec node scripts/dev-prod.mjs "$@"
fi
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*)
    if [ -t 0 ] && [ -t 1 ] && command -v winpty >/dev/null 2>&1; then
      node_exe="$(env -u NODE_OPTIONS node -p process.execPath)"
      exec winpty "$node_exe" scripts/dev-prod.mjs "$@"
    fi ;;
esac
fail "needs an interactive terminal: use PowerShell, Windows Terminal, macOS Terminal, or Git Bash with winpty."
```

The wrapper reads no secret and handles none. Arguments are only the allowlisted port (`nextDevArgs`). Secrets are typed
into Node's raw-mode prompt, so none reaches argv. No silent fallback to visible input exists.

### 2. Preflight order in `run()` (Questions 6 and 7)
Keep the current first block unchanged (`NODE_OPTIONS`, argv, container name, tunnel port: exit 1, empty trace). Then,
**before reading the token**:

1. **`.env*` refusals, exit 2.** Move `dev-prod.mjs:194-228` up, same messages and same order: DATABASE_URL, SIMAP_DEV_ORG,
   issuer variant, dev-prod flag, read failure (`EnvReadFailure` → exit 2).
   - DATABASE_URL checks `[".env.local", ...the other three]`, keeping the current `.env.local` message and first-read
     order; the message uses the file's name.
   - Match DATABASE_URL **case-insensitively** (`envFileSetsKey(text, "DATABASE_URL", true)`). On Windows env names are
     case-insensitive, so a `database_url=` line could overwrite the pinned value, the same hole SIM-031 closed for the issuer.
2. **Tools, exit 1**, naming each missing tool (`checkTools()`, read-only):
   - `docker version --format {{.Server.Version}}`: CLI present and daemon reachable.
   - `next/dist/bin/next` resolves (dependencies installed).
   - Windows: `%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe` exists.
   - POSIX: `lsof` and `ps` on `PATH`.
   - `node` is checked by the wrapper. `pnpm` is not required: the launcher does not call it. `shellcheck` is not a
     runtime tool.
3. **App port, exit 1:** `[dev:prod] port <n> is in use: stop that process or pass --port <n>`.

**The port must be explicit.** Next retries other ports when the port source is `default`
(`next/dist/cli/next-dev.js:302`, `start-server.js:248`), so a busy-port check on 3000 could otherwise end with the app
on 3001. Resolve the port as argv, else non-empty `env.PORT` (validated through `nextDevArgs(["--port", value])`), else
`3000`, and always pass `--port <n>`. No change to `dev.mjs`, so plain `pnpm dev` keeps its behaviour.

`portBusy(port)`: busy if a TCP connect succeeds on `127.0.0.1` or `::1`, or an exclusive bind on `127.0.0.1` fails. The
connect is needed because on Windows a specific-address bind can succeed beside a wildcard listener. A connect timeout
or unexpected error counts as busy (fail closed); `ECONNREFUSED`, and `EADDRNOTAVAIL`/`EAFNOSUPPORT` on `::1`, count as free.

### 3. Org flow (Question 5)
`wantOrg` stays as at `dev-prod.mjs:151`.

| Token on disk | `SIMAP_DEV_ORG` | Action |
|---|---|---|
| Fresh and matching | any | Reuse; no prompt, no sign-in |
| Not usable | set | `runDevToken()` with no argument; `dev:token` reads the env as today |
| Stale or wrong, with a canonical `org` claim | unset | `runDevToken(tokenOrg(token))`, no prompt |
| Missing, or no valid org | unset | `promptOrg()` **once**, then `runDevToken(answer)` |

- The answer is trimmed, lowercased and tested with `CANONICAL_UUID`. Invalid or empty: exit 1, no retry, no sign-in, and
  the answer is not echoed in the error.
- `promptOrg` reuses `promptPassword("Org UUID: ")`, so no second stdin reader type is introduced. Input is hidden, so
  print `[dev:prod] org <uuid>` after validation so that Ming can check a paste.
- `runDevToken(org)` spawns `dev-token.mjs` with `["--org", org]` when `org` is given, else no arguments. An org UUID is
  not a secret, and `--org` is the existing public interface. **`dev-token.mjs` does not change**, so other callers
  are unaffected.
- After sign-in, require `tokenIsFresh(token, now(), wantOrg ?? requestedOrg)`. Keep the current messages, and use
  "does not match SIMAP_DEV_ORG" only when `wantOrg` is set; otherwise "does not match the requested org".
- The claim read from the old token is only a request parameter; Identity decides membership.

### 4. App start and readiness (Questions 3 and 4)
Install the stop-signal handler **before** spawning. `startApp` spawns Next with `stdin: "ignore"`, stdout and stderr
inherited, `cwd` = repo root, and `detached: true` on POSIX only. `stdin: "ignore"` also turns off Next's interactive
upgrade menu (`next/dist/lib/upgrade/nudge.js:377`), which should not run in a session holding production credentials.

**`/api/readyz` semantics.** With `DATABASE_URL` set, the route runs `select 1` through the pool (`route.ts:10-14`,
`pool.ts:40-53`). A 200 proves that the app reached Postgres through the tunnel and the password was accepted. It does
**not** prove schema version, org access or write access. A 503 is retried until the deadline, because it can be
transient during the first compile; at the deadline the child is stopped and the run exits 1 with
`did not become ready in 30 s (database password or tunnel?)`.

- Poll at **2 s** intervals, so a wrong password makes at most about 15 failed logins against production Postgres.
- Per-attempt timeout 10 s, clamped to the 30 s total on an injected monotonic clock.
- Success only on HTTP 200 with body `{"status":"ok"}` (read at most 1 KiB).
- Use `node:http` with host literal `127.0.0.1`, a fresh `http.Agent`, no redirects followed and **no auth or cookie
  header**. Not `fetch`, because Node's env-proxy support could route it off loopback. The route needs no token and
  `src/proxy.ts:25` excludes `api/`.

**Owns the port**, checked after readiness and before the URL. The listener is Next's forked worker, not the direct
child (`next-dev.js:393`), so the check is "in our tree":

- **Windows:** one fixed PowerShell command returns both tables: `Get-CimInstance Win32_Process` (only `ProcessId`,
  `ParentProcessId`, `CreationDate` as FILETIME; never `CommandLine`) and `Get-NetTCPConnection -State Listen -LocalPort <n>`
  (`OwningProcess`). Avoid `netstat`, whose state text is localized.
- **POSIX:** `lsof -nP -iTCP:<n> -sTCP:LISTEN -Fp` and `ps -A -o pid=,pgid=`; a listener is ours when its `pgid` equals the
  child's PID.
- `classifyOwner` returns `owned` only when there is at least one listener and **every** listener is in the tree. Any other
  listener is `foreign`. No listener, a failed or timed-out command, or unparsable output is `unknown`.
- **`foreign` and `unknown` both stop the child and exit 1 (fail closed), and no URL is printed.**

On success print `[dev:prod] local URL: http://127.0.0.1:<port>` and exactly `PRODUCTION DATA: every change is real.`
Use `127.0.0.1`, the address actually bound; `localhost` could resolve to a different `::1` listener.

### 5. Stopping the tree (Question 2)
`handle.stop()` is idempotent and runs on Ctrl-C, SIGTERM, SIGHUP, readiness failure, owner failure, child exit and any
exception (`try/finally` around everything after spawn). It never calls `docker`, so the tunnel keeps running.

**Windows.** Do not use `taskkill /T`: it walks parent PIDs, and Windows keeps stale parent PIDs after a parent exits, so
it could reach an unrelated process.

1. Record the root's identity `(pid, creation time)` right after spawn. Node holds the child handle until exit, so the PID
   cannot be reused in that window. If it cannot be recorded, stop the child and exit 1.
2. `descendantsOf(table, root)` (pure) includes `p` when `p.ppid` is a member's PID, `p.start >= member.start`, and, if that
   PID is now held by a different process `q`, `p.start < q.start`. This keeps orphans of a dead root and rejects PID reuse.
3. On a signal, allow 1.5 s for Next's own shutdown (the console delivers Ctrl-C to it too). Then kill leaves first with
   one fixed PowerShell command per sweep that, for each `pid:start`, opens `[Diagnostics.Process]::GetProcessById`, reads
   `.Handle` (which pins the process), compares `StartTime` FILETIME with the recorded value ignoring the last digit (CIM has
   microsecond precision), and only then calls `.Kill()`. A mismatch is skipped, so the failure mode is "not killed".
4. Re-snapshot, up to 3 sweeps. If members remain, report `could not confirm every child stopped (PIDs: …)` and exit non-zero.

**POSIX.** The child leads its own process group. Send `SIGTERM` to `-pid`, poll `kill(-pid, 0)` for up to 3 s, then
`SIGKILL`. After the first `ESRCH`, never signal that group again.

Exit codes: child's code on a normal exit, 130 SIGINT, 143 SIGTERM, 129 SIGHUP, 1 on any failure path.

**Fake tree test:** a Node fixture (`node -e`, minimal env, no repo secrets) spawns a grandchild that listens on an
ephemeral `127.0.0.1` port and prints its PID. A separately spawned bystander must survive every stop. The tests run on
Windows locally and Linux in CI, and always clean up in `finally`.

### 6. README
Short "One command" section under "Production database (dev)", the new check order, the four-file `DATABASE_URL` rule,
the Git Bash note, and the manual list starting with `pg_dump`. Fix line 25's "not Git Bash" so it applies to direct
`pnpm dev:token` only.

### Rules
- **R3:** no new env name; secrets stay in memory and the app child's env; helper commands get literals and validated
  integers only.
- **R4:** only the files above.
- **R5:** new logic has tests.
- **R1, R2, R6, R7:** not touched (scripts only; no schema, query or route change).
- **Guardrails:** implementer and reviewer never read real `.env*` files or the token file and never run this against
  production; every test uses stubs or a fake tree.

## Specialist input used
None. The orchestrator confirmed that no consult agent applies to the `security` area.

## Assumptions
1. **`dev:prod` changes too.** Both commands share `run()`, so `pnpm dev:prod` gains the earlier refusals, the four-file
   `DATABASE_URL` rule, readiness and tree stop. A developer with `DATABASE_URL` in any `.env*` file must comment it out
   for this command; the ticket asks for that refusal.
2. **Hidden org input** is accepted, because it avoids changing `promptPassword`; the validated UUID is printed right after.
3. **30 s can be tight** on a cold `next dev` compile. The ticket fixes the limit, so a slow first compile fails closed and
   a re-run is faster.
4. **A hard kill of the launcher** (Task Manager, `SIGKILL`, power loss) cannot run cleanup. Node has no built-in Windows
   Job Object. The README states this; the next run then refuses the still-busy port.
5. **Not run during planning:** the PowerShell snapshot and kill commands and the `winpty` path were designed from the
   code and platform behaviour, not executed. The real-tree tests prove the PowerShell commands; `winpty` is under Ming
   verification because it needs a real mintty.
6. **Hotspots:** no open ticket is `IN_PROGRESS`, `REVIEW` or `DONE`, so no rebase is expected.
7. `shellcheck` is not installed and will not be downloaded; impl-log records it as unavailable, as AC7 allows.

## Blocking questions
None.

## Split proposal
None. Estimate: about 360 non-test lines and about 350 test lines, so the total is above the ~400-line guide while the
production code is within it. A split is not recommended: moving the refusals, starting the app and stopping the tree
are only safe together, and a partial `start-dev.sh` would run on production data without its stop guarantees. If
non-test code passes about 500 lines during implementation, stop and report; the fallback is SIM-032 (preflight and org
flow, no wrapper) followed by SIM-032.1 (process lifecycle and wrapper).
