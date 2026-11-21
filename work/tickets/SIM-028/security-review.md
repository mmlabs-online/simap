## Attempt 1

## Security review: SIM-028, attempt 1 (read-only)

**Verdict:** no blockers. There is one 🟡 and seven 🟢. I had no Bash access, so I could not run `git diff`, tests or checks. This review comes from reading the new and changed files directly: `scripts/dev-token.mjs`, `scripts/dev.mjs`, `scripts/dev.test.ts`, `src/lib/dev-token/token.ts`, `src/server/http/dev-token.ts`, `src/server/http/with-auth.ts`, `README.md` l.18-40, `Dockerfile`, `.dockerignore`, `next.config.ts` and `.claude/settings.json`. I could not read `.env.example` because the permission deny on `.env.*` blocks it.

### Findings

**🟡 should-fix: the loopback bind can be bypassed with the attached-value form `-H0.0.0.0`**
- **Where:** `scripts/dev.mjs:17-27`.
- **What happens:** `nextDevArgs` checks only the exact tokens `-H` and `--hostname`, plus the `--hostname=` prefix. Next's CLI uses commander (`node_modules/next/dist/bin/next:8`), and commander accepts a short option with the value attached (`-H0.0.0.0`). That token falls into the `else` pass-through branch at l.26-27. `hasHost` stays false, so the launcher puts `-H 127.0.0.1` first and then passes `-H0.0.0.0`. Commander keeps the last value, so the server binds 0.0.0.0 with `NEXT_PUBLIC_SIMAP_DEV_TOKEN=1` set.
- **Why the Host check does not help:** the Host allowlist in `src/lib/dev-token/token.ts:25,56` gives no protection against a LAN client, because the client sets the Host header itself on a direct connection. `curl -H "Host: localhost" http://<pc-ip>:3000/api/me` sends no Origin and no Sec-Fetch-Site, passes every check in `requestRefusal`, and gets Ming's production identity. The bind is the only defence against the LAN, so the launcher must be airtight.
- **Fix:** in `nextDevArgs`, refuse any argument that starts with `-H` but is not exactly `-H`, unless the rest is an allowed host (also covers `-H=...`). Refuse combined short-flag clusters that contain `H`, for example `/^-[^-]*H/` when the argument is not exactly `-H`. Add `-H0.0.0.0`, `-H=0.0.0.0` and `-H192.168.1.5` to the refusal list in `scripts/dev.test.ts:29-35`.

**🟢 note: the plan's wording on the residual risk is wrong**
- **Where:** plan.md "Other assumptions" says that with the flag in `.env.local` plus `pnpm exec next dev`, "the Host allowlist still applies".
- **Correction:** it applies, but it gives no protection against LAN clients (see the finding above). README l.34 ("Never put `NEXT_PUBLIC_SIMAP_DEV_TOKEN` in a `.env*` file") is the real control.
- **Suggestions:**
  - Fix the wording.
  - Optional follow-up: have `scripts/dev.mjs` or `dev-token.ts` refuse to run when any `.env`, `.env.local`, `.env.development` or `.env.development.local` file defines the flag. This is cheap, because Next loads those files into `process.env`.

**🟢 note: the production path is off, verified by reading**
- **Guard:** `src/server/http/with-auth.ts:111-115` uses the inline literal `process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_SIMAP_DEV_TOKEN === "1"`. `next build` inlines it as `production` (the plan cites `define-env.js` l.76), and `next.config.ts` sets no `allowDevelopmentBuild`. Setting `NODE_ENV=development` at runtime on the image does not change the inlined value.
- **Image:** the image runs `node server.js` from the standalone output (`Dockerfile:15,33`). `.dockerignore:11` drops `scripts/`, so neither launcher is in the image.
- **Gap in the AC2 check:** the bundle check (README l.39) only greps `.next/static`. Also grep `.next/standalone` and `.next/server` for `.config/simap` and `[dev-token]`. That confirms the dynamic import was removed from server output and is not merely unreachable. This is defence in depth, not a defect.

