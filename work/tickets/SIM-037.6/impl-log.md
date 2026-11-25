## Attempt 1 — 2026-11-25

Slice 1 of plan.md only (history API, read-only detail page, links). No migration, no High path.

### Files touched
| File | Required because |
|---|---|
| `src/lib/devices/types.ts` | History DTOs, kinds, allowlist, limits (shared by route, server, UI). |
| `src/lib/devices/history.ts` (new) | Pure audit-row to history-entry mapper. |
| `src/lib/devices/history.test.ts` (new) | Mapper unit tests. |
| `src/lib/validate/device-history-query.ts` (new) | limit/cursor validation. |
| `src/lib/validate/device-history-query.test.ts` (new) | Validator tests. |
| `src/server/devices/history.ts` (new) | The history read (org check, keyset query, batched names, holderSince). |
| `src/server/devices/history.db.test.ts` (new) | DB integration test. |
| `src/app/api/devices/[id]/history/route.ts` (new) | `GET /api/devices/{id}/history`. |
| `src/app/api/devices/devices-routes.test.ts` | Route tests. |
| `src/ui/devices/devices-api.ts` / `devices-api.test.ts` | `history(id, cursor?)` client and tests. |
| `src/ui/devices/device-labels.tsx` (new) | Labels moved unchanged from `DeviceTable.tsx`, plus `DeviceNameLink`. |
| `src/ui/devices/DeviceTable.tsx` | Imports labels, name now links to detail (table and card). |
| `src/ui/devices/DevicesView.test.tsx` | Name-link test; the old `not.toContain("href=")` narrowed to `href="/rooms/` because the name is now a link. |
| `src/lib/nav.ts` / `nav.test.ts` | `deviceDetailHref` and tests. |
| `src/ui/search/SearchView.tsx` / `.test.tsx` | Device hit links to `/devices/<id>`. |
| `src/ui/seats/SeatDetailPanel.tsx` / `.test.tsx` | Device name links to `/devices/<id>`. |
| `src/ui/devices/device-detail-state.ts` + test (new) | Reducers. |
| `src/ui/devices/device-history.ts` + test (new) | Copy helpers. |
| `src/ui/devices/useDeviceDetail.ts` (new) | Hook. |
| `src/ui/devices/DeviceDetailView.tsx` + test (new) | View. |
| `src/ui/devices/DeviceHistory.tsx` + test (new) | History card. |
| `src/ui/devices/DeviceDetailPage.tsx` (new) | Container. |
| `src/app/(app)/devices/[id]/page.tsx` (new) | Route `/devices/<id>`. |
| `src/ui/index.ts` | Export `DeviceDetailPage`. |
| `src/ui/copy/devices.ts`, `src/ui/copy/shell.ts` | Copy (D36). |

### Tests added / changed
- `history.test.ts` (mapper: every kind, allowlist, tolerant meta, causes, missing member, Vietnamese name), `device-history-query.test.ts`
- `devices-routes.test.ts › GET /api/devices/:id/history` (bad uuid, 401, bad limit/cursor, wiring + no-store, service 404)
- `history.db.test.ts` (7 tests: full lifecycle, decline/cancel/extension, deactivation keeps names, user tier + cross-org + unknown id 404, other device/entity/allowlist exclusion, keyset paging with equal `created_at`, holderSince)
- `devices-api.test.ts › history`, `device-detail-state.test.ts`, `device-history.test.ts`, `DeviceDetailView.test.tsx`, `DeviceHistory.test.tsx`
- Updated: `DevicesView.test.tsx`, `SearchView.test.tsx`, `SeatDetailPanel.test.tsx`, `nav.test.ts`

### Checks (actual output summary)
- format:check: `All matched files use the correct format.`
- typecheck: `next typegen && tsc --noEmit` clean.
- check:layers: `check-layers: 763 files, no violations`
- test: `Test Files 288 passed | 1 skipped (289); Tests 2921 passed | 9 skipped (2930)`
- build: succeeded, `/devices/[id]` listed.
- test:db (local Postgres via compose.dev.yml, throwaway DB): all 7 `history.db.test.ts` tests pass. The run as a whole shows `19 failed` in other files; the same 19 fail on a clean stash of `ticket/SIM-037.6` (baseline `19 failed | 264 passed`), so they are not caused by this diff (see Follow-ups).

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- **Pre-existing bug, blocks real use of transfer/return/extension start:** `src/server/devices/handoffs.ts` lines ~175, ~232, ~286 call `orgQuery` with `insert into device_handoffs (...) values ($1, ...)`. The guard in `src/server/http/org-scope.ts` requires the text `org_id = $1`, so every `startTransfer`/`startReturn`/`startExtension` throws `orgQuery: SQL must filter org_id = $1`. `handoffs.db.test.ts` fails on it (about 17 of the 19 baseline failures). Other inserts use the `insert ... select ... from (select $1::uuid as org_id) o where o.org_id = $1::uuid` form. Because of this, `history.db.test.ts` writes the pending row and the start audit row itself in `beginHandoff` (same meta as handoffs.ts) and uses the real services for create, assign, holding edit, confirm, cancel, decline, take-back and deactivate. When the bug is fixed, `beginHandoff` can call the real start functions. This needs its own ticket (BUG).
- Other baseline DB failures, unrelated: `devices.db.test.ts` (`device_handoffs_decided_check` in the test's own SQL), `manage.db.test.ts` (deactivate audit meta shape differs from the test), `map-items.db.test.ts` (ordering, probably collation).
- During this run one DB-test pass listed the `create` row as newest; it did not repeat in 5 later runs. Likely a clock step in the freshly started Docker VM. If it recurs in CI, order by a monotonic key.
- `shellCopy.pages.deviceDetail` is added per plan but, like `roomDetail`, nothing reads it yet.
- Slice 2 (viewer actions) is the proposed SIM-037.13 in plan.md.

### Scope self-check
- Could the diff be smaller? No; every file is in the plan list.
- Diff size: tracked files +271 / -83; plus 19 new files (about 2,000 lines including tests).
