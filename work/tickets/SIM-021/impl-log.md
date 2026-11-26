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
