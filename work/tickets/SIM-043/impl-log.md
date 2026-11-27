# Implementation log — SIM-043 (slice 1)

## Attempt 1 — 2026-11-27

### Files touched
| File | Required because |
|---|---|
| src/lib/auth/tier.ts, tier.test.ts | pure `accessFromToken` + `SUPER_ADMIN_MAX_TTL_S` (AC1, AC2) |
| src/lib/audit/route.ts, route.test.ts | `auditRoute` for audit meta (AC4) |
| src/server/identity/verify.ts, verify.test.ts | parse `roles`, `org_access`, lifetime when `org` present (AC1-AC3) |
| src/server/identity/config.ts, config.test.ts | `loadSuperAdminRole` (configurable key, R3) |
| src/server/http/with-auth.ts, with-auth.test.ts | grant, `ctx.access`, access audit before handler (AC1-AC5) |
| src/server/audit/access.ts, access.test.ts | `writeAccessAudit` (AC4) |
| src/server/members/members.ts | read-only `getMember` (AC5) |
| src/app/api/me/route.ts, route.test.ts | no-row behaviour, `access` field (AC5) |
| src/ui/copy/audit.ts | label for `access.super_admin` (D36) |
| .env.example, docs/spec-v1.md, CLAUDE.md | AC6, R3 |

### Tests added / changed
- All tests listed in plan.md Tests table (tier, route, verify, config, with-auth, access, me).
- No new DB test.

### Checks (actual output summary)
- typecheck: exit 0
- format:check: exit 0, all files formatted
- check:layers: 991 files, no violations
- test: 378 files passed (1 skipped), 3664 tests passed (7 skipped)
- build: exit 0
- test:db: not run (no local DATABASE_URL)

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- `MM_IDENTITY_ISSUER` missing from `.env.example` (plan Q13).
- Add `SIMAP_SUPER_ADMIN_ROLE=simap:super-admin` to the deploy env (work/ming-todo.md, M-90).

### Scope self-check
- Could the diff be smaller? No.
