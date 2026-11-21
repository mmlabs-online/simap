# Implementation log — SIM-032

## Attempt 1 — 2026-11-21

### Files touched
| File | Required because |
|---|---|
| `scripts/start-dev.sh` (new, 100755) | Thin wrapper: pick a terminal path (Node TTY, else winpty), hand off to the launcher |
| `scripts/dev-process.mjs` (new) | Process table, tree identity, owner check, tree stop, tool check, port check, readiness probe, `startApp` |
| `scripts/dev-prod.mjs` | `run()` reordered (preflight first), org flow, readiness, owner check, stop handling; `spawnNext` uses `startApp` |
| `scripts/dev-process.test.ts` (new) | Parsers, tree rules, classifyOwner, portBusy, probeReady, real fake-tree tests |
| `scripts/start-dev.test.ts` (new) | Wrapper under bash with a stub `node` |
| `scripts/dev-prod.test.ts` | New harness and the planned tests; listed existing tests changed |
| `README.md` | One-command section, check order, four-file DATABASE_URL rule, Git Bash note |

### Tests added / changed
- dev-prod.test.ts: preflight group (four files any case, tool, port, explicit port, ordering), org flow, after start,
  stop signal, secrecy across helper calls; happy path trace; DATABASE_URL test inverted; read-error indices 9-12;
  source scan covers dev-process.mjs.
- dev-process.test.ts: parsers, descendantsOf, classifyOwner, portBusy, probeReady, three real-tree tests.
- start-dev.test.ts: hand-off, no TTY, node missing, bash -n.

### Checks (actual output summary)
- typecheck: exit 0
- check:layers: "check-layers: 234 files, no violations"
- format:check: "All matched files use the correct format."
- test: Test Files 98 passed (98); Tests 1024 passed | 3 skipped (1027)
- build: exit 0
- check:dev-bundle: "no dev-token strings in .next/static"
- `bash -n scripts/start-dev.sh`: exit 0 (Git Bash)
- shellcheck: unavailable (not installed), not downloaded, not run.
- Not run: real winpty path, real Ctrl-C in mintty, real tunnel/sign-in (Ming verification).

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- Windows kill compares the recorded CIM FILETIME with `Process.StartTime` within 10 microseconds (they differ by about
  0.5 microsecond; the plan's "ignore the last digit" failed in testing when the difference crossed a boundary).
- In this sandbox a Windows grandchild dies when its parent exits unless it is `detached`; the orphan test detaches it
  on Windows only. Real `next dev` behaviour for orphans is under Ming verification.

### Scope self-check
- Could the diff be smaller? No further without dropping planned behaviour.
- Diff size: code +501 / -58 (dev-process.mjs 304, dev-prod.mjs +179/-58, start-dev.sh 18); README +18/-6; tests +599/-20.
  Non-test net about 443 plus README; gross added about 520 (oxfmt expands lines). Under the ~500 net guide, gross slightly over: flagged for the orchestrator.

## Attempt 2 (rework) — 2026-11-21
Status: NOT COMMITTED. Net non-test lines pass 500 (see Size), so I stopped for the orchestrator's decision.

### Files touched (all in the plan)
- `scripts/dev-process.mjs`: snapshot valid only with the launcher's own PID (`parseWindowsSnapshot(text, selfPid)`); on an unreadable snapshot or unknown root, `child.kill()` on the held handle then retry, unconfirmed PIDs reported; `descendantsOf` drops direct children of a dead root that started after its recorded exit (`root.end`, FILETIME taken in the `exit` handler); `probeReady` hard total timer; POSIX stop treats only `ESRCH` as gone, ignores signal errors, polls after `SIGKILL`, returns `[pid]` if the group remains.
- `scripts/dev-prod.mjs`: one login check (`deps.checkDb({ password, port })`, real one is a single `pg` client, `connectionTimeoutMillis: 5000`, connect then end, no query) before the app starts; `28P01` and every other failure exit 1 with a fixed message, no retry, no app; the three "...: stopped" messages now say "stopping it" so "stopped" is never printed before confirmation; header comment updated.
- `scripts/start-dev.sh`: `CDPATH= cd -- "$(dirname -- "$0")/.."`.
- `README.md`: `.env*` refusal details moved to the preflight paragraph; step 3 is the password plus login check.
- Tests: `scripts/dev-process.test.ts`, `scripts/dev-prod.test.ts`, `scripts/start-dev.test.ts`.

### Tests added
`END`-only and missing-own-PID snapshot; F/G PID-reuse case in `descendantsOf`; trickling server ends within the hard limit; Windows real-child test with the snapshot made unreadable (SystemRoot pointed at a missing dir after start) asserting the child is gone and the stop reports `[pid]`; `full flow without .env files, including sign-in` (exact trace); db check 28P01 / other failure / throw (fixed message, one err line, no app, no secret); `CDPATH` test for the wrapper. Happy-path trace now includes `db check`.

### Checks (Node 22)
- `pnpm typecheck`, `pnpm check:layers`, `pnpm format:check`, `bash -n scripts/start-dev.sh`: exit 0
- `pnpm test`: Test Files 98 passed (98), Tests 1030 passed | 3 skipped (1033)
- `pnpm build`: exit 0; `pnpm check:dev-bundle`: "no dev-token strings in .next/static"
- shellcheck not installed, not downloaded. `pnpm test:db` not run.

### Size
Non-test code vs `main` (mjs + sh): +583 / -59 = 524 net; with README 537. Attempt 1 was 443. The rework added about 81 net lines (the real `pg` login check, the F/G rule, two stop paths and the hard timer account for most). Over the 500 line, so stopped without committing.

### Out-of-plan files
None.

### Follow-ups
- Tunnel port identity check and a minimal helper env (excluded by the orchestrator).
- Nit not fixed (not listed): root exit during the blocking owner check can still print the URL just before the stop.

### Scope self-check
Only reviewer Issues 1-7 and S4/S5 were addressed; no real process other than test-created fake children was started or stopped; no `.env*` values, token file, port 15432 or tunnel container touched.
