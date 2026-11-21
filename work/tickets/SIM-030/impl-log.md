## Attempt 1 — 2026-11-21

### Files touched
| File | Required because |
|---|---|
| `src/lib/dev-token/token.ts` | `wrong_org` reason, shared payload decode, `expectedOrg` pin in `devAuthorizationFor` (scope item 2) |
| `src/lib/dev-token/token.test.ts` | pin tests, `wrong_org` in the warning list |
| `src/server/http/dev-token.ts` (High) | passes `process.env.SIMAP_DEV_EXPECTED_ORG` to `devAuthorizationFor` |
| `src/server/http/dev-token.test.ts` (High) | pin tests through real temp files; `jwt` helper takes an optional org |
| `scripts/dev-prod.mjs` | strict `tokenOrg`, `envFileSetsKey`, four-file `SIMAP_DEV_ORG` refusal, pin in `childEnv`, `readEnvFile` dep |
| `scripts/dev-prod.test.ts` | driver takes per-file `.env` text; new tests |
| `README.md` | `## Production database (dev)` steps 1, 3, 4 |

### Tests added / changed
- token.test.ts › "devAuthorizationFor pin (SIM-030)": same org, case-insensitive, other/missing/non-string org, refusal and status first, no pin
- token.test.ts › `wrong_org` added to the reasons list
- dev-token.test.ts › pin: other-org file (one warning, no token); pin: swap B to A recovers; no pin: behaves as before
- dev-prod.test.ts › envFileSetsKey (both keys); tokenOrg agrees with isCanonicalUuid; four .env files refuse (exit 2, no prompt, value not printed); commented/look-alike lines do not refuse; DATABASE_URL only in .env.local; non-UUID claims; child gets the pin; pin after refresh; pin replaces inherited value in any case
- All `.env*` inputs are injected strings.

### Checks (actual output summary)
- format:check: All matched files use the correct format.
- typecheck + check:layers: exit 0; "check-layers: 223 files, no violations"
- test: Test Files 89 passed (89); Tests 886 passed | 3 skipped (889)
- build: exit 0
- AC7 scan `rg -l SIMAP_DEV_EXPECTED_ORG .next/static .next/server` (grep -rl): no hit in `.next/static`; ONE hit in `.next/server/chunks/[root-of-the-server]__027k0ohra5rgo._.js` (+ .map). That chunk is the already-existing dev-token module: `SIMAP_DEV_TOKEN_FILE` is in it too, so it was bundled before this ticket, and the `process.env.NODE_ENV === "development"` guard in with-auth is folded away (no "development" string in the chunk), so it is dead code. The literal AC7 ("prints nothing") therefore cannot hold; the pin has no runtime effect in a production build. Not widened, recorded for the reviewer. `git diff main -- src/server/http/with-auth.ts` is empty.

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- AC7 wording: scan will always hit the dead dev-token chunk; consider a different check (the guard is constant-folded) or moving the dev-token import out of the production bundle.

### Scope self-check
- Could the diff be smaller? No.
- Diff size: see `git show --stat` of the commit.
