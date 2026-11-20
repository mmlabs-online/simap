# Consult — software-architect (SIM-004, 2026-11-20)

> Orchestrator note: finding 3 is wrong. `.env.example` exists (added by SIM-001 with `PORT=`, SIM-002 added `DATABASE_URL=`); agents cannot see it because the deny rule `Read(**/.env.*)` also hides it.

### Findings
1. **The standalone layout is different from tudocuatui's.** `next.config.ts` already sets `output: "standalone"`. `next build` writes `.next/standalone/{server.js,package.json,node_modules(traced)}` but does not copy `.next/static` or `public/`. The repo has no `public/` folder yet, so a plain `COPY public` would fail the build. tudocuatui's `prod-deps` stage plus `COPY server` does not map onto Next.
2. **The migrate entry is not traced.** `db/migrate.js` and `db/migrator.js` are not reachable from any route, so they are not in standalone. `pg` is traced only because `src/server/db/pool.ts` imports it. With pnpm, the traced `node_modules` uses `.pnpm` symlinks. Whether `/app/node_modules/pg` resolves from `/app/db/migrate.js` has to be checked, not assumed. The standalone `package.json` keeps `"type": "module"`, so ESM `migrate.js` works if `pg` resolves.
3. **There is no `.env.example` in the repo.** R3 and spec §8 require one. This ticket adds the first runtime config names (`DATABASE_URL`, `MM_IDENTITY_ISSUER` if the auth ticket needs it, `PORT`, `HOSTNAME`).
4. **Health endpoints:** `/api/healthz` is a static 200. `/api/readyz` pings the DB (2 s timeout, pool max 5) and returns 503 with no `DATABASE_URL`, which matches the acceptance criterion. Both paths sit under `/api/`, not tudocuatui's `/healthz`, so the check script and compose healthcheck must use the `/api/` paths.
5. **CI** (`.github/workflows/ci.yml`) has a Postgres service but no Docker build or image check. tudocuatui runs `check-image.sh` both in CI (with `CHECK_IMAGE_DATABASE_URL`) and in the release workflow against the pushed digest.
6. **Risk tier:** every file in scope (`Dockerfile`, `.dockerignore`, `deploy/**`, `.github/workflows/release*`, `.env.example`) is a High path, so the plan gate and Ming's per-PR review apply. `next.config.*` is High too, if headers get touched.
7. **ming-todo bookkeeping:** `work/ming-todo.md` has two items with the ID **M-4**. The release also needs Ming steps that are not listed yet: a Docker Hub repo, repository secrets `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN` / `DEPLOY_REPO_TOKEN` on simap, copying `compose.yml` and the deploy workflow into `mmlabs-online/deployment`, and pushing the first `release/vX.Y.Z` branch.
8. **The layout has no `next/font` or inline theme script yet.** Those follow-ups only bite once SIM-005/SIM-008 land, but the image build must still work after they do.

### Recommendations
- **Dockerfile:** three stages, mirroring tudocuatui.
  - **`build`** (`--platform=$BUILDPLATFORM`): `corepack enable`, `pnpm install --frozen-lockfile` with a cache mount, `pnpm build`. Set `NEXT_TELEMETRY_DISABLED=1` as an inline env on the build `RUN`, not as image `ENV`.
  - **Runtime** (`node:22-bookworm-slim`, files root-owned, `USER node`):
    - `COPY .next/standalone ./`
    - `COPY .next/static ./.next/static`
    - `COPY db/migrate.js db/migrator.js db/migrations ./db/`
    - Copy `public/` only if it exists. The cleaner fix is to add `public/.gitkeep` so the `COPY` always works.
    - `ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000`, `EXPOSE 3000`, `CMD ["node","server.js"]`.
    - Liveness `HEALTHCHECK` on `/api/healthz` using Node `fetch`, as tudocuatui does. Compose overrides it with `/api/readyz`.
  - **`pg` for migrate:** option A (default) relies on the traced `pg`, and the check script proves it with `node -e "import('pg')"` from `/app` plus `node db/migrate.js` exiting 2 without `DATABASE_URL`. Option B, if A turns out flaky with pnpm symlinks: a separate `migrate-deps` stage that runs `pnpm install --prod`, copied into `/app/migrate/node_modules`. B costs image size and a second dependency tree.
