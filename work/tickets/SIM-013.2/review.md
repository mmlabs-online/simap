# Review — SIM-013.2

## Attempt 1 — 2026-11-24
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check`: exit 0
- `pnpm typecheck && pnpm check:layers`: both exit 0; "check-layers: 456 files, no violations"
- `pnpm test`: exit 0; "Test Files 179 passed (179)", "Tests 1886 passed | 3 skipped (1889)". This matches impl-log.
- `pnpm build`: exit 0; `ƒ /devices` listed
- `pnpm test:db`: CI-only, not affected (no server, SQL or migration change)

### Acceptance criteria
- [x] AC1: placement for every device, "At seat X" with role tag and room link, or "In inventory". Evidence:
  `src/ui/devices/DeviceTable.tsx:12-28` (PlacementLabel, `roomDetailHref`, role Chip), used in both the table
  (`:74-76`) and the stacked list (`:92`). `src/ui/devices/devices-state.ts:13-15`. Tests:
  `DevicesView.test.tsx:14-25` "shows placement, role tag and room link, or 'In inventory' without a link" and
  `devices-state.test.ts:18-29` "placementText". Both pass.
- [x] AC2: filter all / placed / inventory applied on the server. Evidence: `devices-api.ts:42-44` always sends
  `?placement=${filter}`. `useDevices.ts:21-26` reloads whenever `filter` changes. Tests: `devices-api.test.ts:21-32`,
  `DevicesView.test.tsx:47-53` (radiogroup, 3 radios, one aria-checked). The stale-response guard is
  `devices-state.ts:50-52` (a `load` clears the rows; an older `id` is ignored), plus the `mounted` ref at
  `useDevices.ts:12-19,25`. Tested in `devices-state.test.ts:80-87` "a loaded event with an older id is ignored".
- [x] AC3: loading, error with retry, empty per filter, truncated. Evidence: `DevicesView.tsx:47-83`.
  - Loading: `aria-busy`, no table.
  - Error: `role=alert` with `apiErrorMessage`, plus Try again wired to `reload` (`DevicesPage.tsx:25`).
  - Empty: `emptyText(filter)`, with Show all only when the filter is not `all`.
  - Truncated: notice with `DEVICE_LIMITS.list`.
  - Tests: `DevicesView.test.tsx:55-81`, all pass.
- [x] AC4: static-render and pure tests only, no jsdom. The three new files run in `pnpm test`.
  `grep jsdom src/ui/devices` finds nothing, and `vitest.config` uses `environment: "node"`.
- [x] AC5: `src/app/(app)/devices/page.tsx:1-5` renders `<DevicesPage />` from `@/ui`. The export is at
  `src/ui/index.ts:26`. Build and check:layers are green.

Ming verification after merge (carry to the PR): run `pnpm dev`, open `/devices` and switch All / Placed /
Inventory. Each switch reloads the list and the empty text follows the filter. Below `md` the stacked list replaces
the table. Seed data has no devices; add some through `POST /api/devices` (or wait for SIM-013.4).

### Scope
Every source file is in the plan's file list. `work/ming-todo.md` (M-35) and `ticket.md` are orchestrator workflow
edits from plan approval. The only addition is the copy key `devicesCopy.typeLine`, which impl-log discloses. It is
needed to keep a literal `·` out of the JSX (D36). No High path is touched.

### Issues
None.

### Rules (CLAUDE.md)
No violations found.
- R1: `src/ui/devices/*` imports only `@/lib/*`, `../*` (ui) and `next/link`/`react`. The page imports only `@/ui`.
  check:layers is clean.
- D36: all visible strings come from `src/ui/copy/devices.ts` or `shellCopy`. `no-literals.test.ts` and
  `copy.test.ts` are green.
- R4: no create, edit, delete or place controls. The test at `DevicesView.test.tsx:37-43` asserts that only the 3
  filter buttons exist.
- R5: the new logic has tests.
- R2, R3, R6 and R7 do not apply (no server change).

### Blockers from review agents
None (no review trigger path changed).

### Nits (do not block)
- `DevicesView.test.tsx`: each assertion runs against markup that holds both layouts, so a regression in only the
  stacked `<ul>` (for example, the placement missing there) would not fail. A scoped assertion on the `<ul>` part
  would pin it.
- `DevicesView.test.tsx:78` hard-codes `1000`; `DEVICE_LIMITS.list` would follow a cap change.
- `devices-state.ts:7` types `FILTERS` as `readonly PlacementFilter[]` rather than `as const` as planned. It is
  equivalent here.

### Follow-ups (out of scope)
- Extract the shared `call`/`errorCode` helper (rooms-api, seats-api, devices-api). This is already in impl-log.
- Arrow-key navigation in `FilterChips` (shared component).
- Fake devices in `pnpm seed:dev`.
