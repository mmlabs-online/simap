# Go-live checklist (SIM-021)

Spec "v1 done means" (`docs/spec-v1.md` §6): seatMGT's e2e flows (sign in, manager assigns, devices, seat-request flow,
layout designer) are checked by hand before go-live, and the app is deployed to production at `simap.mmlabs.online`
through the `migrate` → replace flow, so seatMGT can be switched off. simap starts empty; orgs enter their data from
scratch (D6).

**What claude cannot do.** Claude cannot reach production, the deployment repo, the shared database, or the GitHub,
Docker Hub, Identity or Cloudflare settings, and never pushes `release/*` (a release is Ming's step). Every step below
marked `Ming` is Ming's. Claude only prepares checks, records results and files bugs.

Work through the items in order and tick each one. Format of every item: Owner, Check (an observable result or exact
command), Refs (where they exist).

Runbooks (this checklist links to them and does not repeat their steps):
- Release and deploy: [README.md#release-and-deploy](../README.md#release-and-deploy)
- Production image: [README.md#production-image](../README.md#production-image)
- Deployment repo draft and env-file rules: [deploy/deployment-repo/README.md](../deploy/deployment-repo/README.md)
- Restore: `ops/backup/RESTORE.md` in the `mmlabs-online/deployment` repo (not in this repo)

## Checklist

- [ ] **0. Pre-flight**
  - Owner: claude (reports), Ming (decides)
  - Check: every dependency in the ticket header is MERGED in `work/backlog.md`; the last `main` commit has green CI;
    no open S1 or S2 BUG rows on the board.

- [ ] **1. Identity app `simap`**
  - Owner: Ming (verifies; registered in M-1)
  - Check: origin `https://simap.mmlabs.online`; `org_mode=required`; roles per D14 (`simap:admin` owner role,
    `simap:manager`, `simap:user`; `simap:org:invite` on admin and manager); the email-link base for verify-email,
    reset-password and accept-invitation is `https://simap.mmlabs.online` (A4). A forgot-password email for a test
    account opens `https://simap.mmlabs.online/reset-password#token=...`.
  - Refs: M-1, D5, D14

- [ ] **2. Turnstile**
  - Owner: Ming
  - Check: the hostname list of the Turnstile widget whose site key is in `src/lib/identity/config.ts` includes
    `simap.mmlabs.online` (A2). `/sign-up` and `/forgot-password` on production render the widget and it passes.
  - Refs: Turnstile hostname (in M-77)

- [ ] **3. Tunnel**
  - Owner: Ming (verifies; set up in M-2)
  - Check: `simap.mmlabs.online` routes to `http://simap:3000`; no Cloudflare transform rule adds HSTS or CSP (the app
    sets them). See [deploy/deployment-repo/README.md](../deploy/deployment-repo/README.md).
  - Refs: M-2, D8

- [ ] **4. Database**
  - Owner: Ming
  - Check: `select version();` reports 13 or newer; the `simap` role owns database `simap`; the `pg-backup` sidecar is
    healthy.
  - Refs: M-3, M-6 (Postgres check)

- [ ] **5. Secrets**
  - Owner: Ming
  - Check: the Docker Hub repository `mingming21400/simap` exists. The simap repo has the secrets `DOCKERHUB_USERNAME`,
    `DOCKERHUB_TOKEN` and `DEPLOY_REPO_TOKEN`; the deployment repo has the four Drive secrets `SIMAP_GOOGLE_CLIENT_ID`,
    `SIMAP_GOOGLE_CLIENT_SECRET`, `SIMAP_GOOGLE_REFRESH_TOKEN` and `SIMAP_DRIVE_FOLDER_ID` (all or none). Check names
    only; never paste values.
  - Refs: M-6 (Docker Hub and secrets), M-46

- [ ] **6. Deployment repo**
  - Owner: Ming
  - Check: the setup PR is merged (`apps/simap/compose.yml`, `.github/workflows/deploy-simap.yml`, the CODEOWNERS
    line, and the `add-app-db.sh simap` outputs), and the live `deploy-simap.yml` matches the draft in
    `deploy/deployment-repo/`. See [deploy/deployment-repo/README.md](../deploy/deployment-repo/README.md).
  - Refs: M-7

- [ ] **7. Runner safety**
  - Owner: Ming
  - Check: GitHub settings that keep fork code off the production runner are confirmed (item M-76 in
    `work/ming-todo.md`), before any `release/*` push.
  - Refs: M-76, D60

- [ ] **8. First release**
  - Owner: Ming
  - Check: push `release/0.1.0` from a `main` commit that includes this checklist (A8), D57 naming. The `release` run
    is green. Review and merge `release/simap-v0.1.0` on the deployment repo. `deploy-simap` is green (backup, migrate,
    healthy). See [README.md#release-and-deploy](../README.md#release-and-deploy).
  - Refs: M-8, D57

- [ ] **9. Smoke**
  - Owner: Ming runs, claude supplies the checks
  - Check: `curl -sS -o /dev/null -w '%{http_code}\n' https://simap.mmlabs.online/api/healthz` and the same for
    `/api/readyz` both print `200`. The shell shows `v0.1.0` (SIM-040). After sign-in, DevTools Network shows `/api/*`
    calls with status 200 (not 401 or 503), which proves JWKS egress to `api.mmlabs.online` (spec §8 Availability).
    `curl -sI https://simap.mmlabs.online/sign-in` shows exactly one `strict-transport-security` header and exactly
    one `content-security-policy` header.
  - Refs: SYS-04, SIM-040

- [ ] **10. CSP and HSTS in a browser**
  - Owner: Ming
  - Check: run the steps of M-14 on production. The DevTools console shows zero CSP violations.
  - Refs: M-14, SIM-027

- [ ] **11. First org and admin**
  - Owner: Ming
  - Check: the first real org exists (M-1). Its admin signs in once on production, so the member row is created (D16)
    and the device-type seed runs. The Admin tier shows in the shell. The flow run uses a separate test org (A5), not
    this one.
  - Refs: M-1, D6, D16

- [ ] **12. Manual flow run**
  - Owner: Ming runs on production with the test org; claude records the results and files bugs in SIM-021.1
  - Check: every row of [work/tickets/SIM-021/flow-run.md](../work/tickets/SIM-021/flow-run.md) has a result; every
    FAIL has a BUG id; the Summary block is complete.
  - Refs: SIM-021.1, spec §6

- [ ] **13. Decide the lockout recovery (M-23)**
  - Owner: Ming
  - Check: before real users are onboarded, Ming picks one of: keep SIM-011 A4 with the recovery step below,
    Admin-only deactivate (new ticket), or another recovery runbook. Record the choice in M-23.
  - Refs: M-23

- [ ] **14. Sign-off**
  - Owner: Ming
  - Check: switch seatMGT off only when the flow run has no open S1 or S2 bug. Placeholder art does not block this
    (A6). Go-live is complete when SIM-021.1 is MERGED and this item is ticked.
  - Refs: D6, A6

## Rollback

Migrations stay applied in every case: they are forward-only (expand, then contract, R2, D3), so a rollback restores
the previous image and never un-migrates. Never run `docker compose down -v` or remove volumes: all data is in the
shared `pgdata`. Spec §8: rollback is the previous image, or fix forward, or restore the pre-release backup.

**First release (`no-previous`).** There is no earlier release to restore, so the failed health check ends in
`no-previous`. Choose one:
- fix forward with a new release `release/0.1.1`;
- remove the tunnel route for `simap.mmlabs.online` so users see nothing while you fix it;
- restore the `deploy-simap` dump (see `ops/backup/RESTORE.md` in `mmlabs-online/deployment`);
- on the first release only, when the `simap` database holds no real data, drop and recreate the empty `simap`
  database.

**Later releases.**
- Automatic: if the new container fails its health check, `deploy-simap` restores the previous release.
- `restore-unpushed`: the server is back on the old release but the revert could not be pushed (protected deployment
  `main`). Revert the release PR by hand.
- Deliberate rollback later: a non-`release/` PR that reverts `apps/simap/release.env`.

Details: [deploy/deployment-repo/README.md](../deploy/deployment-repo/README.md).

## Lockout recovery (M-23, proposed default)

SIM-011 A4 lets a Manager deactivate Admins. If every Manager or above is deactivated, nobody can reactivate them
through the app. Ming recovers with one SQL statement run through the pg-tunnel (D56) as the `simap` role:

```sql
update members set status = 'active', updated_at = now()
where org_id = '<org uuid>' and sub = '<admin sub>';
```

Table and columns: `db/migrations/20261120150000_init.sql` (members). The deny-list reads `members.status` on each
call, so access returns at once. The statement writes no audit row; note the recovery elsewhere. Claude never runs it.
M-23 stays open until Ming picks this or the Admin-only ticket (item 13).

## Assumptions in force

Each is a default until Ming says otherwise.
- A2 Turnstile: keep the shared tudocuatui widget; Ming adds `simap.mmlabs.online` to its hostname list. No code
  change; the stale comment in `src/lib/identity/config.ts` is a High-path follow-up. Default until Ming says
  otherwise.
- A3 M-7 and M-6 (Docker Hub and secrets) are treated as not confirmed, so items 5 and 6 are for Ming to verify.
  Default until Ming says otherwise.
- A4 The Identity email-link base is unknown, so item 1 makes Ming verify it. Default until Ming says otherwise.
- A5 The flow run uses a separate test org with four test accounts (Admin, Manager, User A, User B). Afterwards Ming
  suspends the test org; its rows stay, isolated by `org_id`, because simap has no org delete (D6, D10). Default until
  Ming says otherwise.
- A6 Go live with placeholder art (D58); real art ships later (SIM-033, M-63). Default until Ming says otherwise.
- A7 M-23: keep SIM-011 A4 and use the recovery step above. Default until Ming says otherwise.
- A8 The checklist ships in the first release (item 8). Default until Ming says otherwise.
