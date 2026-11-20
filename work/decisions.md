# Decisions

Project decisions that change or clarify scope. The planner quotes them. Append only; supersede an entry
with a new one that names it. Format: `D<n> — YYYY-MM-DD — <decision> — <why> (Ming)`.

| ID | Date | Decision | Why |
|---|---|---|---|
| D1 | 2026-11-20 | simap is a full rebuild of seatMGT (code reference: seatMGT branch `ming_dev`), with restructuring; Next.js serves both the UI and the API. The seatMGT draft PRD branch is not a scope source. | seatMGT is retired; one app, one deploy (Ming) |
| D2 | 2026-11-20 | Tooling as tudocuatui, no extras: `pg` with SQL (no ORM/query builder), tudocuatui migrator, `jose`, Tailwind v4, oxfmt, Vitest. First phase has light unit tests only (no e2e, no DB integration suite). Answers OQ-31. | Same stack across mmlabs apps; keep the start small (Ming) |
| D3 | 2026-11-20 | Migrations run like tudocuatui: plain SQL, forward-only, checksummed, expand/contract, one-shot `migrate` container; no down files. Supersedes the "working down" wording of CLAUDE.md R2. Answers OQ-24. DB = shared self-hosted mmlabs Postgres, database and role `simap`. | Proven runner and deploy model (Ming) |
| D4 | 2026-11-20 | Auth option A: Identity access token in browser memory, sent as bearer to Next.js route handlers (tudocuatui pattern). Server Components/server actions do not handle org data. Answers OQ-6. | Reuse tudocuatui verifier and token store (Ming) |
| D5 | 2026-11-20 | simap is multi-org (SaaS-like) on Identity organizations (`org_mode = required`): each org has its own data and its own admins; org admins are appointed by mmlabs Super Admin in the admin portal, as ricotdin takes its admin role from Identity. Answers OQ-3, partly OQ-2. Follow-ups OQ-32–37. | simap belongs to the mmlabs ecosystem (Ming) |
| D6 | 2026-11-20 | No seatMGT data is migrated; simap starts empty and data is built again. Users follow the org. Answers OQ-1. | Clean start (Ming) |
| D7 | 2026-11-20 | Role changes take effect by re-minting or revoking the token (client re-mints after a 403 and on org switch; Identity can revoke the session); the residual lag up to token expiry is accepted. Answers OQ-5. | Identity tokens live up to 12 h (Ming) |
| D8 | 2026-11-20 | Production host `simap.mmlabs.online`; Ming registers the Identity app and hostname later. Answers OQ-7. | (Ming) |
| D9 | 2026-11-20 | No plan/entitlement limits for now: simap does not read or enforce `ent`. Answers OQ-36. | No plans granted yet (Ming) |
| D10 | 2026-11-20 | Only mmlabs Super Admin creates orgs (admin portal); simap has no create-org screen and its default role has no `simap:org:create`. Answers OQ-32. | Admins are appointed by Super Admin (Ming) |
| D11 | 2026-11-20 | People join an org by invitation: org admins/managers invite by email from simap (Identity invitations), Super Admin can also add in the admin portal. Role chosen at invite; later role changes in the admin portal. Answers OQ-33. | Identity v1 has invitations but no app-side member management (Ming) |
| D12 | 2026-11-20 | Every person is an mmlabs Identity account managed by the shared user service; simap keeps no person records without an account. A member is simap's profile of one account in one org. Answers OQ-34; supersedes the seatMGT "member without account" model. | One account system across mmlabs (Ming) |
| D13 | 2026-11-20 | One account may belong to several simap orgs: picker after sign-in and an org switcher in the shell. Answers OQ-35. | (Ming) |
| D14 | 2026-11-20 | Identity roles: `simap:member` (app-scope default), org-scope `simap:admin` (org owner role), `simap:manager`, `simap:user`; admin and manager hold `simap:org:invite`. Answers OQ-37. | Identity requires owner role ≠ default role (Ming) |
| D15 | 2026-11-20 | Several simap roles in one org: highest tier wins (Admin > Manager > User). Answers OQ-4. | (Ming) |
| D16 | 2026-11-20 | Member directory: (a) now — a member appears on the account's first visit; Managers assign only known members; pending invitations sent from simap are listed read-only. (b) later — request an app-facing "list org members" endpoint from org-admin-api and sync from it. Answers OQ-38. | Identity has no app-facing members API yet (Ming) |
| D17 | 2026-11-20 | Display name: filled by the member on first visit (default: email local part), editable by Managers; an Identity display name becomes the default when available. Answers OQ-39. | Tokens carry only email (Ming) |
| D18 | 2026-11-20 | Assigning to an occupied seat asks for confirmation, then replaces the occupant and demotes the primary device. Answers OQ-12. | Keep seatMGT behaviour, avoid mistakes (Ming) |
| D19 | 2026-11-20 | Managers and Admins place, move and return any device of the org; editing/deleting a device is owner or Admin only. Answers OQ-13. | Managers arrange seating (Ming) |
| D20 | 2026-11-20 | Keep seatMGT's free-form layout editor; floor-plan background image after v1. Answers OQ-14. | Faster port; no file storage yet (Ming) |
| D21 | 2026-11-20 | Users may request a seat in any room of the org. Answers OQ-9. | Approval already guards it (Ming) |
| D22 | 2026-11-20 | REG-03 in v1: users release their own seat without approval and return their own devices to inventory. Answers OQ-10. | Releasing carries no risk (Ming) |
| D23 | 2026-11-20 | Users request seats only for themselves; Managers assign others directly. Answers OQ-11. | (Ming) |
| D24 | 2026-11-20 | Requesters can cancel pending requests; decisions show in-app ("Yêu cầu của tôi" with a badge), no email. Answers OQ-20. | (Ming) |
