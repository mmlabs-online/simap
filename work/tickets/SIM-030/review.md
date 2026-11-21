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

## Attempt 2 — 2026-11-21
Verdict: REWORK

No code rework is requested. The only open item is AC7's wording, which is a decision for Ming (Issue 1).

### Checks (run by reviewer)
Run at `2b88384`, working tree clean.
- `pnpm format:check` — exit 0; "All matched files use the correct format" (270 files).
- `pnpm typecheck && pnpm check:layers` — exit 0; "check-layers: 223 files, no violations".
- `pnpm test` — exit 0; Test Files 89 passed (89); Tests 886 passed, 3 skipped (889). Matches impl-log.
- `pnpm build` — exit 0; `.next/BUILD_ID` written 05:06:28Z, after this review's run started at 05:06:10Z.
- `pnpm test:db` — not run (CI-only, needs Postgres); this ticket changes no schema or query.

### Attempt 1 issue
The requested fix is in place at `src/server/http/dev-token.ts:51`, and it removed the name from all compiled code. In the built chunk the argument is folded to `c=void 0`. Issue 1 of Attempt 1 is fixed in code, but the literal AC7 scan still prints one file.

### AC7 scan (fresh build)
| Scope | Result |
|---|---|
| `rg -l SIMAP_DEV_EXPECTED_ORG .next/static .next/server` (the AC7 command) | **1 hit**: `.next/server/chunks/[root-of-the-server]__027k0ohra5rgo._.js.map` |
| Same scan, excluding `*.map` | no hit |
| `.next/static` | no hit; contains 0 `.map` files |
| `.next/standalone`, following symlinks | no hit |
| `public` | no hit |

- The hit is the map's embedded original source for `src/server/http/dev-token.ts` (one occurrence).
- **That map does not ship in the standalone output.** The matching `.js` is in `.next/standalone/.next/server/chunks/` and is byte-identical (`cmp` exit 0), but its `.js.map` is not there. The other 24 maps under standalone do not contain the name.
- The `Dockerfile` runtime stage copies `.next/standalone`, `.next/static`, `public` and the `db` files, not `.next/server`, so the map should not reach the image. No image was built in this review.
- The chunk's `sourceMappingURL` comment remains, and in standalone it points to a file that is not there.

### Acceptance criteria
- [x] AC1 Other-org file: no header, one `wrong_org` warning without the token, 401 — evidence: `dev-token.test.ts` › "pin: other-org file gets no header and warns once without the token"; `token.test.ts` › "pin: other, missing and non-string org are wrong_org"; `with-auth.test.ts` passes.
- [x] AC2 Fresh org A token works on the next request, any letter case — evidence: `dev-token.test.ts` › "pin: swap B to A recovers on the next request, no restart"; `token.test.ts` › "pin: comparison ignores case". An uppercase claim is then refused by the verifier, as Ming approved (Decision 1).
- [x] AC3 Child gets the checked org and a `.env*` value cannot replace it — evidence: `dev-prod.test.ts` › "child gets the checked org as the pin", "pin is the org checked at startup, after a dev:token refresh too", "pin replaces an inherited value in any letter case". The `@next/env` check from Attempt 1 still applies: this rework did not touch that path.
- [x] AC4 Four `.env*` files refuse with exit 2 before the prompt, value not printed — evidence: `dev-prod.test.ts` › "each of the four .env files setting SIMAP_DEV_ORG: exit 2, no prompt, value not printed".
- [x] AC5 Non-UUID `org` is no org — evidence: `dev-prod.test.ts` › "non-UUID org claims are no org: no start, not printed", and the `tokenOrg` parity test.
- [x] AC6 Plain `pnpm dev` unchanged and Checks green — evidence: `token.test.ts` › "no pin: any org passes as before"; `dev-token.test.ts` › "no pin: behaves as before"; Checks above.
- [ ] AC7 (plan) `rg -l "SIMAP_DEV_EXPECTED_ORG" .next/static .next/server` prints nothing — **FAILED as written, on the source map only**, see Issue 1. The second half holds: `src/server/http/with-auth.ts` has no diff against `origin/main`.

