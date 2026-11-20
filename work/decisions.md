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
