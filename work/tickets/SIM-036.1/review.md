## Attempt 1 — 2026-11-24
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — "All matched files use the correct format." (664 files)
- `pnpm typecheck` — `next typegen && tsc --noEmit` ok, no errors
- `pnpm check:layers` — "check-layers: 610 files, no violations"
- `pnpm test` (full run, after the implementer's last fix) — Test Files 232 passed | 1 skipped (233); Tests 2316 passed | 4 skipped (2320). Matches impl-log (2314 + the 2 fixed tests).
- `pnpm build` — exit 0, route table printed, no "error" lines in the build log.

### Acceptance criteria
- [x] AC1 Config off / partial / whitespace / malformed, names only — evidence: `config.test.ts` › "all four unset → off", "each single missing var → names exactly the missing ones", "whitespace in any value → malformed, names it", "client id without .apps.googleusercontent.com", "folder id outside …", "messages never contain any value"; first-use error `drive.test.ts` › "throws DriveConfigError naming variables only on partial config" (A1); `config.ts:26-45`.
- [x] AC2 Drive v3 endpoints and fixed error codes, fake fetch — evidence: `client.test.ts` › token refresh (4 tests), createFile (3), getFile (2), deleteFile, "maps Google failures to fixed codes"; URLs at `client.ts:367`, `:452`, `:466`. Scope `drive.file` is stated in the module comment `client.ts:6-10` (A10: property of the refresh token, M-46).
- [x] AC3 Org subfolder, created once per org with single-flight, file id validated before URL use — evidence: `folders.test.ts` › "5 concurrent resolves for one org → 1 list + 1 create", "a failed lookup is not cached and inflight is cleared"; `drive.test.ts` › "uploadOrgFile resolves the org folder, then creates the file inside it"; `client.test.ts` › "an invalid file id throws drive_invalid_id without calling fetch"; `fileUrl` `client.ts:318-321`, org id re-check `client.ts:403`, `folders.ts:32`.
- [x] AC4 No secret, token or Drive text in logs/errors/bundles — evidence: `client.test.ts` › "every failure path: error and log shape carry no secret, token or Google text" (own keys ⊆ {stack, message, name, code, status}, `message === code`, no `cause`, log keys ⊆ {event, op, status, code, reason}, reason allowlisted, sentinels absent); every new non-test file starts with `import "server-only"`; `pnpm check:layers` green. `reason` in log entries is the approved A2 amendment.
- [x] AC5 `.env.example` lists the four names, no values — not read by the reviewer (session forbids reading .env* files, per orchestrator). impl-log reports +6/-0 lines. Left for Ming to verify in the PR (see below); not blocking per orchestrator instruction.

Ming verification after merge (carry into the PR):
- Check the `.env.example` diff: four empty `GOOGLE_CLIENT_ID=`, `GOOGLE_CLIENT_SECRET=`, `GOOGLE_REFRESH_TOKEN=`, `DRIVE_FOLDER_ID=` lines plus one comment, no values, no duplicate names.
- After M-46: `DRIVE_LIVE=1 pnpm vitest run src/server/drive/drive.live.test.ts` with the four variables set in the shell; expect 1 passed (upload, byte-equal read, delete).
- In Drive: a subfolder named with the test org uuid appears under the `simap` root folder.

### Issues
None.

### Scope
All `src/server/drive/*` files match the plan's file list; `.env.example` is in the plan (High path, approved by Ming, M-48). `work/ming-todo.md` (+8, M-48 entry ticked) and `ticket.md` / `plan.md` / `consult-*.md` / `impl-log.md` are workflow files from the orchestrator, not code changes. No `package.json` change, no new dependency.

### Rules (CLAUDE.md)
No violations found. R1: server layer only, `server-only` first line in `config.ts`, `client.ts`, `folders.ts`, `drive.ts`; imports `@/lib/validate/uuid` and `node:crypto` only. R3: env only via `process.env` at first use (`drive.ts:62`), no values in messages or logs (tested with sentinels). R5: unit tests for every module. R2/R6/R7 not touched (no schema, query or route).

### Blockers from review agents
None.

### Nits (do not block)
- `client.ts:216-223`: a token-endpoint 429 is logged as `drive_unavailable` while the thrown error on the last attempt is `drive_rate_limited`; log the same code as the error (`res.status === 429 ? "drive_rate_limited" : "drive_unavailable"`).
- `drive.ts:64-65`: the memo key on `globalThis.__simapDrive.key` holds the client secret and refresh token in plain text. In-process only and never logged, but a sha256 of the joined values would keep secrets off a global object that a future debug dump might print.
- `client.ts:375`: `size: Number(j.size)` is `NaN` if Drive omits `size`; fall back to `bytes.byteLength`.

### Follow-ups (out of scope)
- Deploy change to pass the four secrets into `simap.env` (A6) before SIM-036.2 goes live, plus M-46 (OAuth client, refresh token, root folder, secret names `SIMAP_GOOGLE_*` / `SIMAP_DRIVE_FOLDER_ID`).
- Possible boot-time fail-fast for all config (Identity, DB, Drive) via `instrumentation.ts` (A1).
- Orphan sweep job for files whose DB row is gone (files already tagged with `appProperties` app/orgId, A8).
