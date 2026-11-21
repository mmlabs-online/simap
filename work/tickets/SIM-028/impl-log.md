## Attempt 1 — 2026-11-21

### Files touched
| File | Required because |
|---|---|
| `scripts/dev-token.mjs` | `pnpm dev:token` (scope bullet 1, AC4) |
| `scripts/dev.mjs` | `pnpm dev` loopback launcher + flag (AC3, Decisions B/C) |
| `src/lib/dev-token/token.ts` | pure token parse, request checks, warnings (AC3, AC5) |
| `src/server/http/dev-token.ts` | per-request file reader + `devAuthorization` (scope bullet 2) |
| `src/server/http/with-auth.ts` | optional `authorization` dep, set only under the inline dev guard (Decision A) |
| `*.test.ts` (token, dev-token, with-auth, scripts/dev, scripts/dev-token) | R5 |
| `package.json` | `dev` launcher, `dev:token` script |
| `.env.example` | names appended blind (file unreadable): SIMAP_DEV_TOKEN_FILE, SIMAP_DEV_EMAIL, SIMAP_DEV_ORG, NEXT_PUBLIC_SIMAP_DEV_TOKEN (no values). Ming: please eyeball the tail of the file. |
| `README.md` | Local development section; step 5 of Local database uses 127.0.0.1 |
| `CLAUDE.md` | Commands line |

### Tests added / changed
- token.test.ts: parseDevToken, isLoopbackHost, devAuthorizationFor (same-origin/none/cross-site, path/host/origin, client header never returned, missing/malformed/expired), warningFor, createWarnOnce
- server dev-token.test.ts: tokenFilePath, readDevTokenFile refresh, devAuthorization, warn once
- with-auth.test.ts: authorization dep (dep result used, null → 401, absent dep unchanged)
- scripts/dev.test.ts: nextDevArgs, devEnv
- scripts/dev-token.test.ts: parseArgs, answer parsing, tokenOrg, error mapping, cookieHeader, tokenFilePath, assertOutsideRepo, writeTokenFile, run (fake fetch/prompt, no secrets printed, logout failure ignored, no-org hint, in-repo refusal)

### Checks (actual output summary)
- typecheck: exit 0 (`next typegen && tsc --noEmit`); check:layers: "211 files, no violations"
- format:check: "All matched files use the correct format."
- test: 82 files passed; 775 passed | 3 skipped
- build: exit 0. `rg -l "dev-token|dev:token|\.config/simap" .next/static` prints nothing (exit 1). Server chunk `dev-token` exists (dynamic import, unreachable when the guard folds to false); not in client.

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- Manual e2e (real token, curl /api/me, LAN refusal, Ctrl-C on password prompt) needs M-1 and Ming; not run here.
- Raw-mode password prompt and `main()` of both scripts are untested (TTY).

### Scope self-check
- Could the diff be smaller? No.
- Diff size: about +430 non-test lines.

## Attempt 2 (REWORK)

### Fixed
- Review Issue 1 / security-review blocker: `scripts/dev.mjs` `nextDevArgs` now also checks attached forms `-H<host>`, `-H=<host>` and short-flag clusters containing `H`; the value must be an allowed loopback host, otherwise it throws the refusal. Required because Next's commander takes the last `-H`, so `-H0.0.0.0` bound all interfaces.
- `scripts/dev.test.ts`: refusal cases `-H0.0.0.0`, `-H=0.0.0.0`, `-H 127.0.0.1 -H0.0.0.0`, `-H192.168.1.5`; keep case `-H127.0.0.1`.
- Optional 🟢 (in files already in plan): `assertOutsideRepo` in `scripts/dev-token.mjs` now treats only `..` or `..<sep>` prefixes as outside (a repo dir named `..foo` is no longer misjudged); `writeTokenFile` removes a stale tmp then writes with `flag: "wx"`.
- Not touched: `.claude/settings.json`, other 🟢 notes.

### Checks
- format:check: exit 0; typecheck: exit 0; check:layers: "211 files, no violations"; test: exit 0 (82 files); build: exit 0.

### Out-of-plan files
None.

### Scope self-check
- Smallest diff: yes, one branch plus tests and two small hardening edits.
