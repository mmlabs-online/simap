# Security review — SIM-015.6

## Attempt 1

Agent: `security-ai-generated-code-auditor`, 2026-11-22. Read-only review (no tests or checks run).

I found no blockers and nothing that must be fixed. All findings below are 🟢.

### Findings

🟢 **R6, org scoping.** `src/server/layout/layout.ts:70`, `:84`, `:93`
- All three queries go through `orgQuery` with `org_id = $1`. `$1` is set from `ctx.scope`, and `withAuth` builds `ctx.scope` from the verified token (`with-auth.ts:71`).
- The members join at `layout.ts:83` matches on both `o.org_id = s.org_id` and `o.id = s.occupant_id`, so it cannot pull a member from another org. The schema backs this with the composite foreign key `seats_occupant_fkey (org_id, occupant_id)`.
- A room in another org returns no row, so the route answers 404 `not_found` (`layout.ts:74`, `:133`). The DB test covers this (`layout.db.test.ts:179`).

🟢 **R7, auth codes.**
- The route returns no 401 or 403 of its own (`route.ts:11-22`). The only refusals are 404 for a bad id (`:14`), 503 when there is no pool (`:16`), and the service's 404 (`:18`).
- The handler only reads, inside a `read only` transaction (`layout.ts:60`), so no write can be repeated by `apiFetch`'s re-send.
- The tier is `user` (`route.ts:21`), which matches "any org member". The deactivated-member check runs in `withAuth` before the handler (`with-auth.ts:73`).

🟢 **R1, layer imports.**
- The route imports only `@/lib` and `@/server`.
- `layout.ts:1` starts with `import "server-only"`.
- `resolve-layout.ts` is in `src/lib/**` and imports only `@/lib/validate` and local sprite modules.

🟢 **R3, secrets and logging.** No secrets, env reads or log calls were added. Errors go to `withAuth`'s generic 500 handler, which logs only an error code.

🟢 **No raw Identity `sub` in the response.**
- `sub` is used only inside SQL, as `o.sub = $3::uuid` (`layout.ts:80`), and only the boolean `mine` comes back.
- `avatarSeed` is `s.occupant_id` (`seat-view.ts:17`). That is `members.id`, a per-org uuid (`20261120150000_init.sql:85`, `:104`), not `members.sub`.
- `$3::uuid` cannot fail on input: the token verifier already rejects a `sub` that is not a canonical uuid (`verify.ts:137`).

🟢 **Caps on `floor_zones` and `sprite_key`.**
- `floor_zones` is returned only when its JSON type is array, it has at most `LAYOUT_LIMITS.floors` (64) items, and its text is at most `bodyBytes` (262,144) bytes; otherwise it comes back as NULL (`layout.ts:65-68`).
- Both sprite columns are cut with `left(sprite_key, 129)` (`:81`, `:91`). 129 is one character over a 128-character key limit, so an oversized key still fails validation instead of being shortened into a valid one.
- Rows are capped at `seats + 1` (`:85`, used to set `truncated` at `:98`) and at `fixtures` (`:94`).
- The values in the SQL are compile-time constants (`validate/layout.ts:10-14`), not user input, so the template string is not an injection risk.

🟢 **Malformed stored data.**
- `take` now starts with the type guard the ticket asked for: object, string sprite, and safe-integer x, y and rotation (`resolve-layout.ts:69-78`).
- After that, every placement goes through `checkLayoutRules` (`:81`).
- Lookups in the sprite registry use `Object.hasOwn` (`placement.ts:30-31`), so a key like `__proto__` resolves to null. The DB test inserts both a 10,000-character key and `__proto__` (`layout.db.test.ts:240-245`).
- `parseStoredFloors` is all-or-nothing, checks the exact key set and integer fields, and falls back to the default floor on any problem (`resolve-layout.ts:22-43`).
- A corrupt grid falls back to the default layout (`:58-64`).
- A seat with no placement maps to `null` (`layout.ts:42-47`).

🟢 **Caching.** A successful response sends `Cache-Control: no-store` (`route.ts:19`). Every error response gets it from `apiError` (`respond.ts:6`).

💭 **Note, not a defect.** `display_name` of each seat's occupant goes to every member of the org (`layout.ts:79`, `seat-view.ts:17`). This matches spec "Room view (all roles)" and SEA-02, and it never crosses orgs. If names should ever be hidden from the `user` tier, that is a spec decision. I list it as a follow-up only.

### Follow-ups (out of scope)
- None needed. If you want an extra regression check, a route test could assert that the JSON response never contains the token's `sub`. Today only the DB layer guarantees this, and it does.

**Verdict: PASS. No security blockers; R1, R3, R6, R7 and every security note in the ticket are met.**
