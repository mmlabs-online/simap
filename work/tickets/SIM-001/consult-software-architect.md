# Consult — software-architect — SIM-001

## Findings
1. **seatMGT reference unreadable:** `D:\Projects\SAF\spaceM\projects\seatMGT` contains only `README.md` on `main`; the `ming_dev` branch is not checked out, so `next.config.ts` / `tsconfig.json` are absent. The "16.x" pin in the ticket is unverified.
2. **tudocuatui pins:** `.mise.toml` → node `22`, `npm:pnpm` `10.34.9`; `package.json` → `packageManager: pnpm@10.34.9`, vitest `5.1.0`, oxfmt `^0.76.0`, typescript `^5.7.0`, react `^19`, tailwind `^4` (via Vite plugin). `.node-version` exists.
3. **tudocuatui CI:** single `ci` job on PR + push to main, `permissions: contents: read`, concurrency cancel on PRs; steps: checkout → `pnpm/action-setup@v4` → `setup-node@v4` (22, pnpm cache) → `install --frozen-lockfile` → `typecheck` → `test:coverage` → `format:check` → `build`. Drop for simap: Postgres service, migrate smoke step, `image` job.
4. **tudocuatui server is JS** (`server/identity.js`, `jwks.js`, `errors.js`, `validate.js`), flat files — simap ports to TS modules.
5. **`server-only` only guards the Client Component graph.** A Server Component in `src/ui` or `src/app` importing `src/server` still builds. D4 (Server Components never touch org data) needs a second guard.
6. **Current `**/config.*` High glob is too broad:** it matches `next.config.ts`, `vitest.config.ts`, `postcss.config.mjs` → nearly every tooling PR is High.
7. **This ticket's PR is High anyway** (touches `.env.example`, `.github/risk-tiers.yml`) — consistent with Gate `plan-approval`.

## Recommendations
1. **R1 layout + dependency rule** (fills scope bullet "Layout and R1"):
   - `src/app/**` pages/layouts (org-data pages = client pages rendering `src/ui`); `src/app/api/**/route.ts` thin handlers: auth → validate → one service call → map to Response.
   - `src/server/<module>/` `service.ts`, `queries.ts` (SQL), tests; `src/server/http/` bearer verify wrapper, one error shape, input validation.
   - `src/ui/**` components + `src/ui/api/` fetch client (attaches bearer); `src/lib/**` pure, isomorphic (types, DTOs, validators).
   - Allowed imports: `api` → server, lib; pages → ui, lib; ui → lib; server → lib; lib → nothing. Every `src/server/**` file starts with `import "server-only"`.
2. **Enforce without ESLint:** (a) `server-only` as above; (b) tsconfig `paths` `@/server/*`, `@/ui/*`, `@/lib/*` and forbid cross-layer relative imports (grep-able); (c) `scripts/check-layers.mjs` (~30 lines, no deps): regex over import specifiers in `src/ui/**`, `src/lib/**`, and non-`api` `src/app/**`; fail on `@/server` or `server-only`. Run as `pnpm check:layers` in CI and loop Checks. Do not make it a `*.test.ts` (the `low` globs would let a PR weakening the guard auto-merge).
3. **Vitest:** alias `server-only` to an empty stub in `vitest.config.ts`, or server tests throw on import. Mirror `@/*` paths.
4. **Pins:** pin `next` and `react`/`react-dom` exact (current 16.x patch + its React 19.2.x); note seatMGT unverifiable in the plan. Node 22 + pnpm 10.34.9 exactly as tudocuatui; add `"engines": {"node": ">=22 <23"}`. Tailwind v4 via `@tailwindcss/postcss` (not the Vite plugin). Next 16: typecheck = `next typegen && tsc --noEmit` so typed routes resolve on a clean checkout.
5. **healthz:** `export const dynamic = "force-dynamic"`, no import from any `src/server/db`; unit test calls `GET()` directly.
6. **CI order:** install → typecheck → check:layers → test → format:check → build; add a step asserting `.next/standalone/server.js` exists (covers the standalone AC).
7. **High paths** (risk-tiers.yml + loop.config mirror): keep `db/migrations/**`, `**/*.sql`; add `src/server/http/auth*`, `src/server/identity/**` (token verifier), `src/middleware.ts` / `src/proxy.ts`; replace `**/config.*` with `src/server/config.*` (or `src/server/env.*`) and `next.config.*` (headers/output/env exposure); add `scripts/check-layers.mjs` (guards R1); drop non-`src/` `server/**`. Keep `src/app/api/**` Medium.

## Risks
- Next 16 vs 15: middleware renamed to `proxy`, `next lint` removed, Turbopack default build — copying seatMGT config blindly may break.
- Regex guard misses dynamic `import()` and re-exports via `src/lib`; acceptable, but also forbid `src/lib` → `src/server`.
- `server-only` in Vitest: missing stub alias → confusing red CI.
- Standalone output with pnpm symlinks: usually fine; SIM-004 should verify traced `node_modules`.

## Open questions
1. `next` 16.x OK given seatMGT unreadable? Default: latest stable 16.x patch, pinned exact.
2. Layer guard as a separate script + CI step (not a Vitest test)? Default: script, so it is not Low tier.
3. `next.config.*` → High? Default: yes.
4. Validation: library or hand-written like tudocuatui `validate.js`? D2 says no extras. Default: hand-written in `src/lib/validate`.
