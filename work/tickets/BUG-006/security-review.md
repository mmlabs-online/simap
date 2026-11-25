# Security review — BUG-006

## Attempt 1

BUG-006 security review: PASS. No blockers and no should-fixes.

Files: d:\project\simap-game-ui\.github\workflows\ci.yml (lines 90-109) and d:\project\simap-game-ui\deploy\deployment-repo\apps\simap\compose.yml (lines 16 and 28).

**🟢 Safety check still fails closed — ci.yml:96, 100, 102-104**
- `prod=/Users/mingming/.config/simap` (line 96) matches the real path at compose.yml:28 (`env_file: /Users/mingming/.config/simap/simap.env`).
- The sed at line 100 has the `g` flag, so it rewrites both occurrences: the env_file line and the comment at compose.yml:16.
- Line 102 then runs `grep -qF "$prod"` on the copy. `-F` makes it a fixed-string match, so the dots in `.config` match literally. Any surviving occurrence of the prefix fails the step with `exit 1`. That includes a future `$prod/release.env` line or any other file under that directory.
- The new check is narrower than the old `/Users/mingming` one only in the intended way: it no longer trips on `$RUNNER_TEMP` sitting under the runner user's home, which was the false positive.

**🟢 The rewrite is still verified positively — ci.yml:101**
`grep -qF "env_file: $d/simap.env"` fails the step if the sed did not substitute. So a compose path change can't slip through as "nothing left to find".

**🟢 No production file is read or written — ci.yml:95-109**
- All writes go to `$RUNNER_TEMP/compose-ci`: `release.env`, `simap.env`, `compose.yml`.
- The only file read is the repo copy of compose.yml.
- `docker compose ... config --quiet` only renders the config. It creates and stops nothing.
- `-p simap-ci` keeps it off the production project name.
- The values are dummies (`ci:ci` database URL, zero digest), so no secret is involved.

**🟢 No sudo, and no `${{ }}` in run blocks — ci.yml:88-117**
- No sudo anywhere.
- The only `${{ }}` uses in the file are at lines 16, 17 and 85. All three are in `concurrency`/`with:` keys, not inside `run:`.
- The run blocks use the shell env vars `$GITHUB_RUN_ID` and `$RUNNER_TEMP`.

**💭 Note (not a defect) — ci.yml:100**
The sed pattern is an unescaped regex, so the `.` in `.config` and `.env` matches any character. This can only make the match wider, never narrower. The `-F` check at line 102 is the real gate, so no action is needed.

Follow-ups: none.
