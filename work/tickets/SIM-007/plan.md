Status: READY

# Plan — SIM-007: Org picker, org switcher and first-visit member profile

> This plan covers **slice S1 only**: the server side of the member profile (migration, `GET /api/me` creates the
> member, `PATCH /api/me` sets the display name, validator and defaults). The ticket is about 3x the size of one
> implement/review cycle, so the client work moves to S2 and S3 (see `## Split proposal`).
> **Gate:** S1 adds a file under `db/migrations/**` (High path), so SIM-007 needs Gate `plan-approval` (currently
> `none`). The orchestrator should set it before IMPLEMENT.

## Scope summary
- Ticket scope (S1 part): "Server: `GET /api/me` creates the member on first call for (`org`, `sub`) and returns member
  + tier; `PATCH /api/me` sets display name." Technical note: "Concurrency on first insert (use `on conflict do
  nothing`)."
- spec §2 "Member = org account (D12)": "A *Member* is simap's profile of one account in one org, keyed by (`org`,
  `sub`): email from the token, plus simap fields (display name, employee code, group). … a member appears on the
  account's first visit (now) … Display name (D17): the member fills it on first visit (default: email local part),
  Managers can edit it".
- spec MEM-01: "A member is created on the account's first visit to the org and asked for a display name (D16, D17)."
- spec §4: "Member | org, Identity `sub` (unique in the org, required), email (from the token), display name, …"
- spec SYS-03: "Every change writes an audit row in the same transaction: actor `sub`, action, entity, id, small meta.
  The row holds no secrets and no tokens."
- spec AUT-02: "Every `/api/*` route handler gets the caller's verified identity: `sub`, email, `org`, simap tier (from
  `org_roles`), linked member. Org data is read and written only with that `org`."
- D16 (a): "now — a member appears on the account's first visit". D17: "Display name: filled by the member on first
  visit (default: email local part), editable by Managers". D36: "Names/data keep Vietnamese diacritics".
- Not in S1 (S2/S3): AUT-06 picker, switcher, remembered org, `org_access_denied`, first-visit screen, shell org name.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 2 | The first `/api/me` in an org creates exactly one member, even under concurrent calls. | `src/server/members/members.db.test.ts` › "10 concurrent first calls create one row with one id and one member.create audit row" and › "same sub in two orgs gives two members" (CI `pnpm test:db`; locally with compose Postgres). `src/app/api/me/route.test.ts` › "GET returns {sub,email,org,tier,member}" (service mocked). |
| 3 (server half) | A display name is required on the first visit and stored in NFC. | `member.test.ts` › validator table (blank, whitespace-only, control chars, 81 code points rejected; NFD input returned NFC). `members.db.test.ts` › "setDisplayName stores NFC and clears needsProfile" (NFD `Nguyễn` in, `normalize("NFC")` equal out, `needsProfile` false on the next GET). `route.test.ts` › "PATCH invalid bodies → 400 invalid_request without a database". The required screen itself is S3. |
| 5 (part) | Unit tests cover … display-name defaults. | `src/lib/validate/member.test.ts` › `defaultDisplayName` cases (see Tests). Picker decision tests are S2. |
| S1-a | First-visit state survives reloads: `needsProfile` stays true until the member saves a name, and a returning member is never re-asked. | `members.db.test.ts` › "second GET returns the same row, needsProfile still true, no new audit row" and › "after PATCH, needsProfile is false". |
| S1-b | Existing client keeps working (additive body). | `src/lib/identity/flow.test.ts` › "readMeResult reads tier and email from the SIM-007 body with member". `pnpm typecheck`, `pnpm test`. |
| S1-c | Schema change is forward-only and expand-only. | Read the migration (one `alter table … add column … null`, no default rewrite, no drop). `pnpm migrate` then `pnpm schema:check` on the compose Postgres (loop.config Prepare). |

