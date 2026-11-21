# Security review — SIM-007.3

## Attempt 1
Agent: `security-ai-generated-code-auditor` (read-only; no checks run). Result: **0 🔴, 1 🟡, 6 🟢, 1 💭**.

- 🟡 An `AuthError` from `getToken` during the PATCH becomes "Could not save your name. Try again." and never reaches the gate's auth routing: `tokenStore.ts:214-222` rethrows renewal `AuthError`s (`session_invalid`, `not_member`, `email_unverified`, `org_access_denied`), `apiFetch` propagates them (`fetch.ts:54,67`), `mapPatchResult` (`profile-form.ts:33-36`) maps only `ApiAccessError` to `access`, so the rest is `retry` (`AuthGate.tsx:541-545`); `store.subscribe` ignores non-`ready` views (`AuthGate.tsx:350`). Fails closed, but the user is stuck on "Try again" (only Sign out helps) instead of join / pick-org / sign-in; contradicts `plan.md:82` (AC5 partly met). Fix: `mapPatchResult` returns `access` for `ApiAccessError` **or** an `AuthError` (export/reuse `isAuthError` from `flow.ts`); network errors/aborts stay `retry`; test `{code:"session_invalid"}` → `access`, `TypeError` → `retry`.
- 🟢 Untrusted `/api/me` JSON guarded (`flow.ts:104-131`); malformed `member` on a 200 → `ready`, grants nothing.
- 🟢 Client/server validation split correct: same `normalizeDisplayName`, only `{displayName}` sent, server re-validates and rejects unknown keys.
- 🟢 Email and display name rendered as React text; no `dangerouslySetInnerHTML`/`innerHTML` under `src/ui`.
- 🟢 Errors do not leak (fixed copy only, no `console.*`).
- 🟢 No loop after save (`saved` needs 200 and `needsProfile === false`; same body through `viewForMe` → `ready`).
- 🟢 Server-side 401/403 on the PATCH routed correctly; double submit and late answers handled (`busy` ref, `seq`).
- 💭 `maxLength` counts UTF-16 units vs server code points (client stricter; UX only).

Follow-ups: `AuthGate.tsx:350,362` handlers act only in `ready`; any pre-`ready` screen that calls `apiFetch` must route `AuthError` itself — consider letting `subscribe` act on `profile` for fatal codes.
