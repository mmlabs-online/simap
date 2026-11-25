# Security review — SIM-037.11

## Attempt 1

**Verdict: PASS on security.** I found no blockers and nothing that must be fixed. This was a read-only review: no files were edited and no commands were run. I could not run `git diff` (no shell), so I reviewed the changed files listed in `impl-log.md` and grepped the server code they call.

### Findings

**db/seeder.js**
- 🟢 **The seeder still only runs against a local dev database.** The new "Tablet E" insert (`d:\project\simap-game-ui\db\seeder.js:145-151`) sits after the existing guard, `assertDevSeedTarget` (lines 3-4, 8, 16-34). That guard refuses to seed when:
  - `NODE_ENV=production`;
  - `DATABASE_URL` is missing or invalid;
  - the host is anything other than localhost / 127.0.0.1 / ::1;
  - the URL has `host` or `hostaddr` overrides;
  - the target is the production database.

  The change does not weaken any of this.
- 🟢 **No secrets or real personal data.** The insert is parameterized (`$1..$4`) and uses only seed UUIDs (`u("8", 5)`), the seed org, `INV-5-${o.key}` and an existing seed member. It has no credentials and no real names or emails. The expiry date is computed in SQL (`(now() at time zone 'Asia/Ho_Chi_Minh')::date - 1`), with no user input involved.
- 💭 Note, not a security issue: the new row is a second `insert ... on conflict do nothing`, outside the `devices` array (lines 132-144). It is idempotent and the id `u("8",5)` does not clash with the four existing devices (`u("8",1..4)`).

**src/ui/devices (new and changed files)**
- 🟢 **No server imports.** A grep of `src/ui/devices` finds no `@/server`, no `server-only` and no `process.env`. The new files import only `@/lib/*`, `../copy/*` and sibling UI modules:
  - `d:\project\simap-game-ui\src\ui\devices\extend-device.ts:1-5`
  - `d:\project\simap-game-ui\src\ui\devices\ExtendDeviceDialog.tsx:3-16`
  - `d:\project\simap-game-ui\src\ui\devices\OverdueBanner.tsx:1-8`

  This matches the reported `check:layers` result (no violations).
- 🟢 **No secrets in client code.** No API keys or token handling were added. The "token" grep hits are only `reloadToken` React state counters in other dialogs.
- 🟢 **The request is built safely.** `startExtension` (`d:\project\simap-game-ui\src\ui\devices\devices-api.ts:166-174`):
  - sends a JSON body;
  - URL-encodes the device id in the path (`devicePath` at line 63);
  - goes through the shared `ApiFetch` (bearer token from memory, D4).

  The client checks its input with the server's own validator (`validateHandoffStart`, `extend-device.ts:24-41`). That only improves the user experience; it is not the security check.
- 🟢 **Authorization is enforced on the server.** The UI hides the Extend action unless the device is the user's own and overdue (`d.mine && d.overdue` at `OverdueBanner.tsx:29`; `!pending` gating in `device-actions.ts`). The server checks again on its own, in `d:\project\simap-game-ui\src\server\devices\handoffs.ts:264-284`:
  - it scopes the query by org (`orgQuery` with `org_id = $1`) and locks the device row (`for update`);
  - `decideExtensionStart` checks that the caller owns the device and that there is no pending handoff;
  - any refusal (`refuse(...)`) happens before the insert and the audit write, which follows R7 and R6.

  Approving an extension is limited to Manager+ on the server (lines 605, 634, 738).
- 🟢 **No new personal data reaches the client.** The banner and dialog show only fields already in `DeviceDto`: name, type, inventory number, expiry date and the pending-handoff text. React escapes all of it as text, and there is no `dangerouslySetInnerHTML`.
- 💭 `settleExtend` treats a `not_found` reply as "done" (`extend-device.ts:49`). That closes the dialog cleanly and does not reveal whether a device exists in another org.

### Follow-ups (out of scope)
- None for security. Once slice 2 (SIM-037.12) lands, a short re-check of the Manager+ pending-extensions list and badge would be worthwhile; the server already rejects non-Managers with 422 `not_allowed` at `handoffs.ts:738-740`.

## Attempt 2

**Security re-check, SIM-037.11 attempt 2: PASS (no blockers, no should-fix)**

I read the changed code and checked imports with Grep. I had no shell, so I did not run any checks.

### Findings
- 🟢 `d:\project\simap-game-ui\src\ui\devices\device-actions.ts:158-163`: `bannerHandlers` is a pure function. It returns only `onExtend`, `onReturn` and `onCancelHandoff` from the full handler set. That reduces what the banner can trigger, so it shrinks the attack surface and adds none. There is no I/O, no secrets, no server import and no new env use. The file's imports (lines 1-4) are `@/lib` types and other `ui` modules only, so R1 still holds. Each action stays gated by the per-device flags in `rowActions`, which come from the server (e.g. `canDelete` at line 143). The server still makes the real authorization decision.
- 🟢 `d:\project\simap-game-ui\src\ui\devices\DevicesPage.tsx:207`: the only change is `handlers={bannerHandlers(actions)}`. The banner calls the same `actions` handlers through the same API client as before. There is no new fetch path, no change to token handling, and no new data reaches the client. `onNew` is still behind `isAdmin` (line 198); that is a UI convenience only, and the server enforces it.
- 🟢 `d:\project\simap-game-ui\src\ui\devices\device-actions.test.ts:286-311`: the new test confirms the key set is limited to the 3 handlers. It also checks that an overdue row the user owns only shows `extend` / `giveBack` / `cancelTransfer` / `cancelExtension`, and that admin actions like delete, edit and assign do not leak into the banner. It is a good regression guard.

### Follow-ups
None. Attempt 1's security review (`d:\project\simap-game-ui\work\tickets\SIM-037.11\security-review.md`) still applies, because attempt 2 does not touch any route handler, server code, SQL or auth path.
