# Security review — SIM-023

## Attempt 1 — security-ai-generated-code-auditor

**Scope:** `git diff origin/main...HEAD` on `ticket/SIM-023` (commits 39d560e, 4d18b95; plan commits ignored). I read these files in full:
- `db/seeder.js`, `scripts/schema-check.mjs`
- `src/server/http/{org-scope,with-auth}.ts`, `src/app/api/me/route.ts`, `src/app/api/routes-guarded.test.ts`
- the four fixtures under `src/test/fixtures/routes/`
- the changed tests and the `package.json` / lockfile delta

I also read the installed parser `node_modules/.pnpm/pg-connection-string@2.14.1/.../index.js` and compared everything against `ticket.md`, the earlier SIM-005 and SIM-008 security reviews, and `CLAUDE.md`.

**Rescan evidence:** `pnpm exec vitest run db/seeder.test.ts scripts/schema-check.test.ts src/app/api src/server/http` passed: 9 files, 46 tests.

**Not checked:** `.env*` (deny rule), the full `pnpm-lock.yaml` beyond the diff hunk, and the full check suite (the reviewer runs it).

**Verdict: 0 🔴, 0 🟡, 5 💭.** All four earlier findings are resolved. The new code adds no blocker and no should-fix.

### Rescan of earlier findings

1. **SIM005-orgscope-forgeable: RESOLVED.**
   - `orgScopeOf` is gone (`org-scope.ts` now exports only the `OrgScope` type and `orgQuery`).
   - `withAuth` builds the scope once from the verified `org` claim (`with-auth.ts:19`, `scopeFor`, frozen) and hands it to the handler as `ctx.scope` (`with-auth.ts:63`). The member gate gets the same object (`:65`).
   - `ctx` itself is frozen.
   - `org-scope.test.ts` proves `Object.keys(mod)` is `["orgQuery"]` and that `@ts-expect-error` rejects a plain `{orgId}` as an `OrgScope`.
   - The comment and `src/server/README.md` now describe the real guarantee.
   - `/api/me` returns an explicit `{sub,email,org,tier}`, so `scope` does not leak into responses (tested in `route.test.ts`).

2. **SIM005-guard-test-regex: RESOLVED.**
   - `routes-guarded.test.ts` now imports every `src/app/api/**/route.ts` and checks each exported method for the runtime marker `Symbol.for("simap.withAuth")`. The methods checked are GET, POST, PUT, PATCH, DELETE, HEAD and OPTIONS.
   - Because the check runs on runtime exports, the export syntax no longer matters. `export { h as POST }`, multi-line `withAuth(` and HEAD/OPTIONS are all covered.
   - The fixtures prove the test fails for an unwrapped GET, an aliased POST and HEAD/OPTIONS, and passes for a wrapped route.
   - It also fails a route that exports no method.
   - `with-auth.ts:84` sets the marker with `defineProperty` defaults: non-enumerable, non-writable, non-configurable.

3. **SIM-008 #1 (seed guard `?host=` / `?hostaddr=` bypass): RESOLVED.**
   - `seeder.js:23` refuses any URL with a `host` or `hostaddr` search param.
   - `seeder.js:30` then re-checks the effective host as returned by `pg-connection-string.parse`. This is the same 2.14.1 parser `pg@8.23.1` resolves, and it decodes the same way pg does. The guard refuses when `cfg.hostaddr` is set, the host is empty, or the host is not in `LOCAL_HOSTS`.
   - Percent-encoded keys or hosts are caught too, because both `URLSearchParams` and `parse` decode them.
   - A unix socket host (`%2F…`, `socket:`) and an empty host are refused.
   - Tests cover `?host=10.0.0.5`, `?hostaddr=10.0.0.5`, `?host=localhost`, `postgres:///simap` and a socket path, and each asserts that `secret-pw` is not in the message.

4. **SIM-008 #2 (`schema:check` unguarded): RESOLVED.**
   - `schema-check.mjs:16-20` calls `assertDevSeedTarget` before `new pg.Client` / `admin.connect()` (`:35-36`) and exits 2 on refusal.
   - `schema-check.test.ts` spawns the script with a non-local URL, a `?host=` override and `NODE_ENV=production`. Each run exits with status 2, no `pass:` lines and no password in the output.