### Issues
#### Issue 1 — 🔴 blocker — AC7 wording does not match what it protects (decision for Ming)
- **Where**: `work/tickets/SIM-030/plan.md:43`; the hit is in `.next/server/chunks/[root-of-the-server]__027k0ohra5rgo._.js.map`.
- **Expected**: The AC7 command prints nothing.
- **Actual**: It prints the source map above. No compiled code and no standalone file contains the name, so the pin has no effect in `next build` output and this is not a security exposure.
- **Fix instruction**: **Implementer: change nothing. Do not obfuscate the name, compute the env key, or strip maps.** Ming chooses one:
  1. **Amend AC7 (reviewer's recommendation).** Accurate wording:
     > After `pnpm build`, `SIMAP_DEV_EXPECTED_ORG` appears in no compiled file under `.next/static` or `.next/server` and nowhere in `.next/standalone`. A build-only source map under `.next/server` may embed the original source.

     Verification: `rg -uu -l -g '!*.map' SIMAP_DEV_EXPECTED_ORG .next/static .next/server` and `rg -uu -L -l SIMAP_DEV_EXPECTED_ORG .next/static .next/standalone` both print nothing. Both were run on this build and printed nothing, so AC7 passes at this commit once Ming approves the wording.
  2. **Keep AC7 as written.** The dev-token module must then leave the production bundle, which is a separate change to the build or import path and needs its own plan.

### Rules (CLAUDE.md)
No violations found. R1: `check:layers` is green. R3: no name in client or standalone output, and no token or org value in the warning. R4: Attempt 2 changed only `dev-token.ts:51`, as Attempt 1 instructed, plus work files. R5: blocked only by AC7 above. R6: org scope still comes from the verified token, and `with-auth.ts` is unchanged.

### Blockers from review agents
None. `security-review.md` Attempt 2 is PASS with no 🔴, 🟡 or 🟢 findings. It covers the High-path change in `65a91b7` by reading code; it did not run the app or inspect compiled output.

### Ming verification after merge
Needs M-3 and the real tunnel (not verified by the reviewer):
1. Run `pnpm dev:prod` for org A.
2. In a second terminal run `pnpm dev:token --org B`. The next `/api/me` is 401 with one `[dev-token]` warning.
3. Run `pnpm dev:token --org A`. The next `/api/me` is 200 without a restart.

### Nits (do not block)
- `ticket.md` still shows `Attempts | 1` in the field table; the orchestrator owns that field.

### Follow-ups (out of scope)
- Keep the dev-token module out of the production bundle altogether, so neither the dead chunk nor its source map is emitted.

## Attempt 3 — 2026-11-21
Verdict: PASS

AC7 is judged against the wording Ming chose (option 1, ticket `## Notes / answers from Ming`, 2026-11-21).

### Checks (run by reviewer)
Run at `87d5ceb` on `ticket/SIM-030`, working tree clean.
- `pnpm format:check` — exit 0; "All matched files use the correct format" (270 files).
- `pnpm typecheck && pnpm check:layers` — exit 0; "check-layers: 223 files, no violations".
- `pnpm test` — exit 0; Tests 886 passed, 3 skipped (889).
- `pnpm build` — exit 0; `.next/BUILD_ID` written 05:15:29Z, after this run started at 05:15:13Z.
- `pnpm test:db` — not run (CI-only, needs Postgres); this ticket changes no schema or query.

### Product code unchanged since `65a91b7`
- `git diff --name-only 65a91b7 HEAD -- . ':(exclude)work/'` prints nothing. The full diff touches only `work/` files.
- `65a91b7` is no longer an ancestor of HEAD because the branch was rebased; its rebased counterpart is `1daa4cb`. The comparison above is by content, so the rebase does not affect it.

### AC7 scan (fresh build)
| Requirement | Command | Result |
|---|---|---|
| No compiled file under `.next/static` or `.next/server` | `rg -uuu -L -l -g '!*.map' SIMAP_DEV_EXPECTED_ORG .next/static .next/server` | no hit (exit 1) |
| Nowhere in `.next/standalone` (and `.next/static`, maps included) | `rg -uuu -L -l SIMAP_DEV_EXPECTED_ORG .next/static .next/standalone` | no hit (exit 1) |
| Allowed exception: build-only source map under `.next/server` | `rg -uu -l SIMAP_DEV_EXPECTED_ORG .next/static .next/server` | 1 hit: `.next/server/chunks/[root-of-the-server]__027k0ohra5rgo._.js.map` |

- Parsing that map shows the name only in `sourcesContent` for `src/server/http/dev-token.ts`, which is the case the amended wording allows.
- The matching `.js` does not contain the name, and the map does not exist under `.next/standalone`.
- The `Dockerfile` runtime stage (lines 21-23) copies `.next/standalone`, `.next/static` and `public`, not `.next/server`. No image was built in this review.

### Acceptance criteria
- [x] AC1 Other-org file: no header, one `wrong_org` warning without the token, 401 — evidence: `dev-token.test.ts` › "pin: other-org file gets no header and warns once without the token"; `token.test.ts` › "pin: other, missing and non-string org are wrong_org"; `with-auth.test.ts` passes.
- [x] AC2 Fresh org A token works on the next request, any letter case — evidence: `dev-token.test.ts` › "pin: swap B to A recovers on the next request, no restart"; `token.test.ts` › "pin: comparison ignores case". An uppercase claim is then refused by the verifier, as Ming approved (Decision 1).
- [x] AC3 Child gets the checked org and a `.env*` value cannot replace it — evidence: `dev-prod.test.ts` › "child gets the checked org as the pin", "pin is the org checked at startup, after a dev:token refresh too", "pin replaces an inherited value in any letter case". The `@next/env` script from Attempt 1 was not re-run; that code is unchanged.
- [x] AC4 Four `.env*` files refuse with exit 2 before the prompt, value not printed — evidence: `dev-prod.test.ts` › "each of the four .env files setting SIMAP_DEV_ORG: exit 2, no prompt, value not printed".
- [x] AC5 Non-UUID `org` is no org — evidence: `dev-prod.test.ts` › "non-UUID org claims are no org: no start, not printed"; `tokenOrg` › "agrees with isCanonicalUuid".
- [x] AC6 Plain `pnpm dev` unchanged and Checks green — evidence: `token.test.ts` › "no pin: any org passes as before"; `dev-token.test.ts` › "no pin: behaves as before"; Checks above.
- [x] AC7 (amended by Ming) — evidence: the scan table above. The `with-auth.ts` half holds: `git diff origin/main -- src/server/http/with-auth.ts` is empty.

The four test files for these criteria were also run on their own: 69 passed (69).

### Attempt 2 issue
Issue 1 (AC7 wording) is resolved by Ming's decision. No code changed for it.

### Scope
Product files changed against `origin/main`: `README.md`, `scripts/dev-prod.mjs`, `scripts/dev-prod.test.ts`, `src/lib/dev-token/token.ts`, `src/lib/dev-token/token.test.ts`, `src/server/http/dev-token.ts`, `src/server/http/dev-token.test.ts`. All are in the plan's file list, and the High path was named and approved (M-14).

### Rules (CLAUDE.md)
No violations found. R1: `check:layers` is green. R3: the name is in no compiled or standalone file, and the warning holds no token or org value. R4: changes stay in the plan. R5: Checks are green and new logic has tests. R6: org scope still comes from the verified token, and `with-auth.ts` is unchanged.

### Blockers from review agents
None. `security-review.md` Attempt 2 is PASS and still covers this product code, which has not changed since.

### Ming verification after merge
Needs M-3 and the real tunnel (not verified by the reviewer):
1. Run `pnpm dev:prod` for org A.
2. In a second terminal run `pnpm dev:token --org B`. The next `/api/me` is 401 with one `[dev-token]` warning.
3. Run `pnpm dev:token --org A`. The next `/api/me` is 200 without a restart.

### Nits (do not block)
- `ticket.md` still shows `Attempts | 1` and `plan.md` row 7 still has the old AC7 command; the amended wording is in the ticket's Notes.
- The branch is one board-only commit behind `origin/main` (`7386409`, `work/backlog.md`).

### Follow-ups (out of scope)
- Keep the dev-token module out of the production bundle altogether, so neither the dead chunk nor its source map is emitted.
