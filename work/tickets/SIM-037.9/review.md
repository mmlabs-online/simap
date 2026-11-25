## Attempt 1 — 2026-11-25
Verdict: PASS

Scope: recipient side of DEV-08 (incoming list, Confirm / Decline, nav badge). UI only: every product change is under
`src/ui/**`; no `src/server/**`, `src/app/api/**`, `db/**`, config or deploy file changed, so no High path and no
review-trigger agent applies. Plan approved by Ming 2026-11-25 (M-61, "duyệt").

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format." (748 files).
- `pnpm typecheck` — exit 0, "Types generated successfully".
- `pnpm check:layers` — exit 0, "check-layers: 694 files, no violations".
- `pnpm test` — exit 0, "Test Files 261 passed | 1 skipped (262)", "Tests 2662 passed | 14 skipped (2676)". Matches
  impl-log exactly.
- `pnpm build` — exit 0.
- `pnpm test:db` — not run (CI-only, needs Postgres); no server or DB change in this diff.

### Acceptance criteria
- [x] 1 A recipient sees each pending incoming transfer with the sender, the device and the note — evidence:
  `src/ui/devices/IncomingTransfers.tsx:58-108` (name, `typeLine(type, inv)`, `from(displayName)`, note only when not
  null); placed via the slot at `src/ui/devices/DevicesView.tsx:75`; `IncomingTransfers.test.tsx › renders each item with
  name, type, inventory number, From <sender> and the note`, `› a Vietnamese sender and device name render intact; a
  note keeps line breaks`, `› no note: no note line; canConfirm false: no Confirm button`; `DevicesView.test.tsx ›
  incoming slot renders between the notice and the filter chips`. Data source: `devices-api.ts` `incomingHandoffs` →
  `GET /api/handoffs?box=incoming` (`devices-api.test.ts › incomingHandoffs sends GET ...`), served by `listHandoffs`
  (`src/server/devices/handoffs.ts:392-413`, own inbox, pending only).
- [x] 2 Confirm moves the device into the recipient's inventory (not placed) with a notice; Decline removes the item
  with a notice — evidence: the move itself is server-side (SIM-037.3, `handoffs.ts` confirm); the UI calls
  `confirmHandoff` / `declineHandoff` (`devices-api.test.ts › confirmHandoff / declineHandoff send POST ...<encoded id>
  ...`), then refreshes both lists and the badge (`DevicesPage.tsx:79-99`). Notices: `incoming-transfer.ts:30-51`;
  `incoming-transfer.test.ts › confirmOutcome › ok: status notice names device and inventory number, says not placed,
  refresh`, `› filter hint only when the filter is placed or unowned`, `declineOutcome › ok: status notice, refresh`.
  Filter hint names the real chip labels ("All", "Not placed", `copy/devices.ts:7`) and shows exactly for the filters
  that hide an owned, unplaced device (`incoming-transfer.ts:37`).
- [x] 3 A stale Confirm or Decline shows a message and refreshes — evidence: `incoming-transfer.ts:17-27` (stale codes →
  status `transfer.gone` + refresh; auth / unavailable / internal / invalid_request → error, no refresh; other domain
  refusals → error + refresh); `incoming-transfer.test.ts › handoff_not_pending, handoff_stale, not_found: status
  transfer.gone, refresh`, `› auth codes, unavailable, internal, invalid_request: error notice, no refresh`, `›
  not_allowed, member_not_assignable, placement_changed: error notice with apiErrorMessage, refresh`. Decline shares the
  same `failed()` path.
- [x] 4 Devices nav shows the incoming count with sr text "N incoming transfer(s)"; requests text unchanged —
  evidence: `AppShell.tsx:16,22`, `AppShellView.tsx:101`, `copy/shell.ts:4-6,44-49`; `AppShellView.test.tsx › devices
  badge: numeral aria-hidden, sr-only '3 incoming transfers' / '1 incoming transfer'`, `› devices 12: 9+ visible, '12
  incoming transfers'`, `› devices 0 or missing: no badge markup`, `› myRequests and devices together: each link has its
  own text`; the existing myRequests cases are unedited and green. `useHandoffBadge.tsx` is a line-for-line copy of
  `useRequestBadge.tsx` (diffed: only the fetch, names and doc text differ), no polling (D24).
- [x] 5 All new strings in `src/ui/copy/*` (D36) — evidence: new copy in `copy/devices.ts` (`incoming` block) and
  `copy/shell.ts` (`incomingTransfers`, `byNav`); the new `.tsx` files contain no English literals (the repo's
  `no-literals.test.ts` passes in the full run).
- Manual two-account run (Test plan "Manual"): not run by the implementer (no second dev account). The unit and markup
  evidence above covers every criterion; the PR should carry the manual steps for Ming (start then confirm, start then
  decline, stale confirm after the sender cancels).

### Issues
None.

### Scope
Every changed product file is in the plan's file list. `work/ming-todo.md` (M-60 / M-61 ticked) and the ticket's own
work files are loop bookkeeping, not product changes. No High path changed.

### Rules (CLAUDE.md)
No violations found. R1: ui-only imports, `check:layers` clean. R3: no config or secrets. R4: no server change, no
generic badge factory. R5: new logic (`incoming-transfer.ts`, API client methods) has tests. R7: auth codes only mapped
in the UI and never cause a refresh or retry.

### Blockers from review agents
None (no review-trigger path changed).

### Nits (do not block)
- `IncomingTransfers.tsx:41`: when the first load fails and there are no items, the section heading reads
  "0 incoming transfers" above the error. A neutral heading (e.g. "Incoming transfers") would read better in that state.
- `DevicesPage.tsx:79-99`: on a no-refresh error (network / auth), the clicked button was `disabled` during the request,
  which can drop focus to `body` in some browsers; the plan accepted "focus stays put". Consider focusing that item's
  Confirm again after re-enabling.
- `IncomingTransfers` has no `status` prop, so the plan's "loading: renders nothing" test case was folded into "empty
  and no error: renders nothing". Behaviour is the same (initial state has no items and no error).

### Follow-ups (out of scope)
- Row Cancel stays visually enabled while a confirm / decline is in flight (guard ignores the click); needs a
  `DeviceTable` change (impl-log Follow-ups).
- If SIM-037.4 / SIM-037.5 add a third nav badge, open a `debt` issue for a shared badge factory (plan Assumptions).
