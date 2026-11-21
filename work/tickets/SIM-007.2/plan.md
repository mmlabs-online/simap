Status: READY

# Plan — SIM-007.2: Org entry: org list, picker, switcher and org_access_denied

> Slice S2 of the approved SIM-007 plan. Client only: no schema, no `/api/*` change, no High path.
> **Predicted risk tier: Medium** (every changed path is under `src/lib/**` or `src/ui/**`; none matches `high:` in
> `.github/risk-tiers.yml`). Under `--auto-merge` it merges only if Ming pre-approves the merge in the batch round.
> Decisions for Ming are Q1–Q8 under `## Assumptions`; **none block** (each has a reversible default).

## Scope summary
- Ticket goal: "After sign-in a user enters one of their orgs (directly with one, via a picker with several), can
  switch orgs, and loses a revoked org cleanly; slice S2 of the approved SIM-007 plan."
- Source slice (`work/tickets/SIM-007/plan.md` § Split proposal, S2): "`src/ui/auth/identityClient.ts` (`orgs()` GET
  `/auth/orgs`, cookie mode, 5 s timeout, UUID-checked ids, trimmed names, dedupe; `token(accountId, orgId?)` sends
  `org_id`), `src/lib/identity/types.ts` + `errors.ts` (`org_access_denied`, the 403 from `/auth/token`), new
  `src/lib/identity/orgs.ts` (`decideOrg(orgs, remembered, exclude?)`: 0 → none, 1 → enter, several → enter the
  remembered one if listed, else pick; the denied org is excluded from auto-enter so a suspended org still listed cannot
  loop), new `src/ui/auth/orgId.ts` (`localStorage` key `mm_org_id:<accountId>`, UUID-checked, cleared on
  sign-out/forget/`session_invalid`), `tokenStore.ts` (`orgId()`, `selectOrg(id)` = reset + persist + re-mint;
  `org_access_denied` clears token and remembered org and notifies), `authChannel.ts` (token messages carry `orgId`; a
  tab ignores a token for another org: **per-tab org**, other tabs do not follow a switch), `flow.ts` (`org_required` →
  `needOrg`; `org_access_denied` → `pickOrg` with notice), `AuthGate.tsx` (lists orgs on entry for the org name and
  count; switch = bump `seq`, unmount via `flushSync` checking, `selectOrg`, re-check; the keyed Fragment remounts all
  data), `src/ui/org/OrgPickerView.tsx` (props-only, reused by the switcher with a "current" marker), `NoOrgView` copy
  'You are not in any organization yet' + how to get access, `src/ui/copy/org.ts`, `src/lib/session.ts` (`orgName`,
  `canSwitchOrg`; switcher hidden/disabled for one org). UI uses the clean UI kit (D47 defers pixel art …). Rule for
  later tickets: client caches live below the keyed Fragment or are keyed by org id."
- SIM-007 ticket ACs used here: AC1 "A user with one org enters it directly; with two sees a picker; switching shows
  only the new org's data." AC4 "`org_access_denied` drops the remembered org and returns to the picker." AC5 (part)
  "Unit tests cover the picker decision".
