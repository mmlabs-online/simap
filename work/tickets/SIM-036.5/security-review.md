# Security review — SIM-036.5

## Attempt 1

## Security review: SIM-036.5, attempt 1

**Verdict: no blockers.** No 🔴 findings, no 🟡 findings, and three 🟢 suggestions. Every focus item checked out.

**Caveat on checks:** I had no shell in this session, so I did not run `git diff` or any of the check commands (`pnpm test`, `typecheck`, `check:layers` and the rest). Under R5 the checks still have to be shown green before PASS. I reviewed the files you listed, plus the Drive and HTTP code they call, by reading them directly.

### Focus items that hold (file:line evidence)

- **Upload validation order:**
  - `src/app/api/device-types/[id]/image/route.ts:25-33` runs the uuid check, then `getPool()` (no query), then `readBytes`, then `validatePng`. Only after that does `setDeviceTypeImage` run, so every 422 comes before any DB or Drive call.
  - `src/server/request/read-bytes.ts:12-13` requires the media type `image/png` exactly. Lines 15-17 refuse a declared `content-length` over the cap without reading. Lines 26-30 enforce the cap again while streaming and cancel the reader.
- **PNG structure:**
  - `src/lib/validate/png.ts:41,50` bounds-check every offset, using `getUint32` so values are never negative. The `end + 4 > length` check also catches lengths up to 2^32-1.
  - Line 51 checks the CRC of every chunk.
  - Lines 53-58 require IHDR first with length 13, and reject a second IHDR or an `acTL` (APNG).
  - Line 64 requires IEND with length 0, at least one IDAT, and no trailing bytes.
  - The loop always ends, because each chunk moves forward by at least 12 bytes.
- **GET headers:**
  - `route.ts:71-81` sends a fixed `Content-Type: image/png`, so Drive's `contentType` is never passed on. It also sends `nosniff`, `Content-Disposition: inline`, `Content-Security-Policy: sandbox` and `Content-Length`.
  - `route.ts:17-20,69` sends `private, no-cache`, and keeps the ETag and nosniff on the 304.
  - `image.ts:212` re-checks the bytes downloaded from Drive with `validatePng` before serving them.
- **Org scoping (R6):**
  - Every SQL statement goes through `orgQuery`, which rejects any SQL without `org_id = $1` and binds `scope.orgId` (`src/server/http/org-scope.ts:21-24`). See `image.ts:81,120-124,167,176-177` and `device-types.ts:181`.
  - Drive file ids come only from the org-scoped row (`image.ts:99,207,211`, `device-types.ts:192`), never from the client. That is the contract `OrgDrive` requires (`src/server/drive/drive.ts:9-10`).
  - The upload sets `orgId = scope.orgId` (`image.ts:103`). The server picks the file name (`image.ts:104`), so no client filename is used.
  - "No row", "other org" and "no image" all give the same 404 (`image.ts:207`), so the 404 reveals nothing across orgs.
  - The DTO exposes only `has_image` (`device-types.ts:53`). The file id is never returned.
- **No 401/403 from handlers (R7):**
  - `driveFailure` (`image.ts:34-46`) maps only to 503 `images_unavailable` or 502 `drive_error`, and rethrows anything else, which the wrapper turns into 500 `internal` (`with-auth.ts:82-86`).
  - The handlers produce only 404, 409, 422, 502 and 503 themselves.
- **No Drive error detail leaked:**
  - Response bodies are only `{error:{code}}` (`respond.ts:9`).
  - The logs record only the DriveCode or `drive_config` (`image.ts:36,40,213`), or the type id for orphans (`image.ts:28`).
  - No log line contains a Drive file id, the bytes or a token.
- **Cleanup order:**
  - set (`image.ts:97-152`) reads without a lock, uploads, runs one compare-and-set transaction, then deletes the old file after commit.
  - When the compare-and-set loses, the new file is deleted and the request gets 409 or 404 (`image.ts:145-150`).
  - A throw before the update applies deletes the new file (`image.ts:141`).
  - remove (`image.ts:163-191`) locks the row, nulls the id and writes the audit row, then deletes the file after commit. No Drive call happens inside the transaction.
  - Deleting the whole device type deletes its file after commit (`[id]/route.ts:41`), and `discardImageFile` never throws (`image.ts:55-66`).
  - I traced the races: two concurrent sets, set against remove, set against deleting the type. None of them leaves the row pointing at a deleted file.

### Findings

- 🟢 **`src/server/device-types/image.ts:138-141`: an audit failure leaves an orphan file it could delete.** `applied` becomes true as soon as the UPDATE returns. If `writeAudit` then throws, `withTx` rolls back (`src/server/db/tx.ts:17-23`), so the row certainly still points at the old file. The new file is still kept and logged as an orphan. Only a failed COMMIT is truly uncertain. Fix: set a flag just before `commit`, or catch the `writeAudit` error inside the callback and mark it as a definite failure, so the audit-failure case deletes the new file. This is low impact because orphans are already accepted.
- 🟢 **`src/lib/validate/png.ts:57-61`: a valid PNG can carry any extra chunk type** (`tEXt`, `zTXt`, `iTXt`, private chunks). Those chunks can hold arbitrary data up to about 20 KB, such as HTML/JS polyglot text or a small zlib bomb in `zTXt`/`iCCP` (roughly a 1000× inflation limit). The fixed `image/png`, `nosniff` and `sandbox` CSP stop it from running as a page, which is the mitigation A7 accepted. Suggested hardening: allow only IHDR, PLTE, tRNS, IDAT, IEND (and optionally sRGB, gAMA, pHYs) and give `image_not_png` for anything else. Optionally also check the IHDR compression, filter and interlace bytes and the bit depth / colour type pair.
- 🟢 **`src/server/request/read-bytes.ts:23-24`: no read deadline.** A client that sends a chunked body very slowly keeps the handler open with no time limit. This is admin-only and capped at 20 KB, so the risk is low. Possible fix: race `reader.read()` against a timeout of about 10 s, then cancel and return `read`.

### Follow-ups (out of scope)
- An orphan sweep. Orphan logs hold only `typeId` (by design), so the sweep must find files by the Drive `appProperties` `{app:"simap", orgId}` and compare them with `device_types.image_drive_file_id`. This is already a ticket follow-up.
- Optional `Cross-Origin-Resource-Policy: same-origin` on GET. Not needed now, because the bearer token already blocks cross-origin embedding.
- No rate limit on admin PUTs (each one uploads to Drive). Worth tracking if abuse by a compromised admin account is a concern.

### Files reviewed
- /home/user/simap/src/app/api/device-types/[id]/image/route.ts
- /home/user/simap/src/app/api/device-types/[id]/route.ts
- /home/user/simap/src/server/device-types/image.ts
- /home/user/simap/src/server/device-types/device-types.ts
- /home/user/simap/src/lib/validate/png.ts
- /home/user/simap/src/server/request/read-bytes.ts
- /home/user/simap/src/server/drive/drive.ts
- /home/user/simap/src/server/drive/client.ts
- /home/user/simap/src/server/http/org-scope.ts
- /home/user/simap/src/server/http/with-auth.ts
- /home/user/simap/src/server/http/respond.ts
- /home/user/simap/src/server/db/tx.ts
- /home/user/simap/work/tickets/SIM-036.5/plan.md

The test files exist (png, read-bytes, image, image.db, image-routes), but I did not read them.
