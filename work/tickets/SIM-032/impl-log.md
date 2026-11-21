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
