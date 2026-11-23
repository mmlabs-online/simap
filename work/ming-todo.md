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
- [ ] M-6 Before the first production `migrate` (SIM-021): run `select version();` on the shared Postgres and confirm it is 13 or newer (`gen_random_uuid()` is built in), and that the `simap` role owns the `simap` database (it creates tables, functions and triggers). (SIM-008)
- [ ] M-6 First-deploy prerequisites for SIM-004: create the Docker Hub repository `mingming21400/simap` and an access
  token; set repository secrets on `mmlabs-online/simap`: `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, `DEPLOY_REPO_TOKEN`
  (fine-grained PAT on `mmlabs-online/deployment` only: Contents read/write, Pull requests read/write). Values go only
  into GitHub secrets, never into a file or chat. Before the first `release/X.Y.Z` push. (D8)
- [ ] M-7 Deployment-repo setup PR for simap (not a `release/*` branch): copy `deploy/deployment-repo/**` from the simap
  repo, run `bash postgres/scripts/add-app-db.sh simap` (this is M-3) and add the CODEOWNERS line; steps in
  `deploy/deployment-repo/README.md`. Ming merges; deploy-simap skips until a release PR writes `release.env`. (D3, D8)
- [ ] M-8 First release: from a commit on `main`, push branch `release/0.1.0` (Ming's step, agents never push
  `release/*`); check the `release` run is green, review and merge the `release/simap-v0.1.0` PR on
  `mmlabs-online/deployment`, then check the `deploy-simap` run and `/api/readyz` (needs M-2, M-3, M-6, M-7). (D8)
- [ ] M-9 Pixel art, phase 1 (D45, D54): pick 1 main free pack (+1 backup) from `docs/art/asset-candidates.md`, check
  its licence (screenshot to `assets/art/licences/`, row in `assets/art/CREDITS.md`), and put the pack's original
  sheet PNG(s) in `assets/art/sources/<pack>/`. No cutting or recolouring: Claude writes `assets/art/sprite-map.json`
  from the sheets. About half a day. Phase 2 (recolour to the palette, draw missing sprites) later, no deadline.- [ ] M-10 Art sources in a public repo (on hold, Ming 2026-11-20): the Imersa "Office Pixel Art" licence forbids
  redistributing the asset files, and `mmlabs-online/simap` is public, so `assets/art/sources/imersa-office/` is
  git-ignored for now (copy steps in `assets/art/CREDITS.md`). Decide later: keep ignored, make the repo private, or ask
  Imersa Studios whether the original free sheets may sit in a public source repo (draft question in the 2026-11-20
  art report). Until then, CI and other machines cannot cut the Imersa sprites; the packing script (SIM-024) must fall
  back to placeholders when a source sheet is missing.
- [x] M-11 (2026-11-21) Approve plan for SIM-028: `work/tickets/SIM-028/plan.md` (High tier; decisions A-G under Assumptions, incl. the split into SIM-028 + SIM-028.1). Add a dated "Plan approved" line in the ticket's *Notes / answers from Ming*.
- [x] M-12 (2026-11-21, option 1) SIM-028 escalated after 3 attempts (launcher loopback bypasses): pick an option in `work/tickets/SIM-028/escalation.md` (recommended: allowlist `pnpm dev` arguments) and note it in the ticket's *Notes / answers from Ming*. PR #28 stays open, do not merge until then.
- [x] M-13 (2026-11-21) Approve plan for SIM-029: `work/tickets/SIM-029/plan.md` (High tier: edits `.env.example`; 3 decisions with defaults). Add a dated "Plan approved" line in the ticket's *Notes / answers from Ming*.
- [x] M-16 (2026-11-21; called M-14 in the SIM-030 review) Approve plan for SIM-030: `work/tickets/SIM-030/plan.md` (High tier: edits `src/server/http/dev-token.ts`; 2 decisions with defaults). Add a dated "Plan approved" line in the ticket's *Notes / answers from Ming*.
- [x] M-15 (2026-11-21, option 1) SIM-030 AC7: choose the wording in `work/tickets/SIM-030/review.md` Attempt 2 (recommended: allow a build-only source map under `.next/server`) and note it in the ticket's *Notes / answers from Ming*.
- [ ] M-14 Before SIM-021 go-live, check SIM-027 (security headers and CSP) in a browser. In Chrome with DevTools
  Console open, on the built app (local `pnpm start` or the first deploy): `/sign-in` (sign in with password, Turnstile
  widget shows and passes), `/sign-up` and `/forgot-password` (Turnstile renders; these pages keep
  `<meta name="referrer" content="no-referrer">` from SIM-006.3), `/rooms` after sign-in (data loads, icons render),
  toggle light/dark and reload (no flash, theme script ran). Expect **zero** "Content Security Policy" violations in the
  console. If Turnstile reports a `connect-src` violation for `challenges.cloudflare.com`, report it (fix: add that
  origin to `connect-src`, small follow-up). After the first deploy: confirm `Strict-Transport-Security` reaches the
  browser through the Cloudflare Tunnel (M-2) and that Cloudflare adds no second, conflicting HSTS or CSP header.
- [x] M-17 Approve plan for SIM-028.1: `work/tickets/SIM-028.1/plan.md` (ticket Gate; 3 decisions with defaults). Add a dated "Plan approved" line in the ticket's *Notes / answers from Ming*.
- [x] M-18 (2026-11-21, add + fix S1, S2) SIM-028.1 before merge: (a) add the name `NEXT_PUBLIC_SIMAP_DEV_PROD` to `.env.example` (R3, High path) or record an exception; (b) fix security Attempt 2 S1 and S2 (`.env*` refusal gaps) in this PR or as a follow-up.
- [ ] M-19 SIM-028.1 before merging PR #34: check the 3 lines added to `.env.example`: a blank line, one comment, and `# NEXT_PUBLIC_SIMAP_DEV_PROD=` (commented, no value). S5 is decided and fixed (2026-11-21).
- [x] M-20 (2026-11-21, option 1) SIM-032 escalated after 2 reworks: choose an option in `work/tickets/SIM-032/escalation.md` (recommended: option 1, one small rework plus a final app-port check). Do not run `scripts/start-dev.sh` on production until it is resolved.
- [x] M-21 (2026-11-21, option 1) SIM-032 escalated again after attempt 4: choose an option in the second section of `work/tickets/SIM-032/escalation.md` (recommended: option 1, one very small rework). Do not run `scripts/start-dev.sh` on production until it is resolved.
- [x] M-22 (2026-11-22) Approve plan for SIM-011: `work/tickets/SIM-011/plan.md` (High tier: edits `src/server/http/with-auth.ts`; assumptions A1–A11, and the split into SIM-011 (members API + deny-list gate) and SIM-011.2 (Members page UI)). Add a dated "Plan approved" line in the ticket's *Notes / answers from Ming*.
- [ ] M-23 SIM-011 security 🟡1 (assumption A4, merged as-is in PR #36): a Manager can deactivate Admins, and if every Manager+ is deactivated only a DB edit recovers. Choose: keep A4, make deactivate/reactivate Admin-only (new ticket), or add a recovery runbook SQL step. See `work/tickets/SIM-011/security-review.md`.
- [x] M-24 (2026-11-22, defaults A1-A14) Approve plan for SIM-015.1: `work/tickets/SIM-015.1/plan.md` (High tier: DB migration; choices A1-A14 with defaults, incl. the split into SIM-015.1, SIM-015.4 and SIM-015.5). Add a dated "Plan approved" line in the ticket's *Notes / answers from Ming*.
- [ ] M-24 Make the self-hosted runner `macbook-runner` available to mmlabs-online/simap (SIM-034, D60): if it is registered only on mmlabs-online/deployment, either move it to an org-level runner (Org Settings → Actions → Runners) in a runner group that allows simap (and deployment), or register the same Mac as a runner for simap with labels `self-hosted, macbook-runner`. Docker must be running for CI (test Postgres, image build).
- [x] M-25 (2026-11-23, all defaults) Approve plan for SIM-015.3: `work/tickets/SIM-015.3/plan.md` (P1, workspace CLAUDE.md section 8). Confirm assumptions 1-3: keyboard activation opens the panel, pan is native scrolling only, and rooms near 64 x 64 tiles show a "too large" view with the seat table still usable. Add a dated "Plan approved" line in the ticket's *Notes / answers from Ming*.
- [x] M-26 (2026-11-23, all defaults) Approve plan for SIM-015.2: `work/tickets/SIM-015.2/plan.md` (P1 gate; slice 1 of 3 = pure editor core, no UI; assumptions A1-A14 with defaults, incl. seat add/delete deferred to Save (A3), room size editable 1-64 (A8), browser Back not guarded (A9)). The plan's follow-up IDs SIM-015.6/015.7 clash with the merged SIM-015.6, so they become SIM-015.7 and SIM-015.8. Add a dated "Plan approved" line in the ticket's *Notes / answers from Ming*.
