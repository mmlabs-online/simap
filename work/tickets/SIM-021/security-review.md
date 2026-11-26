# SIM-021 security review

## Attempt 1

## Security review: SIM-021, attempt 1 (docs only)

Verdict: **PASS with 4 should-fix items. No blockers.** I read `docs/go-live.md`, `work/tickets/SIM-021/flow-run.md`, `work/ming-todo.md:144-145` and the plan. To check the runbook's claims I also read `db/migrations/20261120150000_init.sql`, `deploy/deployment-repo/apps/simap/compose.yml`, `deploy/deployment-repo/.github/workflows/deploy-simap.yml` and the `.github/workflows/*` triggers. I wrote no files. I ran no git or check commands (the directory is not a git repo in this environment).

### Findings

**🟢 1. No secret values, emails, UUIDs or personal data. Secrets are named only.**
- A grep for `@x.`, UUID patterns, `sk-`, `token=<value>` and `password=` finds nothing in `docs/go-live.md` or `flow-run.md`.
- `docs/go-live.md:56-59` lists secret names only and says "Check names only; never paste values".
- The recovery SQL uses placeholders (`docs/go-live.md:150`). The reset link is `#token=...` (`:33`).
- `flow-run.md:14-23` uses tier labels only, and `:177` forbids personal data and screenshots that show emails.
- The Docker Hub namespace `mingming21400` (`go-live.md:56`) is a public registry handle that `compose.yml:3` already uses. That is acceptable.
- One aside: the same grep matched pre-existing `work/ming-todo.md:143`, which this ticket did not change. I did not review it.

**🟢 2. Turnstile, CSP and HSTS checks are included.**
- Turnstile: `go-live.md:36-40`, plus `flow-run.md:40` (F1.6).
- Exactly one HSTS header and one CSP header on `/sign-in`: `go-live.md:87-88`.
- The browser CSP check (zero violations, M-14): `go-live.md:91-94`.
- A check that no Cloudflare transform rule duplicates the headers: `go-live.md:44-45`.

**🟢 3. The tunnel uses HTTP inside the network only.** `go-live.md:44` routes to `http://simap:3000`. The compose draft publishes no ports (`compose.yml:12`, and there is no `ports:` key). `migrate` sits on the internal `db` network only (`compose.yml:71`).

**🟢 4. Runner fork safety is gated before release.**
- Item 7 (`go-live.md:69-73`) requires M-76 (`ming-todo.md:144`) before any `release/*` push.
- `deploy-simap.yml:25-29` triggers only on `push: main` and `workflow_dispatch`.
- The self-hosted jobs in simap's `ci.yml:23,65` and `risk-tier.yml:22` have same-repo fork guards.

**🟡 5. Item 7 covers only the simap repo, not the deployment repo.**
- Evidence: M-76 (`ming-todo.md:144`) checks "repo simap Settings → Actions → 'Run workflows from fork pull requests'" and the org runner-group "Allow public repositories" setting. The production deploy runs on the same `macbook-runner` (`deploy-simap.yml:48`) from `mmlabs-online/deployment`, and other app workflows in that repo may have `pull_request` triggers.
- Risk: if the deployment repo is private and allows fork PR workflows, fork code reaches the runner that holds the production DB credentials (`compose.yml:15-17`).
- Fix: extend item 7's Check with: "the same fork-PR setting is off on `mmlabs-online/deployment`, and no workflow there that runs on `macbook-runner` has a `pull_request` or `pull_request_target` trigger without a same-repo guard."

**🟡 6. Item 4 does not check that the role owns only its own database.**
- Evidence: `go-live.md:50-51` checks only that "the `simap` role owns database `simap`". On a shared Postgres, new databases grant `CONNECT` and `TEMP` to `PUBLIC` by default. So unless `add-app-db.sh` revokes that, the `simap` role can connect to every other app's database. The check also does not prove the role lacks superuser, CREATEDB, CREATEROLE or BYPASSRLS.
- Fix: add these to item 4's Check:
  - `select rolsuper, rolcreatedb, rolcreaterole, rolbypassrls from pg_roles where rolname = 'simap';` returns all `false`.
  - `select datname from pg_database where datdba = 'simap'::regrole;` returns only `simap`.
  - `select datname from pg_database where has_database_privilege('simap', datname, 'CONNECT');` returns only `simap` (template dbs aside).

**🟡 7. The "drop and recreate the empty `simap` database" rollback has no guard rails.**
- Evidence: `go-live.md:132-133`. This runs as an admin role on the shared Postgres. The doc names no owner, no exact statements and no precondition beyond "no real data".
- Risk: dropping the wrong database on a shared server, or recreating it with the wrong owner or with default `PUBLIC` grants. Either breaks R6-adjacent isolation (see finding 6).
- Fix: mark the step "Ming only". Require the `deploy-simap` dump to exist first and name only `drop database simap;`. Say it is recreated through `add-app-db.sh simap` (or with `owner simap`, then `revoke connect, temporary on database simap from public`). After that, re-run item 4's checks.

**🟡 8. The recording rules do not forbid tokens, reset or invite links, or HAR files.**
- Evidence: `flow-run.md:177` forbids "personal data" and email screenshots only. Several steps make tokens easy to capture:
  - `go-live.md:85-86`: inspect `/api/*` in DevTools Network.
  - `flow-run.md:41`: F1.7, the reset link.
  - `flow-run.md:50`: F2.4, the invite link.
  - `flow-run.md:148`: F10.5, a 403 re-mint.
- Risk: a bearer token, a `#token=` reset link or a HAR file pasted into Notes or a `/bug` ticket gets committed to the repo. That is an R3 breach, and a reset link is an account takeover until it expires.
- Fix: add to `flow-run.md` "How to record": "Never paste links from emails (reset or invite links carry tokens), `Authorization` headers, HAR exports or Network screenshots that show request headers. Describe the host and path only."

**🟢 9. The lockout-recovery SQL is scoped by org and run only by Ming.**
- `go-live.md:149-150` filters on `org_id` and `sub`, which together are the unique key `members_org_sub_key` (`init.sql:52`), so it can touch at most one row.
- `status = 'active'` matches the check constraint (`init.sql:51`), and `updated_at` exists (`init.sql:48`).
- Item 13 is owned by Ming, and `go-live.md:154` says "Claude never runs it".
- A suggestion, not a defect: wrap it as `begin; update ... returning org_id, sub, status; commit;` and stop unless the result is `UPDATE 1`. That catches a mis-pasted placeholder.

**🟢 10. Rollback never uses `down -v`.** The only mention is the prohibition at `go-live.md:124` ("Never run `docker compose down -v` or remove volumes"). Migrations stay applied (`:123`), which is consistent with R2 and D3.

**🟢 11. The flow run includes an org-isolation check (R6).** `flow-run.md:150-155` (F11.1 and F11.2) covers listing and direct-URL access. `flow-run.md:173` makes a cross-org leak S1.
- A suggestion: add the reverse direction (the test-org Admin cannot see the real org) and one non-room resource (a device or member detail URL from the other org gets not-found).

### Follow-ups (out of scope)
- A5 (`go-live.md:166-168`) suspends the test org after the run, but the four test Identity accounts stay live in production with known passwords. Consider also removing their `simap:*` roles or disabling them in Identity, as a Ming step.
- A2 shares the tudocuatui Turnstile widget across hostnames. That is acceptable (the site key is public and Identity verifies tokens server-side). A separate widget is a later hardening option, as the plan already notes.
