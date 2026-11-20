# Security review — SIM-007.2

## Attempt 1
Agent: `security-ai-generated-code-auditor` (read-only; no checks run). Result: **0 🔴, 2 🟡, 9 🟢**.

- 🟡 1 Gate loop when a mint "succeeds" but the token has no `org` claim (`src/ui/auth/AuthGate.tsx:240-242, 191-192, 207-216`; `tokenStore.ts:368`): `/api/me` → 403 `org_required` → `needOrg` → `decideOrg` → `enter` the remembered/only org again, with no click and no backoff (each pass: `/auth/orgs`, `/auth/token`, `/api/me`). Fails closed (no data leak) but is an unattended request storm against shared Identity until rate-limited. Fix: per-epoch guard — `org_required` right after a successful `selectAndCheck` for org X adds X to `denied` (picker/noOrg with notice), or a `lastEntered` ref refusing a second auto-enter of the same id; test with mint 200 + `/api/me` always `org_required` → one round, then picker/noOrg.
- 🟡 2 `parseOrgs` takes `src.id` before `org_id` on flat rows (`src/ui/auth/identityClient.ts:64-71`): a flat membership row `{ id: <membership>, org_id, org_name }` would mint with the membership UUID → every org denied → "no organization" (fails closed, breaks entry); `src.name` may be a role/person name. Fix: without a nested `org`/`organization` object prefer `item.org_id`, `item.organization_id`, then `src.id`, and `item.org_name` before `src.name`; test the flat membership shape.
- 🟢 Client org choice is not trusted: `with-auth.ts:59-63` takes `org`/`orgRoles` only from the verified token (R6).
- 🟢 Cross-account / cross-org token adoption closed (`tokenStore.ts:249-252`, `authChannel.ts:49-53`, `adopt` reads the new account's org `:277`, `selectOrg` writes only on unchanged generation `:368`, epoch check `:163`).
- 🟢 localStorage holds only UUIDs, never a token; `readOrgId` validates and evicts (`orgId.ts:11-12`). Optional: validate in `selectOrg` too.
- 🟢 Denied-org loop bounded: `orgId` attached from store state, not server body; once anything is denied `decideOrg` never enters (`orgs.ts:42-46`).
- 🟢 No prototype-pollution path in parsing; optional caps on org name length / list size.
- 🟢 Org names render as React text only (no `dangerouslySetInnerHTML`/`href` sinks).
- 🟢 Sign-out clears in-memory and remembered org on every path; minor: `apply` → `signedOut` (`AuthGate.tsx:250-253`) does not call `resetOrgs()` (nothing exposed today).
- 🟢 Shell org label is client-derived (`AuthGate.tsx:146-149`); cannot diverge today; follow-up: `/api/me` returns the verified org.
- 🟢 No token logging or storage.

Follow-ups: verify the real `/auth/orgs` and `/auth/token` `org_id` contract (Q18) — decides whether 🟡 1 can trigger and settles 🟡 2; consider returning the verified org id from `/api/me`.
