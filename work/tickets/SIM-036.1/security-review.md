# Security review: SIM-036.1

## Attempt 1

**Verdict: no blockers (🔴) and no should-fix items (🟡).** The four security checks listed hold in the code. The notes below are optional hardening or input for SIM-036.2. The check commands were not run; this verdict comes from reading the code.

### What I verified
- **R1, server-only:** `config.ts:1`, `client.ts:1`, `folders.ts:1` and `drive.ts:1` all start with `import "server-only"`. The only import from outside the layer is `@/lib/validate/uuid` (lib), plus `node:crypto`.
- **R3, secrets stay out of messages, logs and errors:**
  - `DriveConfigError` messages name variables only (`config.ts:33,42`).
  - `DriveError` takes only `code` and `status` (`message === code`, no `cause`; `client.ts:23-32`).
  - Every log entry is built in one place, `note()` (`client.ts:109-114`), with fields `{event, op, code, status?, reason?}`. `reason` is allowlisted through `reasonOf` (`client.ts:56-66`); any other value becomes `"other"`.
  - No Google response text, URL, header or token reaches any error or log.
  - The access token is held only in a closure (`cached`) and is never logged.
  - Secrets go only into the token POST body, and that request uses `redirect: "manual"`, so a 307/308 cannot replay `client_secret` or `refresh_token` to another host (`client.ts:183-193,211-214`).
- **OAuth token handling:**
  - Tokens are cached with a 60 s early expiry (`:208`).
  - Refreshes are single-flight, and `inflight` is cleared in `.finally` (`:236-241`).
  - There is a 60 s cooldown after `invalid_grant`, `invalid_client` or `unauthorized_client` (`:227,234`).
  - A 401 clears the cached token and retries once (`:287-294`).
- **Drive query injection:** both values that go into `q` are validated first. `folderId` must match `DRIVE_ID_RE` at config load (`config.ts:40`); the pattern has no quote, backslash or whitespace. `orgId` must pass `isCanonicalUuid` before `q` is built (`client.ts:403-407`). `pageToken` and `q` go through `URLSearchParams`.
- **File-id validation before URLs:**
  - `fileUrl()` checks `DRIVE_ID_RE` and then `encodeURIComponent` (`client.ts:318-321`).
  - `parentId` is checked (`:345`).
  - Ids that Drive returns are checked again in `idOf` (`:325`) and in the list response (`:434`).
  - `folders.resolve` re-checks the org uuid before `orgId` reaches a folder name or `appProperties` (`folders.ts:32`, `drive.ts:32-33`).
- **Multipart upload:** the boundary is random (`randomBytes(12)`, `client.ts:350`). `mimeType` must match `MIME_RE`, so no CRLF can be injected into the part header (`:349`). `name` and `appProperties` are serialised with `JSON.stringify`.
- **Size caps:**
  - Uploads above `DRIVE_MAX_BYTES` (64 KiB) are refused before any fetch (`:348`).
  - Downloads are refused on `content-length` and by a running byte count that cancels the reader (`:124-151`).
- **Timeouts:** an `AbortController` covers both headers and body (`:161-169`). A `Retry-After` value is capped at 10 s (`:119`).
- **Retries:** uploads and folder creation are not retried on 5xx, network errors or 429 (`last = !o.retry`, `:259`).
- **R6 / R7:** not touched (no route, no SQL). `drive.ts:8-11` documents that `getFile` and `deleteFile` need the caller to check `org_id` against the DB row.
- **Live test:** `drive.live.test.ts` is skipped unless `DRIVE_LIVE=1`, never prints config, and deletes the file in `finally`.

### Notes (🟢)
1. 🟢 `client.ts:270`: media downloads use `redirect: "follow"` with no host allowlist. Node 22's fetch should drop `Authorization` on a cross-origin redirect, as the Fetch spec requires, so the bearer token should not leak. This was not checked against the installed undici version. The response is size-capped and time-limited, so the risk is low. Optional hardening: follow redirects manually and only to `*.googleapis.com` or `*.googleusercontent.com`, without the bearer header.
2. 🟢 `client.ts:166`: `res.text()` has no size limit for error bodies, token responses and list pages. The timeout bounds it and the peer is Google, so the risk is small. Optional: reuse `readCapped`, or a similar cap, for text bodies.
3. 🟢 `drive.ts:64-65`: the memo key on `globalThis.__simapDrive.key` is the four raw secrets joined. It never leaves the process, but anything that later dumps `globalThis.__simapDrive` (a debug log or serialiser) would print them. Optional: use a SHA-256 of the joined values as the key.
4. 🟢 `client.ts:349`: a malformed `mimeType` is rejected with `drive_bad_response`. That is a caller error, not a bad response from Google; a different code would be clearer. Not a security issue.

### Follow-ups (out of scope, for SIM-036.2)
- **Content type when serving images:** `getFile` returns Google's `content-type` unchanged (`client.ts:458`). The image route should not echo it. It should answer with a fixed `image/png`, after checking the PNG signature, plus `X-Content-Type-Options: nosniff`, so a file stored with `text/html` or `image/svg+xml` cannot run as same-origin content (CWE-79/CWE-434).
- **Org check on reads and deletes:** the route must look up the file id with `org_id = scope.orgId` before calling `getFile` or `deleteFile` (R6). Drive itself does no org check on these.
- **Filenames:** the upload route should pick the Drive file `name` itself, not take a client-supplied filename.
- **Order of side effects (R7):** `drive_auth` (a revoked token) must map to a domain or 5xx code, not to 401/403. Otherwise `apiFetch`'s automatic re-send on 401/403 could repeat an upload.
- **Deploy secrets:** passing the four secrets into the production env file needs the deploy ticket already noted in the plan (A6) before images go live.
