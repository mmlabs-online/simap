## Attempt 1 — 2026-11-20
Verdict: PASS

### Checks (run by reviewer)
Run locally in WSL on `ticket/SIM-007.2` @ f41548e (after `pnpm install --frozen-lockfile`, exit 0):
- `pnpm format:check` — exit 0, "All matched files use the correct format" (223 files).
- `pnpm typecheck && pnpm check:layers` — exit 0; "check-layers: 197 files, no violations".
- `pnpm test` — exit 0; Test Files 70 passed (70), Tests 700 passed (700). Matches impl-log.
- `pnpm build` — exit 0, route table printed.
- `pnpm test:db` (CI-only) — CI run 44771932491 (ci.yml, head f41548e): job `ci` success, job `image` success
  (`gh run watch 44771932491 --exit-status` exit 0). Risk-tier run 44771932827 success; PR #24 label `risk:medium`
  (matches the plan's predicted tier).

### Acceptance criteria
- [x] 1a One org entered directly, several -> picker, none -> AUT-06 text — evidence: `orgs.test.ts` › "0 orgs -> none",
  "1 org -> enter it…", "2 orgs + remembered unlisted or null -> pick, sorted"; `flow.test.ts` › "403 org_required ->
  needOrg"; `org-views.test.tsx` › "lists one button per org…"; `views.test.tsx` NoOrgView case; gate wiring
  `AuthGate.tsx` `enterOrg` (needOrg/pickOrg cases in `apply`).
- [x] 1b Remembered org (id only), returning user enters without picker — evidence: `orgId.test.ts` (4 cases);
  `tokenStore.test.ts` › "selectOrg(id): … remembered only after the mint", "a store created with a remembered org mints
  with it on restore", "continueAs uses the NEW account's remembered org…".
- [x] 1c Switch re-mints with new `org_id`, only new org's data — evidence: `tokenStore.test.ts` › "selectOrg drops an
  in-flight /token of the old org…"; `identityClient.test.ts` › "token: body is {audience, account_id} without an org and
  adds org_id with one"; `AuthGate.tsx` `switchTo` does `++seq` + `flushSync(checking)` before `selectAndCheck`, and the
  `ready` case gets a new generation (comment present), so the keyed Fragment remounts. Two-org manual run is a Ming
  check (M-1).
- [x] 4 `org_access_denied` drops remembered org, back to picker with notice — evidence: `identityClient.test.ts` ›
  "token: 403 org_access_denied…"; `errors.test.ts` › "org_access_denied is accepted from the body and orgId is never
  taken from it"; `tokenStore.test.ts` › "org_access_denied: token and org cleared…", "a denial clears the remembered org
  only while it still names the denied org", "selectOrg rejected with org_access_denied never writes…"; `flow.test.ts` ›
  "with an account and orgId -> pickOrg(error)".
- [x] 5 (part) Unit tests cover the picker decision — `src/lib/identity/orgs.test.ts` (decideOrg table + sortOrgs).
- [x] T1 A tab ignores a token minted for another org — `tabs.test.ts` › "a tab on org A ignores a token broadcast for
  org B and adopts one for org A", "an org-less message … ignored by a tab with an org and adopted by an org-less tab",
  "tab 1 selectOrg(B) while tab 2 stays on A…"; `authChannel.test.ts` orgId parse cases; `tokenStore.ts` `onMessage`
  `msg.orgId !== orgId` guard (both lowercase).
- [x] T2 A denied org cannot loop on auto-enter — `orgs.test.ts` › "after a denial it never enters" (remembered listed,
  single org left, only org denied, denied org filtered); `flow.test.ts` › "without orgId -> retry(unknown), never
  pickOrg"; gate adds the denied id to the per-tab set before `enterOrg`.
- [x] C1 Copy convention — all new text in `src/ui/copy/org.ts`; `auth.ts` `errors.org_access_denied`; `auth.test.ts`
  CODES updated; `no-literals`/`copy` tests pass in the 700.
- [x] C2 Org name in shell, switcher hidden for one org — `AppShellView.test.tsx` › "shows the org name; the switch
  button only when switchOrg is given"; `org-views.test.tsx` switcher cases; gate passes `switchOrg` only when
  `orgs === null || orgs.length > 1` (Q3 default).
- [x] C3 All loop checks green — see Checks.

Ming verification after merge (not reviewer's; carry into the PR): plan § "Ming verification after merge" steps 1-5
(real `/auth/orgs` body shape Q18 and cookie-only call; two-org picker/remember/switch; two tabs on different orgs;
one-org account has no switch button; revoked org -> picker/no-org with notice and no loop). Needs M-1.

### Issues
None blocking.

### Rules (CLAUDE.md)
No violations found. R1: `src/lib/identity/orgs.ts` pure lib; `src/ui/org/*` imports only ui and `@/lib/*`
(check:layers clean). R3: no env/config; localStorage holds only the org UUID, token stays in memory. R4: every changed
file is in the plan's file table; no High path touched (`risk:medium`). R5: green checks, new logic tested. R6: client
org list is convenience only; server authorisation unchanged.

### Blockers from review agents

### Nits (do not block)
- `src/ui/auth/AuthGate.tsx` `openSwitcher`/`fetchOrgs`: the switcher shows `client.orgs()` in server order; the entry
  picker is sorted via `decideOrg` -> `sortOrgs`. Passing the list through `sortOrgs` in the switcher would keep the
  Vietnamese collation consistent (domain focus: sort with diacritics).
- `src/ui/org/OrgSwitcherDialog.tsx`: plan said "Submit disabled unless state is ready"; it is enabled and `onSubmit`
  ignores it when not ready (and closes on the current org). Harmless, but the button looks actionable while loading.
- `src/ui/auth/tokenStore.ts` `selectOrg`: if the mint fails with `network`/`unknown`, `orgId` stays set to the new org
  but is never written to storage; a later Retry enters that org without remembering it. Acceptable, worth knowing.
- `AuthGate.tsx` `enterOrg`: a 401 `session_invalid` from `/auth/orgs` routes to sign-in via `meErrorView`, but the
  store keeps the account id (only `/auth/token` failures clear it). The next sign-in/continue resets it, so no harm.

### Follow-ups (out of scope)
- `/auth/orgs` body shape unverified (Q18): fix local to `parseOrgs` if Ming's check differs.
- Only the first page of `/auth/orgs` is read (A3): `debt` issue if paging fields show up.
- `src/ui/copy/api.ts` `org_required` text now unused by the gate (kept per plan).