- spec AUT-06 (`docs/spec-v1.md:200-207`): "After sign-in the client lists the account's orgs for simap (`GET
  /auth/orgs`). With one org it enters it directly; with several it shows a picker (D13); with none it shows 'You are
  not in any organization yet' and how to get access. The chosen org is remembered on the device (an id, not a token).
  / The shell shows the current org's name and lets a user with several orgs switch; switching re-mints the token with
  the new `org_id` and reloads all data. Nothing from the previous org stays on screen. / `403 org_access_denied` from
  Identity (org suspended or access removed) drops the remembered org and goes back to the picker."
- D13: "One account may belong to several simap orgs: picker after sign-in and an org switcher in the shell."
  D36: "all user-facing text lives in copy files … Names/data keep Vietnamese diacritics (display, sort, search)."
  D47/D52: clean UI kit now; pixel style of the picker deferred.
- Identity facts (org-admin-api `docs/consumers.md`): line 128 "403 `org_access_denied` | `org_id` given but the user
  holds no role of this app in that org, or the org is unknown or suspended (one answer for all three). Re-list the
  user's orgs."; line 129 "422 `validation_error` / `org_not_supported` | Bug"; lines 136-137 "`GET
  /api/v1/auth/orgs?account_id=` (the caller's orgs for the calling app, with their roles) -> `/auth/token` with
  `org_id`" (cookie class, line 135); line 379 "A token without `org_id` carries app-scope roles only: enough to create
  or pick an org." **The `/auth/orgs` JSON body is not documented** → Ming Q18 default: tolerant parser isolated in
  `identityClient.orgs()` + Ming check after merge.
- Out of scope: first-visit profile screen (SIM-007.3), server `/api/me` (SIM-007, merged), org creation, pixel style.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1a | One org → entered directly; several → picker; none → "You are not in any organization yet" + how to get access. | `orgs.test.ts` › `decideOrg` table (0/1/2+ orgs). `flow.test.ts` › "403 org_required -> needOrg". `org-views.test.tsx` › "OrgPickerView lists one button per org …", › "NoOrgView shows the AUT-06 text and sign-out". Gate wiring by reading `AuthGate.tsx` `enterOrg` (Approach 6). |
| 1b | The chosen org is remembered on the device (id only) and a returning user enters it without a picker. | `orgId.test.ts` (per-account key, UUID check). `tokenStore.test.ts` › "selectOrg mints with org_id, then remembers it", › "a store created with a remembered org mints with it on restore", › "signIn/continueAs use the NEW account's remembered org, never the previous one's". |
| 1c | Switching re-mints with the new `org_id` and shows only the new org's data. | `tokenStore.test.ts` › "selectOrg drops an in-flight /token of the old org (generation)". Gate: `switchTo` does `++seq` + `flushSync(checking)` before `selectOrg`, so `ready` re-enters with `++generation` and the keyed Fragment remounts (comment at the `ready` case). Manual local run (two orgs needs M-1 → Ming check). |
| 4 | `org_access_denied` drops the remembered org and returns to the picker (with a notice). | `identityClient.test.ts` › "403 org_access_denied on /auth/token maps to org_access_denied". `tokenStore.test.ts` › "org_access_denied: token and in-memory org cleared, remembered org cleared only if it still names the denied org, account kept, listeners notified, error carries orgId". `flow.test.ts` › "org_access_denied with an account and orgId -> pickOrg". `orgs.test.ts` › "after a denial decideOrg never enters". |
| 5 (part) | Unit tests cover the picker decision. | `src/lib/identity/orgs.test.ts` (table in Tests). |
| T1 | A tab ignores a token minted for another org. | `authChannel.test.ts` › "orgId: missing → null, null, UUID (lowercased) accepted; number/'x'/'' rejected". `tabs.test.ts` › "tab on org A ignores a token broadcast for org B; adopts one for org A", › "an org-less message (old build) is ignored by a tab with an org and adopted by an org-less tab". |
| T2 | A denied org cannot loop on auto-enter. | `orgs.test.ts` › "denied non-empty: never enter (remembered listed, single org left, remembered denied)". `flow.test.ts` › "org_access_denied without orgId -> retry(unknown), never pickOrg". Gate: denied ids accumulate in a per-tab ref passed to `decideOrg` (Approach 6). |
| C1 | Copy follows the SIM-022/D36 convention. | All new text in `src/ui/copy/org.ts`; `no-literals.test.ts` and `copy.test.ts` pass unchanged (they glob `src/ui/**/*.tsx` and `src/ui/copy/*.ts`). `auth.test.ts` CODES includes `org_access_denied`. |
| C2 | Shell shows the org name; switcher hidden for a single-org user. | `AppShellView.test.tsx` › "org name shown; switch button rendered only when switchOrg is given". `org-views.test.tsx` › switcher cases. |
| C3 | All loop checks green. | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`. |

## Ming verification after merge
Needs M-1 (one account with two simap orgs, plus a second account with one org).
1. **`/auth/orgs` real shape (Q18):** sign in; DevTools → Network → `auth/orgs?account_id=…`: the picker shows both orgs
   with their real names. If the list is empty, names look like ids/slugs, or the retry screen appears, open a bug with
   the response body pasted (no tokens; the body has no secret). Also confirm the call has no `Authorization` header and
   still answers 200 (cookie class).
2. Two-org account: picker → pick org A → app; reload → enters A directly (no picker); shell shows A's name; switch → B:
   the rooms page shows only B's rooms.
3. Two tabs on the same account: switch tab 1 to B; tab 2 stays on A and keeps working after its next token renewal
   (wait ~15 min or click "Refresh permissions").
4. One-org account: enters directly, no switch button.
5. Remove the account's simap role in org A (or suspend A) in the Identity admin, then reload while A is remembered:
   picker (or "no organization" screen) with "You no longer have access to that organization", A not offered, no loop.

## Files to create / modify
Estimate: ≈ 600 changed production lines + ≈ 600 test lines (see Q8).

| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/identity/types.ts` | `AuthErrorCode` += `"org_access_denied"`; `AuthError.orgId?: string` (client-set: the org the denied mint named, never read from a server body); new `export type OrgChoice = { id: string; name: string }` | AC4, T2 | no |
| `src/lib/identity/errors.ts` | add `"org_access_denied"` to `SERVER_AUTH_ERROR_CODES` (line 7-24). `org_not_supported` stays out (→ `unknown` → retry: a bug code, consumers.md:129) | AC4 | no |
| `src/lib/identity/errors.test.ts` | one case: 403 `{error:{code:"org_access_denied"}}` → `{code:"org_access_denied"}` with no `orgId`; `org_not_supported` → `unknown` | AC4 | no (Low) |
| `src/lib/identity/orgs.ts` | **new, pure**: `decideOrg`, `sortOrgs` | AC1, AC5, T2 | no |
| `src/lib/identity/orgs.test.ts` | new: tables below | AC5 | no (Low) |
| `src/lib/identity/flow.ts` | `MeView`: replace `{kind:"noOrg"}` with `{kind:"needOrg"}` (line 50, 63); `GateView` += `{kind:"pickOrg"; error: AuthError}`; `viewForTokenError` (line 24-32): `org_access_denied` + `hasAccount` + `orgId` → `pickOrg`, otherwise → `retry` `unknown` | AC1, AC4, T2 | no |
| `src/lib/identity/flow.test.ts` | update line 70-72 and 134 (`noOrg` → `needOrg`); add `pickOrg` cases | AC4 | no (Low) |
| `src/ui/auth/identityClient.ts` | interface (line 6-28) += `orgs(accountId): Promise<OrgChoice[]>`, `token(accountId, orgId?)`; `token` body adds `org_id` only when given (line 131-139); new `orgs()` using `get` (line 90-111) with `ORGS_TIMEOUT_MS = 5000` and the tolerant parser | AC1, AC4, Q18 | no |
| `src/ui/auth/identityClient.test.ts` | new `orgs()` and `token(…, orgId)` cases | AC1, Q18 | no (Low) |
| `src/ui/auth/orgId.ts` | **new**: `readOrgId(accountId)`, `writeOrgId(accountId, orgId)`, `clearOrgId(accountId, onlyIf?)`; key `mm_org_id:<lowercase accountId>`; UUID-checked, lowercased, try/catch (model: `accountId.ts`) | AC1b, AC4 | no |
| `src/ui/auth/orgId.test.ts` | new (stubbed `localStorage`, pattern of `accountId.test.ts`) | AC1b | no (Low) |
| `src/ui/auth/authChannel.ts` | token message += `orgId: string \| null` (line 4-13); `parseAuthMessage` (line 37-55): absent → `null`, `null` → `null`, UUID string → lowercased, anything else → reject message; `v` stays `1` | T1 | no |
| `src/ui/auth/authChannel.test.ts` | `orgId` parse cases; "does not copy unknown fields" expectation gains `orgId: null` | T1 | no (Low) |
| `src/ui/auth/tokenStore.ts` | org state, `orgId()`, `selectOrg()`, `OrgIdStorage` option, org in `renew`/channel/`onMessage`/`adopt`/sign-out paths, `org_access_denied` handling, `NOTIFY_CODES` (line 50) | AC1, AC4, T1 | no |
| `src/ui/auth/tokenStore.test.ts` | `setup()` (line 29-78) gains an in-memory `orgStorage` and `token` records its 2nd arg; new cases; update line 241-245 (message keys include `orgId`; `setItem` calls unchanged because no org is selected in that test) | AC1, AC4 | no (Low) |
| `src/ui/auth/tabs.test.ts` | `world().tab()` (line 36-56) accepts an `org` option (in-memory `orgStorage`); cross-org cases | T1 | no (Low) |
| `src/ui/auth/AuthGate.tsx` | new views `orgPicker`, `noOrg` notice, `ready.orgs`; `denied` ref; `enterOrg`, `pickOrg`, switcher state + `switchTo`; `needOrg`/`pickOrg` cases in `apply` (line 132-199); session `orgName`; `switchOrg` action; denied reset on account change | AC1, AC4, T2, C2 | no |
| `src/ui/auth/views.tsx` | `NoOrgView` (line 227-236): text from `orgCopy.none`, optional `notice?: "org_denied"` | AC1a, AC4 | no |
| `src/ui/auth/views.test.tsx` | update "NoOrgView has sign-out" (line 84) to the new text + notice | AC1a | no (Low) |
| `src/ui/org/OrgPickerView.tsx` | **new**, props only: entry picker inside `AuthLayout` | AC1a | no |
| `src/ui/org/OrgSwitcherDialog.tsx` | **new**, props only: switcher on `EntityFormDialog` (radio group, current org preselected and marked) | AC1c, C2 | no |
| `src/ui/org/org-views.test.tsx` | new, `renderToStaticMarkup` (pattern of `src/ui/auth/views.test.tsx`) | AC1, C2 | no (Low) |
| `src/ui/copy/org.ts` | **new**: `orgCopy` (picker, switcher, notices, none) | C1 | no |
| `src/ui/copy/auth.ts` | `errors.org_access_denied` (required by `satisfies Record<AuthErrorCode,…>`, line 130); remove the `noOrg` block (line 99-105), now in `orgCopy.none` | C1 | no |
| `src/ui/copy/auth.test.ts` | `CODES` (line 7-27) += `"org_access_denied"` | C1 | no (Low) |
| `src/ui/AppShellView.tsx` | line 100-105: render the swap `IconButton` only when `actions.switchOrg` is set (today: always rendered, disabled without it) | C2, Q3/Q5 | no |
| `src/ui/AppShellView.test.tsx` | new case for the org name and the conditional switch button | C2 | no (Low) |

Not touched (deviation from the S2 list, see Q5): `src/lib/session.ts` (`orgName?` already exists; no
`canSwitchOrg` field: the presence of `ShellActions.switchOrg` is the signal). Also not touched: `src/ui/session.tsx`,
`src/ui/auth/runtime.ts` (the store's `orgStorage` defaults to `orgId.ts`), `src/lib/api/fetch.ts` (SIM-027's file),
`src/ui/copy/api.ts` (`org_required` text unused by the gate after this change, kept for `apiErrorMessage`), anything
under `src/server/**` or `src/app/api/**`.

## Data model / migration
None. Client storage only: `localStorage["mm_org_id:<lowercase accountId>"]` = lowercase org UUID (not a secret; the
token never touches storage).

## API contract
None in simap. Identity calls used (consumers.md; no simap endpoint changes):

| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| GET | `{IDENTITY}/auth/orgs?account_id=<uuid>` | cookie class: `credentials: "include"`, `X-MM-App`, no body, no bearer, `cache: "no-store"`, 5 s timeout | body undocumented → tolerant parse (Approach 2) → `OrgChoice[]` | non-2xx → `toAuthError` (401 `session_invalid` → sign-in; others → `unknown` → retry); fetch throw/timeout → `network` → retry | device cookie |
| POST | `{IDENTITY}/auth/token` | `{audience, account_id}` plus `org_id` **only when an org is selected** | unchanged | new: 403 `org_access_denied` | device cookie |

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `orgs.test.ts` › `decideOrg` "0 orgs → none (no notice)"; "1 org → enter it, even when remembered names another id"; "2 orgs + remembered listed → enter remembered"; "2 orgs + remembered unlisted or null → pick, sorted" | AC1a, AC5 |
| `orgs.test.ts` › "ids compared case-insensitively (remembered upper-case matches)"; "duplicate ids → one entry"; "input array not mutated" | AC5 |
| `orgs.test.ts` › "denied non-empty: never enter — remembered listed → pick; single org left → pick with notice; only org denied → none with notice; denied org removed from the pick list" | AC4, T2 |
| `orgs.test.ts` › `sortOrgs` "Vietnamese names sort with diacritics (`An`, `Ánh`, `Bình`, `Đà Nẵng`) via `Intl.Collator('vi')`; ties by id; NFD and NFC names compare equal" | D36, domain focus |
| `flow.test.ts` › "403 org_required -> needOrg" (replaces line 70-72); meErrorView line 134 → `needOrg` | AC1a |
| `flow.test.ts` › "org_access_denied with an account and orgId -> pickOrg(error)"; "without an account -> signIn"; "without orgId -> retry(unknown)" | AC4, T2 |
| `errors.test.ts` › "org_access_denied accepted from the body; orgId never taken from the body; org_not_supported -> unknown" | AC4 |
| `identityClient.test.ts` › "orgs: GET {BASE}/auth/orgs?account_id=<encoded>, credentials include, X-MM-App, no Authorization, no body, no-store, 5 s AbortSignal" | API contract |
| `identityClient.test.ts` › "orgs: tolerant envelopes — bare array, `{items}`, `{orgs}`, `{organizations}`, `{data}` all parse to the same list" | Q18 |
| `identityClient.test.ts` › "orgs: id from `id` / `org_id` / `organization_id` / nested `org.id` / `organization.id`; name from `name` / `display_name` / nested, else `slug`; ids lowercased; names trimmed + NFC; Vietnamese name kept; non-UUID id dropped; duplicates dropped" | Q18, D36 |
| `identityClient.test.ts` › "orgs: empty list → []; non-empty list where no item parses → rejects `unknown`; unrecognised body (`{}`, `null`, string, non-JSON) → rejects `unknown`; 401 session_invalid mapped; fetch throw → network" | Q18 (never a false "no org") |
| `identityClient.test.ts` › "token: body is exactly {audience, account_id} without orgId and {audience, account_id, org_id} with it"; "403 org_access_denied → {code:'org_access_denied'}" | AC1c, AC4 |
| `orgId.test.ts` › "write/read per account (lowercased key and value); another account reads null"; "invalid stored value → null and removed"; "clear(account, onlyIf) clears only when the stored value equals onlyIf (case-insensitive); clear(account) clears"; "localStorage throwing → null / no throw" | AC1b, AC4 |
| `authChannel.test.ts` › "orgId: missing → null; null → null; UUID → lowercased; 1 / 'x' / '' / {} → message rejected"; "signedOut ignores orgId" | T1 |
| `tokenStore.test.ts` › "no org: token() called with (accountId, undefined); channel message has orgId null" | AC1 |
| `tokenStore.test.ts` › "selectOrg(id): bumps generation, mints with (accountId, lowercase id), orgId() returns it, remembers it only after the mint succeeded" | AC1b, AC1c |
| `tokenStore.test.ts` › "selectOrg drops an in-flight /token of the old org (its late answer is neither stored nor broadcast)" | AC1c |
| `tokenStore.test.ts` › "a store created with a remembered org mints with it on restore" | AC1b |
| `tokenStore.test.ts` › "signIn/continueAs use the NEW account's remembered org, never the previous one's" (account A on org X; continueAs B with none remembered → token(B, undefined)) | Risk 2 |
| `tokenStore.test.ts` › "org_access_denied: token and in-memory org cleared, remembered org cleared only if it still names the denied org, account kept, listeners notified, error carries orgId; a later getToken mints org-less" | AC4 |
| `tokenStore.test.ts` › "selectOrg rejected with org_access_denied never writes the remembered org" | AC4 |
| `tokenStore.test.ts` › "signOut / forget / session_invalid clear the remembered org of the gone account only" | AC1b |
| `tokenStore.test.ts` › line 211 test updated: message keys `[accessToken, accountId, at, expiresAt, orgId, type, v]`; still only `mm_account_id` written | no token in storage |
| `tabs.test.ts` › "tab on org A ignores a token broadcast for org B; adopts one for org A (case-insensitive)" | T1 |
| `tabs.test.ts` › "an org-less message (old build, no orgId field) is ignored by a tab with an org and adopted by an org-less tab" | T1, Risk 1 |
| `tabs.test.ts` › "tab 1 selectOrg(B) while tab 2 stays on A: tab 2 keeps its token and next renews with A" | T1, per-tab org |
| `org-views.test.tsx` › "OrgPickerView lists one button per org named by the org (Vietnamese name intact), in a labelled list; notice org_denied in a status region; busyId disables all buttons and marks the busy one aria-busy; sign-out button present" | AC1a, AC4 |
| `org-views.test.tsx` › "OrgSwitcherDialog: radio per org, current org checked and marked 'Current' in text; loading and failed states (failed shows Try again); single org shows the 'only this organization' text" | AC1c, C2 |
| `org-views.test.tsx` › "NoOrgView shows the AUT-06 text, the how-to-get-access line, the email and sign-out; notice when given" (or in `views.test.tsx` line 84) | AC1a |
| `AppShellView.test.tsx` › "org name shown; switch button rendered only when switchOrg is given" | C2 |
| existing `no-literals.test.ts`, `copy.test.ts`, `auth.test.ts` (CODES updated) | C1 |

No gate-level test (no jsdom, unchanged policy); the gate holds no decision logic beyond calling the pure functions above.

## Approach
1. **Types and errors** (`src/lib/identity/types.ts`, `errors.ts`): add the code, `AuthError.orgId?`, `OrgChoice`.
   `toAuthError` never sets `orgId`.
2. **Identity client** (`identityClient.ts`): `token(accountId, orgId?)` → body `{audience, account_id, ...(orgId &&
   {org_id: orgId})}`. `orgs(accountId)`: `get("/auth/orgs?account_id=" + encodeURIComponent(accountId),
   AbortSignal.timeout(5000))`, then a private `parseOrgs(json)` (all guessing lives here, Q18):
   - list = `json` if array, else the first array among `items`, `orgs`, `organizations`, `data`; none → throw
     `unknownError()`.
   - per item: `src = item.org ?? item.organization ?? item` (object); id = first string of `src.id`, `item.org_id`,
     `src.org_id`, `item.organization_id`; name = first non-blank string of `src.name`, `src.display_name`,
     `item.org_name`, `src.slug`; id must match `UUID_RE`, lowercased; name `trim().normalize("NFC")`; drop invalid.
     Roles are ignored (simap tiers come only from `org_roles` on the server, R6).
   - dedupe by id; empty input list → `[]`; non-empty input with zero valid items → throw `unknownError()` (a parse
     failure must reach the retry screen, never "you have no organization").
   - Only the first page is read (pagination unknown; see Assumptions).
3. **Pure decision** (`src/lib/identity/orgs.ts`, lib → lib only):
   ```ts
   export type OrgNotice = "org_denied";
   export type OrgDecision =
     | { kind: "enter"; org: OrgChoice }
     | { kind: "pick"; orgs: OrgChoice[]; notice?: OrgNotice }
     | { kind: "none"; notice?: OrgNotice };
   export function decideOrg(input: { orgs: readonly OrgChoice[]; remembered: string | null; denied: readonly string[] }): OrgDecision
   export function sortOrgs(orgs: readonly OrgChoice[]): OrgChoice[]
   ```
   Lowercase + dedupe, drop `denied`. If `denied` is non-empty (Q1): 0 left → `none` + notice, else `pick` (sorted) +
   notice — never `enter`. Otherwise: 0 → `none`; 1 → `enter`; several → `enter` the remembered one if listed, else
   `pick`. `sortOrgs`: `Intl.Collator("vi", { sensitivity: "base" })` on NFC names, tie by id. No storage, client or
   clock.
4. **Remembered org** (`src/ui/auth/orgId.ts`): as in the file table. Exported `OrgIdStorage = { read(accountId),
   write(accountId, orgId), clear(accountId, onlyIf?) }` lives in `tokenStore.ts` next to `AccountIdStorage`.
5. **Token store** (`tokenStore.ts`):
   - Option `orgStorage: OrgIdStorage = { read: readOrgId, write: writeOrgId, clear: clearOrgId }`. State `let orgId =
     id ? orgStorage.read(id) : null` (returning user: one token call with the org, then `/api/me`).
   - Interface: `orgId: () => string | null`; `selectOrg: (orgId: string) => Promise<void>` (rejects with the mint's
     `AuthError`).
   - `renew` (line 125-178): capture `const org = orgId` with `epoch`/`accountId`; `client.token(accountId, org ??
     undefined)`; broadcast `orgId: org`. In `.catch`, after the epoch check: `org_access_denied` → `token = null`;
     `if (org) { orgStorage.clear(accountId, org); orgId = null; }`; rethrow `{ ...err, orgId: org ?? undefined }`
     (orgId only when non-null). Add `"org_access_denied"` to `NOTIFY_CODES` (line 50) so background renewals reach the
     gate.
   - `selectOrg(next)`: `reset(); orgId = next.toLowerCase(); const gen = generation; await renew(); if (gen ===
     generation && token !== null) orgStorage.write(id!, orgId)` (remember only after a successful mint).
   - `onMessage` (line 214-225): token messages also require `(msg.orgId ?? null) === (orgId?.toLowerCase() ?? null)`;
     `signedOut` stays account-wide.
   - `adopt` (line 235-241): after `reset()`, `orgId = orgStorage.read(accountId)` (the NEW account's value or null).
   - `signOut`, `forget`, `session_invalid` branch, remote `signedOut`: `orgId = null` and `orgStorage.clear(gone)`
     (key is account-scoped, so only the gone account's entry is removed).
6. **Flow** (`flow.ts`): `viewForMe` 403 `org_required` → `{kind:"needOrg"}`. `viewForTokenError`:
   `org_access_denied` → `hasAccount && err.orgId ? {kind:"pickOrg", error: err} : {kind:"retry", error:{code:"unknown"}}`
   (placed before the generic fall-through).
7. **Gate** (`AuthGate.tsx`; extension points for SIM-007.3 marked **[EXT]**):
   - `View` += `{ kind: "orgPicker"; orgs: OrgChoice[]; notice?: OrgNotice; busyId?: string | null }`; `noOrg` +=
     `notice?`; `ready` += `orgs: OrgChoice[] | null` (null = not loaded). Gate state `switcher: null | { status:
     "loading" | "ready" | "failed"; orgs: OrgChoice[] }`.
   - Refs: `denied = useRef<Set<string>>(new Set())` (per tab; reset in `signIn`, `continueAs`, `useOtherAccount`,
     `signOut`, remote sign-out; an id is deleted once a mint for it succeeds); `orgList = useRef<OrgChoice[] | null>`
     (reset on the same account changes); `orgListSeq` like `listSeq`.
   - `enterOrg(s)` (shared by `needOrg` and `pickOrg`): `setView(checking)`; `const acct = store.accountId()`; null →
     `apply(signedOut session_invalid)`; `list = await client.orgs(acct)` (catch → `apply(meErrorView(e, true), s)`:
     network/unknown → retry, `session_invalid` → sign-in); `if (!alive()) return`; `orgList.current = list`;
     `decideOrg({ orgs: list, remembered: store.orgId(), denied: [...denied.current] })` → `enter` →
     `selectAndCheck(id, s)`; `pick` → `orgPicker`; `none` → `noOrg` with `store.accountEmail()` (existing code at
     line 147-155) + notice.
   - `selectAndCheck(id, s)`: `try { await store.selectOrg(id) } catch (e) { if (alive) apply(meErrorView(e, store.accountId() !== null), s); return }`;
     `denied.current.delete(id)`; `runCheck(s)`. **[EXT]** every org entry ends in `runCheck` → `apply(ready)`, so
     SIM-007.3's "needsProfile → profile view" check in `readMeResult`/`viewForMe`/`apply` covers entry, switch and
     restore without touching the org code.
   - `apply` cases: `needOrg` → `enterOrg(s)`; `pickOrg` → `denied.current.add(v.error.orgId!.toLowerCase())`, then
     `enterOrg(s)` (denied non-empty → `decideOrg` cannot `enter`: bounded, T2). The existing `noOrg` MeView case
     disappears (now produced only by `enterOrg`).
   - Picker click `pick(id)`: `busy` guard; `s = ++seq`; `setView(v => ({...v, busyId: id}))`; `selectAndCheck(id, s)`;
     finally clear busy.
   - `ready` case (line 137-146): keep `generation: prev.kind === "ready" ? prev.generation : ++generation.current` and
     add a comment: "a switch passes through `checking`, so it always gets a new generation and remounts all data — do
     not optimise". Session `{ tier, email, orgName }` with `orgName = orgList.current?.find(o => o.id === store.orgId())?.name`.
     If `orgList.current` is null, start `loadShellOrgs()` in the background (`client.orgs`, failure ignored, dropped
     if `orgListSeq` moved or the view is no longer `ready`); on success set `orgList.current` and
     `setView(v => v.kind === "ready" ? {...v, orgs, session: {...v.session, orgName}} : v)` (same generation: no
     remount). **[EXT]** SIM-007.3 adds its `profile` view kind next to `orgPicker`; `ready` stays the only place that
     renders children.
   - Shell actions in the `ready` render (line 429-436): `switchOrg` = `openSwitcher` when `view.orgs === null ||
     view.orgs.length > 1`, else `undefined` (Q3). `OrgSwitcherDialog` renders next to the keyed Fragment (outside it),
     inside `SessionProvider`.
   - `openSwitcher`: `setSwitcher({status:"loading", orgs: []})`; fresh `client.orgs()`; → `ready` (also refreshes
     `orgList.current`) or `failed` (Retry re-runs it). Cancel/close: `setSwitcher(null)`, nothing else.
   - `switchTo(id)`: same id as `store.orgId()` → close. Else close; `s = ++seq`; `flushSync(() => setView(checking))`
     (unmount the old org's screens first, as `signOut` does at line 278); `selectAndCheck(id, s)`. A denial → `pickOrg`
     path: picker with notice, the previous org still offered (no automatic restore).
   - Background denial (`store.subscribe`, line 249-258) needs no change: it already routes through
     `apply(viewForTokenError(err, …))`, now `pickOrg`.
   - Sign-out stays reachable on `orgPicker` (button), `noOrg` (existing), `retry` (unchanged: it has none today, kept
     as is — out of scope).
8. **Views** (`src/ui/org/*`, ui → ui/lib only, all text from `orgCopy`, user data rendered as text, no
   `dangerouslySetInnerHTML`):
   - `OrgPickerView({ orgs, notice?, busyId?, onPick, onSignOut })`: `AuthLayout` title `orgCopy.picker.title`; notice
     via `Notice kind="info"`; `<ul aria-label={orgCopy.picker.listLabel}>` of `Button` items (org name, wrapping, no
     truncation); all disabled while `busyId` is set, the busy one `aria-busy` and text `orgCopy.picker.entering`;
     `autoFocus` on the first button; text button "Sign out" (`authCopy.actions.signOut`).
   - `OrgSwitcherDialog({ open, state, currentId, onSwitch, onRetry, onClose })`: `EntityFormDialog` (title
     `orgCopy.switcher.title`, submit `orgCopy.switcher.submit`, native `<dialog>` focus trap/Escape/focus return);
     body: loading `Notice busy`; failed `Notice error` + Retry button; else a `<fieldset>` with `<legend>` and one
     radio per org (`name="org"`, label = org name, current preselected, current also labelled with
     `orgCopy.switcher.current` text — not colour only); one org → `orgCopy.switcher.only`. Submit disabled unless
     state is ready.
   - `NoOrgView` (views.tsx): `orgCopy.none.title`, `orgCopy.none.body(email)` ("You are not in any organization
     yet."), `orgCopy.none.howTo` ("Ask an organization admin to add you, then sign in again."), optional notice.
9. **Copy** (`src/ui/copy/org.ts`, D36, English, no diacritics): `picker {title, listLabel, entering}`, `switcher
   {title, submit, legend, current, loading, loadFailed, retry, only}`, `notices {org_denied: "You no longer have
   access to that organization."}`, `none {title, body(email), howTo}`. `auth.ts` errors `org_access_denied: "You no
   longer have access to that organization."`.
10. **Shell** (`AppShellView.tsx` line 100-105): wrap the swap `IconButton` in `{actions.switchOrg && …}` and drop
    `disabled`.
11. Checks from `loop.config.md`: format, typecheck + check:layers, test, build.

Rules: **R1** `orgs.ts` is pure lib; `src/ui/org/*` imports only ui and `@/lib/*`; no server import (check:layers).
**R3** no env, no new config; nothing secret stored (org id only; token stays in memory, the channel carries it as
today). **R4** files above only. **R5** tests above. **R6** the client list is a convenience: authorisation still comes
only from the minted token's `org` claim checked by `withAuth` (untouched); a tampered remembered id at worst yields
`org_access_denied`.

## Specialist input used
- `work/tickets/SIM-007.2/consult-frontend-developer.md`:
  - Adopted: tolerant parse only in `orgs()`, throw on unparseable (Risk 3); options-object `decideOrg` with lowercase
    compare and "denied non-empty → never enter" (Rec 1, Q1); per-tab `denied` set in the gate (Rec 2/Risk 4);
    `OrgIdStorage` injectable, `selectOrg` = reset + set + renew, epoch capture, denial clears memory + remembered and
    keeps the account, adopt reads the NEW account's org (Rec 3, Risk 2); `orgId` in the channel with "absent = null",
    no `v` bump (Rec 4, Risk 1); key `mm_org_id:<accountId>`, write only after a successful mint, clear-if-equal (Rec
    5); `orgs()` failure → retry not `noOrg` (Rec 7); background denial via `subscribe` (Risk 6); no restore after a
    failed switch (Risk 5).
  - Changed: picker and switcher are two components (entry buttons in `AuthLayout`; switcher radios in
    `EntityFormDialog`) instead of one `OrgPickerView` with `onCancel` — `EntityFormDialog` needs a submit, and a
    radio group + "Switch" is its natural fit (Q2). Single-org switcher: hidden after a background list instead of
    a lazy-only fetch (Q3) — the same background call supplies the org name, which `/api/me` does not return.
  - Rejected: separate `nextOrgStep` reducer (Rec 2) — the loop bound is already a property of `decideOrg` with a
    non-empty `denied`; a reducer would duplicate it (Q6). Optional "disabled denied org in the list": denied orgs are
    simply filtered out.
- `work/tickets/SIM-007/consult-frontend-developer.md` and `consult-api-platform-engineer.md`: carried in through the
  approved S2 text (cross-tab leak, keyed Fragment remount, caches below the Fragment, org storage per account).

## Assumptions
**Decisions for Ming (batch round). None block; each default is reversible.** Q1–Q8 below.

- **Q1 (deviation from the SIM-007 consult's "one org left → enter"; consult Q1/Q6). Non-blocking.** After any
  `org_access_denied` in this tab, the gate never auto-enters: it shows the picker (or "no organization") with the
  notice, even if exactly one org remains. Why: loop-proof by construction and the notice is never lost. Default: yes.
- **Q2 Switcher = dialog (consult Q2). Non-blocking.** `EntityFormDialog` with a radio group, current org preselected,
  "Switch" submit; Cancel/Escape changes nothing. Default: yes.
- **Q3 Single-org users (consult Q3). Non-blocking.** After entering `ready`, the gate fetches `/auth/orgs` once in the
  background (not on the path to the first screen) for the org name and count; the switch button is hidden when the
  list has exactly one org, shown while the list is unknown or failed (the dialog then fetches itself). Cost: one
  extra Identity call per entry/reload. Default: yes.
- **Q4 Remembered org cleared on explicit sign-out / forget / `session_invalid`** (as written in S2). Consequence: a
  multi-org user picks again after signing out; reloads and new tabs keep it. Default: as S2.
- **Q5 (deviation from S2's `src/lib/session.ts` `canSwitchOrg`). Non-blocking.** No new `Session` field; the gate
  passes `switchOrg` only when switching makes sense, and `AppShellView` hides the button when it is absent (today it
  shows it disabled). Default: yes.
- **Q6 No gate reducer (consult Rec 2 / SIM-007 consult Q6). Non-blocking.** Loop safety is tested on `decideOrg`;
  the gate is wiring only (no jsdom tests, as today). Default: yes.
- **Q7 Mid-session denial** (renewal gets `org_access_denied` while a screen is open): the screen unmounts and the
  picker shows with the notice. Default: yes.
- **Q8 Size.** ≈ 600 production + ≈ 600 test lines, above the ~400-line guide. Default: keep S2 as one PR (Ming
  approved it as one slice; SIM-007.3 in this batch builds on it; tests are table-driven). Fallback split if review
  struggles: S2a plumbing (types, errors, `orgs.ts`, `orgId.ts`, identity client, token store, channel, flow) and S2b
  (gate, views, copy, shell). Non-blocking.

Other assumptions:
- **A1 `/auth/orgs` body** is unknown (Q18): parser per Approach 2; Ming check after merge (step 1). If the real shape
  differs, the fix is local to `parseOrgs` (follow-up bug).
- **A2 `/auth/orgs` is cookie-only** (consumers.md:135-136 "cookie class"); no bearer is sent. If it needs a bearer, the
  Ming check shows a 401/403 → retry screen; follow-up.
- **A3 Pagination:** only the first page is read; an account in more orgs than one page holds sees a partial picker.
  Follow-up (`debt`) if Ming's check shows paging fields.
- **A4 Per-tab org:** open tabs keep their own org after a switch elsewhere; the remembered value (last successful
  choice) applies to new tabs and reloads. Cross-org tabs each renew their own token (one extra lock wait; accepted).
- **A5 Org name** comes from the `/auth/orgs` list (the token carries only the id; `/api/me` returns no org name).
  If the background list fails, the shell shows no name.
- **A6** `org_not_supported` / `validation_error` from `/auth/token` keep today's mapping (`unknown` → retry,
  `validation_error` → sign-in error): bug codes, not user cases (consumers.md:129).
- **A7 Old-build tabs during a deploy**: their org-less broadcasts are ignored by org tabs and adopted only by org-less
  tabs (absent `orgId` = null).
- **Hotspots:** SIM-006.3 is MERGED (its `AuthGate.tsx`/`views.tsx`/`copy/auth.ts` edits are already on this branch's
  base). **SIM-007.3** (same batch, runs after this) edits `AuthGate.tsx`, `flow.ts`, `src/ui/org/*` and adds
  `copy/profile.ts`: it must branch from `main` after this PR merges (extension points marked [EXT] in Approach 7).
  **SIM-027** (same batch) hardens `apiFetch` (`src/lib/api/fetch.ts`, not touched here) and may touch
  `src/ui/auth/runtime.ts` (not touched here); expect at most a trivial rebase in `AuthGate.tsx` if it adds a handler.
  SIM-019.2 does not share files.
- **Rule for later tickets** (from S2): client data caches live below the keyed Fragment or are keyed by org id;
  module-level caches need a clear on generation change.

## Blocking questions
None.

## Split proposal
None (see Q8 for the fallback split if Ming prefers smaller PRs).
