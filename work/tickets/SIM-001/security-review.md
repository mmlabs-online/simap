# Security review — SIM-001

## Attempt 1
Agent: security-ai-generated-code-auditor (run via general-purpose with the agent file; opus). Read-only. No `.env*` values read.

Verdict: **no 🔴 blockers.** No secrets, no client-exposed env, no data leaks.

### Findings
1. 🟡 `.github/workflows/ci.yml:20` — `actions/checkout@v4` persists GITHUB_TOKEN into `.git/config`, readable by every later step (install/test/build run third-party dep code). Token is `contents: read` only, but no reason to expose it; the kit's own `risk-tier.yml:26` already disables it. **Fix:** `with: { persist-credentials: false }` on the checkout step.
2. 🟡 `.github/workflows/ci.yml:20-22` — actions pinned to mutable major tags (`@v4`), not commit SHAs; a compromised/re-pointed tag runs in CI. Low impact now (no secrets, `contents: read`). **Fix:** pin each action to its full commit SHA with a `# v4.x.y` comment; let Dependabot/Renovate bump.
3. 🟡 `scripts/check-layers.mjs:62-63` — any import whose target is under `src/` but outside the five layers (e.g. `src/foo.ts`, `src/proxy.ts`, `src/instrumentation.ts`) is silently allowed. Transitive bypass: `src/ui/x.tsx` → `@/foo` → (`src/foo.ts`) `@/server/db` — each hop passes, so the UI→server ban is not enforced by the R1 guard (Next's `server-only` build error still protects the client bundle). Not exploited today. **Fix:** when `target.startsWith("src/")` and `layerOf(target)` is null, report a violation (explicit allowlist for Next root files: `src/proxy.*`, `src/middleware.*`, `src/instrumentation.*`); add a test case in `scripts/check-layers.test.ts`.
4. 🟡 `.github/risk-tiers.yml:6-30` — the files that compute/enforce the tier are not High: `.github/scripts/risk_tier.py`, `.github/workflows/risk-tier.yml`, `.github/workflows/ci.yml`. A Medium PR could edit `risk_tier.py` to always print `low`, or drop `check:layers`/`pnpm build` from CI, and the label would be wrong (`risk-tier.yml:32` runs the PR's own copy). Only `risk-tiers.yml` itself is protected. **Fix:** add `.github/scripts/risk_tier.py`, `.github/workflows/**`, `.github/risk-tiers.yml` to `high:` and mirror in `.claude/loop.config.md` → High paths. (Script + `risk-tier.yml` workflow are kit-managed → also upstream to spaceM `skills-library/project-kit`.)
5. 🟢 `.github/workflows/ci.yml:17-18` — no `timeout-minutes`; a hung build burns the 6 h default. **Fix:** `timeout-minutes: 15`.
6. 🟢 `next.config.ts:3-7` — no `env:` key, no `NEXT_PUBLIC_*`; nothing exposed to the client. `poweredByHeader: false` good. No security headers yet (CSP, `X-Content-Type-Options`, `frame-ancestors`/`X-Frame-Options`, `Referrer-Policy`, HSTS) — acceptable for a placeholder page; out of scope per R4. **Fix:** follow-up ticket to add `headers()` before real UI/auth ships.
7. 🟢 `src/app/api/healthz/route.ts:1-5` — clean: static `{status:"ok"}`, `no-store`, no version/env/DB leak. **Note for SIM-002:** when adding a DB probe, never echo connection strings, error messages or DB host.
8. 🟢 `.env.example:1-2` — key name only (`PORT=`). `.gitignore:5-7` ignores `.env`, `.env.*`, keeps `.env.example`. Correct.
9. 🟢 `scripts/check-layers.mjs:19-24` — known blind spots beyond #3: template-literal imports (`` import(`@/server/x`) ``) and non-literal dynamic imports not caught (the latter documented at line 4). Layer map correctly bans ui→server and pages→server (lines 9-15), handles multi-line and `export * from`, runs in CI (`ci.yml:28`). `server-only` stub aliased only in `vitest.config.ts:12` — production build still enforces it.
10. 🟢 `.github/risk-tiers.yml:16-17` — Next also accepts root `middleware.*` / `proxy.*` / `instrumentation.*` (and `src/instrumentation.*` runs server code at startup); only `src/middleware.*` and `src/proxy.*` are High. **Fix:** add root `middleware.*`, `proxy.*`, `instrumentation.*`, `src/instrumentation.*` to `high:` + loop.config mirror.

### Follow-ups (out of SIM-001 scope)
- Kit-level: compute the risk tier from the base branch's copy of `risk_tier.py` / `risk-tiers.yml`, not the PR head's, so a PR cannot change its own tier (#4) → spaceM `skills-library/project-kit`, `debt` issue.
- Security-headers ticket (#6).

### Files reviewed
`.github/workflows/ci.yml`, `.env.example`, `next.config.ts`, `src/app/api/healthz/route.ts`, `scripts/check-layers.mjs`, `.github/risk-tiers.yml`, `.claude/loop.config.md`, `.github/workflows/risk-tier.yml`, `package.json`, `.gitignore`, `tsconfig.json`, `vitest.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`. Grep for `process.env` / `NEXT_PUBLIC` across `src`, `scripts`, configs: only `TZ` in `vitest.config.ts`.

## Attempt 2
Agent: security-ai-generated-code-auditor (via general-purpose, opus). Read-only, diff `c188a64..HEAD` only.

Verdict: **no new 🔴; no Attempt 1 finding changed status** (all 10 open as written — #1–#5, #10 live in `ci.yml` / `risk-tiers.yml` / `check-layers.mjs`, untouched; #6 still holds).

### New findings in this diff
- 🟢 `next.config.ts:7` `agentRules: false` — only stops Next writing `AGENTS.md` in dev; no env exposure, no `NEXT_PUBLIC_*`, not in the client bundle. Fix: none.
- 🟢 `.gitattributes:1` `* text=auto eol=lf` — repo-defined line endings, reproducible `format:check`; binaries auto-detected (none yet). Fix: when images/fonts arrive, add explicit `*.png binary` etc.
- 🟢 `CLAUDE.md:24,74`, `.claude/loop.config.md:5-6` — wording only; no secrets, no High-path semantics change. Fix: none.
- 🟢 `work/tickets/SIM-001/impl-log.md:52-75` — process notes, no secrets; deleted `AGENTS.md` was untracked. Fix: none.

### Still open from Attempt 1 (unchanged)
- 🟡 #1 `ci.yml:20` `persist-credentials: false`. 🟡 #2 `ci.yml:20-22` SHA-pin actions. 🟡 #3 `check-layers.mjs:62-63` flag `src/` targets outside the five layers (+ allowlist, test). 🟡 #4 `risk-tiers.yml:6-30` make `risk_tier.py`, `.github/workflows/**`, `risk-tiers.yml` High (+ loop.config mirror, kit upstream).
- 🟢 #5–#10 as in Attempt 1.
