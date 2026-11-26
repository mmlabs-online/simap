# Implementation log — SIM-021

## Attempt 1 — 2026-11-26

### Files touched
| File | Required because |
|---|---|
| `docs/go-live.md` | Created: checklist items 0-14, Rollback, Lockout recovery (A7), Assumptions in force (A2-A8); ticket scope, AC 1 |
| `work/tickets/SIM-021/flow-run.md` | Created: flow-run template F1-F11 (71 rows), summary, recording and bug rules; ticket ACs 2-3 (the means) |
| `work/ming-todo.md` | Appended M-77 after M-76 (one added line, nothing else changed) |
| `work/tickets/SIM-021/impl-log.md` | This log |

### Tests added / changed
- None (docs only, per plan).

### Checks (actual output summary)
- `pnpm format` then `pnpm format:check`: "All matched files use the correct format."
- `pnpm typecheck && pnpm check:layers`: exit 0; "check-layers: 808 files, no violations"
- `pnpm test`: 308 files passed, 1 skipped; 3126 tests passed, 7 skipped
- `pnpm build`: exit 0
- Plan greps: tick boxes 15, `Owner:` 15, `Check:` 15; flow rows 71 (every Expected cites a spec ID or D/R id, Result/Notes/BUG empty);
  no emails or UUID patterns in `docs/go-live.md` or `flow-run.md`; `down -v` appears once, as a "never".

### Out-of-plan files
- None.

### Deviations
- M-78 (plan approval) already exists at the top of `work/ming-todo.md`; M-77 was still free and was appended after M-76 as planned.
- Rollback and runbook links point to existing README anchors; I did not re-read workflow lines 151-235 line by line, I relied on the README rollback text (lines 39-45).
- Item 1's `org_mode`/role details are copied from the plan, not independently verified against Identity.

### Follow-ups
- Stale comment in `src/lib/identity/config.ts` about simap's own Turnstile widget (High path; A2).

### Scope self-check
Docs only; no code or High-path file changed.

## Attempt 2 — 2026-11-26

Fixes for `review.md` attempt 1 and `security-review.md` attempt 1 (docs only).

### Files touched
| File | Required because |
|---|---|
| `work/tickets/SIM-021/flow-run.md` | Review blocker 1 (F6 reordered: D1 placement, decline, cancel, confirm, return by B, then D2 for placed-delete and take-back; precondition added; 18 rows); should-fix 2 (citations: F6.1 D68, F6.3 DEV-07/D63, F6.12 and F6.15 DEV-09/D63, F6.14 DEV-01/D31, F4.3 + D62, F4.5 LAY-01, F4.6 LAY-07, F4.7 Room view/LAY-06); should-fix 3 (F10.3 per SYS-03); nits (F1.3 AUT-01/D33, F7.4 REG-01, F7.7 REG-02/D24, F8.2 counts condition, F8.4 MEM-01/D34); header line about "three accounts" fixed (four accounts per A5); security items 8 and the optional isolation rows F11.3, F11.4 |
| `docs/go-live.md` | Should-fix 4 (`restore-failed` in Rollback); security 5 (fork-PR check for `mmlabs-online/deployment` in item 7), 6 (role-privilege and ownership/CONNECT SQL in item 4), 7 (drop-and-recreate marked Ming only, dump first, exact statements, item 4 re-check); optional transaction plus `UPDATE 1` check on the recovery SQL; nits: `simap:member` in item 1, image repository named by README link instead of the account name |
| `work/tickets/SIM-021/impl-log.md` | This log |

### Tests added / changed
- None (docs only).

### Checks (actual output summary)
- `pnpm format` then `pnpm format:check`: all matched files use the correct format.
- `pnpm typecheck`: exit 0.
- `pnpm test`: 308 files passed, 1 skipped; 3126 tests passed, 7 skipped.
- Plan greps: tick boxes 15, `Owner:` 15, `Check:` 15; flow rows 76; no email or UUID patterns; `down -v` appears once, as a "never".

### Out-of-plan files
- None.

### Follow-ups (noticed, not done)
- Review nit on `flow-run.md` AUT-02 vs AUT-01 for "Continue as": cited AUT-01, D33 (spec AUT-01 lists it).
- Security follow-up: the four test accounts stay live after A5 suspends the test org; Ming may remove their roles.

### Scope self-check
- Could the diff be smaller? No; each change maps to a listed finding.

## Attempt 3 — 2026-11-26

Fixes for `review.md` attempt 2 (docs only).

### Files touched
| File | Required because |
|---|---|
| `work/tickets/SIM-021/flow-run.md` | Blocker: F6.14 is now "Admin opens D2's actions while placed", expecting no Delete action (DEV-01, D63; verified: `canDelete` needs `owner_id === null`, `decideDelete` refuses owned and placed devices). F6.18 assigns D1 (in org inventory after F6.12) to User A with an expiry of today (expiry today is valid; overdue is `holding_expires_on < today`). F4.7 cites spec §6 LAY. F7.6 cites REG-02. |
| `docs/go-live.md` | Item 4 CONNECT query excludes templates and `postgres`. Recreate path is now `create database simap owner simap;` plus the revoke, with the `simap` container stopped first; `add-app-db.sh` only if known safe for an existing role. Lines 30 and 60 rewrapped. |
| `work/tickets/SIM-021/impl-log.md` | This log |

### Tests added / changed
- None (docs only).

### Checks (actual output summary)
- `pnpm format` then `pnpm format:check`: all matched files use the correct format.
- `pnpm typecheck`: exit 0. `pnpm check:layers`: 808 files, no violations.
- `pnpm test`: 308 files passed, 1 skipped; 3126 tests passed, 7 skipped. `pnpm build`: compiled successfully.
- Plan greps: tick boxes 15, `Owner:` 15, `Check:` 15; flow rows 76; no email or UUID patterns.
- Walked F4 and F6 top to bottom; every row's precondition holds.

### Out-of-plan files
- None.

### Follow-ups (noticed, not done)
- Spec contradiction for Ming: DEV-01's last bullet and D31 (`docs/spec-v1.md:282-284`: placed-device delete warning, "Move to inventory", "then allow delete") cannot happen under D63 (a placed device always has an owner; Move to inventory goes to the owner's inventory; only org-inventory devices can be deleted). The spec needs a clean-up. Spec not edited here.
- Carried: stale Turnstile comment in `src/lib/identity/config.ts` (High path, A2); remove test accounts' `simap:*` roles after A5.

### Scope self-check
- Could the diff be smaller? No; each change maps to a listed finding.