**🟢 note: the client Authorization is always dropped and verification is not bypassed**
- `with-auth.ts:57-59`: once the dep is set, `req.headers.get("authorization")` is never read. A `null` from `devAuthorization` goes to `verify(null)` and gives 401.
- The file token goes through the unchanged `d.verifier.verify`. The org comes from the verified claim (l.67-68), and the tier from `orgRoles` (l.69).
- `devAuthorizationFor` (`token.ts:72-80`) does not take the client header as input.
- `verify.ts` has no `log(`/`console.` calls. Errors in the dep are caught at l.87-89 and only an event name is logged.

**🟢 note: Origin, Sec-Fetch-Site and DNS-rebinding checks hold up**
- **DNS rebinding is blocked:** a rebinding page sends `Host: evil.example`, which is refused at `token.ts:56`.
- **Origin parsing is safe:** `Origin: null` or a malformed Origin throws in `new URL` and is refused (l.59-65).
- **Other localhost ports:** a page on another localhost port sends `Sec-Fetch-Site: same-site`, which is refused at l.67. The Origin check ignores the port (l.61 `isLoopbackHost(u.host)`), so a request without Sec-Fetch-Site from another loopback origin passes. Modern browsers always send Sec-Fetch-Site to localhost, so the remaining exposure is non-browser local processes and other OS users on the machine, which README l.35-36 already documents.
- **Not a credential secret:** the token is a production Identity credential, valid against `https://simap.mmlabs.online` for its whole lifetime. It is worth saying this in the README.

**🟢 note: `assertOutsideRepo` has a prefix edge case and ignores symlinks**
- **Where:** `scripts/dev-token.mjs:116`.
- **Prefix case:** `!rel.startsWith("..")` lets a path such as `<repo>/..cache/tok` through (rel `..cache/tok`). Use `rel === ".." || rel.startsWith(".." + sep)`.
- **Symlinks:** `resolve` does not follow symlinks or junctions, so a symlinked directory that points into the repo is accepted. Compare `realpathSync` of the nearest existing parent.
- **Server side:** the server reader (`src/server/http/dev-token.ts:22`) accepts any `SIMAP_DEV_TOKEN_FILE` path. That is acceptable because the content only goes to the verifier and is never echoed.
- **Config mismatch:** Next loads `.env.local` into the server, but the script does not. An override set only in `.env.local` therefore splits script and server across two different paths. That is functional, not a security issue.

**🟢 note: the temporary file has a fixed name**
- **Where:** `scripts/dev-token.mjs:123-125`. `${file}.tmp` is written without an exclusive flag, so a pre-existing symlink at that path would be followed.
- **Risk:** low, since the path is inside the user's own home directory.
- **Fix:** `writeFileSync(tmp, …, { mode: 0o600, flag: "wx" })` after `rmSync(tmp, { force: true })`.
- **Permissions:** `mkdirSync(..., mode 0o700)` only applies to newly created directories, so an existing wider-permission `~/.config/simap` is left as it is. Optionally call `chmodSync(dir, 0o700)` on POSIX.

**🟢 note: no leaks found in output or error messages**
- **Password:** only in the login body (`dev-token.mjs:177`). It is never in argv or env, and the prompt is hidden (l.216-247). A non-TTY run is refused (l.250).
- **Errors:** network errors are swallowed into a fixed message (l.153-154). Identity error codes are allowlisted to `^[a-z_]{1,40}$` (l.84-85). Errors of unknown type print "unexpected error" (l.206).
- **Output:** stdout carries only the path, lifetime and org (l.200-203).
- **Warnings:** server warnings are fixed strings that never interpolate the token or headers (`token.ts:82-99`).

**🟢 note: the agent permission deny covers only the default token path**
- **Where:** `.claude/settings.json:12` denies `Read(~/.config/*/dev-token)`.
- **Not covered:** a file at a `SIMAP_DEV_TOKEN_FILE` override path, the transient `dev-token.tmp`, and shell reads (`cat`, `Get-Content`).
- **Suggestion:** add `Read(~/.config/*/dev-token*)`. A deny for `Bash(*dev-token*)` is optional. (Orchestrator note: permission settings are Ming's call; not changed by any agent.)

### Follow-ups (out of scope)
- Detect the flag in `.env*` files, so the residual case where both bind and Host are open fails closed.
- Extend the AC2 bundle grep to server and standalone output, and add it to CI. Slice 2's `check:dev-bundle` is the natural place.
