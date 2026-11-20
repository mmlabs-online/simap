## Attempt 1 — 2026-11-20

### Files touched
| File | Required because |
|---|---|
| `package.json`, `pnpm-lock.yaml` | `pnpm add jose@6.2.17` (exact pin, plan Decision 11) |
| `src/lib/validate/uuid.ts` (+ test) | canonical UUID check for `sub`/`org` |
| `src/lib/auth/tier.ts` (+ test) | AUT-04/D15 tier mapping, exact keys, highest wins |
| `src/lib/api/error.ts` | single error shape types shared with SIM-006 |
| `src/server/identity/config.ts` (+ test) | port of `loadIdentityConfig` |
| `src/server/identity/jwks.ts` (+ test) | port of tudocuatui JWKS resolver (UA `simap-server`) |
| `src/server/identity/verify.ts` (+ test) | verifier: aud `simap`, 8192 cap, `org`/`org_roles`, no `roles`, `verify(authorization)` |
| `src/server/http/respond.ts` (+ test) | `apiError(status, code)` with no-store / WWW-Authenticate / Retry-After |
| `src/server/http/org-scope.ts` (+ test) | branded `OrgScope`, `orgQuery` (R6) |
| `src/server/http/with-auth.ts` (+ test) | `createWithAuth`, lazy `withAuth`, member-gate hook |
| `src/app/api/me/route.ts` (+ test) | manual-test target (Decision 6) |
| `src/app/api/routes-guarded.test.ts` | fail-open guard |
| `src/server/README.md` | two convention lines |

### Tests added / changed
- `uuid.test.ts`, `tier.test.ts`, `config.test.ts`, `jwks.test.ts` (ported, UA updated), `verify.test.ts`, `respond.test.ts`,
  `org-scope.test.ts`, `with-auth.test.ts`, `me/route.test.ts`, `routes-guarded.test.ts`, all with the plan's names (a few merged).
- New: `verify.test.ts` covers ES384 alg, org/org_roles rules, 6 KB token, header cap; `with-auth.test.ts` covers the
  verifier-throws -> 500 case.

### Checks (actual output summary)
- format:check: `Finished in 14ms on 46 files` (clean, after `oxfmt src`)
- typecheck: exit 0
- check:layers: `check-layers: 33 files, no violations`
- test: `Test Files 16 passed (16); Tests 130 passed (130)`
- build: exit 0, with no `MM_IDENTITY_ISSUER` set; `/api/me` listed as dynamic

### Out-of-plan files
None. `.env.example` is in the plan but was NOT changed (see below).

### Follow-ups (noticed, not done)
- **Ming step (blocked):** `.env.example` append was denied by permissions (the shell append and any `git diff` on that
  file were refused). Please append these two lines yourself:
  `# mmlabs Identity issuer; production must be https://api.mmlabs.online` and `MM_IDENTITY_ISSUER=` (no value).
  Acceptance criterion 7 stays open until then.
- JSON body helper (`readJson` with 413/415/400) for the first write route.
- Optional `check:layers` rule that only `src/server/**` repositories call `orgQuery`/pool.
- Add the 24 h stale-JWKS window to `work/decisions.md` at merge (Decision 5).

### Scope self-check
- Could the diff be smaller? No; production code is a near-verbatim port plus the guard; tests follow the plan list.
- Deviations: `verify.ts` does not apply `now` to `jwtVerify` (faithful to the tudocuatui port; `now` only drives the JWKS cache).
