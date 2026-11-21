# SIM-028: Signed-in local dev with a server-side dev token (no browser call to Identity)

| Field | Value |
|---|---|
| State | PLANNING |
| Priority | P1 |
| Size | M |
| Areas | architecture, ui, security |
| Gate | plan-approval |
| Depends on | SIM-006.2, SIM-007.2 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-21 |
| Claimed by | claude@2026-11-21T01:21:04Z |
| PR | https://github.com/mmlabs-online/simap/pull/28 |

## Goal
On `pnpm dev` the app at `http://localhost:3000` opens signed in as Ming without the browser ever calling mmlabs
Identity, so local development is not blocked by CORS (Identity cannot register a localhost origin).

## Scope reference
- D56 (Ming, 2026-11-21): local dev uses tudocuatui's dev-token pattern (option B).
- D4 (token as bearer to route handlers), D5 (org-scoped tokens), D7/SIM-006 (Identity client contract).
- Port source: tudocuatui `scripts/dev-token.sh`, `dev/devTokenProxy.ts`, README "Development" (its D44, D46),
  at `D:\project\spaceM\projects\tudocuatui`.

## Scope
- `pnpm dev:token`: cross-platform Node script (Windows and macOS; tudocuatui's is bash). Asks for email (or
  `SIMAP_DEV_EMAIL`) and the password with hidden input; `POST /auth/login` then `/auth/token`
  `{audience:"simap", account_id, org_id?}` with `Origin: https://simap.mmlabs.online` and `X-MM-App: simap`;
  validates the token answer like `identityClient.token`; best-effort `/auth/logout`; writes the token (mode 600 where
  supported) to `~/.config/simap/dev-token` (override `SIMAP_DEV_TOKEN_FILE`). Org: `--org <uuid>` or
  `SIMAP_DEV_ORG`; without one, the token is unscoped. Maps 401 / Turnstile / rate-limit answers to clear messages.
- Dev-only server injection (Next.js `src/proxy.ts` or the equivalent Next 16 hook): for same-origin `/api/*` requests
  in `NODE_ENV=development`, drop the client `Authorization` and set `Bearer <file token>`, read per request.
  Missing, malformed or expired token → one console warning naming `pnpm dev:token`, request forwarded without a bearer.
- Dev-token mode in the browser: `AuthGate` (and the org entry of SIM-007.2) skip the Identity sign-in, renewal and
  org-switch calls and go straight to `/api/me`; the UI shows that it runs on a dev token.
- README: "Local development" section (setup, `pnpm dev:token`, token lifetime, Turnstile note).

## Out of scope
- Production DB guardrails and `pnpm dev:prod` (SIM-029).
- Any org-admin-api change (if one is needed, the planner writes a prompt for Ming in `docs/requests/`).
- Switching org in the UI while on a dev token (re-run `pnpm dev:token --org …` instead).

## Acceptance criteria
- [ ] With a valid token file, `pnpm dev` + opening `http://localhost:3000` shows the app signed in; the browser's
      network log has no request to `api.mmlabs.online`.
- [ ] The token never reaches the browser: not in any response body or header, not in `.next/static` or any client
      bundle, and `pnpm build` output contains no dev-token code path that can run (`NODE_ENV=production` disables it).
- [ ] The injection only applies to same-origin requests (`Sec-Fetch-Site` absent or `same-origin`), only to `/api/*`,
      always drops a client-sent `Authorization`, and refuses to run unless the dev server listens on loopback.
- [ ] `pnpm dev:token` never prints the password or token, never writes the password anywhere, and writes the token
      file outside the repo; the file default path and override are tested.
- [ ] Missing / malformed / expired token → a single warning naming `pnpm dev:token`; `/api/*` then answers 401 as
      without a token. Refreshing the file needs no dev-server restart.
- [ ] All Checks green; new logic has Vitest tests (token-file reader, header rewrite, script answer parsing).

## Technical notes
- Files (expected): `scripts/dev-token.mjs`, `src/proxy.ts` (High path), a dev-token reader (server-only, not
  importable from ui/pages, R1), `src/ui/auth/AuthGate.tsx` + org entry, `package.json`, `README.md`, `.env.example`
  (names only: `SIMAP_DEV_TOKEN_FILE`, `SIMAP_DEV_EMAIL`, `SIMAP_DEV_ORG`).
- Manual end-to-end check needs M-1 (app `simap` registered in org-admin-api with origin
  `https://simap.mmlabs.online`); implementation and unit tests do not.
