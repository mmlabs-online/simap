## Attempt 1 — 2026-11-24

### Files touched
| File | Required because |
|---|---|
| `src/server/drive/config.ts` | AC1: `DriveConfigError`, `loadDriveConfig`, `DRIVE_ID_RE` (High path `**/config.*`) |
| `src/server/drive/config.test.ts` | AC1 tests |
| `src/server/drive/client.ts` | AC2-AC4: token refresh, request/retry, createFile, createFolder, findOrgFolders, getFile, deleteFile, fixed error codes |
| `src/server/drive/client.test.ts` | AC2-AC4 tests (fake fetch) |
| `src/server/drive/folders.ts` | AC3: per-org folder resolver (single-flight, cached) |
| `src/server/drive/folders.test.ts` | AC3 tests |
| `src/server/drive/drive.ts` | `OrgDrive` facade + lazy `getDrive()` on `globalThis.__simapDrive` |
| `src/server/drive/drive.test.ts` | AC1 (first-use error, memo), AC3 (upload, stale-folder retry) |
| `src/server/drive/drive.live.test.ts` | opt-in live round trip (skipped unless `DRIVE_LIVE=1`) |
| `.env.example` | AC5: four names with empty values and one comment line, appended with a shell `printf >>` (file not readable by the implementer; stat showed +6 / -0 lines) |

### Tests added / changed
- config.test.ts: unset → off; valid → on; each missing var; whitespace; client id suffix; folder id regex; messages never contain values
- client.test.ts: refresh + cache; single-flight; invalid_grant cooldown and inflight cleared; token 5xx/429/redirect/bad body; multipart body; no retry on create, 401 retry once; too large / bad mime / bad id; getFile + caps; deleteFile; status mapping; invalid ids; fetch options; findOrgFolders (q, paging, 10-page cap, non-uuid); error and log shape
- folders.test.ts: cache; create; concurrency; oldest wins; failed lookup / forget; non-canonical ids
- drive.test.ts: uploadOrgFile; not_found retry once; other errors not retried; getDrive null / throws / memo
- drive.live.test.ts: skipped (1)

### Checks (actual output summary)
- typecheck: `next typegen && tsc --noEmit` ok; `check-layers: 610 files, no violations`
- format:check: All matched files use the correct format.
- test: first full run 2 failed (my tests used an org uuid with no letters, so `.toUpperCase()` was still canonical); fixed; `pnpm exec vitest run src/server/drive`: Test Files 4 passed | 1 skipped; Tests 35 passed | 1 skipped. Full `pnpm test` before the fix: 2314 passed, 2 failed (those two), 4 skipped; not re-run in full after the fix.
- build: `pnpm build` completed, route table printed, no errors.

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- Plan test "more than 10 pages → drive_bad_response" is in `client.test.ts` (paging lives in `findOrgFolders`), not `folders.test.ts`.
- Deploy secrets for the four variables (A6) remain a follow-up ticket and M-46.

### Scope self-check
- Could the diff be smaller? No; every file is in the plan.
- Diff size: ~+1440 lines in src/server/drive (all new, incl. tests) + 6 in .env.example / -0
