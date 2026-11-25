# Security review — SIM-037.5

## Attempt 1

Agent: security-ai-generated-code-auditor (run through general-purpose with the agent file). Scope: `git diff origin/main...HEAD` (33 files; 18 source, the rest tests and fixtures). Static reading only. No checks or DB tests were run. The impl-log says `test:db` was NOT RUN locally (no Postgres) and is waiting on CI.

**Verdict: no 🔴 blockers.** One 🟡 should-fix: the deactivation lock cycle from SIM-037.4 is still open (`lockMember` still takes `for update`), and this diff adds three more paths into it. Everything else is a 💭 note.

### Focus areas checked

- **Extension start: owner only.**
  - Route: `withAuth` (`src/app/api/devices/[id]/handoffs/route.ts:12`). The order is UUID (404), then pool (503), then JSON (400), then `validateHandoffStart(body, todayUtc7(new Date()))` (400), then dispatch on kind (`:20-27`).
  - Service: device `for update`, then the pending read under that lock, then `decideExtensionStart`, then INSERT (`src/server/devices/handoffs.ts:267-291`).
  - `decideExtensionStart` (`src/lib/devices/handoff-rules.ts:82-92`): a null member gives `not_allowed`, an unowned device gives `device_unowned`, `actor !== owner` gives `not_allowed`, and a pending handoff gives `handoff_pending`. `tier` is not consulted, so a Manager or Admin who is not the owner gets 422. That matches the plan: they edit the expiry directly.
  - The owner check compares the member id from `actorMemberId(sub)` (token) with `owner_id` read under the device lock. No client field is trusted.
  - The INSERT sets `from_member_id = requested_by_id = me`, not a body value (`:290`). The validator's allowed-key list per kind refuses `toMemberId` on an extension (`src/lib/validate/device.ts:205-212`).
  - One pending handoff per device: the check runs under the device lock, and the partial unique index backs it up. Transfer and return starts already refuse any pending kind.
- **Approve and reject: Manager+.**
  - `decideHandoffAction` (`handoff-rules.ts:116-121`): cancel is checked first (owner = from, or Manager+). Then an extension allows confirm and decline only when `atLeast(tier, "manager")`. A null member is refused first, and permission is checked before status.
  - Confirm: the permission check on the unlocked row returns before any transaction (`handoffs.ts:624-633`), then dispatch to `confirmExtensionOnce` (`:634-636`). `kind` and `device_id` cannot change and `tier` comes from the token, so not re-checking permission under the lock is safe.
  - Decline and cancel go through the generic `closeHandoff`, which checks again under the handoff lock (`:341-348`).
  - `handoffFlags` reuses the same function, so `canConfirm` and `canDecline` cannot drift from what is enforced.
  - The owner (User), another User and a portal Admin with no member row all get 422.
- **`box=extensions`.**
  - A caller below Manager gets 422 `not_allowed` before any query (`handoffs.ts:738-740`).
  - The kind literal is interpolated from a fixed ternary on the validated union `HandoffBox` (`:750`), not from user input, so there is no injection.
  - The list is org-wide pending extensions only, and the joins repeat `org_id` (`handoffRows`, `:82-87`).
- **Count fields.**
  - `extensions` is `count(*) filter (where kind = 'extension' and $4::boolean)`, where `$4 = atLeast(tier, "manager")` from the verified token. It is 0 for a User.
  - `overdue` is a scalar subquery `where org_id = $1 and owner_id = $2 and holding_expires_on < $5::date`, where `$2` is the caller's member id from the token sub (`handoffs.ts:783-791`). It cannot count another member's or another org's devices. A null `holding_expires_on` never matches. A caller with no member row gets all zeros (`:777-779`).
  - The `incoming` filter `to_member_id = $2` is unchanged, and an extension has `to_member_id = null`, so extensions never show as incoming.
- **R6 org scoping.**
  - Every new query goes through `orgQuery` with `org_id = $1`: `startExtension` device lock, pending read and INSERT; `confirmExtensionOnce` device lock, handoff lock and expiry UPDATE (`:584`); the list filter; the count and its subquery.
  - `deviceRows` keeps `d.org_id = $1` and its joins.
  - A handoff id or device id from another org gets 404.
- **R7.**
  - Every refusal in the diff is 404, 409 or 422, through `refuse`/`Abort` or `Result`. No handler returns 401 or 403. `Refusal.status` typing is unchanged.
  - On the confirm path, permission is refused before any lock. On start, permission and state are refused before the INSERT and before `writeAudit`. The device row is locked first, with no write, which is the same pattern as `startReturn`.
