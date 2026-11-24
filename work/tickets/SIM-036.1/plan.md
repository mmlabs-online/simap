Status: READY

# Plan — SIM-036.1: Google Drive image storage client (tudocuatui pattern)

Gate: **plan-approval** (High paths: `.env.example`, and `src/server/drive/config.ts` matches `**/config.*`). Ming
approves the defaults A1-A12 below; "duyệt" = all defaults as written.

## Scope summary
- `work/decisions.md` D61 (2026-11-24), part (2): "Images are stored in Google Drive the tudocuatui way (its
  D27/D34/D41: server-only OAuth refresh token, scope `drive.file`, a per-org subfolder, served by an `/api` route
  behind the bearer, rendered as `blob:` URLs). Image format: square PNG, 24 × 24 px, transparent background allowed,
  at most 20 KB". This ticket delivers only the server-side client; the route, table and UI are SIM-036.2+.
- `CLAUDE.md` R3: "Config from env only; names in `.env.example`, no values; no secrets in code, logs or client
  bundles." R1: server code lives in `src/server/**`, each non-test file starts with `import "server-only"`.
- Ticket scope: "`src/server/drive/` (server-only): config loader from env (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `GOOGLE_REFRESH_TOKEN`, `DRIVE_FOLDER_ID`; all unset = off, partly set or malformed = startup error naming variables
  only), OAuth token refresh, upload (multipart), download (`alt=media`), delete, and a per-org subfolder
  (`<root>/<org_id>/`, cached in memory, single-flight). A TypeScript port of tudocuatui's client: plain `fetch`, no
  new dependency." / "Errors carry a fixed code only (no Google message, URL or headers); logs hold
  `{event, op, status, code}` only." / "Variable names (no values) in `.env.example`."
- Reference: `d:\project\spaceM\projects\tudocuatui\server\drive.js` (whole file, 604 lines) and
  `server\driveFolders.js` (75 lines).

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Config: all four unset gives `off`; any subset set, whitespace, or a malformed client id / folder id gives an error naming the variables only; unit tests. | `src/server/drive/config.test.ts` (all cases listed under Tests). Each throwing case uses sentinel secret values and asserts none appear in `err.message`. Lazy "startup" = first `getDrive()` call (A1): `drive.test.ts › getDrive throws DriveConfigError on partial config`. |
| 2 | Upload, download and delete call the Drive v3 endpoints with scope `drive.file` and map Google failures to fixed codes; unit tests with a fake `fetch`. | `src/server/drive/client.test.ts`: asserts method + URL of each call (`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart…`, `…/drive/v3/files/<id>?alt=media`, `DELETE …/drive/v3/files/<id>`), token refresh body, and the status → code table. Scope `drive.file` is a property of the refresh token Ming mints (M-46); the client never requests scopes, so the reviewer checks the module comment and M-46 wording, not code (A10). |
| 3 | Files go into the org's subfolder; the subfolder is created once per org (concurrent calls share one lookup); a file id is validated before it is used in a URL. | `folders.test.ts › concurrent resolves share one list + one create`; `drive.test.ts › uploadOrgFile puts the file in the org folder with appProperties`; `client.test.ts › invalid file id throws drive_invalid_id without calling fetch`. |
| 4 | No secret, token or Drive response text appears in logs, errors or client bundles (`pnpm check:layers` passes; a test asserts the error and log shape). | `client.test.ts › every failure path: error and log shape` (exact key sets; sentinel secret, token and Google message absent from `JSON.stringify(log)` and from `err.message`/`err` own keys). `pnpm check:layers` green (every new non-test file starts with `import "server-only"`). `pnpm build` green. |
| 5 | `.env.example` lists the four names, no values. | Diff of `.env.example`: four `NAME=` lines with empty values and a one-line comment. |

