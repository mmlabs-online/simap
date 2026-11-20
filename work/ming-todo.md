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
- [ ] M-2 Cloudflare Tunnel published application `simap.mmlabs.online` → the simap container. Before go-live. (D8)
- [ ] M-3 Shared Postgres: create database and role `simap`; put the password where the deployment repo's deploy job
  reads it (as tudocuatui). Before the first deploy. (D3)
- [x] M-4 (2026-11-20) Approve plan for SIM-001: `work/tickets/SIM-001/plan.md` (High tier; 9 decisions with defaults). Add a dated "Plan approved" line in the ticket's *Notes / answers from Ming*.
