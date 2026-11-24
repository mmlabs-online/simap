## Findings

1. **Where it goes and the layer rules.** `src/server/drive/` is in the `server` layer. It may import only `server` and `lib`, and every non-test file must start with `import "server-only"`. `scripts/check-layers.mjs` checks both through the `SERVER_ONLY` regex and `ALLOWED.server`. The UUID validator to reuse is `isCanonicalUuid` in `src/lib/validate/uuid`.

2. **simap does not load config at startup.** There is no `src/instrumentation.ts`. Config is read lazily on first use:
   - `src/server/http/with-auth.ts:101-120` says "Lazy: reads env on the first request, never at import (so `next build` needs no env or network)". It calls `loadIdentityConfig(process.env)`, which throws `IdentityConfigError` with messages that name the variable and never its value.
   - `src/server/db/pool.ts:33-38` returns `null` when `DATABASE_URL` is unset and keeps the pool on `globalThis.__simapPool`.
   - tudocuatui instead exits the process on bad config. The ticket's phrase "startup error" therefore does not match how simap works today.

3. **The reference client is much bigger than this ticket needs.**
   - `drive.js` also contains `moveFile`, `getParents`, `listFiles`, sweep queries (`taggedFilesQuery`), `checkFolder`, and streamed `getMedia` with abort-signal handover.
   - `driveFolders.js` holds the per-user folder resolver: a lookup by `appProperties`, oldest folder wins, at most 10 pages, single-flight through two Maps, and `forget()`.

4. **Env names.** I found no `GOOGLE_*` or `DRIVE_*` names in the repo; the only hit was the ticket itself. Per instructions I did not open `.env.example`, so the planner must confirm it is clean.
   - tudocuatui's deploy secrets use a project prefix (`TUDOCUATUI_GOOGLE_*`, its D28) and its runtime reads the unprefixed names. Simap's deploy secrets would likewise need a `SIMAP_` prefix in the deployment repo, which is a Ming-only step outside this ticket.

5. **Log shape conflict.** tudocuatui's log entries include an allowlisted `reason` field (for example `invalid_grant`). The ticket's acceptance criterion allows `{event, op, status, code}` only.

## Recommendations

- **Config (AC1).** Port `loadDriveConfig(env)` almost as is: empty string counts as unset; all four unset gives `{mode:"off"}`; then check for missing values, whitespace, the `.apps.googleusercontent.com` suffix and the folder-id regex. Throw `DriveConfigError` naming variables only. Test it with sentinel secret values and assert none of them appear in `err.message`.
- **Factory.** Add a lazy `getDrive()` that mirrors `getAuthDeps`: read env on first call, return `null` when off, and memoize on `globalThis.__simapDrive` keyed by the config so dev reloads keep the token cache. That keeps `next build` env-free. "Startup error" then means "fails on first use, naming variables only".
  - If Ming wants a real fail-fast at boot, a `src/instrumentation.ts` `register()` could call the loader. That file sits in no layer (`layerOf` returns `null`), so the import guard would not check it. I suggest leaving it as a follow-up, not doing it here.
- **Test seam (AC2).** Keep tudocuatui's injection shape: `createDriveClient({config, fetch, now, sleep, random, log, tokenUrl, apiBase, uploadBase, timeouts})`. Unit tests pass a fake `fetch` and a no-op `sleep`. Pass `cache: "no-store"` on every fetch so Next's patched fetch never caches a token or media response.
- **Port these:**
  - The `once` timeout wrapper and `redirect: "manual"`.
  - Token caching with a 60 s early expiry, single-flight `inflight`, and the 60 s cooldown after `invalid_grant`.
  - A 401 clears the cached token and retries once.
  - Retry with backoff on 429 / 5xx only for idempotent operations; uploads are never retried.
  - The `FILE_ID_RE` check before any URL, plus `encodeURIComponent`.
  - Multipart upload with a random boundary.
  - Delete treats `drive_not_found` as success.
  - The error codes. `DriveError` carries the code only, with no `cause`.
- **Drop these:** `moveFile`, `getParents`, `taggedFilesQuery` / `subfoldersQuery`, and the public `listFiles`. Keep one internal list call for the folder lookup.
- **Download.** Replace the streamed `getMedia` with a buffered `getFile(id) → {bytes, contentType}` that aborts once a byte cap is exceeded (for example 64 KB). Images are ≤20 KB under D61, so the stream handover adds complexity with no benefit.
- **Upload size.** Set the client's `MAX_BYTES` near the D61 limit (≤64 KB) and return `drive_too_large` above it. Exact 20 KB / PNG / 24 px validation belongs in `src/lib/validate/` in SIM-036.2.
- **Per-org folder (AC3).**
  - Port `createFolderResolver` keyed by `orgId`, validated with `isCanonicalUuid` before it is put into the Drive `q` string. This blocks query injection; the org claim is the only caller-derived value in `q`.
  - Tag folders `appProperties {app:"simap-folder", orgId}` and files `{app:"simap", orgId}`, so a future orphan sweep is possible without migrating anything.
  - Keep the oldest-folder-wins rule and the page cap.
  - Take the org as a plain string, not `OrgScope`, so the module stays a pure client; SIM-036.2 passes `scope.orgId`.
- **Logs (AC4).** Use `{event:"drive", op, status?, code}`. Either drop `reason` or have Ming amend the criterion to allow the allowlisted `reason`, which is useful for diagnosing `invalid_grant`. I'd keep it and amend. Write logs as JSON to `console.error`, like `pool.ts`. Add a test that runs every failure path and asserts the error and log keys exactly.

## Risks

- One Google account and refresh token serves every org (ticket note, tudocuatui D38). If the token is revoked, images break for all tenants, and per-org separation exists only in this code, not in Drive permissions.
- Each Next process has its own caches. With several replicas, two processes can each create a folder for the same org (harmless, oldest wins) and each refresh its own token.
- A cooldown or failure during `refresh()` must clear `inflight`, or every waiter hangs. The reference's `.finally` already does this; the test should cover it.
- `.env.example` is a High path, so the plan needs Ming's approval.

## Open questions

1. Is "first use" error acceptable instead of a true startup error, or should `instrumentation.ts` be added now?
2. Keep the allowlisted `reason` in logs, and amend AC1/4?
3. Is the Identity `org` claim always a canonical UUID? The folder-name validation depends on it.
4. Deploy secret names in the deployment repo (`SIMAP_GOOGLE_*`?), and whether Ming reuses tudocuatui's OAuth client or creates a simap one. Either way it needs a new `ming-todo` item (M-46).

Files: `src/server/http/with-auth.ts`, `src/server/identity/config.ts`, `src/server/db/pool.ts`, `scripts/check-layers.mjs`, `spaceM/projects/tudocuatui/server/drive.js`, `spaceM/projects/tudocuatui/server/driveFolders.js`.
