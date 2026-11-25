# Security review — SIM-037.2

## Attempt 1

Security audit: SIM-037.2, review attempt 1 (`git diff origin/main...HEAD`). Agent: security-ai-generated-code-auditor (run through general-purpose with the agent file; static reading only, no tests or DB run).

**Result: no 🔴 blockers. Two 🟡 should-fix items, both small (one docstring, one visibility confirmation). The rest are 💭 notes.**

Checked: both new routes, `assignDevice` and `updateHolding` in `src/server/devices/devices.ts`, the validators in `src/lib/validate/device.ts` and `src/lib/devices/holding.ts`, the CSV export, search, the pg-error mapping, and the migration `db/migrations/20261125120000_device_lifecycle.sql`. No secrets, env access, client-exposed config or LLM calls in the diff.

### Findings

🟡 **1. Free-text note is stored in audit meta, against the `writeAudit` contract.** `src/server/devices/devices.ts:847-852` (`device.assign` meta `note`) and `:539` (`device.holding_update` meta `from`/`to` hold `{note, expiresOn}`).
- `src/server/audit/write.ts:6` says meta "holds codes, field names and counts only". Ticket scope line 28 and plan AC5 explicitly ask for the note in meta: a deliberate scope choice, not an implementer error.
- A Manager-written note about a person stays in the admin-only audit log (`src/app/api/audit/route.ts:19`, tier `admin`) even after the note is cleared or the device is deleted, and cannot be erased.
- Rendering is safe: no `dangerouslySetInnerHTML` in `src/` apart from `src/app/layout.tsx`; React escapes the text.
- **Fix (one commit):** update the `write.ts:6` docstring to allow "holding notes (DEV-07)". Optionally ask Ming to confirm notes may be kept in the audit log permanently. Do not change the code (scope requires it).

🟡 **2. Holding note is visible to every org member.** `src/server/devices/devices.ts:725` (`toDto`).
- `holding` is returned whatever the tier, so a plain User sees Managers' notes and expiry on any owned device. The spec (`docs/spec-v1.md:128`) does not say who may see the note.
- **Fix:** confirm with Ming that org-wide visibility is intended. If not, return `holding.note` only to `canManageHolding(tier) || r.mine`. At minimum the slice-2 UI should hint "visible to everyone in the org".

💭 **3. R7 satisfied.** Both routes `withAuth(..., { tier: "user" })` (`assignment/route.ts:32`, `holding/route.ts:32`); Manager+ check returns 422 `not_allowed` before `inTx` and any query (`devices.ts:810`, `:872-874`); only the wrapper returns 401/403; uuid, pool, body and validation checks precede the service call.

💭 **4. R6 satisfied.** Every lookup and write goes through `orgQuery` with `org_id = $1`: member lookup `:815`, device lock `:822`, `:883-884`, pending-handoff check `:831`, updates `:838-839`, `:900`. A `memberId` from another org returns 422 `member_not_assignable` (no existence leak).

💭 **5. Lock order safe against `deactivateMember`.** `assignDevice` locks member `for share` (`:815`) then device `for update` (`:822`); `deactivateMember` (`src/server/members/manage.ts:344`, `lockMember`) takes member `for update` first, then rooms, seats, devices — member always first, no deadlock; a concurrent deactivate waits and then sees the new owner. `updateHolding` locks only the device (`:884`). Two assigns are serialised; the second gets 409 `device_owned`.

💭 **6. Validators sound.** `CONTROL_NOT_NEWLINE = /[^\P{Cc}\n]|\p{Cf}/u` (`src/lib/validate/device.ts:545`) refuses every control char except LF (incl. tab, lone CR, bidi overrides, zero-width); CRLF → LF first. Note NFC, trimmed, ≤ 500 code points (`[...s].length`), consistent with DB `btrim`/`char_length <= 500` (migration lines 19-20). Serial/manufacturer/brand via `text()` (refuses all Cc/Cf). Unknown keys refused; `holdingNote`, `ownerId`, `note`, `expiresOn` cannot enter via create or PATCH (`:571`). `parseCalendarDay` (`src/lib/devices/holding.ts:248-259`) strict regex, UTC round-trip, years 2000-2100. `day < today` string compare correct; today computed server-side (`todayUtc7(new Date())`). `expiresOn` bound as `$n::date`, read back with `to_char`.

💭 **7. No CSV formula injection.** New columns go through `toCsv` → `csvCell` (`src/lib/export/csv.ts:13`, `:19`, `FORMULA_START = /^[=+\-@\t\r]/` gets a `'` prefix, then RFC quoting). Holding note not exported.

💭 **8. No SQL injection.** Search uses existing `like(col, p)` (`src/server/search/search.ts:51`) with fixed columns and bound `p` with `escape '\\'`. `updateHolding` column names only from fixed `HOLDING_COLUMNS` (`devices.ts:858-861`, `:894-896`).

💭 **9. Minor information exposure.** `serial_taken` (`src/server/devices/pg-error.ts:937`) reveals an existing serial within the caller's own org only. Serial index is case-sensitive (`devices_org_serial_key`, migration line 22): data quality, not security.

### Follow-ups (out of scope)
- Ming: may holding notes stay in the audit log permanently (retention/erasure), and may a plain User read other people's holding notes (finding 2)?
- Slice 2 UI: render the note as plain text, never HTML/Markdown; keep a "visible to the org" hint if finding 2 stays.
