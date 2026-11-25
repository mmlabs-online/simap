## SIM-021 consult (software architect): go-live checklist

### Findings
1. **Every dependency is MERGED.** SIM-004, 009, 015.2, 016, 017, 018, 019.2 and 027 are merged, and so are SIM-034 and SIM-038. The only open v1-adjacent rows are SIM-033 (BLOCKED, waits on M-63) and SIM-020 (P3, waits on M-42 and M-43).
2. **The deploy path already exists and is documented.**
   - `README.md` "Release and deploy" and `deploy/deployment-repo/README.md` describe it.
   - Ming pushes `release/X.Y.Z`. `release.yml` then tags `vX.Y.Z`, pushes `mingming21400/simap`, runs `check-image.sh` and opens the deployment PR `release/simap-vX.Y.Z`.
   - Merging that PR runs `deploy-simap`: env file → pull → `pg-backup /backup.sh` → one-shot `migrate` → replace → wait on `/api/readyz` → automatic restore of the previous release if unhealthy.
   - There are no other runbooks in `docs/` (only `docs/art` and `docs/requests`). `go-live.md` should link to these two READMEs, not repeat them.
3. **Rollback does not work on the first release.** With no earlier `release.env`, a failed health check ends as `no-previous`. For v0.1.0 the rollback is: fix forward, or take the tunnel route down, or restore the pre-migration dump. Since the DB starts empty (D6), dropping and recreating the `simap` DB is also acceptable on the first release only.
4. **Env and secrets.**
   - The production host env file (`~/.config/simap/simap.env`) holds `DATABASE_URL` and `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `DRIVE_FOLDER_ID`. The last four are all-or-none and come from the `SIMAP_*` deployment secrets (M-46, done).
   - `compose.yml` pins `NODE_ENV=production` and `MM_IDENTITY_ISSUER`.
   - In production, the client ignores `NEXT_PUBLIC_MM_IDENTITY_BASE` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (`src/lib/identity/config.ts:14-22`).
   - The simap repo also needs the GitHub secrets `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN` and `DEPLOY_REPO_TOKEN` (M-6b, still open).
5. **Turnstile has a code dependency.** `src/lib/identity/config.ts:4-5` says the Turnstile site key is shared with tudocuatui and that "simap gets its own widget before go-live (SIM-021)".
   - Changing it touches a High path (`**/config.*`), which is outside SIM-021's planned files (R4).
   - Whether we change it or not, the widget's hostname list must include `simap.mmlabs.online`, or sign-in, sign-up and forgot-password fail in production.
6. **Identity email links point at simap pages.** `/accept-invitation`, `/reset-password` and `/verify-email` use `#token=`. M-1 does not say that Identity's link base for app `simap` was set to `https://simap.mmlabs.online`.
7. **Open Ming items that matter for go-live:**
   - M-6a: Postgres version 13 or newer, and the `simap` role owns the DB.
   - M-6b: Docker Hub repository and GitHub secrets.
   - M-7: deployment-repo setup PR. It is probably done in practice, since SIM-038 synced against a live `deploy-simap.yml`. Ming should confirm and tick it.
   - M-8: first release.
   - M-14: CSP and HSTS check in a browser.
   - M-76: fork-PR guards. The release runs on the production host's runner.
   - M-23: lockout recovery if every Manager and Admin is deactivated.
   - Stale: M-19 (about PR #34) can probably be closed.
   - Not blocking: M-42, M-43 (SIM-020, P3), M-10.
8. **Art.** `public/sprites/office.png` and `office.json` are committed placeholders. Without M-63 and SIM-033, production draws placeholders but stays fully usable, including the layout designer. Shipping no Imersa art also means no credits obligation yet.

### Recommendations
**`docs/go-live.md`, in order.** Each item has an owner, a check and a tick box. Only Ming can do the Ming items: the orchestrator cannot reach production, the deployment repo, the shared DB, GitHub or Docker Hub settings, Identity, or Cloudflare.

| # | Item | Owner |
|---|---|---|
| 0 | Pre-flight: every dependency MERGED, CI green on `main` | claude |
| 1 | Identity app `simap` (M-1, verify): origin `https://simap.mmlabs.online`; `org_mode=required`; roles per D14 (`simap:admin` owner, `simap:manager`, `simap:user`, `simap:org:invite` on admin and manager); email-link base for verify, reset and accept-invitation set to the prod origin | Ming |
| 2 | Turnstile: widget hostname includes `simap.mmlabs.online`. Decide shared key vs own widget. If own widget, a separate High ticket to change the constant, merged before item 7 | Ming decides; claude does the ticket if needed |
| 3 | Tunnel (M-2, verify): `simap.mmlabs.online` → `http://simap:3000`; no extra Cloudflare HSTS or CSP transform rules | Ming |
| 4 | DB (M-3 done, plus M-6a): `select version()` is 13 or newer; `simap` owns the DB; `pg-backup` sidecar is healthy | Ming |
| 5 | Secrets: M-6b (Docker Hub repository and token, 3 GitHub secrets on simap); `SIMAP_*` Drive secrets present (M-46). Record names only, never values | Ming |
| 6 | Deployment repo (M-7): `apps/simap/compose.yml`, `deploy-simap.yml`, CODEOWNERS line merged; the repo's workflow matches the simap draft (SIM-038) | Ming |
| 6b | Runner safety (M-76) before any `release/*` push | Ming |
| 7 | First release (M-8): push `release/0.1.0` from the `main` commit that includes SIM-021's merge and any pre-release fixes; release run green; review and merge `release/simap-v0.1.0`; `deploy-simap` green (backup → migrate → healthy) | Ming |
| 8 | Smoke: `https://simap.mmlabs.online/api/readyz` returns 200; header shows `v0.1.0`; a signed-in `/api` call is not 401 (proves JWKS egress) | Ming; claude gives the exact checks |
| 9 | M-14: CSP console clean on `/sign-in`, `/sign-up`, `/forgot-password`, `/rooms`; theme toggle works; HSTS arrives, only once | Ming |
| 10 | First org and admin: the org exists (M-1); the admin signs in once on prod so the member row is created (D16) and the device-type seed runs; Admin tier shows; the admin invites a test Manager and a test User (D11) | Ming |
| 11 | Manual flow run (below) | Ming runs it; claude writes the template and records results |
| 12 | Decide M-23 (lockout recovery) before real users are onboarded | Ming |
| 13 | Sign-off, then switch seatMGT off only after the flow run has no open S1 or S2 bugs (spec "v1 done means") | Ming |

**Rollback section of `go-live.md`:**
- First release: fix forward with a new `release/0.1.1`, or remove the tunnel route.
- If a migration half-applied: restore from the `deploy-simap` dump per the deployment repo's `ops/backup/RESTORE.md`. Never use `down -v`.
- Later releases: the automatic restore, or a deployment PR that reverts `apps/simap/release.env`.
- Migrations always stay applied: expand/contract (R2, D3).

**Art decision: go live without SIM-033 and M-63.** Placeholders are a known limitation, not a bug. Ship the real atlas later as `release/0.2.0` once Ming has a PC. If Ming wants the real look before users see it, gate only item 13 (switching seatMGT off), not the deploy.

**Recording the manual flow run.** Put it in a new `work/tickets/SIM-021/flow-run.md`, linked from `go-live.md`.
- Header: date, version (`v0.1.0` from the app header), browser and device, which accounts by tier (Admin, Manager, User; no emails), org (no name or uuid needed).
- One table per flow: sign in and org pick; manager assigns or unassigns a seat; devices (create, place, move, return, delete with D31 refusal, device-type image upload through Drive); seat request (User requests → Manager approves or rejects, plus the rival and occupied case); layout designer (create room, place desks and fixtures, save, reload, conflict); also invite and accept, dashboard and search, CSV export, audit log, theme, and mobile room view.
- Columns: `# | Flow | Step | Tier | Expected (spec ID, e.g. REG-02) | Result PASS/FAIL/BLOCKED/N-A | Notes | BUG id`.
- End with a summary: counts, open S1/S2, go or no-go.
- claude prefills the steps and expected results from spec IDs before the run. Ming reports results (Vietnamese is fine). claude fills the table and files bugs.

**Findings to bugs.** Each FAIL becomes `/bug "<what Ming saw>"` → `BUG-xxx` from `work/templates/bug.md`.
- `Found in: v0.1.0 (production)`.
- Severity: S1 = blocks a v1 flow or crosses org scope (R6); S2 = wrong result with a workaround; S3 = cosmetic.
- Put the BUG id back in the table row.
- Leave out personal data and screenshots with emails.
- After the bugs are fixed and released, re-run only the failed rows and append the result with the new version.
- Things outside spec (placeholder art, missing members sync from SIM-020) are Notes, not bugs.

**`work/ming-todo.md` cleanup.** Add one item: "run `docs/go-live.md` items 1-13", listing M-6a/b, M-7, M-8, M-14, M-76 and M-23 as sub-steps. Also close or confirm M-19 and M-7.

### Risks
- The Turnstile hostname or Identity email-link base is not set for the prod origin: sign-up, reset and invite break only in production (light tests, D2).
- The first release has no automatic rollback (`no-previous`). Keep seatMGT running until sign-off.
- The release runs on the production host's runner: fork-PR exposure until M-76 is confirmed.
- One shared Drive folder and account for every org (SIM-036.1 A7). A broken refresh token fails image uploads at run time, not at boot (A1). Check it in the flow run.
- No recovery path if all Managers and Admins are deactivated (M-23).
- Changing the Turnstile constant is a High-path code change. Keep it out of SIM-021 (R4).

### Open questions (for Ming)
1. Turnstile: keep the shared tudocuatui widget (add the simap hostname) or create a simap widget, which needs a High ticket and Identity to know its secret?
2. Is M-7 actually done (`deploy-simap.yml` live, `apps/simap/compose.yml` and CODEOWNERS merged)? Is M-6b done (Docker Hub repository and 3 secrets)?
3. Did M-1 set Identity's email-link base for verify, reset and invite to `https://simap.mmlabs.online`?
4. Go live with placeholder art and ship the atlas as 0.2.0, or hold the seatMGT switch-off until SIM-033?
5. Who is in the flow run, i.e. which test accounts cover Manager and User? Is it the real first org or a separate test org that is removed afterwards?
6. M-23: keep A4 and add a recovery SQL step to `go-live.md`, or open a ticket?

Relevant files:
- /home/user/simap/work/tickets/SIM-021/ticket.md
- /home/user/simap/work/ming-todo.md
- /home/user/simap/README.md
- /home/user/simap/deploy/deployment-repo/README.md
- /home/user/simap/deploy/deployment-repo/apps/simap/compose.yml
- /home/user/simap/deploy/deployment-repo/.github/workflows/deploy-simap.yml
- /home/user/simap/.github/workflows/release.yml
- /home/user/simap/src/lib/identity/config.ts
- /home/user/simap/work/templates/bug.md
- /home/user/simap/docs/spec-v1.md