Checks the reviewer runs: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`.

## Ming verification after merge
- After M-46 (folder, OAuth client, refresh token in local env outside the repo): run the opt-in live check
  `DRIVE_LIVE=1 pnpm vitest run src/server/drive/drive.live.test.ts` with the four variables set in the shell. It
  uploads one 1×1 PNG into `<root>/<test org uuid>/`, reads it back byte-equal, deletes it. Expect 1 passed (it is
  skipped, not failed, when `DRIVE_LIVE` is unset, so CI and `pnpm test` never touch Drive).
- In Drive: a subfolder named with the test org uuid appears under the `simap` root folder (it stays; empty).

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/server/drive/config.ts` | create: `DriveConfigError`, `loadDriveConfig(env)`, `DriveConfig` type | AC1 | **Yes** (`**/config.*`) |
| `src/server/drive/config.test.ts` | create | AC1 | Yes (`**/config.*`) |
| `src/server/drive/client.ts` | create: `DriveError`, `DriveCode`, `createDriveClient(opts)` (token, request/retry, `createFile`, `createFolder`, `findOrgFolders`, `getFile`, `deleteFile`) | AC2, AC3 (id check), AC4 | No |
| `src/server/drive/client.test.ts` | create | AC2, AC4 | No |
| `src/server/drive/folders.ts` | create: `createOrgFolderResolver({ drive })` (port of `driveFolders.js`) | AC3 | No |
| `src/server/drive/folders.test.ts` | create | AC3 | No |
| `src/server/drive/drive.ts` | create: `OrgDrive` facade (`uploadOrgFile`, `getFile`, `deleteFile`) + lazy `getDrive()` memoized on `globalThis.__simapDrive` | AC1 (first-use error), AC3 | No |
| `src/server/drive/drive.test.ts` | create | AC1, AC3 | No |
| `src/server/drive/drive.live.test.ts` | create: opt-in live round trip, `describe.skipIf(process.env.DRIVE_LIVE !== "1")` | ticket Test plan "Manual (after M-46)" (A9) | No |
| `.env.example` | add the four names, empty values, one comment line | R3, ticket scope | **Yes** |

No other file. No `package.json` change (no dependency, no new script).

## Data model / migration
None.

## API contract
None (no route; SIM-036.2 adds the routes). Internal TypeScript contract that SIM-036.2 will call:

```ts
// config.ts
export class DriveConfigError extends Error {}
export type DriveConfig = { clientId: string; clientSecret: string; refreshToken: string; folderId: string };
export function loadDriveConfig(env: Record<string, string | undefined>): { mode: "off" } | ({ mode: "on" } & DriveConfig);

// client.ts
export type DriveCode = "drive_not_configured" | "drive_auth" | "drive_not_found" | "drive_forbidden"
  | "drive_rate_limited" | "drive_unavailable" | "drive_too_large" | "drive_bad_response" | "drive_invalid_id";
export class DriveError extends Error { readonly code: DriveCode; readonly status?: number }

// drive.ts
export type OrgDrive = {
  uploadOrgFile(orgId: string, f: { name: string; mimeType: string; bytes: Uint8Array }): Promise<{ id: string; size: number; mimeType: string }>;
  getFile(id: string): Promise<{ bytes: Uint8Array; contentType: string | null }>;
  deleteFile(id: string): Promise<void>; // already gone = success
};
export function getDrive(): OrgDrive | null; // null = off; throws DriveConfigError when misconfigured
export const DRIVE_MAX_BYTES: number; // 64 KiB
```

