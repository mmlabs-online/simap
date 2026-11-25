Status: READY

# Plan — SIM-021: Go-live checklist and first production deploy

## Scope summary
- Ticket goal: "simap runs in production at `simap.mmlabs.online` with a first org, and seatMGT's main flows are
  checked by hand."
- Ticket scope: "Checklist in `docs/go-live.md`: Identity app settings, tunnel, DB, first release, first org and
  admin." and "Manual run of seatMGT's flows (sign in, manager assigns, devices, request flow, layout designer) on
  production; findings become BUG tickets." Out of scope: "The release itself (Ming's step)."
- Spec `docs/spec-v1.md` §6 "v1 done means" (lines 568-574): "seatMGT's e2e flows (sign in, manager assigns, devices,
  seat-request flow, layout designer) are checked by hand before go-live" and "The app is deployed to production at
  `simap.mmlabs.online` through the `migrate` → replace flow, and seatMGT can be switched off. simap starts empty;
  orgs enter their data from scratch (D6)."
- Spec §8 Database (line 618-619): "Rollback = previous image, or fix forward, or restore the pre-release backup."
- D6: "No seatMGT data is migrated; simap starts empty and data is built again."
- D8: "Production host `simap.mmlabs.online`; Ming registers the Identity app and hostname later."
- `.claude/loop.config.md` Guardrails: "never touch the hosting dashboard, the shared Postgres or the deployment repo
  by hand"; "never push `release/*` (a release is Ming's step)".

**What this PR delivers (decision, see Split proposal):** the checklist `docs/go-live.md`, a prefilled manual
flow-run template `work/tickets/SIM-021/flow-run.md`, and one `work/ming-todo.md` item (M-77). The flow run itself
happens on production after Ming's release (M-8), so it cannot be inside this PR. Recording its results and filing
the bugs is a follow-up ticket **SIM-021.1**, which the orchestrator creates when this plan is approved.

## Acceptance criteria → verification
Ticket AC 1 is met in this PR. Ticket ACs 2 and 3 are met in SIM-021.1 (A1). This PR provides the means for both: the
template and the recording and filing rules.

| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | `docs/go-live.md` exists with an ordered, numbered checklist covering the ticket scope: pre-flight, Identity app settings, Turnstile, tunnel, DB, secrets, deployment repo, runner safety, first release, smoke, CSP/HSTS, first org and admin, flow run, lockout recovery decision, sign-off (items 0-14 in Approach step 1). | Read the file. Every scope topic of the ticket maps to at least one item. |
| 2 | Every checklist item has an **Owner** (`Ming` or `claude`, or both with roles), a **Check** (an observable result or exact command) and a tick box. | `grep -c '^- \[ \] \*\*' docs/go-live.md` equals `grep -c 'Owner:' docs/go-live.md` and `grep -c 'Check:' docs/go-live.md` (all three counts are the same, ≥ 15). Spot-read each item. |
| 3 | `go-live.md` has a `## Rollback` section that covers the first release (`no-previous`: fix forward with `release/0.1.1`, or remove the tunnel route, or restore the `deploy-simap` dump, or, on the first release only, drop and recreate the empty `simap` DB), later releases (automatic restore, `restore-unpushed`, revert PR of `apps/simap/release.env`), and "migrations stay applied". It never mentions `down -v` except as a "never". | Read the section. Cross-check it against `deploy/deployment-repo/README.md` lines 39-45 and `deploy/deployment-repo/.github/workflows/deploy-simap.yml` lines 151-235. |
| 4 | `go-live.md` links to the existing runbooks and does not repeat their steps: `README.md#release-and-deploy`, `README.md#production-image`, `deploy/deployment-repo/README.md`; it names `ops/backup/RESTORE.md` as a path in `mmlabs-online/deployment`. | Relative links resolve (`ls` the targets). The doc does not reproduce the release workflow steps or the env-file rules; it says "see …". |
| 5 | `go-live.md` holds no secret values, no emails, no org UUIDs and no account names (R3). Secrets are named only. | `grep -nE '@[a-z0-9-]+\.|[0-9a-f]{8}-[0-9a-f]{4}-' docs/go-live.md work/tickets/SIM-021/flow-run.md` finds nothing except the `@didi-code0980` CODEOWNERS handle if quoted (preferably not quoted; link the README instead). |
| 6 | `go-live.md` has an `## Assumptions in force` (or similar) block that lists the defaults A2-A8 of this plan, each marked "default until Ming says otherwise", so Ming can see what the checklist assumes. | Read the section. |
| 7 | `work/tickets/SIM-021/flow-run.md` exists with: a header (date, version from the app header, browser and device, accounts by tier label only, org = "test org" label only), one table per flow F1-F11 (Approach step 2) with columns `# \| Flow \| Step \| Tier \| Expected (spec ID) \| Result \| Notes \| BUG id`, every row's Step and Expected filled and citing at least one spec ID or decision, Result/Notes/BUG id left empty, and a Summary block (counts PASS/FAIL/BLOCKED/N-A, open S1/S2, go or no-go). | Read the file. `grep -c '^| F' work/tickets/SIM-021/flow-run.md` ≥ 60. Every row has a spec ID (e.g. `AUT-01`, `REG-02`) or `D<n>` in the Expected column. Results column empty. |
| 8 | `flow-run.md` has a "How to record and file bugs" section: Ming reports results (Vietnamese is fine); claude fills the table; each FAIL becomes `/bug` with `Found in: v0.1.0 (production)`, severity S1 (blocks a v1 flow or crosses org scope, R6) / S2 (wrong result, workaround exists) / S3 (cosmetic); the BUG id goes back into the row; no personal data or screenshots with emails; things outside the spec (placeholder art, no members sync before SIM-020) go into Notes, not bugs; after fixes ship, re-run only failed rows and append the results with the new version. | Read the section. |
| 9 | `work/ming-todo.md` gains exactly one new open item `M-77` that points to `docs/go-live.md`, lists the open Ming steps it covers (M-6 Postgres check, M-6 Docker Hub and secrets, M-7, M-8, M-14, M-76, M-23, the Turnstile hostname, the Identity email-link base) and asks Ming to confirm or close M-7 and M-19. No other line in the file changes. | `git diff work/ming-todo.md` shows only added lines for M-77. |
| 10 | No file outside the list below changes; no High path is touched (no change to `src/lib/identity/config.ts`). | `git diff --stat main...HEAD`. |
| 11 | Checks are green. | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`. |

## Ming verification after merge
These belong to the go-live run, not to this PR's review:
- Ming works through `docs/go-live.md` items 1-11 and 13-14 (M-77), including the first release M-8.
- Ming runs the flow in `work/tickets/SIM-021/flow-run.md` on production (item 12) and reports the results.
- Then SIM-021.1 (claude) records the results in `flow-run.md` and files every FAIL with `/bug`. This meets ticket
  ACs 2 and 3.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `docs/go-live.md` | Create: ordered checklist 0-13, rollback, links, assumptions in force, the M-23 recovery step (A7) | Ticket scope, AC 1 | No |
| `work/tickets/SIM-021/flow-run.md` | Create: prefilled manual flow-run template plus recording and bug rules | Ticket ACs 2-3 (the means); caller's deliverable | No |
| `work/ming-todo.md` | Append one item M-77 under `## Open` (after M-76, line 143) | Ticket Technical notes; points Ming to the checklist | No |

The highest ID in `work/ming-todo.md` is M-76, so the new item is M-77. (The file already has duplicate IDs, e.g. two
M-6 items at lines 23 and 24. Leave them as they are. In `go-live.md`, cite them as "M-6 (Postgres check)" and
"M-6 (Docker Hub and secrets)".)

## Data model / migration
None.

## API contract
None.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| None (docs only; ticket Test plan: "Unit: none"). | The manual flow run is the test (spec "v1 done means"). The reviewer's checks are the greps in the AC table. |

## Approach
1. **Write `docs/go-live.md`.** Start with a short purpose line that quotes spec "v1 done means". Add a "What claude
   cannot do" paragraph: claude cannot reach production, the deployment repo, the shared DB, or the GitHub, Docker Hub,
   Identity or Cloudflare settings, and never pushes `release/*`. Every Ming step is Ming's. Each item uses one format:
   `- [ ] **N. Title**`, then indented `Owner: …`, `Check: …`, plus `Refs: M-x, Dn` where they exist. Items, in order
   (from consult "Recommendations" table, adopted):
   - 0 Pre-flight (claude): every dependency in the ticket header is MERGED in `work/backlog.md`. The last `main`
     commit has green CI. No open S1/S2 BUG rows.
   - 1 Identity app `simap` (M-1 done; Ming verifies): origin `https://simap.mmlabs.online`, `org_mode=required`, roles
     per D14 (`simap:admin` owner role, `simap:manager`, `simap:user`; `simap:org:invite` on admin and manager), and
     the email-link base for verify-email, reset-password and accept-invitation is `https://simap.mmlabs.online`
     (A4). Check: a forgot-password email for a test account opens
     `https://simap.mmlabs.online/reset-password#token=…`.
   - 2 Turnstile (Ming): the hostname list of the widget whose site key is in `src/lib/identity/config.ts:5` includes
     `simap.mmlabs.online` (A2). Check: `/sign-up` and `/forgot-password` on production render the widget and it
     passes.
   - 3 Tunnel (M-2 done; Ming verifies): `simap.mmlabs.online` → `http://simap:3000`; no Cloudflare transform rule adds
     HSTS or CSP. Link `deploy/deployment-repo/README.md`.
   - 4 DB (M-3 done, plus M-6 Postgres check): `select version();` reports 13 or newer, the `simap` role owns database
     `simap`, and the `pg-backup` sidecar is healthy.
   - 5 Secrets (M-6 Docker Hub and secrets; M-46 done): the Docker Hub repository `mingming21400/simap` exists. The
     simap repo has the secrets `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN` and `DEPLOY_REPO_TOKEN`, and the deployment
     repo has the four `SIMAP_*` Drive secrets. Names only.
   - 6 Deployment repo (M-7): the setup PR is merged (`apps/simap/compose.yml`, `.github/workflows/deploy-simap.yml`,
     CODEOWNERS line, `add-app-db.sh simap` outputs), and the live `deploy-simap.yml` matches the draft in
     `deploy/deployment-repo/`. Link that README.
   - 7 Runner safety (M-76) before any `release/*` push.
   - 8 First release (M-8): push `release/0.1.0` from a `main` commit that includes this PR, D57 naming. The `release`
     run is green. Review and merge `release/simap-v0.1.0`. `deploy-simap` is green (backup → migrate → healthy). Link
     `README.md#release-and-deploy`; do not restate its steps.
   - 9 Smoke (Ming runs; claude gives the checks): `curl -sS -o /dev/null -w '%{http_code}\n'
     https://simap.mmlabs.online/api/healthz` and `…/api/readyz` both print `200`. The shell shows `v0.1.0` (SIM-040).
     After sign-in, DevTools Network shows `/api/*` calls with status 200 (not 401 or 503), which proves JWKS egress to
     `api.mmlabs.online` (spec §8 Availability). `curl -sI https://simap.mmlabs.online/sign-in` shows exactly one
     `strict-transport-security` header and exactly one `content-security-policy` header.
   - 10 CSP and HSTS in a browser (M-14): run M-14's steps on production. The console shows zero CSP violations.
   - 11 First org and admin (Ming): the first real org exists (M-1). Its admin signs in once on production, so the
     member row is created (D16) and the device-type seed runs. The Admin tier shows in the shell. The flow run uses a
     separate test org (A5).
   - 12 Manual flow run (Ming runs, claude records in SIM-021.1): link `work/tickets/SIM-021/flow-run.md`.
   - 13 Decide M-23 before real users are onboarded. Link the recovery step (A7).
   - 14 Sign-off (Ming): switch seatMGT off only when the flow run has no open S1 or S2 bug. Placeholder art does not
     block this (A6).

   Then add these sections:
   - `## Rollback`: the content of AC 3, with links.
   - `## Lockout recovery (M-23, proposed default)`: A7.
   - `## Assumptions in force`: A2-A8.

   Note: the consult numbers the items 0-13. This plan inserts "First org" before the flow run and ends at 14. Keep
   whichever numbering the doc uses consistent with the M-77 text.
2. **Write `work/tickets/SIM-021/flow-run.md`.** Header fields as in AC 7. Accounts table by tier label: `Admin`,
   `Manager`, `User A`, `User B`, with no emails (A5). Precondition: each test account has signed in once, because
   only known members can be assigned (SEA-03, D16). Flows and the spec IDs each row cites:
   - F1 Sign in and org: AUT-01, AUT-02, AUT-06, D53, D33. Rows cover: wrong password message; sign-in; "Continue as";
     org picker or switch; sign-out refuses the next call; sign-up and forgot-password with Turnstile; reset-password
     link host.
   - F2 Invite and accept: AUT-03, D11, MEM-01, D17. Rows cover: Admin invites Manager; Manager cannot offer Admin; the
     pending invitation is listed; accept-invitation; display name on first visit.
   - F3 Rooms and seats: ROO-01, ROO-02, SEA-01, SEA-02. Rows cover: create room; duplicate code refused; add seats
     (codes `<room>-01…`); cannot-seat with a reason; room code change regenerates seat codes; deleting an occupied
     seat is refused; delete room with the impact shown.
   - F4 Layout designer: LAY-01, LAY-02, LAY-03, LAY-05, LAY-06, LAY-07, D62. Rows cover: place desks and fixtures;
     rotate; fixture on a desk refused; save and reload; a stale save in a second tab gets the conflict; Map items
     rename and hide; room view at 390 px.
   - F5 Manager assigns: SEA-03, SEA-05, DEV-06, D18. Rows cover: assign; reassign with confirm and primary demoted;
     clear; assigning the same member changes nothing; `?seat=` URL.
   - F6 Devices: DEV-01 to DEV-11, D31, D61, D63, D68. Rows cover: device type image upload through Drive; Admin
     creates a device (org inventory); assign to User A with expiry; User A places it as primary at their own seat;
     primary at another seat refused; lend as secondary; move; return to own inventory; transfer A→B (confirm, decline,
     cancel); return to org with Admin confirm; Admin take-back; delete while placed refused, then deleted from org
     inventory; detail history. Overdue (DEV-10) is N-A on the run day unless an expiry of today is checked the next
     day.
   - F7 Seat request: REG-01, REG-02, REG-03, D23, D24. Rows cover: User A requests; a duplicate creates nothing; a
     request for an occupied seat is refused; User B requests the same seat; Manager approves A and B is auto-rejected;
     the My requests badge; cancel; reject; release own seat.
   - F8 Members: MEM-01, MEM-02, D34. Rows cover: edit fields; deactivate User B with the counts warning; B's calls are
     refused; reactivate.
   - F9 Dashboard, search, export: DSH-01, DSH-02, D27. Rows cover: the counts; "nguyen" finds "Nguyễn"; the CSV opens
     in Excel with diacritics.
   - F10 Roles, audit, shell: SYS-01, SYS-03, SHL-01, SHL-02, AUT-02 403 re-mint, D65. Rows cover: User sees no
     Approvals or Admin pages; the Groups nav is hidden; audit filter; theme kept; "refresh permissions".
   - F11 Org isolation (R6, SYS-01): the real first org's Admin does not see the test org's room, and the test org's
     room URL answers not-found there.

   Then add a Summary block and the "How to record and file bugs" section (AC 8).
3. **Append M-77 to `work/ming-todo.md`** (AC 9). Suggested text: "M-77 Go live (SIM-021): work through
   `docs/go-live.md` in order and tick each item there. Covers M-6 (Postgres check), M-6 (Docker Hub and secrets),
   M-7, M-76, M-8, M-14, M-23, plus the Turnstile hostname and the Identity email-link base. Then run
   `work/tickets/SIM-021/flow-run.md` with the test org and send the results; claude records them and files bugs
   (SIM-021.1). Also confirm or tick M-7, and close M-19 if PR #34 is already merged." No other edits.
4. Run the checks (R5). If `pnpm format:check` covers Markdown and flags the new files, run `pnpm format` on them only.

Rules: R3 (secret names only, no values or PII), R4 (no Turnstile code change; any follow-up is a separate ticket),
R2 and D3 (the rollback text keeps migrations applied). R1, R6 and R7 are untouched because there is no code. The
Guardrails hold because every production, DB and dashboard action is owned by Ming.

## Specialist input used
`consult-software-architect.md`:
- Adopted: findings 1-8, the item table (one item added, "first org" moved before the flow run), the rollback section,
  the art decision, the flow-run recording format and columns, the bug severity rules, and the ming-todo cleanup
  (as one item, M-77).
- Adopted with a change: "Close or confirm M-19 and M-7". The implementer does not tick or edit those lines. M-77
  asks Ming to do it, because only Ming ticks Ming items.
- Open questions 1-6 are resolved as defaults A2-A7 below.

## Assumptions
Numbered for Ming. Each is a default he can overrule at the plan-approval gate.
1. **A1 Split of the ticket's ACs.** This PR delivers the checklist, the template and M-77. Ticket ACs 2 ("manual flow
   run recorded") and 3 ("bugs filed with `/bug`") move to the follow-up SIM-021.1 "Record the production flow run
   and file bugs" (Depends on: SIM-021; Needs Ming: M-8 and the flow run; Size XS; Gate none; it touches only
   `flow-run.md`, the new BUG tickets and the board). SIM-021 is MERGED when this PR merges. Go-live is complete when
   SIM-021.1 is MERGED and checklist item 14 is ticked. Reason: the run needs production, which exists only after
   Ming's release (out of scope in the ticket), and an open PR cannot wait on it.
