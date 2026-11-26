# SIM-044 — security review (security-ai-generated-code-auditor)

## Attempt 1

Verdict: PASS — no 🔴, no 🟡 (code read only; checks not run by the auditor). Commit 9e4a3f0.

- 🟢 List and detail filtered in SQL before the limit: `src/server/devices/devices.ts:183-184` (`heldWhere`, user tier only), used at `:209` and `:230`; `$2` is the verified `ctx.sub`, tier from `withAuth` (`with-auth.ts:69`). Not-held → shared `notFound`.
- 🟢 Fail-closed without a member row (left join → `coalesce(..., false)`): list, detail, mine, history (`history.ts:52,59`), search (`search.ts:143`); DB tests `devices.db.test.ts:937`, `:1000`.
- 🟢 History refuses before reading audit data: probe `history.ts:41-57`, `notFound` at `:58-59` before `:69` / `:94`.
- 🟢 Search: held predicate ANDed outside the whole match group (`search.ts:142-144`), so owner-name / MAC / serial matching cannot surface others' devices; cursor appended after the predicate (`:76-78`).
- 🟢 `/api/devices/mine` cursor tampering: predicate always applied (`devices.ts:243-250`), strict decoder (`cursor.ts:13-27`), validator (`my-devices-query.ts:9-37`).
- 🟢 R6: every query through `orgQuery`, joins repeat `org_id`.
- 🟢 R7: `mine/route.ts` `withAuth({tier:"user"})`, 400/503 before DB, `no-store`; no new 401/403.
- 🟢 `reload` (`devices.ts:657-667`) unfiltered → no post-commit 500 on write paths.
- 💭 No test pins `reload` as unfiltered (`devices.ts:665`); optional capture test in `devices.test.ts`.
- 💭 NUL in cursor `k` → unhandled 500 (`cursor.ts:25`), same as existing cursors; optional fix for all cursors.

Follow-ups (already in plan): Q10 write-action existence oracle; SIM-044.1 slice B; Q6 other members' email.

## Attempt 2

Verdict: PASS — no 🔴, no 🟡 (code read only). Rework commit ec0bb73 changes test data/assertions only.

- 🟢 `src/server/devices/devices.db.test.ts:108` Manager-only assertion `!d.mine && d.canPlace`, matches `canPlace`; User assertions `:86-103` unchanged.
- 🟢 `src/server/search/search.db.test.ts:278,281` lowercase stored MACs; User-tier search assertions `:290-295` unchanged and now executed; positive result at `:290` rules out vacuous `?? []`.
- 🟢 `devices.db.test.ts:122-126` (unowned detail 404 for User), `:936-995` visibility block (list per tier, no member row, 404 = cross-org 404, pending recipient, former holder), `:889-890`, `:916` intact.
- 💭 `search.db.test.ts:292`: add a positive User-tier MAC check (`q("AA:BB:CC:00:00:01")` → `[mine]`) so the empty MAC result stands on its own (optional).