## Ming verification after merge
- With a real org token (M-1; mint with `org_id` by hand until S2 ships): `GET /api/me` twice → same `member.id`,
  `needsProfile: true`; `PATCH /api/me {"displayName":"Nguyễn Văn A"}` → 200, `needsProfile: false`. Check
  `audit_log` has one `member.create` and one `member.update` row for that `sub`.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `db/migrations/20261120190000_members_profile_confirmed_at.sql` | new: `alter table members add column profile_confirmed_at timestamptz null;` (timestamp must sort after the newest file in `db/migrations` at implementation time) | Persisted first-visit flag (A1) | **Yes** (`db/migrations/**`, `**/*.sql`) |
| `db/migrations/README.md` | "Schema (v1)" section: one line on `members.profile_confirmed_at` (null = profile not confirmed yet; set once by the member's first `PATCH /api/me`) | Keep the schema doc true | **Yes** (`db/migrations/**`) |
| `src/lib/validate/member.ts` | new, pure: `DISPLAY_NAME_MAX = 80`, `normalizeDisplayName(v)`, `defaultDisplayName(email)`, `validateMePatch(body)` | AC3, AC5; shared with S3 and SIM-011 | no |
| `src/lib/validate/member.test.ts` | new: tables for the three functions | AC3, AC5 | no |
| `src/lib/members/types.ts` | new: `MemberStatus = "active" \| "deactivated"`, `MeMemberDto = { id, displayName, status, needsProfile }` | One DTO for server and the S3 client | no |
| `src/server/members/members.ts` | new (`import "server-only"`): `getOrCreateMember`, `setOwnDisplayName` | AC2, AC3 | no |
| `src/server/members/members.db.test.ts` | new: DB integration tests (pattern of `src/server/rooms/rooms.db.test.ts`, fixtures from `src/test/db/fixtures.ts`) | AC2, AC3 | no |
| `src/app/api/me/route.ts` | GET calls `getOrCreateMember` and adds `member`; new PATCH | AC2, AC3 | no |
| `src/app/api/me/route.test.ts` | replace the "exactly {sub,email,org,tier}" test (line 20-39) with the new shape (service mocked with `vi.mock`), add 503/400/403 cases and PATCH cases | AC2, AC3 | no |
| `src/lib/identity/flow.test.ts` | add one `readMeResult` compatibility test (test only; `flow.ts` unchanged) | S1-b | no |

Not touched: `src/server/http/**` (no member gate change; SIM-011 owns `memberGate`, `with-auth.ts:30,101`),
`src/server/identity/**`, `src/lib/api/error.ts` (no new codes), `src/test/db/fixtures.ts` (its `addMember` keeps
working: the new column is nullable).

## Data model / migration
- `members.profile_confirmed_at timestamptz null`, no default. `null` = created on first visit, name not yet confirmed
  by the member; set to `now()` once by `setOwnDisplayName` (`coalesce`, never reset).
- Expand only: the previous image never reads or writes the column (it has no member code at all), and inserts without
  it keep working. No index (read only by `(org_id, sub)`, already unique-indexed by `members_org_sub_key`).
- No backfill: no production member rows exist yet (go-live SIM-021 not done); seed and test rows get `null`, which only
  means "asked once for a name". Downgrade: none (forward-only, D3); rollback = previous image, the column is ignored.
- Existing constraints used as is (`db/migrations/20261120150000_init.sql:37-55`): `members_org_sub_key unique (org_id,
  sub)`, `email text not null` + non-blank check, `display_name text not null` + `btrim(display_name) <> ''` check,
  `status` default `'active'`.

## API contract
| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| GET | `/api/me` | bearer only | 200 `{ sub, email, org, tier, member: { id, displayName, status, needsProfile } }`, `Cache-Control: no-store`. Top-level fields unchanged (AuthGate reads `tier`, `email`: `src/lib/identity/flow.ts:90-109`). | 401 `unauthenticated`; 403 `org_required` / `forbidden` (withAuth, before any DB work, so no member is ever created without a simap org role); 403 `forbidden` when no member exists yet and the token has no email (A2); 503 `unavailable` (no pool); 500 `internal` | tier `user` |
| PATCH | `/api/me` | `application/json` `{ "displayName": string }`, strict (unknown key → 400), ≤ 16 KB (`readJson`) | 200, same body as GET (so the client can reuse `readMeResult`), `no-store` | 400 `invalid_request` (bad JSON, wrong type, unknown key, invalid name); 403 `member_deactivated` (service, A6); 403 `forbidden` (no member and no email, A2); 503 `unavailable`; 401/403 from withAuth | tier `user`; acts on the caller only (`sub` and `org` from the verified token, never from the body) |

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `member.test.ts` › `defaultDisplayName`: `nguyen.van.a@x.vn` → `nguyen.van.a`; `a+tag@x` → `a+tag` (no tag stripping); `"a@b"@x.com` → `"a@b"` (last `@`); NFD local part → NFC; 100-char local part → 80 code points, no trailing space; `"  a  b @x"` → `a b`; empty local part (`@x.com`) → whole email normalized; no `@` → whole string | AC5 |
| `member.test.ts` › `normalizeDisplayName`: NFD `Nguyễn Văn A` → NFC equal; trims; collapses `"a \t\n b"` → `"a b"`; rejects `""`, `"   "`, non-string, `null`, `"a\u0007b"`, `"a\u007fb"`; accepts exactly 80 code points incl. `"😀".repeat(80)` (160 UTF-16 units); rejects 81 code points | AC3 |
| `member.test.ts` › `validateMePatch`: `{displayName:"x"}` ok; `{}`, `[]`, `null`, `"x"`, `{displayName:"x", sub:"…"}` (unknown key), `{displayName:1}` → `{ok:false}` | AC3, R6 (no sub in body) |
| `members.db.test.ts` › "first call creates one active member with the default name, needsProfile true, one member.create audit row (actor = sub, entity_id = member id)" | AC2, SYS-03 |
| `members.db.test.ts` › "10 concurrent first calls create one row with one id and one member.create audit row" (`Promise.all` of 10 `getOrCreateMember` on the pool) | AC2 |
| `members.db.test.ts` › "same sub in two orgs gives two members; each org sees only its own" | AC2, R6 |
| `members.db.test.ts` › "second GET returns the same row, needsProfile still true, no new audit row, display name and email unchanged" (second call passes a different email) | S1-a, A4 |
| `members.db.test.ts` › "setDisplayName stores NFC and clears needsProfile; one member.update audit row with meta {fields:['displayName']}" | AC3, SYS-03 |
| `members.db.test.ts` › "same name again is a no-op: no update, no audit row, needsProfile stays false" | idempotence |
| `members.db.test.ts` › "PATCH before any GET creates then updates (one row, member.create + member.update)" | A5 |
| `members.db.test.ts` › "deactivated member: GET returns status deactivated (not reactivated); setDisplayName refuses 403 member_deactivated" | A6 |
| `members.db.test.ts` › "no email and no row: refusal 403 forbidden, nothing inserted; no email with an existing row returns it" | A2 |
| `route.test.ts` › "GET returns {sub,email,org,tier,member}" (`vi.mock("@/server/members/members")`, `getPool` stubbed non-null) | AC2, contract |
| `route.test.ts` › "GET, user tier, DATABASE_URL unset → 503 unavailable" | contract |
| `route.test.ts` › "token without simap org role → 403 forbidden, service not called" | no member without a role |
| `route.test.ts` › "PATCH invalid bodies → 400 invalid_request without a database" (wrong content type, unknown key, blank, 81 code points) | AC3 |
| `route.test.ts` › "PATCH valid body, DATABASE_URL unset → 503"; "PATCH valid body → 200 same shape as GET" (mocked) | contract |
| `route.test.ts` › "no Authorization → 401 on GET and PATCH" | AUT-02 |
| `flow.test.ts` › "readMeResult reads tier and email from the SIM-007 body with member" | S1-b |

`src/app/api/routes-guarded.test.ts` already proves every route export is wrapped by `withAuth`; the new PATCH must pass
it unchanged.

## Approach
1. **Migration** (`db/migrations/<ts>_members_profile_confirmed_at.sql`): header comment (SIM-007, expand-only, why),
   then the single `alter table`. No `begin`/`commit` (runner rule, README line 8-10). README line. Run `pnpm migrate`,
   `pnpm migrate:smoke`, `pnpm schema:check` locally.
2. **Pure lib** (`src/lib/validate/member.ts`, R1 lib → lib only):
   - `normalizeDisplayName(v: unknown): string | null`: string only → `normalize("NFC")` → `replace(/\s+/gu, " ")` →
     `trim()` → reject if empty, if `/\p{Cc}/u` matches, or if `[...s].length > DISPLAY_NAME_MAX` (code points; the
     rooms validator counts UTF-16 units, `src/lib/validate/room.ts:26-30`; code points are fairer to diacritics and
     emoji, A3).
   - `defaultDisplayName(email: string): string`: local part before the last `@`; run through the same
     normalisation; truncate to 80 code points then `trimEnd`; if that is empty or still invalid, use the normalized,
     truncated whole email (never blank, so the DB check holds).
   - `validateMePatch(body): Validated<{ displayName: string }>` with strict keys (pattern of `validateRoomPatch`,
     `room.ts:60-87`; import `type Validated` from `./room`).
   - `src/lib/members/types.ts`: the DTO types.
3. **Service** (`src/server/members/members.ts`, `import "server-only"`, every query through `orgQuery` with
   `where org_id = $1`, insert via the select-from-subselect form used in `rooms.ts:91-98` and `audit/write.ts:18-24`):
   - `getOrCreateMember(db, scope, who: { sub; email: string | null }): Promise<Result<MeMemberDto>>`
     a. Fast path on the pool, no transaction: `select id, display_name, status, profile_confirmed_at from members
        where org_id = $1 and sub = $2`. Found → return (no writes on returning visits; email and name untouched, A4).
     b. Not found and `email === null` → `{ ok:false, status:403, code:"forbidden" }` (A2).
     c. `withTx`: `insert into members (org_id, sub, email, display_name) select o.org_id, $2::uuid, $3::text,
        $4::text from (select $1::uuid as org_id) o where o.org_id = $1::uuid on conflict (org_id, sub) do nothing
        returning id`. A returned row → `writeAudit(c, scope, { actorSub: sub, action: "member.create", entity:
        "member", entityId: id, meta: { source: "first_visit" } })`. Then re-select by `(org_id, sub)` in the same
        transaction (READ COMMITTED: a losing insert waits for the winner's commit, and the next statement sees the
        row). Only the winning insert returns a row, so exactly one audit row.
   - `setOwnDisplayName(db, scope, who, displayName)`: one `withTx`; ensure the row exists with step c (A5); `select …
     for update`; `status = 'deactivated'` → refusal 403 `member_deactivated` (A6); then `update members set
     display_name = $3, profile_confirmed_at = coalesce(profile_confirmed_at, now()), updated_at = now() where org_id =
     $1 and sub = $2 and (display_name is distinct from $3 or profile_confirmed_at is null) returning …`; a returned
     row → `writeAudit` `member.update`, `meta: { fields: ["displayName"], self: true }` (no name in meta: SYS-03 "small
     meta", avoids PII in audit meta). Return the row as DTO.
   - `Result`/refusal shape as `rooms.ts:14-21` (`{ ok:false, status, code }` with codes from `API_ERROR_CODES`).
     `needsProfile = profile_confirmed_at === null`.
4. **Route** (`src/app/api/me/route.ts`): `dynamic = "force-dynamic"`, `NO_STORE`.
   - GET: `getPool()` null → 503; `getOrCreateMember(pool, ctx.scope, { sub: ctx.sub, email: ctx.email })`; refusal →
     `apiError`; else `Response.json({ sub, email, org, tier, member })`.
   - PATCH: `readJson` → 400; `validateMePatch` → 400; then `getPool()` → 503 (validation first so it is testable
     without a DB); `setOwnDisplayName`; 200 with the GET body.
   - Both `{ tier: "user" }`. No member creation in `memberGate` (SIM-011 owns it).
5. **Tests** as listed; then the Checks from `loop.config.md` (format, typecheck + check:layers, test, build) and
   `pnpm test:db` locally against compose Postgres (CI runs it).

Rules: **R1** lib pure, server imports lib, route is the only entry into `src/server/members`; **R2** one forward-only
expand migration, reviewed at the plan gate; **R3** no env; **R4** S1 files only; **R5** tests above; **R6** every
query via `orgQuery`/`ctx.scope`, `sub` from the token only, strict body without `sub`/`org`.

## Specialist input used
- api-platform-engineer: adopted flat additive `/api/me` body; create in the handler, not in `memberGate`; insert `on
  conflict do nothing` + re-select in one `withTx`; no `do update` form; default name from the local part; never
  resurrect a deactivated member; PATCH strict body, `invalid_request` for all validation errors, no new codes; PATCH
  auto-creates; DB concurrency test with N parallel calls and the two-org case. Adopted the `profile_confirmed_at`
  migration (their preferred option) over the `created_at = updated_at` heuristic (fragile once SIM-011 edits names).
  Changed: fast-path select outside a transaction so returning visits write nothing; audit rows for create/update
  (SYS-03 "every change", which answers their audit question); email refresh not done (A4).
- frontend-developer: adopted the persisted flag (they proposed nullable `display_name`; rejected because it relaxes a
  NOT NULL used by audit/actor joins and future pickers, while an extra nullable column is a pure expand), the shared
  validator in `src/lib/validate/` (server and S3 reuse it), and server-side NFC that never trusts the client. All
  client recommendations (identity client `orgs()`, `decideOrg`, org storage, token store, cross-tab, gate, views,
  copy) are carried into S2/S3 in `## Split proposal`.

## Assumptions
Each has a proposed default; Ming can override at the plan gate.
- **A1 First-visit flag = migration** (`members.profile_confirmed_at`). Default: yes. It is the only reliable "first
  visit" signal (the row must exist with a non-blank default name for AC2), and it is expand-only. Consequence: High
  path → Gate `plan-approval`, PR tier High (never auto-merged).
- **A2 Token without email.** `verify.ts:138-139` maps a missing or empty `email` to `null`; `members.email` is NOT
  NULL. Default: if no member row exists, refuse with 403 `forbidden` and insert nothing; an existing row is returned
  as is. Identity requires `email_verified: true` (`verify.ts:135`), so this should not happen in practice; the client
  already fails closed on a 200 without email (`flow.ts:100-103`).
- **A3 Display-name rules.** Default: NFC, internal whitespace runs collapsed to one space, trimmed, 1–80 code points,
  control characters (`\p{Cc}`) rejected; no further character restrictions (Vietnamese diacritics, emoji allowed).
  No DB length check (the service is the only writer; SIM-011 must reuse `normalizeDisplayName`).
- **A4 No email refresh on GET.** Default: the email stored at first visit stays until a later ticket (SIM-020 sync or
  a follow-up) refreshes it; refreshing on every GET would add a write and an audit row per entry. Follow-up candidate.
- **A5 PATCH before GET auto-creates** the member (order-independent API). Default: yes.
- **A6 Deactivated member.** GET returns the row unchanged (never reactivates); PATCH refuses 403
  `member_deactivated` in the service as defence in depth until SIM-011's `memberGate` blocks earlier.
- **A7 No Identity display name yet** (D17 "becomes the default when available"): tokens carry only email, so the
  default is the email local part. When a `name` claim or the members endpoint exists, only `defaultDisplayName`'s
  caller changes.
- **A8 Local dev**: `/api/me` now needs `DATABASE_URL`; without it the gate shows the retry screen (503). Run
  `docker compose -f compose.dev.yml up -d` + `pnpm migrate`.
- **Hotspots:** none for S1 (SIM-006.3 and SIM-010.2 in this batch do not touch `src/app/api/me`, `src/server/members`,
  `src/lib/validate/member.ts` or `db/migrations`). SIM-011 (BACKLOG) will extend `src/server/members/members.ts` and
  must keep the `profile_confirmed_at` semantics (a Manager edit does not confirm the member's own profile).

## Blocking questions
None.

## Split proposal
Ticket total ≈ 1,400 changed lines with tests (server ≈ 650, client org entry ≈ 600, profile screen ≈ 250). Slices:

- **S1 = this plan (SIM-007):** migration, members service, `GET`/`PATCH /api/me`, validator + defaults. ACs 2, 3
  (server), 5 (defaults). Gate `plan-approval` (High path). ~650 lines incl. tests.
- **S2 = new ticket SIM-007.2 "Org entry: picker, switcher, org_access_denied"** (areas ui, security; depends on
  SIM-006.2; independent of S1). ACs 1, 4, 5 (picker decision). Files: `src/ui/auth/identityClient.ts` (`orgs()`
  GET `/auth/orgs`, cookie mode, 5 s timeout, UUID-checked ids, trimmed names, dedupe; `token(accountId, orgId?)`
  sends `org_id`), `src/lib/identity/types.ts` + `errors.ts` (`org_access_denied`, the 403 from `/auth/token`),
  new `src/lib/identity/orgs.ts` (`decideOrg(orgs, remembered, exclude?)`: 0 → none, 1 → enter, several → enter the
  remembered one if listed, else pick; the denied org is excluded from auto-enter so a suspended org still listed
  cannot loop), new `src/ui/auth/orgId.ts` (`localStorage` key `mm_org_id:<accountId>`, UUID-checked, cleared on
  sign-out/forget/`session_invalid`), `tokenStore.ts` (`orgId()`, `selectOrg(id)` = reset + persist + re-mint;
  `org_access_denied` clears token and remembered org and notifies), `authChannel.ts` (token messages carry `orgId`;
  a tab ignores a token for another org: **per-tab org**, other tabs do not follow a switch), `flow.ts` (`org_required`
  → `needOrg`; `org_access_denied` → `pickOrg` with notice), `AuthGate.tsx` (lists orgs on entry for the org name and
  count; switch = bump `seq`, unmount via `flushSync` checking, `selectOrg`, re-check; the keyed Fragment remounts all
  data), `src/ui/org/OrgPickerView.tsx` (props-only, reused by the switcher with a "current" marker), `NoOrgView` copy
  "You are not in any organization yet" + how to get access, `src/ui/copy/org.ts`, `src/lib/session.ts`
  (`orgName`, `canSwitchOrg`; switcher hidden/disabled for one org). UI uses the clean UI kit (D47 defers pixel art,
  although D52 lists the org picker as a pixel surface). Rule for later tickets: client caches live below the keyed
  Fragment or are keyed by org id. **Before S2 runs**, the `/auth/orgs` response shape must be confirmed: it is not in
  this repo (org-admin-api `docs/consumers.md` "Organizations" is outside it; only `org_access_denied` = 403 from
  `/auth/token` is recorded, `work/tickets/SIM-005/consult-api-platform-engineer.md:17`). Default if Ming does not
  paste it: a tolerant parser isolated in `identityClient.orgs()` plus a Ming check after merge. Hotspot: SIM-006.3
  edits `AuthGate.tsx`, `views.tsx` and `copy/auth.ts`; S2 rebases after it.
- **S3 = new ticket SIM-007.3 "First-visit profile screen"** (area ui; depends on S1 and S2). AC3 (UI). Files:
  `flow.ts` (`readMeResult` reads `member`; 200 with `needsProfile` → `profile` view after the gate is ready),
  `src/ui/org/ProfileView.tsx` (label, `autocomplete="nickname"`, `maxLength` 80, prefilled with the server's
  default name, required, visible error), `AuthGate.tsx` (`PATCH /api/me`, then re-check), `src/ui/copy/profile.ts`,
  client validation via `normalizeDisplayName` from `src/lib/validate/member.ts`.
