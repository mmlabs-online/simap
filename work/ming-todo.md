# Ming's to-do (things only Ming can do)

Agents read this before `/run`. A ticket waits on an item only if it lists the item in `Needs Ming`.
Tick (`- [x]`) and date items when done. `/run` adds plan-approval and escalation items here.
Never write a secret value here: name the secret and where Ming puts it.

## Always
- Review and merge the PRs that `/run` opens (`/status` lists them). Agents never merge.

## Open
- [ ] M-1 Register app `simap` in org-admin-api: origin `https://simap.mmlabs.online` (and the local dev origin),
  `org_mode = required`, join policy, org-scope roles (OQ-37) and org owner role; create the first org and appoint its
  admin in the admin portal. Before the auth ticket can be checked end to end. (D5, D8)
- [ ] M-2 Cloudflare Tunnel published application `simap.mmlabs.online` → the simap container, service `http://simap:3000` (HTTP, not HTTPS). Before go-live. (D8)
- [ ] M-3 Shared Postgres: create database and role `simap`; put the password where the deployment repo's deploy job
  reads it (as tudocuatui). Before the first deploy. (D3)
- [x] M-4 (2026-11-20) Approve plan for SIM-001: `work/tickets/SIM-001/plan.md` (High tier; 9 decisions with defaults). Add a dated "Plan approved" line in the ticket's *Notes / answers from Ming*.
- [ ] M-4 Run the org-admin-api request for an app-facing org members read and remove-from-org (prompt in
  `docs/requests/org-admin-api-org-members.md`). Blocks SIM-020. (D16, D34)
- [x] M-5 (2026-11-20) Approve plan for SIM-002: `work/tickets/SIM-002/plan.md` (High tier; 8 decisions with defaults). Add a dated "Plan approved" line in the ticket's *Notes / answers from Ming*.
- [ ] M-6 First-deploy prerequisites for SIM-004: create the Docker Hub repository `mingming21400/simap` and an access
  token; set repository secrets on `mmlabs-online/simap`: `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, `DEPLOY_REPO_TOKEN`
  (fine-grained PAT on `mmlabs-online/deployment` only: Contents read/write, Pull requests read/write). Values go only
  into GitHub secrets, never into a file or chat. Before the first `release/vX.Y.Z` push. (D8)
- [ ] M-7 Deployment-repo setup PR for simap (not a `release/*` branch): copy `deploy/deployment-repo/**` from the simap
  repo, run `bash postgres/scripts/add-app-db.sh simap` (this is M-3) and add the CODEOWNERS line; steps in
  `deploy/deployment-repo/README.md`. Ming merges; deploy-simap skips until a release PR writes `release.env`. (D3, D8)
- [ ] M-8 First release: from a commit on `main`, push branch `release/v0.1.0` (Ming's step, agents never push
  `release/*`); check the `release` run is green, review and merge the `release/simap-v0.1.0` PR on
  `mmlabs-online/deployment`, then check the `deploy-simap` run and `/api/readyz` (needs M-2, M-3, M-6, M-7). (D8)
