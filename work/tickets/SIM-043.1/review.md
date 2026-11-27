# Review — SIM-043.1

## Attempt 1 — 2026-11-27
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format."
- `pnpm typecheck && pnpm check:layers` — exit 0, typegen + tsc clean; "check-layers: 1001 files, no violations"
- `pnpm test` — exit 0, "Test Files 382 passed | 1 skipped (383); Tests 3735 passed | 9 skipped (3744)" (matches impl-log)
- `pnpm build` — exit 0, route table printed, build succeeded
- `pnpm test:db` — CI-only, not applicable (no DB/server change)

### Acceptance criteria
- [x] `parseOrgs` returns `access` per org; missing = `member`; unknown values dropped and do not trigger the
  zero-parsed error — evidence: `src/ui/auth/identityClient.ts:92-102` (`unopenable` counter, check at :102);
  `identityClient.test.ts` › "orgs: access is read from the item or the nested org; missing means member",
  › "orgs: unknown access values are dropped; other orgs in the list still parse" (`"owner"`, `""`, `null`, `5`,
  `"SUPER_ADMIN"`, `" super_admin"`), › "orgs: only unknown-access orgs returns [] without rejecting; only malformed
  orgs still rejects unknown"; existing expectations updated with `access: "member"`. All green.
- [x] Super-admin orgs show a "Support access" badge in the picker and switcher; member orgs look as today — evidence:
  `src/ui/org/OrgPickerView.tsx:39-43`, `src/ui/org/OrgSwitcherDialog.tsx:74-78`, copy `src/ui/copy/org.ts:18-20`;
  `org-views.test.tsx` › "Support access badge (D86)" (both views, badge exactly once, plain list without badge, Current
  marker kept); existing view tests unchanged and green; `orgs.test.ts` › "decideOrg access › keeps access on enter
  and pick; absent stays absent" (`src/lib/identity/orgs.ts:40`).
- [x] A 429 `rate_limited` during background renewal waits at least `Retry-After` before retrying; the current token is
  kept while it lives — evidence: `src/ui/auth/tokenStore.ts:231-239` (delay = max(RETRY_MS, Retry-After), re-arm only
  while `now() + delay < expiresAt`); the `renew` catch (`tokenStore.ts:185+`) never clears `token` for `rate_limited`,
  and the re-arm in test 1 itself proves `token !== null` (the guard requires it). `tokenStore.test.ts` ›
  "background renewal retry delay (D86)": 30 s → `[30_000]` with exactly 2 `/token` calls; 5 s / missing → `[15_000]`;
  120 s → no re-arm; network → `[15_000]`.
- [x] Tests in `identityClient.test.ts`, `tokenStore.test.ts` and the org view tests cover the cases above — the
  tests listed exist and pass.

Ming verification after merge (carry to the PR): with a staff account on the real Identity (after M-90), the picker
lists a non-member org with the "Support access" badge and member orgs without it. Real 429 behaviour after 30
mints/hour cannot be checked locally.

### Implementer deviation (Retry-After test values) — accepted
The plan asked for "Retry-After 120 re-arms at 120 s", but the plan's own guard (`now() + delay < expiresAt`) and
`REFRESH_MARGIN_S = 60` (`tokenStore.ts:60`) make that impossible: background renewal fires at `validUntil` =
`expiresAt - 60 s`, so any delay >= 60 s is past expiry and must not re-arm. The plan contradicted itself; the
implementer kept the planned code and changed only the test values (30 s for the re-arm case, 120 s for the
no-re-arm case), which still prove the `max(RETRY_MS, Retry-After)` rule and the expiry guard. Recorded in impl-log;
no scope change.

### Scope
All changed source files are in the plan's file list; no out-of-plan files; no High path touched (checked against
`.claude/loop.config.md` High paths). Work files only under `work/tickets/SIM-043.1/`.

### Issues
#### Issue 1 — 🟡 should-fix — test name overclaims
- **Where**: `src/ui/auth/tokenStore.test.ts` › "Retry-After beyond the token's expiry does not re-arm; the token is still returned while valid"
- **Expected**: the name matches what is asserted.
- **Actual**: only `rearmed` is asserted; nothing checks the token is still returned. (Note: past `validUntil`,
  `getToken` renews on demand rather than returning the cached token, so the claim is not straightforwardly true.)
- **Fix instruction**: drop "; the token is still returned while valid" from the test name, or add an assertion that
  fits the real behaviour (e.g. the token is not cleared). Not blocking: AC3 "token kept" is evidenced by test 1 and the code.

### Rules (CLAUDE.md)
No violations found. R1: ui files import only `../copy`, `@/lib` types; check:layers clean. D36: copy in
`src/ui/copy/org.ts`. R3/R6/R7: not touched (client only). R4: within plan. R5: checks green, new logic tested.

### Blockers from review agents
None.

### Nits (do not block)
- `parseOrgs` prefers `item.access` whenever it is defined (so `item.access: null` drops the org even if the nested org
  says `super_admin`), unlike the plan's `firstString(item.access, src.access)`. Stricter and fine; consider one line
  in the doc comment.
- The picker badge test asserts the badge appears once but not that it sits on the super_admin org's button.
- impl-log follow-up says "Retry-After over ~45 s gives up"; on the first background failure the limit is < 60 s
  (45 s only after a prior 15 s retry).
- `identityClient.ts` doc comment line exceeds the surrounding wrap width (formatter accepts it).

### Follow-ups (out of scope)
- `onVisible` (`tokenStore.ts:250-254`) calls `background()` immediately when a hidden tab becomes visible, ignoring a
  pending Retry-After; likewise on-demand `getToken`/`renewNow` (accepted plan assumption). Each early retry just gets
  another 429; consider remembering a `retryNotBefore` timestamp if Identity counts rejected attempts.
- When Retry-After exceeds the remaining token life, background renewal stops re-arming; the next request then hits
  `/token` on demand and may surface `rate_limited`. Consider UX for super admins near the 30 mints/hour limit.