- **Date validation and clock.**
  - Every route injects `todayUtc7(new Date())` (handoffs start, confirm, count, list and get devices). `todayUtc7` adds the +7 h offset and slices the ISO day (`src/lib/devices/holding.ts:5-7`).
  - The validator needs `parseCalendarDay`, a strict `YYYY-MM-DD` that is a real date in years 2000-2100, and `day > today` (`validate/device.ts:219-222`). The string compare is correct for zero-padded days. The bound matches the holding edit (`expiry()`, which uses `>= today`).
  - Approve re-checks `new_expires_on <= today` under the lock and returns 409 `handoff_stale` (`handoffs.ts:578-580`). It also re-checks that the owner is unchanged (`owner_id !== from_member_id` gives `handoff_stale`). An extension cannot be applied to a new owner after a reassignment.
- **SQL parameter shifts.**
  - `deviceRows` binds `[sub, today, ...values]` (`src/server/devices/devices.ts:159`). `$3::date` is used in the select expression (`:144`), so `$3` is always referenced and its type is always inferred as date. `FILTER_SQL.overdue` reuses `$3` (`:170`).
  - `getDevice` (`:208`) and `reload` (`:612`) moved to `d.id = $4` with `[id]`. `listDevices` passes `[]`.
  - Grep finds no other `deviceRows` caller, and `layout.ts`'s `deviceRows` is an unrelated local name.
  - `updateHolding`'s `$${i + 3}` belongs to its own query and is not affected.
  - The count query has `$1` org, `$2` me, `$3` admin, `$4` manager, `$5` today, matching its 4 bound values plus the org.
- **Lock order in `confirmExtensionOnce`.**
  - The order is device `for update`, then handoff `for update` (`handoffs.ts:561-575`). That is consistent with `startExtension`/`startReturn` (device, then handoff) and with take-back (room, seat, device, handoff).
  - Approve vs cancel or decline: `closeHandoff` locks only the handoff row and never the device, so there is no cycle and one winner.
  - Approve vs take-back: same order, then take-back cancels the extension, or approve sees `handoff_not_pending`.
  - Approve vs `updateHolding`: both lock the device row, so they are serialized. See the 💭 below.
  - Approve vs deactivation of the owner, when the approver is someone else: the approver's only member lock is `FOR KEY SHARE` on the approver (from `decided_by_id`). `update devices set holding_expires_on` does not touch `owner_id`, so there is no FK re-check on the owner. There is no cycle. The exception is the 🟡 below.
- **Information exposure.**
  - `overdue` and `pendingHandoff.newExpiresOn` are visible org-wide on `DeviceDto`. `holding.expiresOn` was already org-wide (`devices.ts:92`), so nothing new leaks.
  - The extension note appears only in `HandoffDto` (the Manager+ `extensions` box, and the start/confirm response to the actor). Device rows still carry no handoff note.
- **Audit.**
  - `device.extension_start` (meta: handoff id, owner, inventory number, new date, note), `device.extension_confirm` (`fromExpiresOn`/`toExpiresOn`), and generic `device.extension_decline` / `_cancel`.
  - Every refusal throws before `writeAudit`. The actor always comes from `actorSub`.
- **Secrets.** No secrets, no env or client-exposed config, no LLM call sites.

### Findings

🟡 **The SIM-037.4 deactivation lock cycle is still open, and extensions add three more paths** (`src/server/members/manage.ts:228`, `:423-427`; `src/server/devices/handoffs.ts:286-291`, `:346-355`, `:584-587`).
- **Cause.** `lockMember` still takes `select … for update` (manage.ts:228), so the 🟡 fix from SIM-037.4 (`for no key update`) has not landed. Every write that sets a member FK (`from_member_id`/`requested_by_id` on insert, `decided_by_id` on update) takes `FOR KEY SHARE` on that member row, and `FOR KEY SHARE` conflicts with `FOR UPDATE`.
- **New paths in this diff:**
  1. **Owner cancels their own extension while a Manager deactivates them.** `closeHandoff` locks H (`:346`), then writes `decided_by_id = X`. Deactivation holds X `for update`, then waits on H. This is a deadlock.
  2. **Owner starts an extension on a placed device while being deactivated.** `startExtension` locks D (`:269`), then the INSERT needs `KEY SHARE` on X. Deactivation holds X, then updates X's placed device D (manage.ts:381/395). This is a deadlock. The same cycle exists for `startReturn`.
  3. **A Manager approves their own extension while being deactivated.** This is allowed by the plan assumption. `confirmExtensionOnce` holds D and H, and `setConfirmed` needs `KEY SHARE` on X.
- **Effect.** Postgres aborts one side with `40P01`, which surfaces as a 500. Nothing is corrupted, because the losing transaction rolls back. The plan's lock-order note (Approach 3) does not mention it.
- **Fix.** Same as SIM-037.4: in `lockMember` (or only in `deactivateMember`), use `for no key update` instead of `for update`. If that is tracked as a `debt` issue, link SIM-037.5 to it and add the extension paths to its description. Add a two-connection DB test: the owner holds a cancel of an extension open while the Manager deactivates them. Expect no deadlock and one winner.

