## Attempt 1 — 2026-11-20
Verdict: PASS

### Checks (run by reviewer)
Run in the worktree on Windows, Node 24 (`pnpm install --frozen-lockfile --config.engine-strict=false`; CI uses Node 22).
- format: `pnpm format:check` — exit 0, "All matched files use the correct format. Finished in 16ms on 46 files".
- lint / typecheck: `pnpm typecheck && pnpm check:layers` — exit 0, "check-layers: 33 files, no violations".
- test: `pnpm test` — exit 0, "Test Files 16 passed (16); Tests 130 passed (130)".
- build: `pnpm build` with `MM_IDENTITY_ISSUER` unset (`env -u`) — exit 0; `/api/me` listed as `ƒ` (dynamic). Proves
  the config is lazy.
All four match the impl-log summary.

### Acceptance criteria
- [x] AC1 Manager token reaches a Manager+ route with `{sub,email,org,tier:'manager'}` — evidence:
  `src/server/identity/verify.test.ts:100` (real ES256 token → `{sub,email,org,orgRoles:["simap:manager"]}`) and
  `src/server/http/with-auth.test.ts:47` (handler receives exactly `{sub,email,org,tier:"manager"}`, `toEqual`);
  wiring in `src/server/http/with-auth.ts:48-52`.
- [x] AC2 Each rejection is 401 with no details — evidence: per-cause verifier tests `verify.test.ts:121` (alg),
  `:140` (typ), `:146` (iss), `:158` (aud), `:165` (expired/leeway/iat/nbf/age), `:189` (unknown kid), `:195` (key in
  header), `:211` (email_verified), `:220` (sub), `:233` (org without org_roles), plus `:240`, `:249`, `:254`; guard
  table `with-auth.test.ts:72` asserts 401, `WWW-Authenticate: Bearer`, one identical body `{error:{code:"unauthenticated"}}`
  and no log for every cause.
- [x] AC3 No `org` or no simap role → 403; `roles` never grants org access — evidence: `with-auth.test.ts:105`
  (`org_required`), `:112` (`simap:member`, `[]`, `other:admin` → `forbidden`), `verify.test.ts:275` (a token with
  `roles:["simap:admin"]` and no `org` yields `org:null`, so the guard answers `org_required`); `verify.ts:140-151`
  never reads `roles`; `src/lib/auth/tier.test.ts:17` near-miss keys.
- [x] AC4 JWKS unreachable → 503 — evidence: `verify.test.ts:383` (fetch throws / 500 / timeout → `unavailable:true`),
  `:415` (rotated key during outage), `:442` (24 h stale then unavailable), `with-auth.test.ts:123` (503 +
  `Retry-After: 5`, handler not called), `src/server/identity/jwks.test.ts` (ported cases, all green).
- [x] AC5 Tokens and claims never logged; tests use a local ES256 key and JWKS — evidence: grep of non-test files in
  `src/server/identity` and `src/server/http` shows only fixed-field log calls (`jwks.ts:126` `{event,reason}`,
  `with-auth.ts:35,43,58,65,69` `{event}` / `{event,code}`); `verify.test.ts:317` (console spies, result keys only
  `ok`/`code`), `with-auth.test.ts:214` (no token/sub/email/org in logs); all tests use `generateKeyPair("ES256")`
  with `createLocalJWKSet` or a fake fetch JWKS.
- [x] AC6 (ticket scope) Org-scoping helper and deny-list hook — evidence: `src/server/http/org-scope.ts:13-30`,
  `org-scope.test.ts:8,14,29,35`; `MemberGate` at `with-auth.ts:11`, `with-auth.test.ts:152` (default allows,
  deactivated → 403 `member_deactivated`, throws → 503 + log, not called when tier fails).
- [ ] AC7 (ticket scope) `MM_IDENTITY_ISSUER=` in `.env.example` — **open Ming step, not an implementation defect.**
  The agent's append was refused by permissions; plan Decision 9 (approved by Ming) makes that a Ming step with no
  workaround. `.env.example` is absent from `git diff origin/main...HEAD --stat` (reviewer did not read the file).
  `src/server/identity/config.test.ts:36` covers the "production must be `https://api.mmlabs.online`" rule. The PR
  must carry this step (see Ming steps below).
- [x] AC8 No `/api` route accidentally unguarded — evidence: `src/app/api/routes-guarded.test.ts:46` green.
- [x] AC9 Checks green — see Checks above.

Ming steps the PR must carry:
- Append to `.env.example` (no value): `# mmlabs Identity issuer; production must be https://api.mmlabs.online` and
  `MM_IDENTITY_ISSUER=` (AC7).
- Ming verification after merge (from plan.md, not verified here): once M-1 exists, `curl` `/api/me` with a real org
  token (200 `{sub,email,org,tier}`), without header (401), with a token minted without `org_id` (403
  `org_required`); confirm a real multi-role org token stays under 8192 characters.

### Issues
None.

### Rules (CLAUDE.md)
No violations found.
- R1: every new `src/server/**` non-test file starts with `import "server-only"`; pure code is in `src/lib/**`;
  only `src/app/api/me/route.ts` imports `@/server/http/with-auth`; `check:layers` clean.
- R3: issuer read lazily from `process.env` (`with-auth.ts:82`); config errors never carry the value
  (`config.ts:176-194`, `config.test.ts:17`).
- R4: every changed file is in plan.md's file list; no out-of-plan files. All changed High paths
  (`src/server/identity/**`, `src/server/http/**`, `config.ts`) are named in the plan.
- R6: `org` comes only from the verified token; tier only from `org_roles` (`with-auth.ts:48-51`); `orgQuery` binds
  `scope.orgId` as `$1`.
- R5: new logic has tests (130 tests).

### Blockers from review agents
To be filled by the orchestrator from `security-review.md` (review trigger fires: `src/server/`). None known to the
reviewer.

### Nits (do not block)
- `routes-guarded.test.ts:37-61` only scans `route.ts` and the methods GET/POST/PUT/PATCH/DELETE in
  `export const|function` form; `route.js`/`route.tsx`, `HEAD`/`OPTIONS`, or `export { h as GET }` would slip past.
  Fine for now (only one route); worth tightening when more routes land.
- `with-auth.ts:43` logs `jwks_unavailable` on every request during an Identity outage (fixed fields only, so no
  leak, but noisy); a once-per-window throttle like `identity_config_invalid` could help.
- Approach step 3 asked for a separate commit `SIM-005: adapt verifier to simap org tokens`; the port and the
  adaptation landed together in `42865bc`. No effect on the result.
- `org-scope.ts` and `with-auth.ts` import each other (type-only on one side); harmless, but `AuthContext` could move
  to its own types module if the cycle ever becomes a runtime import.

### Follow-ups (out of scope)
- JSON body helper (`readJson` with 413/415/400) for the first write route (`debt` issue at merge).
- Optional `check:layers` rule that only `src/server/**` repositories call `orgQuery`/pool (`debt` issue).
- Record the 24 h stale-JWKS window in `work/decisions.md` at merge (plan Decision 5).