2. **A2 Turnstile: keep the shared tudocuatui widget.** Ming adds `simap.mmlabs.online` to its hostname list in
   Cloudflare. No code change. The comment at `src/lib/identity/config.ts:4` ("simap gets its own widget before
   go-live (SIM-021)") then becomes stale. Correcting it is a High-path edit (`**/config.*`), so it goes to a
   follow-up ticket, not this PR. If Ming wants simap's own widget instead, a separate High ticket changes
   `TURNSTILE_SITE_KEY_PROD`, Identity must be given the new widget's secret, and that ticket must be released
   before checklist item 8.
3. **A3 M-7 and M-6 (Docker Hub and secrets) are treated as not confirmed.** The consult says M-7 is probably done
   (SIM-038 synced against a live `deploy-simap.yml`), but `work/ming-todo.md` lines 24 and 28 are unticked. They stay
   as checklist items 5 and 6 for Ming to verify. This does not block the plan or the PR; it blocks only the release.
4. **A4 The Identity email-link base is unknown.** M-1 does not say whether the link base for verify-email,
   reset-password and accept-invitation of app `simap` is `https://simap.mmlabs.online`. Checklist item 1 makes Ming
   verify it and set it if needed. Flow rows F1 and F2 check it end to end.
5. **A5 Test org and test accounts.** The flow run uses a separate test org that Ming creates as Super Admin (D10),
   not the real first org. It needs four Identity accounts with verified emails: Admin (org owner role), Manager,
   User A and User B. User B is needed for the rival request (REG-02) and the transfer (DEV-08). After the run, Ming
   suspends the test org in the admin portal. Its rows stay in the DB, isolated by `org_id`, because simap has no org
   delete (D6, D10). With only three accounts, the rival and transfer rows are marked N-A.
6. **A6 Go live with placeholder art.** The committed atlas is placeholder-only (D58). SIM-033 (BLOCKED, M-63) ships
   the real art and the Credits page later as `release/0.2.0`. The app, including the layout designer, is fully usable
   without it. With no third-party art bundled, there is no credits obligation yet (D45). Placeholder art does not
   block the seatMGT switch-off (item 14). If Ming wants the real look first, only item 14 waits, not the deploy.
7. **A7 M-23 lockout recovery.** Keep SIM-011 A4 for now, and add a documented recovery step to `go-live.md`. Ming
   runs one SQL statement through the pg-tunnel (D56) as the `simap` role: `update members set status = 'active',
   updated_at = now() where org_id = '<org uuid>' and sub = '<admin sub>';` (table and column from
   `db/migrations/20261120150000_init.sql:37-51`). The deny-list reads `members.status` on each call, so access
   returns at once. The step writes no audit row; note that in the doc. Claude never runs it. M-23 stays open until
   Ming picks this or the Admin-only ticket; item 13 asks for that choice before real users join.
8. **A8 The checklist ships in the first release.** Item 8 pushes `release/0.1.0` from a `main` commit that includes
   this PR. This is not required (it is a doc), but it keeps "the commit that went live" equal to the checklist that
   was used.
9. **A9 Hotspots.** There is no open ticket in IN_PROGRESS, REVIEW or DONE. SIM-033 (BLOCKED) and SIM-020 (BACKLOG)
   do not touch these files. `work/ming-todo.md` is edited by most `/run`s, so a small rebase is possible if another
   ticket adds an item first. In that case, take the next free M number.
10. **A10 Stale ming-todo entries.** M-19 (PR #34 `.env.example` lines) looks stale, and the file has duplicate IDs
    (M-4, M-6, M-24, M-75). This plan only asks Ming to confirm M-19 and M-7 in M-77. It does not renumber anything.

## Blocking questions
None. Every open question has a default (A2-A7). Ming confirms or changes them at the plan-approval gate.

## Split proposal
- **SIM-021 (this plan):** `docs/go-live.md`, `work/tickets/SIM-021/flow-run.md` (template) and M-77 in
  `work/ming-todo.md`. About 250-350 lines of Markdown, no code.
- **SIM-021.1 (new, created on approval):** after Ming's release (M-8) and flow run, claude fills `flow-run.md` with
  the results, files each FAIL with `/bug` (`Found in: v0.1.0 (production)`), writes the BUG ids back into the rows
  and completes the Summary (go or no-go). This meets ticket ACs 2 and 3.
- **Conditional follow-up (only if Ming overrides A2 or wants the comment fixed):** a High-tier ticket for the
  Turnstile constant or comment in `src/lib/identity/config.ts`.
