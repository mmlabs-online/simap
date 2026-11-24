# Escalation — SIM-032: One-command local start on production data

| Field | Value |
|---|---|
| Attempts | 3 (2 reworks) |
| Date | 2026-11-21 |

## What was asked
One command, `scripts/start-dev.sh`, signs in, opens the tunnel, starts the app on production data and prints the URL
with a clear warning. Every failure stops everything, and Ctrl-C leaves no child process and keeps the tunnel running.

## What failed, per attempt
| Attempt | Main issues from review | Fixed in next attempt? |
|---|---|---|
| 1 | Failed or empty process snapshot left the app running; no hard 30 s readiness limit; PID-reuse risk; AC1 test missing; `CDPATH`; about 15 failed production logins on a wrong password | Yes, except the failed-snapshot case was only partly fixed |
| 2 | A descendant could survive while stop reported success; failed first snapshot orphaned the Next worker; `checkDb` close unbounded; `PG*` values reached the production session | Yes, but the retry added T1 |
| 3 | 🔴 T1: the snapshot retry can adopt a reused PID as root, kill an unrelated process and falsely report success. Reviewer Issue 1 / security T2: children of a live remembered member are missed, reproduced 3 of 3 with a fake tree | Open |

Closed and verified: preflight order, `.env*` and `PG*` refusals, org flow, loopback readiness with a hard deadline,
single bounded database login check, no secrets in output or argv.

## Likely root cause
The stop guarantee is built by polling parent PIDs on Windows. That is inherently racy: processes can exit, fork or have
their PID reused between snapshots, so each fix exposes another timing case. The reviewer also reproduced a remaining
limit that PID tracking cannot solve: a middle process that exits before any snapshot saw its child.

Stopping is also judged only by "tree is empty". The property that matters most, that nothing still serves on the app
port with production credentials, is never checked at the end.

## Options for Ming
1. **One more small rework, plus a final port check.** Apply the two-line T1 fix and the Issue 1 fix (a fix for Issue 1
   already worked in a scratch copy), report known survivors, and report success only if the app port has no listener.
   Document the remaining fork race. Smallest change; a hidden child that holds no port could still survive.
2. **Use a Windows Job Object.** The OS then stops the whole tree, which removes the PID races. Strongest guarantee, but
   needs new native or P/Invoke code and a re-plan, so it is larger and riskier for a dev tool.
3. **Simplify to `taskkill /T /F` while Node still holds the child, plus the final port check.** Removes most of the
   tracking code. It cannot find orphans whose parent already exited, so the port check carries more of the guarantee.
4. **Stop here and keep `pnpm dev:prod` on `main`.** No new code, but none of the SIM-032 improvements ship.

## Recommendation
Option 1. It closes both open defects with a small diff and adds a direct check of the guarantee that protects
production. A Job Object can be a later ticket if a real run shows surviving processes.


---

# Second escalation — 2026-11-21

Ming chose option 1 above (one extra rework, attempt 4). T1, T2, Issue 2 and root-PID N6 are verified fixed.

## What failed in attempt 4
| Finding | Source | Evidence |
|---|---|---|
| 🔴 U1: a failed listener query reads as "port is free", so a stop can be reported clean while the app still serves | Security Attempt 4, reviewer Attempt 4 | Reviewer reproduced it with a simulated cmdlet failure and a real listener. A natural failure was not triggered |
| Should-fix: the new T1 test is flaky under load (8 of 12 with 32 CPU spinners, 12 of 12 idle) | Reviewer Attempt 4 | Test defect; product behaviour is correct |

## Options for Ming
1. **One more very small rework.** Decide "port free" with the real bind probe `portBusy`, which already fails closed and never kills, and fix the flaky test. The reviewer checked this fix in a scratch copy: `[0]` with a failing query and a live listener, `[]` on a free port.
2. **Use a Windows Job Object.** Strongest guarantee, but needs a re-plan and new native code.
3. **Stop here and keep `pnpm dev:prod` on `main`.** None of the SIM-032 improvements ship.

## Recommendation
Option 1. The fix replaces a query that can fail silently with a direct test of the port, and it has already worked in a scratch copy.
