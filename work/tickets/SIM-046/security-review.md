# Security review — SIM-046

## Attempt 1

Summary: no blockers. Upload validation, serving headers, R6 org scoping, R7 and Drive id hygiene all hold. Two small should-fix items and three notes, all in the metadata strip and orphan logging.

Scope read: `src/lib/validate/photo.ts`, `src/lib/validate/png.ts`, `src/server/members/photo.ts`, both route files, `src/server/request/read-bytes.ts`, `src/server/drive/image-flow.ts` (`mapDriveFailure`), `src/server/drive/client.ts` (`DRIVE_MAX_BYTES` and the read cap), the migration and `orgQuery`. I had no shell, so I could not run the checks or the tests. I did not read the test files. My conclusions come from reading the code.

### Findings

🟡 1. The JPEG strip stops looking at the first SOS, so metadata segments between progressive scans are kept.
- Where: `src/lib/validate/photo.ts:136-139` (strip copies everything from the first `0xDA` on) and `photo.ts:53-54` (the parser accepts any length-carrying segment between scans, including APP1, APP13 and COM).
- Risk: a progressive JPEG with an Exif/GPS APP1 or a COM segment after the first scan passes validation and is stored with that metadata. Normal encoders do not do this, so the impact is limited to the uploader's own data. Still, it breaks the A3 promise ("APP1/APP13/COM removed"), and the planned test only covers segments before the SOS.
- Fix (one of):
  - (a) After each scan's entropy data, keep walking segments and apply `JPEG_DROP` to them too.
  - (b) Simpler: make `parseJpeg` refuse APPn and COM once `sos === true`. Only DHT, DQT, DRI, SOS and EOI are valid between scans.
  - Either way, add a test: "progressive JPEG with APP1 between scans: stripped (or refused)".

🟡 2. The orphan log has only `memberId`, so a commit-unknown orphan is hard to find.
- Where: `src/server/members/photo.ts:26` and `:120`.
- Risk: when the audit insert or COMMIT fails after the update, the file is kept and logged as `drive_orphan {memberId}`. If the transaction actually rolled back, the file stays in the org's Drive folder with no DB reference. Without the Drive id or the upload name, cleanup means listing the folder by the `photo-<memberId>-` prefix and matching against the DB. This is not a leak; it is an operations gap.
- Fix: add the random file-name suffix (the UUID the server chose, not the Drive id) to the orphan log, e.g. `{ event: "drive_orphan", memberId, name: "photo-<id>-<uuid>.jpg" }`. This keeps the "never log the Drive id" rule and makes the orphan traceable. If that is out of scope, make it a follow-up, as it matches the device-type precedent.

💭 3. Some non-image data survives the strip by design, and the serving headers cover it.
- Where: `photo.ts:108-109`.
- What survives: JPEG APP2-APP12, APP14 and APP15, and PNG private or ancillary chunks other than the five dropped ones. These can carry arbitrary bytes, such as an HTML/JS payload.
- Why it is safe: `nosniff`, `Content-Security-Policy: sandbox`, a Content-Type from the magic bytes and serving behind the bearer stop it from being run as a page. No change needed. Just do not drop those headers in slices 2 and 3.
- Optional hardening: switch the JPEG strip to an allow-list (keep APP0, APP2 ICC_PROFILE, APP14 Adobe, DQT, DHT, DRI, SOF, SOS).

💭 4. Many phone JPEGs will be refused because they carry data after the first EOI.
- Where: `photo.ts:40`.
- Cause: Android Ultra HDR and MPF secondary images, and Samsung trailers, sit after the first EOI. The no-trailing-bytes rule refuses them with `image_not_supported`.
- This is the safe choice (no polyglot tail). It is a UX cost, not a security problem. Slice 2's copy and client pre-check should say "re-save or crop the image" for this case.

💭 5. Deactivated members' photos can be read with GET by id.
- Where: `src/app/api/members/[id]/photo/route.ts:18-42`, any user in the same org.
- This matches A4 and OQ-58. It is noted only so the choice stays visible if OQ-58 changes.

### Verified OK
- **Validation runs before any DB or Drive call.** The PUT order in `src/app/api/me/photo/route.ts:19-31` is `readBytes`, then `validatePhoto`, then strip, then validate again, then `getPool`. The Content-Type allow-list and the declared and streamed caps are in `read-bytes.ts:16-35`. The size check comes before parsing (`photo.ts:74`), and the magic bytes pick the format (`:78-90`).
- **APNG is refused:** `acTL` is rejected at `png.ts:59`.
- **Truncated or polyglot PNG is refused:** chunk bounds and CRC are checked, and IEND must be last with nothing after it (`png.ts:43-67`).
- **JPEG structure is strict:** every segment length is ≥ 2 and stays inside the buffer (`:44`); only one SOF, and only C0-C2 (`:46`); `Nf` must be 1 or 3, with the matching length (`:48`); zero height (DNL) is refused (`:51`); SOS must come after the SOF (`:55`); a nested SOI or a stray standalone marker is refused (`:41`); EOI must be the last 2 bytes (`:40`); the scan loop is bounds-checked and always moves forward; dimensions are capped at 512 px, so there is no decompression bomb.
- **Strip, PNG side:** it relies on the earlier validation and is checked again at `route.ts:27-29`. A failure throws a 500 with no side effect. The same re-validation runs on every GET read (`src/server/members/photo.ts:202-206`).
- **Serving headers:** both GET handlers send `private, no-cache`, `nosniff`, `inline`, `CSP: sandbox`, `Content-Length` and a Content-Type from the bytes. A 304 keeps the ETag and Cache-Control headers and is answered before any Drive call (`photo.ts:199`).
- **R6:** every query goes through `orgQuery`, which enforces `org_id = $1` and puts `scope.orgId` first (`src/server/http/org-scope.ts:21-24`); the Drive id is only used after the org-scoped row lookup; a cross-org or non-UUID id gives a 404, and the UUID check runs before `getPool` (`[id]/photo/route.ts:21`, `:47`).
- **R7:** no handler returns 401 or 403; the deactivated race gives 409 `not_allowed` (`photo.ts:73`, `:129-131`, `:151`); Manager removal is its own `{ tier: "manager" }` DELETE handler (`[id]/photo/route.ts:44-55`); there is no PUT export, so Next answers 405.
- **The Drive id never leaves the server:** the DTO is only `{hasPhoto, photoVersion}`; audit meta is `{version, self, type, bytes}` or `{version, self}`; logs carry only event, op and code, or `memberId` (`image-flow.ts:33-45`, `photo.ts:26`, `:204`); the ETag is `"<memberId>-<version>"`.
- **Orphans:** a lost CAS or a pre-update failure deletes the new file. The old file is deleted after commit, best effort. Drive-off removal still works (DB first).
- **Drive cap:** `DRIVE_MAX_BYTES = 256 KB` applies to both upload (`client.ts:352`) and download (`client.ts:127-144`).
- **Migration:** expand-only and nullable, with a constant default and a constraint on the id format. It is forward-only (R2).
- **R3:** no secrets and no new env vars.

### Follow-ups (out of scope)
- If finding 2 is deferred: make orphan logs traceable (the file-name UUID) for both device-type images and photos.
- Slice 2 and 3 UI: keep the photo out of `src/ui/roomlayout/**` and `src/lib/sprites/**` (AC4 guard test), and add copy for phone JPEGs refused because of trailing data (finding 4).