💭 **`reload` uses the real clock by default** (`src/server/devices/devices.ts:610`). Write responses from `placeDevice`, `updateDevice`, `assignDevice`, `updateHolding` and `takeBack` compute `overdue` from `todayUtc7(new Date())` inside `src/server`. This breaks the injected-clock pattern, and DB tests cannot pin `today` for those responses. It is a recorded design deviation and has no security impact. Optional fix: thread `today` from the routes, as `getDevice` does.

💭 **A Manager can approve their own extension request** (`handoff-rules.ts:118`). This is accepted in the plan ("spec only requires Admin/Manager"). A Manager can already set their own expiry directly with `updateHolding` (Manager+), so this adds no privilege. Worth stating in the spec if separation of duties is ever wanted.

💭 **A Manager's direct holding edit does not cancel a pending extension** (`devices.ts:503-550`). If a Manager sets the expiry and a pending extension is approved later, the requested date overwrites the edit. The audit row records `fromExpiresOn`, and only Manager+ can do either action, so there is no security impact. Optional: refuse or cancel in `updateHolding` when an extension is pending, or show it in the slice 2 UI.

💭 **A pending extension is left behind after the owner changes.** If the device is reassigned while an extension is pending, approve correctly returns 409 `handoff_stale`. But the stale request still blocks every new handoff on the device until a Manager+ cancels or rejects it. Not a security issue. Consider cancelling it where ownership changes, or leaving it to the slice 2 UI.

💭 **Rows are locked before the start refusal** (`handoffs.ts:267-284`). The device row is locked `for update` before `decideExtensionStart` refuses a non-owner. There is no write, R7 holds, and the transaction is short. Same pattern as `startReturn` and the SIM-037.3 and SIM-037.4 💭.

💭 **No DB run yet.** These claims rest on static reading:
- the `$3`/`$4` shift in `deviceRows`, `getDevice` and `reload`
- the `overdue` expression and filter
- the 5-parameter count query
- `confirmExtensionOnce`'s stale checks

`pnpm test:db` must be green in CI before PASS (R5).

### Follow-ups (out of scope)
- Land the SIM-037.4 `lockMember` lock-mode fix, which covers the three new paths above.
- Add a DB test for member deactivation cancelling a pending extension. The impl-log notes the OQ-44 test covers transfer and return only. The code path has no kind filter (manage.ts:424-426).
- Slice 2 (SIM-037.11): the UI must use `canConfirm`/`canDecline` from `HandoffDto` and not re-derive them, and must show the stale-owner and stale-date 409s.

## Attempt 2

Agent: security-ai-generated-code-auditor. Scope: the attempt 2 commit `50aa88f` ("coalesce overdue to boolean (rework 2)"), which changes only `src/server/devices/devices.ts`: 2 lines, +2/−2. Static reading only. No checks or DB tests were run.

**Verdict: no 🔴 blockers. Attempt 2 adds no new findings.**

### Delta checked
- **`src/server/devices/devices.ts:144`** (the `deviceRows` select): `overdue` is now `coalesce(d.owner_id is not null and d.holding_expires_on < $3::date, false)`.
  - Before this change, an owned device with a null `holding_expires_on` produced SQL `NULL`. Now it is always a boolean, which matches `DeviceDto.overdue: boolean` (`:73`, `:112`).
  - No new data is exposed. It is still computed from columns that were already visible org-wide.
- **`src/server/devices/devices.ts:170`** (`FILTER_SQL.overdue`): the same `coalesce` is used. In a WHERE clause, NULL and false both drop the row, so the filter returns the same rows as before. This is a fixed string literal with no user input in it, so there is no injection risk.
- **Parameters:** `$3` is still the injected `today`, bound by `deviceRows`. The `$3`/`$4` positions are unchanged, so the parameter shift checked in attempt 1 still holds.
- **R6 and R7:** org scoping is untouched (`d.org_id = $1` and the joins are unchanged). No status codes changed.

### Attempt 1 findings
None of them changed. The delta does not touch any of the code involved:
- 🟡 **The deactivation lock cycle is still open.** `lockMember` still uses `for update` (`src/server/members/manage.ts:228`), and the three extension paths in `src/server/devices/handoffs.ts` are unchanged.
- 💭 **The four notes still apply:** `reload` uses the real clock (`devices.ts` `reload`), a Manager can approve their own extension, a direct holding edit does not cancel a pending extension, and a stale extension is left behind after the owner changes.

### Follow-ups
None new.
