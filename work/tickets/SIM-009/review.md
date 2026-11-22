# Review — SIM-009

## Attempt 1 — 2026-11-22
Verdict: PASS

Scope of this review: slice 1 only (plan.md "Split proposal"). AC2, AC3 and AC4 belong to SIM-009.2 and are not
closed by this PR.

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format."
- `pnpm typecheck && pnpm check:layers` — exit 0, "check-layers: 275 files, no violations"
- `pnpm test` — exit 0, "Test Files 112 passed (112); Tests 1110 passed (1110)"
- `pnpm test:db` (local Postgres) — exit 0, "Test Files 4 passed (4); Tests 33 passed (33)"
- `pnpm build` — exit 0
- Matches impl-log.md attempt 1 exactly.

### Acceptance criteria
- [x] AC1 A Manager can invite only as user; an Admin as user or manager — evidence:
  `src/lib/invitations/roles.ts:7-11` (`OPTIONS` table) with `roles.test.ts`; `InviteDialog.test.tsx` "manager sees
  only User", "admin sees User and Manager, never Admin", "user tier renders nothing"; server guard
  `src/app/api/invitations/route.ts:21` (422 `role_not_allowed` before the write) with `route.test.ts`
  "manager + simap:manager -> 422 role_not_allowed, service not called", "admin + simap:admin -> 400",
  "user tier -> 403 forbidden from the wrapper". All green.
- [x] AC5 Unit tests cover role options per tier and error-code mapping — evidence: `roles.test.ts`,
  `invite-flow.test.ts` (one row per contract code, `rate_limited keeps retryAfterSeconds`), `errors.test.ts` (six new
  codes pass `toAuthError`), `auth.test.ts` (each code has its own non-generic message), `identityClient.test.ts`
  (invite request shape and strict parse). All green.
- [x] S1 simap records the invitations it sent (email, role, inviter, time; no token) — evidence:
  `src/server/invitations/record.ts:20-55` (org-scoped upsert via `orgQuery` + `writeAudit` in `withTx`, audit meta
  `{role}` only, no token column or value); `record.db.test.ts` "records a pending row and lists it", "a re-invite in
  another case keeps one pending row", "an accepted row for the same address does not conflict", "another org does
  not see the row"; `route.test.ts` "201 body is the service DTO, no-store". All green.
- [x] S2 English messages for every documented error code — evidence: `src/ui/copy/auth.ts:121-128` (six codes;
  `satisfies` forces completeness), `src/ui/copy/api.ts:20`, `src/ui/copy/invitations.ts`; `auth.test.ts` and
  `no-literals.test.ts` green.
- [x] T1 No High path touched — `git diff --name-only origin/main...HEAD` has no file under the High globs
  (`src/server/http/**`, `src/server/identity/**`, `src/proxy.*`, `next.config.*`, `*.sql`, `.env.example` untouched).
- AC2, AC3, AC4 — deferred to SIM-009.2 (not verified here, by plan).

Ming verification after merge (from plan.md, carry into the PR):
1. As org Admin: Members → "Invite people" shows User and Manager; invite a second account as Manager; Identity
   `POST …/auth/orgs/<org>/invitations` answers 201, then `POST /api/invitations` 201, and
   `GET /api/members/invitations` lists the address.
2. As Manager: the role list shows only User.
3. Before M-1 is complete or with `join_policy` not `open`: the form shows the `org_invite_unavailable` message.
4. The email links to `/accept-invitation#token=…`, which is a 404 until SIM-009.2 merges: do not send real
   invitations to other people before then.

### Issues
None.

### Rules (CLAUDE.md)
No violations found.
- R1: lib files are pure; UI imports only `@/lib` and `../`; `src/server/invitations/record.ts` starts with
  `import "server-only"` and is imported only by `src/app/api/invitations/route.ts`; check:layers green.
- R2: no schema change (existing `invitations` table and partial unique index used).
- R3: no env, no secrets; email kept out of audit meta and logs.
- R4: every changed file is in plan.md's file list; impl-log "Out-of-plan files: None" confirmed.
- R6: insert scoped by `ctx.scope` through `orgQuery`; inviter is `ctx.sub`; role check uses `ctx.tier`.
- R7: the only 401/403 come from `withAuth({tier:"manager"})`; role-above-tier is 422; all refusals precede the
  write; the upsert makes an `apiFetch` re-send harmless.
- R5: checks green; new logic has tests.

### Blockers from review agents
None. `security-review.md` Attempt 1 has no 🔴; its two 🟡 (no per-inviter cap on records; upsert overwrites role/inviter without tracing the previous values) and the NFC note are listed as follow-ups in the PR.

### Nits (do not block)
- `src/ui/invitations/InviteDialog.tsx:66-87`: the email/role field errors set `aria-invalid` but the message is shown
  only in the dialog-level error; an `aria-describedby` link to it would help screen-reader users.
- `src/ui/invitations/InviteDialog.tsx:54-60`: the "Try saving again" button is not `disabled` while `submitting`
  (the `busy` ref already blocks a double call, so this is cosmetic).
- `src/ui/invitations/InvitePeople.tsx:76-79`: the `(e as never)` cast accepts any thrown object with a `code`; the
  client only throws `AuthError`, so this is safe today, but a small `isAuthError` guard would read better.

### Follow-ups (out of scope)
- SIM-011.2 must keep `<InvitePeople />` on the Members page (plan A7).
- Mark invitation rows `accepted` when the invitee first visits (plan A4).
- SIM-009.2: accept-invitation page (AC2, AC3, AC4).
