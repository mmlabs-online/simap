## Attempt 1 — 2026-11-20
Verdict: PASS

Scope of this review: slice S1 (auth library) only, per Ming's split approval (ticket.md Notes, 2026-11-20). S2
(SIM-006.2) and S3 (SIM-006.3) are not judged here. The ticket's AC1, AC3b and AC4b moved to SIM-006.2.

### Checks (run by reviewer)
Local Node 24.20 with `--config.engine-strict=false` (CI is Node 22). Results match impl-log.md.
- `pnpm format:check` — exit 0, "All matched files use the correct format."
- `pnpm typecheck && pnpm check:layers` — exit 0 (typegen + tsc clean); "check-layers: 95 files, no violations"
- `pnpm test` — exit 0, "Test Files 38 passed (38); Tests 390 passed | 3 skipped (393)". No `.skip`/`.only`/`.todo` in
  any new test file, so the 3 skips predate this change.
- `pnpm build` — exit 0, static pages 8/8; route list unchanged (no new route, as S1 requires).

### Acceptance criteria
- [x] AC2 — token in memory only; renewed before `exp`; two tabs share one renewal — evidence:
  `tokenStore.test.ts` › "never writes anything but mm_account_id; no history or console use" (:211), "caches until
  receivedAt + (expires_in - 60) s" (:96), "caches a 12-hour token until expires_in - 60 s" (:107); `tabs.test.ts` ›
  "two tabs renewing at once -> one /token…" (:78), "tab B waiting on the lock adopts A's broadcast…" (:90), "hidden tab
  skips the timer and renews on visibilitychange" (:258); `fetch.test.ts` › "refuses a path outside /api/ and never puts
  the token in the URL" (:41). Grep for `sessionStorage|document.cookie|console.` in non-test files under
  `src/ui/auth`, `src/lib/identity`, `src/lib/api/fetch.ts`: no matches. All pass.
- [x] AC3a — one re-mint and one retry after a 403; the second 403 ends in `forbidden` — evidence: `fetch.test.ts` ›
  "403 forbidden -> one re-mint, one retry, 200 returned" (:71), "403 then 403 -> exactly one retry, throws forbidden"
  (:77, asserts 2 fetches and 2 getToken calls), "403 org_required is not retried" (:91). Code:
  `src/lib/api/fetch.ts:57-75`.
- [x] AC4a — sign-out in the store ends this tab's session and tells other tabs — evidence: `tokenStore.test.ts` ›
  "signOut broadcasts signedOut before /logout…" (:292), "clears the id, then calls logout with it; getToken is null at
  once" (:338); `tabs.test.ts` › "sign-out in A signs out B (memory, storage, listener), no /logout from B" (:192).
  `tabs.test.ts` is identical to tudocuatui's apart from one import path, so its BUG-007 cases were ported unchanged.
- [x] AC5 — unit tests cover renewal timing, error-code → screen mapping and the retry rule — evidence: timing tests
  above; mapping in `flow.test.ts` (`viewForTokenError` table, `viewForMe`, `initialView`) and `errors.test.ts` (ported
  plus `join_rejected`/`join_queue_full`, and `join_approval_unavailable` → `unknown`, `no_access` never taken from a
  body); retry rule in `fetch.test.ts` (13 cases). All green.
- [x] AC6 — the contract's credentials mode and app header for all ten calls — evidence: `identityClient.test.ts` ›
  "credentials and X-MM-App per call" (:316-349). login/token/accounts/join/logout/resend use `include` + `simap`;
  signup/forgot use `omit` + `simap`; verify-email/reset use `omit` with no header. This matches consumers.md lines
  39-45 and the plan's API contract table. Code: `src/ui/auth/identityClient.ts:56-87`.
- [x] S1 builds alone — all four checks are green, nothing imports the new modules yet, and the route list is unchanged.

Port fidelity: I diffed each file against tudocuatui `origin/main:src/features/auth/*`.
- `accountId`, `fakeTabs`, `authChannel` and `refreshLock` match except the config import.
- `identityClient` differs only in the A13 three-mode `post` and the `join` status return.
- `tokenStore` differs only in the `join()` status and `renewNow`.
- `errors` and `types` differ only in the code swap and the removed view prop types.
- `validation` → `credentials.ts` differs only in the `FieldErrorCode` move (same union as tudocuatui's `copy.ts:5`)
  and the token parsers left for S3.

All of these match plan.md and the impl-log's "Differences" list. Ported tests changed only for the node env
(`vi.stubGlobal`) and for `createRefreshLock({ locks: undefined })` in the tokenStore setup. That matches tudocuatui's
jsdom and CI Node 22, which have no `navigator.locks`; `tabs.test.ts` still uses a fake lock manager.

### Issues
None.

### Rules (CLAUDE.md)
No violations found.
- R1: `check:layers` is clean. `src/lib/**` imports only lib, and `src/ui/auth/**` imports lib and ui.
- R2: no schema change.
- R3: config holds only public values (prod base URL, the public Turnstile site key); no secrets, no `.env*` touched.
- R4: every changed file is in the S1 file list; out-of-plan files: none.
- R5: checks are green and the new logic has tests.
- R6: the client sends no org id.

### Blockers from review agents
- None. `security-review.md` Attempt 1: 0 🔴, 0 🟡, 3 💭.
`**/auth*`).

### Nits (do not block)
- `src/ui/auth/tokenStore.test.ts:247` — `expect(sessionStorage.length).toBe(0)` is now vacuous, because the stub at
  :20 is `{ length: 0 }`. A write would still throw, since the stub has no `setItem`, and the grep shows no
  `sessionStorage` use. A Map-backed stub like the `localStorage` one would bring back the original assertion.
- `src/lib/identity/flow.ts:168` — `viewForMe` maps any status other than 200/401/403/503 (for example a 500
  `internal`) to `noAccess("forbidden")`, so a server fault would read "You don't have permission". The plan specifies
  only 503/network → retry, so this is not a deviation. SIM-006.2 may want 5xx → retry.
- `impl-log.md` Follow-ups names `NEXT_PUBLIC_IDENTITY_BASE`, but plan.md Ming step 1 says
  `NEXT_PUBLIC_MM_IDENTITY_BASE`. SIM-006.2 should use the plan's name.
- `src/lib/identity/config.ts:10` — `DEV_BASE_RE` accepts `https://127.0.0.1/api/v1`, and a localhost port up to
  99999. This is dev-only and harmless, since production ignores the override.

### Follow-ups (out of scope)
- Debt issue for tudocuatui (`project:tudocuatui`): signup and forgot send `credentials: "include"`, but consumers.md
  says `omit` (A13). The orchestrator opens it, as the impl-log says.
- PR tier: High (`src/lib/identity/config.ts` matches `**/config.*`). Ming reviews it; never auto-merged.
- Ming verification after merge: none for S1. The manual sign-in, two-tab and DevTools checks in plan.md come after
  SIM-006.2 and SIM-006.3, and the Ming steps (`.env.example` names, Turnstile hostnames, M-1 origins) are due with
  SIM-006.2.