`getFile`/`deleteFile` are not org-checked in Drive: the org binding of a file id lives in simap's DB row
(SIM-036.2 looks the id up with `org_id = scope.orgId` before calling). This is noted in the `drive.ts` doc comment.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `config.test.ts › all four unset → off` (also all four `""`) | AC1 |
| `config.test.ts › all four valid → on with values` | AC1 |
| `config.test.ts › each single missing var → names exactly the missing ones` (loop over 4 × "only this one missing", plus "only one set") | AC1 |
| `config.test.ts › whitespace in any value → malformed, names it` (leading/trailing space, inner tab/newline) | AC1 |
| `config.test.ts › client id without .apps.googleusercontent.com → GOOGLE_CLIENT_ID` | AC1 |
| `config.test.ts › folder id outside /^[A-Za-z0-9_-]{10,200}$/ → DRIVE_FOLDER_ID` (9 chars, 201 chars, `/`, `'`, Vietnamese `đ`) | AC1, domain focus |
| `config.test.ts › messages never contain any value` (sentinels `SECRET-SENTINEL-…` in every var, every failing case) | AC1, AC4 |
| `client.test.ts › refresh: POST form body to token URL, caches token until expires_in - 60 s, refreshes after` (fake `now`) | AC2 |
| `client.test.ts › concurrent calls share one refresh (single-flight)` | AC2 |
| `client.test.ts › invalid_grant → drive_auth and 60 s cooldown with no fetch; inflight cleared so waiters reject` | AC2, consult risk |
| `client.test.ts › token 5xx retried up to 3 then drive_unavailable; 429 → drive_rate_limited; redirect → drive_bad_response; missing access_token → drive_bad_response` | AC2 |
| `client.test.ts › createFile: multipart body (metadata JSON with parents + appProperties, then bytes), content-type boundary, URL with uploadType=multipart&fields=id,size,mimeType` | AC2 |
| `client.test.ts › createFile is never retried on 5xx or network error; 401 refreshes and retries once` | AC2 |
| `client.test.ts › createFile over DRIVE_MAX_BYTES → drive_too_large, no fetch`; bad mime → `drive_bad_response`, no fetch; response id failing FILE_ID_RE → `drive_bad_response` | AC2 |
| `client.test.ts › getFile: GET files/<id>?alt=media, returns bytes + content-type; body above cap → drive_too_large (stream cancelled); content-length above cap → drive_too_large` | AC2 |
| `client.test.ts › deleteFile: DELETE files/<id>; 404 → resolves; 500 retried then drive_unavailable` | AC2 |
| `client.test.ts › status mapping table: 401×2 → drive_auth, 403 → drive_forbidden, 403 rateLimitExceeded → drive_rate_limited, 404 → drive_not_found, 429 → drive_rate_limited (after retries), 5xx → drive_unavailable, 400 → drive_bad_response, fetch throw/timeout → drive_unavailable` | AC2 |
| `client.test.ts › invalid file id (undefined, "", "../x", "a b", 9 chars, 201 chars) → drive_invalid_id without calling fetch` | AC3 |
| `client.test.ts › every fetch has cache "no-store" and redirect "manual" (media: "follow")` | consult |
| `client.test.ts › every failure path: error and log shape` — DriveError own keys ⊆ {name, code, status, message}, `message === code`, no `cause`; each log entry keys ⊆ {event, op, status, code, reason}, `event === "drive"`, `reason` ∈ allowlist ∪ {"other"}; sentinel client secret, refresh token, access token and Google message text (`"SENSITIVE google message"`) absent from every `JSON.stringify(entry)` and from `String(err)` | AC4 |
| `client.test.ts › findOrgFolders builds q only from validated ids` (non-uuid org → drive_invalid_id, no fetch; q contains `appProperties has { key='orgId' and value='<uuid>' }`) | AC3 |
| `folders.test.ts › existing folder found → no create; cached on second call (one list total)` | AC3 |
| `folders.test.ts › none found → creates one with name = orgId, appProperties {app:"simap-folder", orgId}` | AC3 |
| `folders.test.ts › 5 concurrent resolves for one org → 1 list + 1 create; two orgs → separate` | AC3 |
| `folders.test.ts › several folders → oldest createdTime wins, tie → smallest id; more than 10 pages → drive_bad_response` | AC3 |
| `folders.test.ts › failed lookup is not cached and inflight is cleared (next call retries)`; `forget(orgId)` drops the cache | AC3 |
| `folders.test.ts › non-canonical org id (uppercase, nil uuid, "x") → drive_invalid_id` | AC3 |
| `drive.test.ts › uploadOrgFile resolves the org folder then createFile with parentId = folder and appProperties {app:"simap", orgId}` | AC3 |
| `drive.test.ts › uploadOrgFile: createFile drive_not_found on a cached folder → forget, re-resolve, retry once` | AC3 |
| `drive.test.ts › getDrive returns null when all four unset; throws DriveConfigError (names only) on partial config; memoized while env unchanged, rebuilt when it changes` (env stubbed with `vi.stubEnv`, `globalThis.__simapDrive` reset per test) | AC1 |
| `drive.live.test.ts › round trip upload / read / delete` (skipped unless `DRIVE_LIVE=1`) | Ming verification |

