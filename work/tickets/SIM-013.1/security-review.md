# SIM-013.1 security review

## Attempt 1

## Security review: SIM-013.1, attempt 1

**Verdict: no blockers and no should-fix items. Security PASS on everything I could check by reading the code.** I could not run git, so I read the files listed in `impl-log.md`, plus `org-scope.ts`, `audit/write.ts`, `read-json.ts`, `lib/devices/rules.ts` and `init.sql:113-139`. The DB behaviour, including the delete-vs-place race test, is only proven once `pnpm test:db` is green in CI (R5).

### Findings

🟢 **R6 org scoping: met.** File: `d:\project\simap-game-ui\src\server\devices\devices.ts`
- Every new query goes through `orgQuery` with `org_id = $1`, and `$1` always comes from `scope.orgId`. The queries are:
  - the actor lookup, `:298`
  - the owner lookup, `:321`
  - the insert, `:329-332`, which uses the select-from-subselect form with `org_id` taken from the scope, never from the body
  - the locked reads, `:374-375` and `:426-427`
  - the update, `:390`
  - the delete, `:434`
  - the audit insert, `write.ts:22-24`
- `reload` reuses `deviceRows`, which repeats `org_id` on every join (`:121-123`).
- The DB backs this up. `devices_owner_fkey (org_id, owner_id) references members (org_id, id)` (`init.sql:133`) means a device cannot point at a member in another org, even if a code path were missed.

🟢 **Authorization: met.**
- **Create (`:313-317`):**
  - When `ownerId` is absent, the caller's own member id is used. No member row gives 422 `no_linked_member`.
  - `canCreateFor(tier, ownerId === me)` lets only an Admin create for someone else (`rules.ts:12`).
  - A non-Admin who sends their own member id as `ownerId` passes, which is correct.
  - An Admin with no member row can still create for a named member, which matches the spec.
- **Update (`:380`) and delete (`:432`):** both use `canEdit(tier, me === cur.owner_id)`, which allows the owner or an Admin only (D19). `me` is `null` when the caller has no member row, so the comparison is safely false.
- **Owner is immutable:**
  - `validateDevicePatch` only accepts `name`, `type`, `inventoryNumber` and `mac` (`d:\project\simap-game-ui\src\lib\validate\device.ts:117`). `ownerId`, `seatId` and `role` are rejected with a 400.
  - `COLUMNS` (`devices.ts:347-352`) has no `owner_id`, `seat_id`, `role` or `org_id`, so even a validator mistake could not write them.
  - The comment at `:194-195` covers the unlocked `owner_id` read in `placeDevice`.

🟢 **No cross-org id leaks.**
- The permission check runs before the owner lookup (`:317` before `:318`). A non-Admin always gets 422 and never sees the 404/422 difference that would reveal whether a member id exists.
- An Admin can only probe their own org, because the lookup is org-scoped, so another org's member id gives 404.
- A 422 on update or delete does reveal that a device exists in the caller's own org. That is fine: the list endpoint already shows those devices to any member.
- The 409 for a duplicate does not echo the conflicting device (`pg-error.ts`, `inTx` at `:57-58`).

🟢 **R7: met.**
- Route handlers (`d:\project\simap-game-ui\src\app\api\devices\route.ts:25-38`, `d:\project\simap-game-ui\src\app\api\devices\[id]\route.ts:26-54`) never return 401/403 themselves. Only `withAuth` (tier `user`) does.
- The services can only return 404/409/422 (`Refusal.status`, `:31`).
- Every refusal is thrown as `Abort` before the insert, update, delete or audit (`:315-325`, `:379-380`, `:431-433`). `withTx` rolls back.
- The 23505 errors map to 409 after rollback, so there is no partial write.

🟢 **PATCH SQL cannot be injected.**
- The `SET` clause is built only from the constant `COLUMNS` (`:386`). Placeholders run `$3..$n`, and the values go in as parameters (`:391`).
- The filter on `key in patch` is safe. `patch` is a fresh object, and its keys are checked against the fixed `COLUMNS` list.
- A JSON body with a `__proto__` key becomes an own key, so it fails the unknown-key check and gets a 400.
- A no-op patch writes nothing (`:384`).

🟢 **Input validation: sound.**
- **MAC:** four anchored, case-insensitive regexes, then the input is re-chunked (`device.ts:55-76`). The output always matches the DB check `init.sql:128`. Mixed separators and bad lengths are rejected.
- **Text fields:** NFC, trimmed, capped in code points (120 for name, 60 for type and inventory number), with `\p{Cc}` and `\p{Cf}` rejected (`:78-86`). That rejects newlines, tabs, zero-width characters and bidi overrides such as U+202E.
- **Body:** capped at 16 KiB, must be `application/json`, and invalid UTF-8 is rejected (`read-json.ts:6-33`).
- **`ownerId`:** must be a canonical uuid (`:109`).
- 💭 Note: `text()` still accepts U+2028 and U+2029 (line and paragraph separators), private-use characters, and lone surrogates sent as JSON `\ud800` escapes. pg sends a lone surrogate as U+FFFD, so it cannot cause a 500. The only risk is display spoofing. The fix, if wanted, is to widen the class to `/[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Zl}\p{Zp}]/u`. This is a follow-up, not needed for this ticket.

🟢 **Audit meta holds no sensitive data.**
- Create and delete log `{ inventoryNumber, ownerId }` (`:341`, `:440`).
- Update logs `{ fields }` with field names only, plus the inventory number's `from`/`to` (`:399-402`).
- Name, type and MAC stay out of the audit, as `write.ts:6` requires and as the plan decided.
- `actorSub` comes from the verified token, not the body.

🟢 **D31 delete-vs-place race: closed.**
- `deleteDevice` locks the device row `for update` (`:426-427`). Then it checks permission, then the placement (`:432-433`), then deletes.
- `placeDevice` takes that same device lock last (`:236`).
  - If delete commits first, place's locked read returns no row and answers 404 (`:240`).
  - If place commits first, delete then sees `seat_id` set and answers 409 `device_placed`.
- Delete holds only the device lock, and place takes it last, so there is no deadlock.
- The composite FKs are `on delete restrict` on the parent side, and nothing references `devices`, so the plain delete is safe.
- The test exists in `devices.db.test.ts`, but only CI has run it.

🟢 **R3:** no new environment variables, no secrets, and nothing reaches a client bundle. **R1:** only `src/app/api/devices/**` imports `@/server/devices/*`.

### Follow-ups (out of scope)
- 💭 Widen the `text()` rejected characters as described above. Better done once in a shared helper, since `room.ts` and `member.ts` likely have the same gap.
- 💭 Inventory number uniqueness is case-sensitive (plan Assumption 1), so `AB-1` and `ab-1` can both exist and look like one record. Changing that needs a migration and Ming's decision.
