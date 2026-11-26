# Security review — SIM-047

## Attempt 1

Summary: PASS from security. I found no blockers and no should-fix items in SIM-047 slice A. There are two notes (🟢) and no follow-ups are required. I read the code and did not run any checks.

**Findings**

🟢 **Server-side validation runs before any write.**
- `src/app/api/me/pixel-look/route.ts:25-29` parses the JSON (400 if it is bad) and calls `validatePixelLook` (422 `invalid_look`, or 400 for a non-object body). Only then does it reach the pool or the service.
- `isPixelLook` (`src/lib/sprites/pixel-look.ts:12-24`) requires exactly the four keys and checks them with `Object.keys`. A JSON `__proto__` key becomes its own property, which makes five keys, so the body is rejected. Each value must be a safe integer within the bounds of its ramp.
- The validator rebuilds the value from only those four fields (`src/lib/validate/pixel-look.ts:10-11`), so nothing extra gets through.

🟢 **Self-only.**
- No member id comes from the request. Every query is keyed on `ctx.sub` from the verified token (route.ts:16,32,43; `src/server/members/pixel-look.ts:21,38,48`).

🟢 **R6 org scoping.**
- Every statement goes through `orgQuery` with `org_id = $1` (pixel-look.ts:21,38,48).
- The layout join is scoped on both sides: `o.org_id = s.org_id and o.id = s.occupant_id ... where s.org_id = $1` (`src/server/layout/layout.ts:82-83`). A member's look cannot leak to another org.

🟢 **R7 is met, and this matches the precedent.**
- `withAuth` already rejects a deactivated member before the handler runs (`src/server/http/with-auth.ts:73-74`).
- The 403 `member_deactivated` in the service (pixel-look.ts:43) only covers the race where a member is deactivated between the gate and the row lock. It is returned after `select ... for update` and before the `update`/`writeAudit`, so no side effect has happened yet. If `apiFetch` re-sends, the request is still idempotent.
- This is the same pattern as `setOwnDisplayName` (`src/server/members/members.ts:97-98`). Read literally, R7 says these codes come "only from the auth wrapper", so the same wording question applies to the existing code. It is not a new risk.

🟢 **The DB check is correct** (`db/migrations/20261126140000_members_pixel_look.sql:7-17`).
- `CASE jsonb_typeof = 'object'` protects `?&` and `jsonb - text[]`, so a scalar or array value is rejected (`false`) instead of raising an operator error.
- Exact keys are enforced by `?&` together with `- keys = '{}'`.
- A missing key or a JSON `null` value fails, because `jsonb_typeof` gives `'null'` and the `?&` check is false.
- The regexes `^[0-3]$`, `^[0-5]$`, `^[1-3]$`, `^[0-6]$` match the ramps described in the migration comment and reject `1.0`, `-0` and multi-digit values. They are slightly stricter than JS, which is harmless because `JSON.stringify` writes integers as plain integers.
- The migration is expand-only: one nullable column, no default, so the previous image keeps working.

🟢 **The client parse of layout data is tolerant.**
- On the server, `seatViewOf` passes the raw jsonb through `parsePixelLook` and returns null for empty seats (`src/lib/sprites/seat-view.ts:23`).
- On the client, `toSeatView` parses it again (`src/lib/sprites/map-view.ts:104`), and `resolveLook` (pixel-look.ts:41-44) falls back to `avatarFor(seed)`.
- `lookFromChoice` indexes the ramps only after the range check, so out-of-range input cannot cause an undefined colour or injection.

🟢 **No new data exposure.**
- The layout select adds only `o.pixel_look` (layout.ts:78). The seat view carries only `look`, which is four small integers or null.
- GET returns only `{ look }` with `Cache-Control: no-store`.

🟢 **Audit meta** (pixel-look.ts:52-58).
- One `member.update` row is written, and only when the value changes (`is distinct from ... returning id`). Its meta is `{ fields: ["pixelLook"], self: true, look }`.
- `look` holds non-sensitive preset indices (null on reset), so there is no PII or secret in it.
- It goes beyond the displayName precedent, which records only field names. That is acceptable and useful for history.

🟢 **Secrets / R3.** There are no new env vars, keys or log lines in the files I reviewed.

**Notes (no action needed)**
- 💭 GET on a member row that was never created returns 404 `not_found` instead of creating it (pixel-look.ts:24). That is fine. The domain code is 404, not 401/403, so it does not trigger an `apiFetch` re-send.
- 💭 If the ramps are ever widened, `isPixelLook` follows the `*_RAMP.length` bounds automatically, but the hardcoded DB regexes will not. Writes would then fail at the check with a 500 until a new migration replaces the constraint. The migration comment documents this, and it is a correctness concern rather than a security one.

**Follow-ups:** none.
