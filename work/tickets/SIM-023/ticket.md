# SIM-023: Harden org scope, guarded-routes test and dev-seed guard

| Field | Value |
|---|---|
| State | PLANNING |
| Priority | P0 |
| Size | S |
| Areas | security |
| Gate | plan-approval |
| Depends on | SIM-005, SIM-008 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-20 |
| Claimed by | claude@2026-11-20T07:24:39Z |
| PR | — |

## Goal
Close the four 🟡 security findings left open when SIM-005 and SIM-008 merged, so an org scope can only come from a
verified token, an unguarded `/api` route fails CI, and dev tooling can never seed or create databases on a non-local
server. Must land before SIM-007 / SIM-010 add org queries.

## Scope reference
- spec §8 Security (org isolation, no production data from dev tooling); CLAUDE.md R6; decisions D4, D5.
- `work/tickets/SIM-005/security-review.md` Attempt 1 findings 1–2 (SIM005-orgscope-forgeable, SIM005-guard-test-regex).
- `work/tickets/SIM-008/security-review.md` Attempt 1 findings 1–2 (seed guard `?host=` bypass, `schema:check` unguarded).

## Scope
- `src/server/http/org-scope.ts` / `with-auth.ts`: `withAuth` builds the `OrgScope` once from the verified context and
  passes it to the handler (e.g. `ctx.scope`); `orgScopeOf` is no longer exported (or accepts only a context created by
  `withAuth`); comment and `src/server/README.md` match the real guarantee.
- `withAuth` marks the function it returns (e.g. non-enumerable `Symbol.for("simap.withAuth")`);
  `src/app/api/routes-guarded.test.ts` imports every `src/app/api/**/route.ts` and fails if any exported HTTP method
  (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS) lacks the marker, except `healthz` and `readyz`.
- `db/seeder.js` `assertDevSeedTarget`: parse with `pg-connection-string` (the parser `pg` uses) and refuse URLs whose
  effective host is not local or that carry `host` / `hostaddr` query parameters; error messages never include the URL.
- `scripts/schema-check.mjs`: call the same guard before connecting; exit 2 on refusal.

## Out of scope
- Other 💭 notes from both audits (JWKS log rate limit, unknown-`kid` cooldown, trigger `search_path`, role split).
- The real member gate (SIM-011).

## Acceptance criteria
- [ ] Handlers receive the org scope from `withAuth`; no exported function turns an arbitrary `{ org }` into an
  `OrgScope` (a type test or `@ts-expect-error` proves `orgScopeOf({ org: "…" })` no longer compiles or throws).
- [ ] The guarded-routes test fails for a fixture route that exports an unwrapped `GET`, an `export { h as POST }`, or a
  `HEAD`/`OPTIONS` handler, and passes for the real routes.
- [ ] `assertDevSeedTarget` refuses `postgres://u:pw@localhost/simap?host=10.0.0.5` and `…?hostaddr=10.0.0.5`, and the
  error message does not contain the password; existing local cases still pass.
- [ ] `schema:check` exits 2 without connecting when `DATABASE_URL` is not local.
- [ ] All loop checks green; the two security reviews' findings 1–2 are marked resolved by the review agent rescan.

## Technical notes
- Files: `src/server/http/org-scope.ts`, `src/server/http/with-auth.ts` (+ tests), `src/app/api/me/route.ts`,
  `src/app/api/routes-guarded.test.ts`, `src/server/README.md`, `db/seeder.js`, `db/seeder.test.ts`,
  `scripts/schema-check.mjs`.
- High paths: `src/server/http/**` → Gate `plan-approval`.
- `pg-connection-string` is a dependency of `pg`; decide whether to add it as a direct dependency (pnpm strictness).

## Test plan
- Unit: org-scope / with-auth tests, guarded-routes test with fixtures, seeder guard cases.
- Manual: none (schema-check refusal is a unit-level or scripted check).

## Notes / answers from Ming
—

## Handoff
