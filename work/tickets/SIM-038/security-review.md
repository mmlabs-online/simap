## Attempt 1

## Security review: SIM-038, attempt 1

**Verdict: no blockers. PASS from the security side.** There is one 🟡 (a stale comment) and a few 🟢 notes. I had no shell in this session, so I did not run `git diff` or `pnpm test`. I reviewed the three changed files as they are on the branch. I did not read any `*.env` file.

Files reviewed:
- /home/user/simap/deploy/deployment-repo/.github/workflows/deploy-simap.yml
- /home/user/simap/deploy/deployment-repo/README.md (lines 31-37)
- /home/user/simap/scripts/deploy-envfile.test.ts
- /home/user/simap/src/server/drive/config.ts (read only to cross-check the env names and the folder regex)

### Findings

🔴 None.

🟡 **deploy-simap.yml:83-84, stale step comment.** The comment above `envfile` still says "Writes DATABASE_URL to the host env file. The password is never printed (no echo, no argv)." The step now also writes the four Google Drive values. There is no security risk, but whoever audits this file later will rely on that comment as the claim about what gets written and what is never printed.
Fix: change it to "Writes DATABASE_URL and, when all four are set, the Google Drive values to the host env file. No secret value is ever printed (no echo, no argv). If this fails, the old file stays and nothing is started." Note that this file is a byte copy, so apply the same edit to the production workflow too.

🟢 **Secret values are never printed, logged or put in argv (yml:89-135).**
- Secrets come in only through the `env:` block of the `envfile` step. They are not used in any other step, and no `${{ }}` appears inside a `run:` block, so there is no template injection. The test at test.ts:227 checks this.
- The values are only touched by bash builtins: `${!n}`, `[[ =~ ]]` and `printf ... >> "$tmp"`. No external process gets a value in its argv. There is no `set -x`.
- Both error paths, the all-or-none message (yml:109) and the format message (yml:123), print only `SIMAP_*` names.

🟢 **All-or-none and format checks (yml:103-126).**
- Partial sets fail with exit 1 before any file is written.
- The regexes are anchored, and their character classes exclude newline, `=`, quotes, `$` and spaces. That blocks injecting an extra line into the env file and blocks compose interpolation through `$`.
- The folder regex `^[A-Za-z0-9_-]{10,200}$` matches `DRIVE_ID_RE` at src/server/drive/config.ts:20.
- The env names match the names the app reads (config.ts:13-16).

🟢 **File modes and atomic write (yml:94-139).**
- `umask 077`, then `install -d -m 700`, then `mktemp` in the target directory, then `chmod 600`, then `mv -f`, which is an atomic replace.
- A `trap` removes the temp file on failure, and the `$HOME` prefix guard is still there.
- A replaced file always ends up mode 600, even if the old file was more permissive.

🟢 **Test fixtures use only fake values (test.ts:43-51, 157-163).**
- Every value is visibly fake: `fake-client-0001...`, `fakeSecret_0001`, `1//fake-refresh_token-0001`, `fakeFolderId_0001`, `fakepassword...`.
- The child process gets a minimal env (PATH, HOME and test variables only; `process.env` is not spread), so no real secret from CI can leak into it.
- The tests check that no value appears in stdout or stderr, that the mode is 600, that no temp file is left behind, that the old file is unchanged on failure, and that all 14 partial subsets fail.
- A static check limits secret use to the four `SIMAP_*` secrets, and only in the `envfile` env block.

🟢 **README.md:31-37** names only the secrets, never values, and says to run `workflow_dispatch` from `main` after any change. It says nothing about rotating or revoking the Google credentials; see the follow-ups.

### Follow-ups (out of scope)
- The runner is self-hosted on a personal macOS host. While the `envfile` step runs, its secrets are in that process's environment, so other processes running as the same user could read them. That is an existing trust boundary, not new in this diff, but worth a line in ops docs.
- Add a rotation note to the README: if the refresh token or client secret ever leaks, revoke it in the Google Cloud console and Google account permissions, update the repository secrets, then dispatch the workflow. Removing the values from the env file is not enough.
- Confirm that apps/simap/compose.yml in the deployment repo gives the `simap` service, and not the `migrate` service, the env file via `env_file`. The `migrate` container does not need the Drive credentials. This was not in the diff, so I did not verify it.
