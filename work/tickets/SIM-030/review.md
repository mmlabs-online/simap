## Attempt 1 — 2026-11-21
Verdict: REWORK

### Checks (run by reviewer)
- `pnpm format:check` — exit 0; "All matched files use the correct format" (270 files).
- `pnpm typecheck && pnpm check:layers` — exit 0; "check-layers: 223 files, no violations".
- `pnpm test` — exit 0; Test Files 89 passed (89); Tests 886 passed, 3 skipped (889). Matches impl-log.
- `pnpm build` — exit 0.
- `pnpm test:db` — not run (CI-only, needs Postgres); this ticket changes no schema or query.
- AC7 scan over the build output (`.js`, excluding `.next/cache`) — **not empty**: `.next/server/chunks/[root-of-the-server]__027k0ohra5rgo._.js` and its copy under `.next/standalone/.next/server/chunks/`. No hit in `.next/static`.

### Acceptance criteria
- [x] AC1 Other-org file: no header, one `wrong_org` warning without the token, 401 — evidence: `dev-token.test.ts` › "pin: other-org file gets no header and warns once without the token"; `token.test.ts` › "pin: other, missing and non-string org are wrong_org"; `with-auth.test.ts:75` (null header gets 401). All pass.
- [x] AC2 Fresh org A token works on the next request, any letter case — evidence: `dev-token.test.ts` › "pin: swap B to A recovers on the next request, no restart"; `token.test.ts` › "pin: comparison ignores case". An uppercase claim is then refused by the verifier, as Ming approved (Decision 1).
- [x] AC3 Child gets the checked org and a `.env*` value cannot replace it — evidence: `dev-prod.test.ts` › "child gets the checked org as the pin", "pin is the org checked at startup, after a dev:token refresh too", "pin replaces an inherited value in any letter case". Reviewer script against the real `@next/env` with throwaway files: all 4 files × 3 key casings (`SIMAP_DEV_EXPECTED_ORG`, lowercase, mixed) gave "pin kept". Control without a pin: the file value does load, including the lowercase key on Windows, so the harness can detect a replacement.
- [x] AC4 Four `.env*` files refuse with exit 2 before the prompt, value not printed — evidence: `dev-prod.test.ts` › "each of the four .env files setting SIMAP_DEV_ORG: exit 2, no prompt, value not printed"; `scripts/dev-prod.mjs` runs the check before `ask(...)`.
- [x] AC5 Non-UUID `org` is no org — evidence: `dev-prod.test.ts` › "non-UUID org claims are no org: no start, not printed", `tokenOrg` › "agrees with isCanonicalUuid".
- [x] AC6 Plain `pnpm dev` unchanged and Checks green — evidence: `token.test.ts` › "no pin: any org passes as before"; `dev-token.test.ts` › "no pin: behaves as before"; Checks above.
- [ ] AC7 (plan) `rg -l "SIMAP_DEV_EXPECTED_ORG" .next/static .next/server` prints nothing — **FAILED as written**, see Issue 1. The second half holds: `src/server/http/with-auth.ts` has no diff against `origin/main`.

### AC7 judgment: is the code reachable in a production build?
**Not reachable. The AC as written still fails.**

- All 6 compiled copies of the `with-auth` deps (3 in `.next/server`, 3 in standalone) contain `memberGate:…,log:…,...!1`: the `NODE_ENV === "development" && …` guard at `with-auth.ts:111-115` is folded to false, and the `authorization` dep is gone.
- The pin is in module 54690. Its only references are its own definition and the async loader module 12929.
- Module 12929 is defined in the loader chunks, and no compiled code calls it. All 3 distinct contexts of the id in `.next/server` are definitions.
- No file outside the pin's chunk contains `devAuthorization`.

So the pin has no runtime effect in `next build` output, and the ticket's risk note holds in substance. There is no security exposure. The implementer's reachability claim is correct, and recording rather than widening followed plan step 3. But the plan's check is a literal empty scan and it prints a file, so this criterion has no passing evidence. It can be met with one line in a file the plan already lists (Issue 1).

### Issues
#### Issue 1 — 🔴 blocker — acceptance criterion AC7 not met
- **Where**: `src/server/http/dev-token.ts:51`
- **Expected**: After `pnpm build`, a scan for `SIMAP_DEV_EXPECTED_ORG` in `.next/static` and `.next/server` prints nothing.
- **Actual**: The name is in `.next/server/chunks/[root-of-the-server]__027k0ohra5rgo._.js`, because the dead dev-token module is still emitted and reads the variable unconditionally.
- **Fix instruction**: Replace the third argument at `dev-token.ts:51` with
  `process.env.NODE_ENV !== "production" ? process.env.SIMAP_DEV_EXPECTED_ORG : undefined`.
  Use `!== "production"`, not `=== "development"`: Vitest runs with `NODE_ENV=test`, so the stricter form would disable the pin in the tests. Keep the read uncached, change nothing else. Run all Checks, then the AC7 scan, and paste its result in impl-log. The reviewer has not built this change. If the name still appears after the build, do not try other ways to hide the string (no computed env keys): record the result and stop, so Ming can decide whether to amend AC7 to "not reachable".

### Rules (CLAUDE.md)
No violations found. R1: `check:layers` is green and the pure logic is in `src/lib`. R3: the pin has no `NEXT_PUBLIC_` prefix, no hit in `.next/static`, and the warning contains no token or org value. R4: every product file is in the plan's list. `work/ming-todo.md` (M-14) comes from the orchestrator's plan-gate commits `2593020` and `8991aa6`, not from the implementer. R5: blocked only by AC7 above. R6: org scope still comes from the verified token (`with-auth.ts:57-71`).

### Blockers from review agents
None at the time of writing: no `security-review.md` exists for this ticket yet. The `security` area and `src/server/` paths trigger `security-ai-generated-code-auditor`.

### Ming verification after merge
Needs M-3 and the real tunnel (not verified by the reviewer):
1. Run `pnpm dev:prod` for org A.
2. In a second terminal run `pnpm dev:token --org B`. The next `/api/me` is 401 with one `[dev-token]` warning.
3. Run `pnpm dev:token --org A`. The next `/api/me` is 200 without a restart.

### Nits (do not block)
- `README.md` step 3: the sentence "Then it asks for the password…" stays on a long line after the new text; the formatter accepts it.
- impl-log "Diff size: see `git show --stat`" could state the number.

### Follow-ups (out of scope)
- Keep the dev-token module out of the production bundle altogether, so the dead chunk and its loader chunks are not emitted.

### Blockers from review agents
- None. security-review.md Attempt 1 is PASS with no 🔴 or 🟡. Its Windows check was run and printed `true`.
