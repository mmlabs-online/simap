## Attempt 1 — 2026-11-24

### Files touched
| File | Required because |
|---|---|
| src/lib/export/csv.ts (+ csv.test.ts) | Pure CSV helpers, kinds, cap, filename. |
| src/server/export/export.ts (+ export.test.ts, export.db.test.ts) | Org-scoped read-only queries for seats, devices, members. |
| src/app/api/export/[kind]/route.ts (+ route.test.ts) | Manager+ API entry. |
| src/ui/dashboard/export-api.ts (+ export-api.test.ts) | Bearer download via apiFetch. |
| src/ui/dashboard/save-blob.ts | Browser download side effect. |
| src/ui/dashboard/ExportCard.tsx | Export buttons card. |
| src/ui/dashboard/DashboardView.tsx, DashboardPage.tsx, DashboardView.test.tsx | Host the card for Manager+, wiring, tests. |
| src/ui/copy/dashboard.ts | Export copy (D36). |

### Tests added / changed
- csv.test.ts (escaping, formula guard, Vietnamese, BOM/CRLF, filename, kinds)
- export.test.ts (orgQuery $1, cap+1/truncated, mapping, read-only repeatable-read tx)
- export.db.test.ts (two-org isolation, cap)
- route.test.ts (403 for user, headers/BOM, 404, truncated header, 503)
- export-api.test.ts, DashboardView.test.tsx (3 new cases)

### Checks (actual output summary)
- typecheck: exit=0
- check:layers: exit=0, 581 files, no violations
- format:check: exit=0
- test: exit=0, 222 files passed, 2220 passed | 3 skipped
- build: exit=0
- test:db: exit=0, 13 files, 157 tests passed

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- Plan listed a `failed` copy string; not added because errors reuse `apiErrorMessage` (unused string).
- No download icon in `ICON_NAMES`; buttons are text only.

### Scope self-check
- Could the diff be smaller? No.
- Diff size: about +900 lines including tests.