## Approach
1. **`config.ts`** (`import "server-only"` first line). Port `loadDriveConfig` from `drive.js:22-71` as is: `NAMES`
   order, empty string = unset, all missing → `{mode:"off"}`, some missing → `DriveConfigError("Google Drive config is
   incomplete, missing: <names>")`, then whitespace check, `.apps.googleusercontent.com` suffix, `FOLDER_RE`
   (`/^[A-Za-z0-9_-]{10,200}$/`) → `DriveConfigError("malformed Google Drive config: <names>")`. Export `FOLDER_RE`
   (shared as `DRIVE_ID_RE` with the client; same pattern as `FILE_ID_RE`). Model on
   `src/server/identity/config.ts:5-16` (error class, value-free messages).
2. **`client.ts`** — port `createDriveClient` from `drive.js:103-345, 355-430, 507-520` to TypeScript with these
   changes:
   - Options: `{ config, fetch, now, sleep, random, log, tokenUrl, apiBase, uploadBase, timeouts }` (same defaults).
   - `once()`: add `cache: "no-store"` to every init; drop the `streaming` / external `signal` handover (no streamed
     media, A4).
   - Keep: token cache with 60 s early expiry, single-flight `inflight` cleared in `.finally`, 60 s cooldown after
     `invalid_grant|invalid_client|unauthorized_client`, 401 → clear token and retry once, retry with backoff
     (Retry-After capped 10 s) on 429 / rate-reason 403 always and on 5xx/network only when `retry: true`, `reasonOf`
     with the `REASONS` allowlist (else `"other"`), `fileUrl()` with `FILE_ID_RE` + `encodeURIComponent`, multipart
     upload with `simap` + `randomBytes(12)` hex boundary, `MIME_RE`, delete treats `drive_not_found` as success.
   - `MAX_BYTES` → `DRIVE_MAX_BYTES = 64 * 1024` (A5).
   - `createFile({ name, mimeType, bytes, appProperties, parentId })` and `createFolder({ name, appProperties })` as in
     the reference (both `retry: false`).
   - New `getFile(id)`: `GET fileUrl(id)?alt=media`, `redirect: "follow"`, `accept-encoding: identity`, timeout
     `t.headers`; reject when `content-length` > cap; otherwise read `res.body` with a reader, summing bytes, and on
     exceeding the cap `reader.cancel()` and throw `drive_too_large`; return `{ bytes, contentType }`. Errors inside
     `request()` are handled as today; `getFile` needs `request()` to return the unread `Response` for ok answers, so
     `once()` reads `text()` only for non-ok responses and for ok responses of ops that parse JSON (flag
     `raw: true` for media).
   - Replace the public `listFiles({q})` and the query helpers with one method `findOrgFolders(orgId)` that validates
     `orgId` with `isCanonicalUuid` (`@/lib/validate/uuid`) and builds
     `'<root>' in parents and trashed = false and mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='app' and value='simap-folder' } and appProperties has { key='orgId' and value='<orgId>' }`,
     paging internally like `listFiles` (`drive.js:527-575`, `pageSize` 100, at most 10 pages → `drive_bad_response`)
     and returning `{ id, createdTime }[]`.
   - Drop `moveFile`, `getParents`, `getMedia`, `checkFolder`, `taggedFilesQuery`, `subfoldersQuery` (A8).
   - Log via the injected `log(entry)` only; entry = `{event:"drive", op, code, status?, reason?}` (A2).
   - `DriveError(code, status?)`: `super(code)`, `name = "DriveError"`, no `cause`, no other fields.
   - Header comment states: secrets from env only; scope `drive.file` comes from the refresh token (M-46).
