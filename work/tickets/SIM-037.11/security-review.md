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