### New-code checks (requested)
- **Marker forgeability (💭, accepted):** `Symbol.for` is a global registry, so a route could set `Object.defineProperty(fn, Symbol.for("simap.withAuth"), {value:true})` on an unwrapped handler and pass the test. That is a deliberate bypass, plainly visible in a diff, and the test exists to catch mistakes, so it is acceptable. If you want it closed, use a module-private `WeakSet` of wrappers and export only an `isGuarded(fn)` predicate (`with-auth.ts:17,84`). A private `Symbol()` would not work across vitest module instances.
- **Cast-guard heuristic (💭):** `org-scope.test.ts` "OrgScope is cast only in with-auth.ts" matches only `as [unknown as] OrgScope` and `<OrgScope>`. It misses `{orgId: x} as any`, `as never`, `as Parameters<typeof orgQuery>[1]` and `// @ts-ignore`. The test comment already says it is a heuristic. The real guarantee is that there is no exported constructor plus review.
  - Optional hardening: `orgQuery` checks at runtime that `scope` is a member of a module-private `WeakSet` filled by `scopeFor`, and throws otherwise. That makes a forged scope fail closed at runtime, not only at the type level.
- **Fixtures under `src/test` (no finding):** Next App Router only routes `src/app/**/route.*`. The fixtures sit outside `src/app` and are not named `route.ts`, so Next never serves them. They are reached only through the test's dynamic `import()`. `check-layers` ignores `src/test` (`check-layers.test.ts:79`).
- **Error messages leaking DATABASE_URL (no finding):**
  - Every throw in `assertDevSeedTarget` uses a fixed string.
  - Exceptions from `new URL` and `parse` are caught and replaced with fixed strings. This matters because `parse` can throw on `sslcert`/`sslkey` paths with an ENOENT message that includes the path.
  - `schema-check.mjs:18` prints only `err.message` from the guard.
  - The tests assert that `secret-pw` is absent.
  - The SIM-008 💭 #6 note about raw pg errors after connect is unchanged and out of scope.

### Findings
1. 💭 **Two copies of the parser can drift apart.** `package.json` pins `"pg-connection-string": "2.14.1"` exactly, while `pg` declares `^2.14.1`. A future `pg` bump could resolve a newer parser for pg while the guard keeps 2.14.1, and "the same parser pg uses" would then quietly stop being true.
   - **Fix:** use `^2.14.1` to match pg's range, or add a test asserting that `require.resolve` from `pg` and from the root point to the same version.
2. 💭 **The marker can be forged with `Symbol.for`** (see above). `with-auth.ts:17,84`. The optional fix is a `WeakSet` registry.
3. 💭 **`OrgScope` is enforced at the type level only.** `org-scope.ts:15-20`. The optional fix is a `WeakSet` runtime check in `orgQuery` (see above).
4. 💭 **Gaps in the guard test that predate this ticket.**
   - `routes()` matches only `route.ts` (`routes-guarded.test.ts:16`). Next also serves `route.js`, `route.tsx` and the like.
   - healthz/readyz are skipped wholesale (`:9`). A future `POST` in a probe route would not be checked.
   - **Fix:** match `/^route\.[cm]?[jt]sx?$/`, and for the probes allow only `GET`/`HEAD` unmarked.
5. 💭 **`assertDevSeedTarget` checks only the hostname.** `localhost` still trusts `/etc/hosts` and container networking (SIM-008 💭 #8). Nothing new here; the SIM-004 follow-up still applies.

### Follow-ups (out of scope)
- Optional `WeakSet` hardening for the `withAuth` marker and for `OrgScope` (findings 2–3). Track this as `debt` if you want it before SIM-007 / SIM-010 add org queries.
- Widen the route-file glob and limit the probe exemption to GET/HEAD (finding 4).
- Align the `pg-connection-string` version range with `pg` (finding 1).
- SIM-008 💭 items 3–8 and SIM-005 💭 items remain as previously recorded.