3. **`folders.ts`** — port `driveFolders.js:8-73` with `orgId` instead of `userId`: `isCanonicalUuid` check first,
   `resolved` + `inflight` Maps, oldest-wins over `findOrgFolders`, create with
   `{ name: orgId, appProperties: { app: "simap-folder", orgId } }`, `forget(orgId)`.
4. **`drive.ts`** — `createOrgDrive({ client, folders })` returning `OrgDrive`: `uploadOrgFile` resolves the folder,
   calls `createFile({ ..., parentId, appProperties: { app: "simap", orgId } })`; on `drive_not_found` it `forget`s,
   re-resolves and retries once. `getDrive()` mirrors `getAuthDeps` (`src/server/http/with-auth.ts:97-120`) and
   `getPool` (`src/server/db/pool.ts:32-38`): reads `process.env` on first call, never at import; `off` → `null`;
   misconfigured → throws `DriveConfigError`; memoized on `globalThis.__simapDrive = { key, drive }` where `key` is the
   four values joined (rebuilt when env changes in dev); log sink `(e) => console.error(JSON.stringify(e))` as in
   `pool.ts:6`.
5. **`drive.live.test.ts`** — `describe.skipIf(process.env.DRIVE_LIVE !== "1")`; uses `getDrive()`, a fixed test org
   uuid, a hard-coded 1×1 transparent PNG byte array; upload → getFile byte-equal → delete. Never prints config.
6. **`.env.example`** — follow the file's existing comment/`NAME=` style; append:
   `# Google Drive for device-type images (D61): set all four or none (none = images off). Scope drive.file (M-46).`
   then `GOOGLE_CLIENT_ID=`, `GOOGLE_CLIENT_SECRET=`, `GOOGLE_REFRESH_TOKEN=`, `DRIVE_FOLDER_ID=`. Before editing, grep
   the file for these four names only (`^(GOOGLE_|DRIVE_)`) to confirm no clash; never print other values.
7. Run the four checks.

Rules: R1 (server layer, `server-only` first line, imports only `@/lib/validate/uuid` and `node:crypto`; checked by
`pnpm check:layers`), R3 (env only, names in `.env.example`, values never in messages/logs; tests with sentinels),
R4 (only the files above), R5 (unit tests for every module). R2/R6/R7 not touched (no schema, no query, no route);
R6 is prepared for by keying every folder on the verified org id.

Estimated size: ~520 source lines + ~650 test lines (A11).

## Specialist input used
`consult-software-architect.md`:
- Adopted: layer placement and `isCanonicalUuid` reuse (F1); lazy `getDrive()` modelled on `getAuthDeps` with
  `globalThis` memo (Rec "Factory"); injection seam and `cache: "no-store"` (Rec "Test seam"); the full "Port these"
  list; the "Drop these" list, with the internal list call exposed only as `findOrgFolders` (A8); buffered `getFile`
  with a 64 KB cap instead of streamed `getMedia` (A4); `DRIVE_MAX_BYTES` 64 KB in the client, exact PNG/24 px/20 KB
  checks deferred to SIM-036.2 `src/lib/validate/` (A5); `appProperties` tags `simap-folder` / `simap` (A7); org id as
  a plain string; JSON logs to `console.error`; the error/log shape test; the `inflight` clearing test (Risk 3).
- Settled open questions as defaults: Q1 → A1 (first use, no `instrumentation.ts`); Q2 → A2 (keep allowlisted
  `reason`); Q3 → A3 (verified: `src/server/identity/verify.ts:147` refuses any `org` claim that is not
  `isCanonicalUuid`, so a scoped caller always has a canonical uuid; the resolver re-checks anyway); Q4 → A6.
- Not adopted: none.

## Assumptions
Defaults for Ming to approve (plan-approval gate):
- **A1 "Startup error" = first-use error.** simap reads config lazily (`with-auth.ts:101`, `pool.ts:32`) so
  `next build` needs no env. `getDrive()` throws `DriveConfigError` (names only) on its first call; with all four
  unset it returns `null` and SIM-036.2 answers `drive_not_configured`. No `src/instrumentation.ts` here; a real
  boot-time fail-fast for all config (Identity, DB, Drive) is a possible follow-up.
