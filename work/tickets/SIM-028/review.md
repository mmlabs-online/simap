## Attempt 1 — 2026-11-21
Verdict: REWORK

### Checks (run by reviewer)
- `pnpm format:check`: exit 0, "All matched files use the correct format."
- `pnpm typecheck && pnpm check:layers`: exit 0 / exit 0, "check-layers: 211 files, no violations"
- `pnpm test`: exit 0, "Test Files 82 passed (82); Tests 775 passed | 3 skipped (778)". This matches impl-log.
- `pnpm build`: exit 0
- AC2 bundle scan after build: `grep -rlE "dev-token|dev:token|\.config/simap|SIMAP_DEV" .next/static` found nothing (exit 1). In the production server chunk `src_0bem0o5uz58ir._.js`, `getAuthDeps` compiles to `memberGate:ed,log:ef,...!1`, so the guard folds to false and no `authorization` dep exists. The `devAuthorization` module still ships in `[root-of-the-server]__027k0ohra5rgo._.js`, but nothing can reach it.
- `pnpm test:db`: CI-only, not run (no DB change).

### Acceptance criteria
(judged against the plan's slice-1 mapping; the browser half of ticket AC1 belongs to SIM-028.1)
- [x] 1 (slice 1) A file token signs `/api/*` requests. Evidence: `src/server/http/dev-token.test.ts` › "returns Bearer <file token> for a same-origin localhost /api request"; `with-auth.test.ts` › "verifier gets the dep result, not the client header". Both pass. The curl check is Ming's (after M-1).
- [x] 2 The token never reaches the browser. Evidence: the bundle scan and the folded guard above. Code reading: `with-auth.ts` passes the dev result only to `d.verifier.verify(...)`, and `./dev-token` is loaded only through `await import()` inside the guard.
- [ ] 3 The dev server must listen on loopback. FAILED, see Issue 1. The same-origin, `/api/*`, Host and Origin checks and the drop of the client `Authorization` header are covered by `token.test.ts` › devAuthorizationFor cases, and those pass.
- [x] 4 Script secrets and the token path. Evidence: `scripts/dev-token.test.ts` › "signs in, … never prints secrets", "tokenFilePath default and override", "assertOutsideRepo …", "writeTokenFile … atomically", "refuses a token file inside the repo". Code reading: the password exists only in the `/auth/login` body (`scripts/dev-token.mjs` run()), never in argv, env or a file.
- [x] 5 Missing/malformed/expired token gives one warning and a 401; a refreshed file needs no restart. Evidence: `token.test.ts` › parseDevToken and createWarnOnce; `dev-token.test.ts` › "two requests with a missing file warn once…" and "a rewritten file is picked up on the next call"; `with-auth.test.ts` › "dep returning null -> 401 …".
- [x] 6 Checks green; new logic has tests (see above).

Ming verification after merge (from plan.md, carry these into the PR):
1. In PowerShell run `pnpm dev:token --org <uuid>`. Check that the password stays hidden and that Ctrl-C leaves the terminal usable.
2. Run `pnpm dev` (banner shows 127.0.0.1). `curl -i http://localhost:3000/api/me` should answer 200. Delete the file: the next call answers 401 with one warning. Re-run the script: 200 again without a restart.
3. From another device on the LAN, `http://<pc-ip>:3000` should not connect.
4. Report the token lifetime the script prints.
5. (SIM-028.1) In the browser, the app is signed in and the network log has no request to `api.mmlabs.online`.

### Issues
#### Issue 1 — 🔴 blocker — security / AC3 (loopback bind can be bypassed)
- **Where**: `scripts/dev.mjs:15-30` (`nextDevArgs`), and `scripts/dev.test.ts:28` (refusal cases)
- **Expected**: `pnpm dev` refuses every non-loopback hostname that Next's CLI accepts (AC3 "refuses to run unless the dev server listens on loopback"; plan Approach step 5).
- **Actual**: Next's commander also accepts the attached short-option form `-H<value>`. `nextDevArgs` checks only `-H`, `--hostname` and `--hostname=`, so it passes `-H0.0.0.0` through. Because no other `-H` was seen, it also prepends `-H 127.0.0.1`, and commander takes the last value. Reproduced with Next's own `next/dist/compiled/commander`:
  `["-H0.0.0.0"] -> ["dev","-H","127.0.0.1","-H0.0.0.0"] hostname: 0.0.0.0` (the same happens for `["-H","127.0.0.1","-H0.0.0.0"]`).
  The server then listens on all interfaces with `NEXT_PUBLIC_SIMAP_DEV_TOKEN=1`. The Host allowlist does not help here, because a LAN client can send `Host: localhost:3000` itself. Any device on the LAN would then get API access as Ming's identity.
- **Fix instruction**: In `nextDevArgs`, add a branch for `a.startsWith("-H") && a.length > 2`: validate `a.slice(2)` against `ALLOWED` (throw `REFUSED` otherwise), set `hasHost = true` and push `a`. Add these cases to the refusal test in `scripts/dev.test.ts`: `["-H0.0.0.0"]`, `["-H", "127.0.0.1", "-H0.0.0.0"]` and `["-H192.168.1.5"]` throw. Add `["-H127.0.0.1"]` to the kept cases. Record the change in impl-log.

### Rules (CLAUDE.md)
- R1: no violations. `src/server/http/dev-token.ts` starts with `import "server-only"`; `src/lib/dev-token/token.ts` is pure; check:layers is green.
- R3: no secrets in code or logs. The warnings never include the token (tested). `.env.example` could not be read (agent permission deny on `.env*`), so I could not verify the four appended names. Ming: please eyeball the tail of the file (+10 lines in the diff stat).
- R4: every changed file is in the plan's file list, or is loop bookkeeping (`work/ming-todo.md` M-11 tick, ticket.md, plan/consult/impl-log).
- R5: new logic has tests; checks green.
- R2, R6: not applicable (no schema change; the token still goes through the full verifier and the org claim).

### Blockers from review agents
None (filled in by the orchestrator if security-review.md reports any).

### Nits (do not block)
- `src/server/http/dev-token.ts` `tokenFilePath(process.env)`: Next loads `.env.local` into the server's env, but `pnpm dev:token` does not read it. If someone sets `SIMAP_DEV_TOKEN_FILE` in `.env.local`, the script and the server would use different files. A README line saying "set it in the shell, not in `.env*`" would prevent that.
- `createWarnOnce` keys on the last warning only, so requests that alternate between refused and missing warn on every switch. This is acceptable for dev.

### Follow-ups (out of scope)
- Add the AC2 `.next/static` scan to CI (already planned as `pnpm check:dev-bundle` in SIM-028.1).

## Attempt 2 — 2026-11-21
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check`: exit 0, "All matched files use the correct format."
- `pnpm typecheck`: exit 0. `pnpm check:layers`: exit 0, "check-layers: 211 files, no violations".
- `pnpm test`: exit 0, "Test Files 82 passed (82); Tests 775 passed | 3 skipped (778)". This matches impl-log. The count is unchanged because the new cases were added inside the existing `it` blocks in `scripts/dev.test.ts`.
- `pnpm build`: exit 0. AC2 bundle scan `grep -rlE "dev-token|dev:token|\.config/simap|SIMAP_DEV" .next/static` found nothing (exit 1).
- `pnpm test:db`: CI-only, not run (no DB change).

### Attempt 1 blocker (Issue 1, attached `-H` forms)
Fixed. `scripts/dev.mjs:26-31` now checks every short-option argument that contains `H` (`-H<host>`, `-H=<host>`, and clusters such as `-pH…`). The value after `H` must be in `ALLOWED`; otherwise the launcher refuses to start. When it cannot parse the argument, it refuses.
I fed the launcher output to Next's own `next/dist/compiled/commander`, using the same `dev` option shape:
- Refused: `-H0.0.0.0`, `-H=0.0.0.0`, `-H 127.0.0.1 -H0.0.0.0`, `-pH0.0.0.0`, `-- -H0.0.0.0`, `--hostname 0.0.0.0`, `-H localhost --hostname=0.0.0.0`.
- Allowed: `-H127.0.0.1` gives hostname 127.0.0.1, `--port 4000` gives 127.0.0.1 (prepended), `[]` gives 127.0.0.1.
Next's `dev` command defines `-H, --hostname` with no `.env()` binding (node_modules/next/dist/bin/next:203), so no env var can override the host. Tests: `scripts/dev.test.ts` adds the requested refusal cases and the kept case `-H127.0.0.1`, and they pass.

### Acceptance criteria
- [x] 1 (slice 1), 2, 4, 5, 6: unchanged since Attempt 1. The evidence is the same tests, still green, plus the bundle scan re-run above.
- [x] 3 The dev server listens on loopback. Evidence: see the blocker section above. The Host, Origin and same-origin checks are still covered by `token.test.ts` › devAuthorizationFor and pass.

Ming verification after merge: the 5 items listed in Attempt 1 still apply. Carry them into the PR.

### Rework diff (f3f772c)
- `scripts/dev.mjs`, `scripts/dev.test.ts`: the fix above.
- `scripts/dev-token.mjs`: two optional hardening edits from security-review. Both are in a planned file, so no scope issue.
  - `assertOutsideRepo` now treats only `..` or `..<sep>` as outside. Before, a sibling named `..foo` was misread as outside.
  - `writeTokenFile` removes a stale `.tmp` file, then writes with `flag: "wx"`.
  Existing assertOutsideRepo and writeTokenFile tests still pass.
- No out-of-plan files, no High path the plan did not name.

### Rules (CLAUDE.md)
- R1, R3, R4, R5: no violations. R2 and R6 do not apply. (The Attempt 1 note about `.env.example` still stands: an agent cannot read it.)

### Blockers from review agents
None. security-review.md reports no blockers. The orchestrator fills in any new ones.

### Nits (do not block)
- `scripts/dev-token.test.ts`: no test covers the `..foo` sibling case that the new `assertOutsideRepo` check fixes, e.g. a file at `<repo>/..foo/t`, which should throw.
- `-H=127.0.0.1` is accepted, but commander reads its value as `=127.0.0.1`, so Next fails to bind. This fails safe and is harmless.
- The two nits from Attempt 1 still apply.

### Follow-ups (out of scope)
- Same as Attempt 1: add the `.next/static` scan to CI (SIM-028.1).

## Attempt 3 — 2026-11-21
Verdict: REWORK

### Checks (run by reviewer)
- `pnpm format:check`: exit 0, "All matched files use the correct format."
- `pnpm typecheck`: exit 0. `pnpm check:layers`: exit 0, "check-layers: 223 files, no violations".
- `pnpm test`: exit 0, "Test Files 86 passed (86); Tests 810 passed | 3 skipped (813)". This matches impl-log. `scripts/dev.test.ts` alone: 9 passed.
- `pnpm build`: exit 0. AC2 bundle scan `grep -rlE "dev-token|dev:token|\.config/simap|SIMAP_DEV" .next/static` found nothing (exit 1).
- `pnpm test:db`: CI-only, not run (no DB change).

### Security-review Attempt 2, finding 1 (host flag taken as another option's value)
Fixed. `scripts/dev.mjs` `nextDevArgs` now always returns `[..., "-H", "127.0.0.1"]` last, and `hasHost` is gone. User host flags are still validated.
I fed the launcher output to Next's bundled `next/dist/compiled/commander`, with the same `dev` option shape as `node_modules/next/dist/bin/next:203` (scratch script outside the repo). The final `options.hostname` was `127.0.0.1` for all of these:
- `[]`, `--port 4000`, `-H localhost`, `--hostname=::1`, `-- -H localhost`
- `--experimental-https-key --hostname=localhost`, `--experimental-https-cert -Hlocalhost`
- `--experimental-upload-trace -H localhost`, `--experimental-https-ca --hostname localhost`, `-p -H localhost`

These were refused: `-H 0.0.0.0`, `-H0.0.0.0`, `--experimental-https-key --inspect=0.0.0.0:1`. Tests: `scripts/dev.test.ts:19-27` covers the three cases security-review asked for and passes.

### Security-review Attempt 2, finding 2 (non-loopback inspector)
- **Args: fixed.** The commander run shows these are accepted: `--inspect` (true), `--inspect 9229`, `--inspect 127.0.0.1:9229` and `--inspect=localhost:9229`. These are refused: `--inspect 0.0.0.0:9229`, `--inspect=0.0.0.0`, `--inspect 0.0.0.0` and `--inspect somedir`. The launcher reads an optional value the same way commander does: it takes the next token unless that token starts with `-`. Tests: `scripts/dev.test.ts:29-55`.
- **NODE_OPTIONS: not fully fixed. See Issue 1.** `--inspect*` with a non-loopback value is refused (`--inspect=0.0.0.0`, `--inspect-brk=…`, `--inspect-port=…`, `--inspect-wait=…`, `--inspect 0.0.0.0`). Node's alias `--debug-port` is not checked.

### Acceptance criteria
- [x] 1 (slice 1), 2, 4, 5, 6: unchanged since Attempt 1. The same tests are still green, and the bundle scan was re-run above.
- [ ] 3 Loopback only. The dev server bind is fixed (see above), but the inspector is not fully covered. See Issue 1.

Ming verification after merge: the 5 items listed in Attempt 1 still apply. Carry them into the PR.

### Issues
#### Issue 1 — 🟡 should-fix (Ming asked for it before merge, so it blocks this rework) — security
- **Where:** `scripts/dev.mjs:22` (`/^--inspect[\w-]*(?:=(.*))?$/`).
- **Expected:** a non-loopback inspector address in `NODE_OPTIONS` is refused under any spelling Node accepts.
- **Actual:** `assertNodeOptionsSafe({ NODE_OPTIONS: "--inspect --debug-port=0.0.0.0:9229" })` is accepted.
  - `--debug-port` is Node's alias for `--inspect-port`, and Node 22 allows it in `NODE_OPTIONS`. I checked this on loopback: `NODE_OPTIONS="--inspect --debug-port=127.0.0.1:9339" node -e "…inspector.url()"` printed `ws://127.0.0.1:9339/…`, so Node uses the alias's host.
  - `devEnv` passes `NODE_OPTIONS` on unchanged, so the long-lived Next parent process opens its inspector on 0.0.0.0:9229.
  - `next-dev.js:378-389` rewrites only `inspect` / `inspect-brk` for the forked child and keeps `debug-port`.
- **Fix instruction:**
  - Change the regex at l.22 to `/^--(?:inspect[\w-]*|debug-port)(?:=(.*))?$/`.
  - In `scripts/dev.test.ts:90-96`, add `"--inspect --debug-port=0.0.0.0:9229"` and `"--debug-port=0.0.0.0"` to the refuse list.
  - In the accept list, add `"--inspect --debug-port=127.0.0.1:9230"`.
  - Nothing else.

### Rules (CLAUDE.md)
- R1, R3, R4, R5: no violations. R2 and R6 do not apply.
- Scope: commit 317418d touches `README.md`, `scripts/dev.mjs`, `scripts/dev.test.ts`, `scripts/dev-token.test.ts` and `impl-log.md`. All are in the plan's file list; `README.md` is listed there too, so impl-log's "out-of-plan" entry is not needed. No High path changed in this attempt.

### Blockers from review agents
None new. The orchestrator fills in any new ones.

### Nits (do not block)
- A user's loopback choice (`-H localhost`, `--hostname=::1`) is now always overridden by the trailing `-H 127.0.0.1`. README step 4 says so, and the result is safe. The keep-and-validate branches could be simplified later.
- The `<repo>/..foo/t` regression test from the Attempt 2 nit is added (`scripts/dev-token.test.ts:117-119`). Done.
- `assertNodeOptionsSafe` refuses a quoted loopback value such as `--inspect="127.0.0.1:9229"`. This fails safe.

### Follow-ups (out of scope)
- A launcher check cannot protect `pnpm` or the launcher's own Node process: Node opens a `NODE_OPTIONS` inspector at startup, before any script code runs. Mention in README that `NODE_OPTIONS` must not set a non-loopback inspector.
- Same as earlier attempts: add the `.next/static` scan to CI (SIM-028.1).
