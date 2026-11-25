# SIM-004 (D1/D8): the Next.js standalone server on :3000, non-root, plus the one-shot migrate entry
# (`node db/migrate.js`, run by the deployment's `migrate` service; the app itself never migrates).
# Runtime config comes only from outside: DATABASE_URL from the host env file, MM_IDENTITY_ISSUER from the compose
# file once SIM-005 reads it. None of them is set here (R3). No ports published: cloudflared reaches it as `simap`.

# No --platform=$BUILDPLATFORM: the standalone trace copies native optional deps of the build platform.
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
COPY . .
# SIM-040: the release tag (public, shown in the UI header); `dev` when the build passes none.
ARG SIMAP_VERSION=dev
# Needs network: next/font/google fetches fonts at build time. Inline variables, never ENV.
RUN NEXT_PUBLIC_SIMAP_VERSION="$SIMAP_VERSION" NEXT_TELEMETRY_DISABLED=1 pnpm build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
# Files stay root-owned: the app cannot rewrite itself. .dockerignore drops tests, docs and .env*.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY db/migrate.js db/migrator.js ./db/
COPY db/migrations ./db/migrations
# The only writable path: Next's runtime cache.
RUN mkdir -p .next/cache && chown node:node .next/cache
USER node
EXPOSE 3000
# Liveness only; the compose file overrides this with /api/readyz (database included).
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node","-e","fetch('http://127.0.0.1:3000/api/healthz',{signal:AbortSignal.timeout(2000)}).then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node","server.js"]
