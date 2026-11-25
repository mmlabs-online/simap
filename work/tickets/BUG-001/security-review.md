# Security review — BUG-001

## Attempt 1

## Security review: BUG-001, attempt 1

**Verdict: no 🔴 and no 🟡 findings.** The two test edits do not weaken any security-relevant assertion. `export.ts` still scopes every query by org and adds no new PII.

I had no shell (Read/Grep/Glob only), so I could not run `git diff` against origin/main. I compared the current files against the stale lines named in `ticket.md` and `plan.md`, and against the "Files touched" list in `impl-log.md`.

### Findings

🟢 **1. Org isolation of the CSV export is intact**
- File: `/home/user/simap/src/server/export/export.ts`
- All three queries filter `where <alias>.org_id = $1`: seats at :36, devices at :76, members at :100.
- Every join is also keyed on `org_id`:
  - seats joins at :32-35
  - devices joins at :73-75; rooms joins through `s.org_id`, which is itself bound to `d.org_id`
  - members joins at :99
- They run through `orgQuery` (`/home/user/simap/src/server/http/org-scope.ts:21-24`). It throws unless the SQL contains `org_id = $1` and binds `scope.orgId` as `$1`. Only the row cap is passed as an extra value.
- The query runs in a read-only, repeatable-read transaction (:116). Nothing changed here in BUG-001.

🟢 **2. No extra PII in the devices export**
- SIM-037.2 added Serial, Manufacturer and Brand (:59-61, :69, :84-86). These are asset attributes, not personal data.
- Personal data in the devices export is still limited to Owner name and Owner employee code (:70). It has no owner email.
- The emails in the seats export (Occupant email) and the members export already existed and were not touched by this change.

🟢 **3. The export test still proves org isolation, and now more strictly**
- File: `/home/user/simap/src/server/export/export.db.test.ts`
- Two orgs are seeded (:46-47). Org A's devices export must have exactly 1 row (:56) whose owner is "Nguyễn a" (:58). Org B's device leaking in would break both checks.
- The seats and members isolation checks for both orgs are unchanged (:49-53, :64-71).
- Columns are now looked up by name with `colIndex` (:16-20), which throws on a missing column. A later column insert or rename now fails loudly instead of silently shifting.
- New checks were added for Owner employee code (:59) and Seat code (:62). No assertion was removed.
- The unowned-device test (:74-84) still asserts the owner name, owner code and room code are null for the inventory row.

🟢 **4. The device edit permission change matches the rules and removes no coverage**
- File: `/home/user/simap/src/server/devices/devices.db.test.ts:522` and `:525`
- Both calls changed tier `"user"` to `"admin"`. This is correct:
  - `canEdit = isOwner || tier === "admin"` (`/home/user/simap/src/lib/devices/rules.ts:9`).
  - `updateDevice` computes `isOwner` as `cur.owner_id !== null && me === cur.owner_id`. It refuses with 422 before any uniqueness work (`/home/user/simap/src/server/devices/devices.ts:398-399`).
  - Device `b` is created by an Admin (:517), so it is unowned under D63.
- The old assertion expected 409. It never asserted that the User was allowed, so changing it removes no permission coverage.
- The test still proves 409 `inventory_number_taken` (:523) and `mac_taken` with another MAC spelling (:526), that the stored value is unchanged (:527-528), and that the same values are allowed in another org (:529-536).
- The permission refusals are still covered by the edit permission test (:400-443):
  - The owner can edit (:405).
  - User and Manager editing another member's device get 422 `not_allowed`, and the row is unchanged (:419-426).
  - An Admin can edit (:427).

### Follow-ups (out of scope, 💭)
- **Missing test for unowned devices.** No DB test covers a User or Manager calling `updateDevice` on an *unowned* device. That is the `owner_id !== null` guard in `devices.ts:398`. If the guard were dropped, the edit matrix would still pass, because it only tests another member's owned device. Before this fix, the uniqueness test accidentally hit this path, which is how the 422 showed up. Suggested fix: a new test asserting `updateDevice(..., "user", <unowned id>, {...})` returns 422 `not_allowed` and leaves the row unchanged.
- **One-way devices isolation check.** The export test checks devices isolation only from org A's side (:55-62). A matching check of org B's devices export, expecting 1 row with owner "Nguyễn b", would make it symmetric like the seats and members checks.