- **A2 Logs keep an allowlisted `reason`.** Entries are `{event:"drive", op, status?, code, reason?}`; `reason` is
  only one of the fixed tudocuatui allowlist (`invalid_grant`, `invalid_client`, `unauthorized_client`,
  `rateLimitExceeded`, `userRateLimitExceeded`, `storageQuotaExceeded`, `insufficientFilePermissions`, `notFound`,
  `cannotAddParent`, `authError`, `backendError`) or `"other"`; never Google text. It tells Ming "refresh token
  revoked" (`invalid_grant`) apart from other auth failures. This amends AC4's `{event, op, status, code}` wording;
  if Ming says no, drop `reason` (a 10-line change).
- **A3 Org id validation.** The org id is always the verified `org` claim (canonical uuid, `verify.ts:147`); the
  resolver and `findOrgFolders` re-validate with `isCanonicalUuid` before it enters the Drive `q` string or a folder
  name, and throw `drive_invalid_id` otherwise.
- **A4 Download is buffered with a 64 KB cap**, not streamed (images are ≤20 KB under D61).
- **A5 Client byte cap 64 KB** (`drive_too_large` above it, before any fetch). PNG / 24×24 / 20 KB validation is
  SIM-036.2.
- **A6 Deploy secrets are M-46's, not this ticket's.** Runtime names stay unprefixed (`GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `DRIVE_FOLDER_ID`). Proposed deployment-repo secret names, like
  tudocuatui D28: `SIMAP_GOOGLE_CLIENT_ID`, `SIMAP_GOOGLE_CLIENT_SECRET`, `SIMAP_GOOGLE_REFRESH_TOKEN`,
  `SIMAP_DRIVE_FOLDER_ID`. Today production env reaches the container only through
  `/Users/mingming/.config/simap/simap.env`, which the deploy workflow writes with `DATABASE_URL` only
  (`deploy/deployment-repo/apps/simap/compose.yml:15-28`, `scripts/deploy-envfile.test.ts:90`). Passing the four
  secrets into that file is a deploy change (High path) for a follow-up ticket before SIM-036.2 goes live; the
  orchestrator should add that follow-up and extend M-46 with the secret names and the choice "own simap OAuth client
  (recommended, separate revocation) vs reuse tudocuatui's".
- **A7 One Drive account for every org** (ticket note, tudocuatui D38): Ming's account, one refresh token; per-org
  separation is by subfolder and the DB row's `org_id`, not Drive permissions. A revoked token turns images off for
  every org (`drive_auth`). Confirm at approval.
- **A8 Smaller surface than the reference:** no `moveFile`, `getParents`, streamed `getMedia`, `checkFolder`, public
  `listFiles` or sweep queries. Files and folders carry `appProperties` (`app`, `orgId`) so a later orphan sweep needs
  no migration (ticket Out of scope).
- **A9 The "dev script" is an opt-in Vitest file** (`drive.live.test.ts`, skipped unless `DRIVE_LIVE=1`), because the
  module imports `server-only` and `@/` aliases that plain `node scripts/*.mjs` cannot load; Vitest already aliases
  both (`vitest.config.ts:9-13`). No `package.json` script.
- **A10 Scope `drive.file`** is fixed by the refresh token Ming creates (M-46); the client never asks for scopes.
- **A11 One slice (~520 + ~650 test lines).** It is a cohesive port with no route or schema. Fallback split if review
  stalls: (a) `config.ts` + `client.ts` + `.env.example`; (b) `folders.ts` + `drive.ts` + live test.
- **A12 Multi-replica:** caches are per process; a duplicate org folder from two processes is harmless (oldest wins).
- `.env.example` could not be read by the planner (permission denied even for a name-only grep); the implementer
  greps it for `^(GOOGLE_|DRIVE_)` names only before adding them. The consult found no `GOOGLE_*`/`DRIVE_*` names
  elsewhere in the repo.
- Hotspots: no other ticket is `IN_PROGRESS`, `REVIEW` or `DONE` (`work/backlog.md`); all files except
  `.env.example` are new.

## Blocking questions
None.

## Split proposal
None (see A11 for the fallback split).