- Risks: Next 16 proxy runtime and file reads; the browser must learn "dev-token mode" without a client env secret
  (e.g. a dev-only `/api/dev-session` flag or a public `NEXT_PUBLIC_` boolean); Identity tokens may still be 15 min
  (tudocuatui M-29) — then re-run the script.

## Test plan
- Unit: token-file reader (missing/malformed/expired/ok), header rewrite (cross-site, same-origin, no header, client
  Authorization dropped), loopback check, script JSON parsing and error mapping, AuthGate dev-mode decision (pure).
- Manual: `pnpm dev:token`, `pnpm dev`, open localhost:3000 in Chrome, check network log and that rooms load.

## Notes / answers from Ming
- 2026-11-21: Ming chose option B (tudocuatui dev-token). Any org-admin-api change → give Ming a prompt.
- Waiting for Ming: plan approval (High tier)
- Plan approved (2026-11-21): Ming approved decisions A-G as written in plan.md (incl. the split; SIM-028.1 created on main).
- 2026-11-21: Ming asked to fix both 🟡 findings of security-review Attempt 2 on PR #28 before merge.
- 2026-11-21 (escalation answer): Ming chose escalation.md option 1. Plan Decision C is amended: `pnpm dev` accepts only `--port <n>` / `-p <n>`, refuses every other argument and any `--`, builds `["dev", "-H", "127.0.0.1", "--port", n]` itself, and refuses to start when `NODE_OPTIONS` contains `inspect` or `debug` in any spelling. Plan approved (2026-11-21) for an amendment limited to this launcher change; anything wider needs a new approval. Attempts reset to 0 after the escalation decision.

## Handoff

### 2026-11-21 — claude — BLOCKED
- Agent calls: 3 (software-architect×1 63k, frontend-developer×1 44k, planner×1 133k; in/out split not reported).
- Done: consult (architecture, ui; security has no consult agent), plan.md Status READY covering slice 1 (dev:token script, `pnpm dev` loopback launcher, bearer injection in `withAuth`, README, `.env.example` names).
- In progress / next: Ming approves plan (M-11) incl. decisions A-G and the split; on approval create SIM-028.1 (browser dev-token mode, AC1 browser half) from `## Split proposal`, then `/run SIM-028`.
- Gotchas: SIM-027 may add `src/proxy.*` and touches `src/lib/api/fetch.ts` (slice 2 hotspot); `.env*` is unreadable to agents, so `.env.example` names are appended blind; manual e2e needs M-1; `gh` CLI is not installed on this machine.

### 2026-11-21 — claude — DONE
- Agent calls: 5 this run (implementer×2 80k + 24k, reviewer×2 64k + 29k, security-ai-generated-code-auditor×2 60k + 41k; in/out split not reported). Earlier run: 3 calls (see above).
- Done: slice 1 implemented (dev:token script, loopback `pnpm dev` launcher, bearer injection in `withAuth`, README, `.env.example` names). Attempt 1 REWORK (attached `-H0.0.0.0` bypass); attempt 2 PASS. PR #28 opened.
- In progress / next: Ming reviews PR #28. Security attempt 2 left two 🟡 (host flag swallowed by a value-taking option; non-loopback `--inspect`), flagged in the PR as "fix before merge recommended". Then SIM-028.1 (browser dev-token mode).
- Gotchas: `gh` is installed at `C:\Program Files\GitHub CLI\gh.exe` but not on PATH; Node via fnm (`fnm env`); `.env.example` edited blind.

### 2026-11-21 — claude — ESCALATED
- Agent calls: 3 this run (implementer×1 37k, reviewer×1 47k, security-ai-generated-code-auditor×1 58k; in/out split not reported).
- Done: attempt 3 fixed both attempt-2 🟡 as reported (`-H 127.0.0.1` appended last; `--inspect` and `NODE_OPTIONS` checks). Checks green (86 files, 810 tests).
- In progress / next: reviewer REWORK (`--debug-port` in `NODE_OPTIONS`); security 🟡 new bypass (trailing `--` or a value-taking option as last arg turns the appended `-H` into an operand/value). Max reworks reached → escalation.md; Ming picks an option (M-12). PR #28 stays open, not to be merged before that.
- Gotchas: the launcher's blocklist approach to Next CLI args keeps leaking; recommended fix is an allowlist (`--port` only) with `-H 127.0.0.1` right after `dev`.