- **Migrate command:** `["node","db/migrate.js"]` (same relative path as the repo). The app `CMD` never migrates.
- **`.dockerignore`:** tudocuatui's list, plus `.next`, `**/*.test.ts`, `scripts`, `deploy`, `work`, `docs`, `.claude`, `.env*`, `compose.dev.yml`.
- **`scripts/check-image.sh`:** port the generic parts:
  - no secret-like env names, non-root user, no `.env*` files, no `*.map` under `/app/.next/static`
  - `Cmd` is exactly `["node","server.js"]`, and image env sets only `NODE_ENV`/`HOSTNAME`/`PORT` among app variables
  - layout: `/app/.next/static` non-empty, `db/migrations/*.sql`, `pg` importable, no `src/`
  - exit-2 check for migrate without a DB
  - `--network none` smoke: `/api/healthz` 200, `/api/readyz` 503, `/` 200 with a hashed `/_next/static/...` asset 200 (this proves the static copy works), image `HEALTHCHECK` reaches healthy
  - optional DB smoke: migrate twice ("up to date"), then `/api/readyz` 200
  - Drop the tudocuatui-specific checks (SPA fallback, `version.txt`, Supabase, Google, `TUDO_*`).
- **CI:** add an `image` job that builds with buildx and runs `check-image.sh` with `CHECK_IMAGE_DATABASE_URL` pointing at the service Postgres. This is how acceptance criteria 1–2 get verified on every PR.
- **Release workflow:** copy tudocuatui's almost line for line: `APP=simap`, `SIMAP_IMAGE=<ns>/simap:vX.Y.Z@sha256:…`, verify the pushed digest with `check-image.sh`, open a PR on `mmlabs-online/deployment` that changes only `apps/simap/release.env`. Skip the version build argument for now (see Q3).
- **Deploy compose:** tudocuatui's compose with these settings:
  - `name: simap`, service `simap` on `[tunnel(web), db]`, `migrate` on `[db]` only with `profiles: [migrate]` and `command: ["node","db/migrate.js"]`
  - `cap_drop: [ALL]`, `no-new-privileges`, json-file log limits
  - `env_file: /Users/mingming/.config/simap/simap.env`
  - healthcheck on `/api/readyz`, `start_period` about 20 s (Next cold start)
  - Copy the deploy workflow with only names and paths changed; it writes just `DATABASE_URL`. Add a test like `deploy-envfile.test.ts` that runs `docker compose config` with a dummy `release.env` (acceptance criterion 3).
- **`work/ming-todo.md`:** renumber the duplicate M-4 and add M-6..M-9 for the steps in finding 7.

### Risks
- **pnpm symlinks in standalone:** this is the biggest source of failures that only show up at runtime. The check script must import `pg` inside the image, not just test that the folder exists.
- **`next/font/google` (once SIM-005/008 add it):** the image build needs network, and a Google outage would block a release. The default is to accept this for now, since buildx on GitHub has egress, and file debt to self-host Manrope with `next/font/local` (OFL font, committed woff2).
- **JWKS egress:** the app must stay on the `web` network. A `--network none` smoke can only check unauthenticated paths.
- **`/api/readyz` is public through the tunnel:** each hit costs a DB round trip. Low impact at this scale. Rate-limit or block it at Cloudflare (Ming's step), or cache the result for about 2 s in-process (an app change, outside SIM-004).
- **Strict CSP:** a nonce-based CSP makes every page dynamic and needs the theme script to carry the nonce. Don't do it here. Basic headers (`nosniff`, `frame-ancestors 'none'`, Referrer-Policy) could go in `next.config.ts`, but that file is also High and outside this ticket's scope. Better as a follow-up.
- **Architecture:** tudocuatui pushes `linux/amd64` only. If the macbook runner is Apple Silicon, the app runs under emulation, which is slow but works. Follow tudocuatui unless Ming says otherwise.

### Open questions (with proposed defaults)
1. **How should migrate get `pg`?** Default: the traced standalone `pg` (option A), proven by the check script. Fall back to a separate prod-deps stage (B) if the import fails.
2. **Should security headers and CSP go in this ticket?** Default: no. File debt for basic headers now and a nonce CSP later.
3. **Should the image carry the app version (like `VITE_APP_VERSION`)?** Default: no version build argument now. The release tag and digest pin the version. Add `version` to `/api/healthz` later if wanted.
4. **Image namespace and platform?** Default: `mingming21400/simap`, `linux/amd64`, same as tudocuatui.
5. **Should the deployment-repo files live in `deploy/deployment-repo/` and be copied by Ming with the first release PR, as tudocuatui did?** Default: yes. Agents never push to the deployment repo by hand.
6. **What about Google Fonts at build time?** Default: allow network at build and file debt to self-host Manrope.

Files read: wt-SIM-004 `next.config.ts`, `db/migrate.js`, `src/app/api/readyz/route.ts`, `.github/workflows/ci.yml`, `work/ming-todo.md`; ref-tudocuatui-main `Dockerfile`, `scripts/check-image.sh`, `deploy/deployment-repo/apps/tudocuatui/compose.yml`, `deploy/deployment-repo/.github/workflows/deploy-tudocuatui.yml`.
