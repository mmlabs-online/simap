# Security review — SIM-037.12

## Attempt 1

**Security review: SIM-037.12, attempt 1. Verdict: PASS, no blockers**

### Findings
- 🟢 **Seeder stays behind the local-dev guard.** The new pending-extension insert is at `d:\project\simap-game-ui\db\seeder.js:152-159`. `d:\project\simap-game-ui\db\seed-dev.js:9` calls `assertDevSeedTarget` before any seeding, and that guard (`d:\project\simap-game-ui\db\seeder.js:15-34`) refuses a non-local host and `NODE_ENV=production`. The row holds only fixed fake data: a deterministic `u("c",1)` id, the seeded member `members[0]`, and a generic English note. It has no secrets, real names or emails. `on conflict do nothing` keeps it idempotent, which matches the impl-log's two "seed ok" runs.
- 🟢 **A non-Manager never calls `GET /api/handoffs?box=extensions`.** `d:\project\simap-game-ui\src\ui\devices\DevicesPage.tsx:58` works out `isManager` with `atLeastTier`. Line 70 passes it to `handoffBoxes` (`d:\project\simap-game-ui\src\ui\devices\incoming-transfer.ts:98-101`, which adds `extensions` only when `isManager` is true). Line 72 passes `enabled` to `useHandoffList`. When `enabled` is false, `d:\project\simap-game-ui\src\ui\devices\useIncomingHandoffs.ts:26` and `:35` return before fetching, so neither the first load nor `refresh` calls the API. `PendingExtensions` renders nothing when it has no items and no error (`d:\project\simap-game-ui\src\ui\devices\PendingExtensions.tsx:31`).
- 🟢 **The server enforces the same rule.** `listHandoffs` returns 422 `not_allowed` for `box=extensions` below Manager, before any query (`d:\project\simap-game-ui\src\server\devices\handoffs.ts:742-744`). That follows R7: a domain refusal, not a late 401/403. The `kind` value put into the SQL text at `:754` is a hard-coded literal picked by a ternary, not user input, so there is no injection risk.
- 🟢 **Approve/Reject buttons follow the server flags.** They render only when `item.canConfirm` / `item.canDecline` is true (`d:\project\simap-game-ui\src\ui\devices\PendingExtensions.tsx:79` and `:94`).
- 🟢 **Server-side authorization for confirm/decline is Manager+.** `decideHandoffAction` allows an extension only for `atLeast(tier, "manager")` (`d:\project\simap-game-ui\src\lib\devices\handoff-rules.ts:118`), and returns false when the caller has no member id (`:116`).
  - Confirm: checks this before any lock or write (`d:\project\simap-game-ui\src\server\devices\handoffs.ts:628-639`).
  - Decline: goes through `closeHandoff`, which checks before the lock and again after the row lock, before the update (`d:\project\simap-game-ui\src\server\devices\handoffs.ts:336-353`).
- 🟢 **No server imports in `src/ui`.** A search of `src/ui` for `@/server` and `server-only` found nothing. The impl-log also reports `check:layers` clean (785 files, no violations).
- 🟢 **No PII beyond the API response.** The extension row shows only the device name, type, inventory number, `from.displayName`, the expiry dates and the note, all fields that already come back from the Manager-gated API (`d:\project\simap-game-ui\src\ui\devices\PendingExtensions.tsx:62-75`). React renders the note as text, so it cannot inject HTML. No email or sub is shown.

### Follow-ups (out of scope)
- None.

I did not run any checks myself (I had no shell). The green checks come from the impl-log.
