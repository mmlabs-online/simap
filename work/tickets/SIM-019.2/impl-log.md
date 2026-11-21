## Attempt 1 — 2026-11-21

### Files touched
| File | Required because |
|---|---|
| `src/lib/nav.ts`, `src/lib/nav.test.ts` | admin-only `audit` rail item, tests pin the lists |
| `src/lib/icons.ts` | `history` icon |
| `src/ui/copy/shell.ts` | `nav.audit` (exhaustive over NavId) and `pages.audit` |
| `src/ui/copy/audit.ts` (new) | page copy, `actionLabel` |
| `src/lib/audit/day-range.ts` + test (new) | UTC+7 day range -> UTC instants (D35) |
| `src/ui/audit/audit-api.ts` + test (new) | apiFetch wrapper for `/api/audit`, `/api/audit/facets` |
| `src/ui/audit/audit-state.ts` + test (new) | pure logic (canViewAudit, toApiFilter, formatAuditTime, actorLabel, metaEntries) |
| `src/ui/audit/useAudit.ts` (new) | data hook (facets once, list, load more, stale drop) |
| `src/ui/audit/AuditView.tsx` + test (new) | pure view |
| `src/ui/audit/AuditPage.tsx` (new) | page glue, hook mounted only for admins |
| `src/app/(app)/audit/page.tsx` (new) | route |
| `src/ui/index.ts` | `AuditPage` export |

### Tests added / changed
- day-range.test.ts (6), audit-api.test.ts (6), audit-state.test.ts (6), AuditView.test.tsx (11), nav.test.ts "audit is admin only" + updated admin counts.

### Checks (actual output summary)
- typecheck: exit 0 (next typegen + tsc); check:layers: 219 files, no violations
- format:check: All matched files use the correct format
- test: 82 files passed, 772 tests passed
- build: exit 0 (/audit route listed)

### Out-of-plan files
- `src/ui/AppShellView.test.tsx` — the admin rail test pinned 5 links; now 6 (`/audit` appended). Direct consequence of the nav item.

### Follow-ups (noticed, not done)
- None.

### Scope self-check
- Could the diff be smaller? No.
- Diff size: about +900 lines incl. tests (over the ~550 estimate; tests and the view are the bulk).
