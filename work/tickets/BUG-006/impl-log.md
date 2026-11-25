# Impl log — BUG-006

## Attempt 1 — 2026-11-26

### Files touched
| File | Required because |
|---|---|
| `scripts/ci-workflows.test.ts` | Regression test (written first) |
| `.github/workflows/ci.yml` | Fix: `prod=/Users/mingming/.config/simap` defined once, used by `sed` and by `grep -qF "$prod"` in step `compose config` |

### Tests added / changed
- `scripts/ci-workflows.test.ts` › compose copy safety check matches the production env path, not the runner home

Failed before the fix:
`AssertionError: expected '/Users/mingming' to be '/Users/mingming/.config/simap'` (scripts/ci-workflows.test.ts:63)
Passes after the fix (full `pnpm test`).

### Checks (actual output summary)
- typecheck: pass (next typegen + tsc, exit 0)
- format:check: All matched files use the correct format.
- check:layers: 805 files, no violations
- test: Test Files 307 passed | 1 skipped (308); Tests 3108 passed | 9 skipped (3117)
- build: exit 0

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- None. Criterion 3 (`compose config` green on MacBookPro) is verified only by the PR's CI run.

### Scope self-check
- Could the diff be smaller? No.
- Diff size: ci.yml +2/-2 lines, test +13 lines.
