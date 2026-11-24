**Findings**
- Patterns: routes are `withAuth(handler, {tier})`. `user` is any member and `admin` is Admin only; the auth codes come only from the wrapper (R7). Handlers follow one order: id check (`isCanonicalUuid` → 404), `getPool()` (null → 503 `unavailable`), `readJson`, the lib validator (→ 400 `invalid_request`), a server function returning `{ok, status, code}`, then `apiError`. Responses carry `Cache-Control: no-store`. See `src/app/api/devices/route.ts` and `devices/[id]/route.ts`.
- `readJson` (`src/server/request/read-json.ts`) is JSON-only. It checks content-type, checks `content-length`, and caps the size while streaming. There is no binary reader yet.
- `LayoutResponse.seatDevices` is `Record<seatId, {type: string}[]>`, defined in `src/lib/sprites/layout.ts:35`. The query is in `src/server/layout/layout.ts` (lines 93-107).
- Drive (`src/server/drive/drive.ts`): `getDrive()` returns null when Drive is off. It can throw `DriveConfigError` when the config is partial. `OrgDrive` has `uploadOrgFile(orgId, {name, mimeType, bytes})`, `getFile(id)` and `deleteFile(id)`; `deleteFile` treats an already-gone file as success. `getFile` and `deleteFile` do no org check. `DriveError` has a `code` such as `drive_auth` or `drive_not_found`.
- Migrations so far: init, members, room_tile_layout. There is no org-bootstrap table in the migration list, so org rows come from Identity claims. Seeding orgs created after the migration is a real problem.

**Recommendations**

*Routes (all under `/api`)*
- `GET /device-types` (user tier) and `POST /device-types` (admin).
- `PATCH /device-types/{id}` (admin; body `{name?, slot?}`) and `DELETE /device-types/{id}` (admin, 204).
- `PUT /device-types/{id}/image` (admin) and `DELETE /device-types/{id}/image` (admin, 204).
- `GET /device-types/{id}/image` (user).
- No separate slot route. Put rename and slot change in PATCH.
- The DTO is `{id, name, slot, hasImage, imageVersion}`. Never expose the Drive file id.

*Upload*
- Use a raw `image/png` body, not multipart. Multipart parsing adds attack surface and the client has a `Blob` anyway. Add `readBytes(req, maxBytes, contentType)` beside `readJson`. It should check content-type exactly, check `content-length`, and cap the size while streaming.
- Use a hard cap of 20 KB (20480). Return 413 or 422, with one fixed code such as `image_too_large`.
- Put the PNG parsing in `src/lib/validate/png.ts` as pure code with unit tests. Check the 8-byte signature, require the first chunk to be IHDR (length 13), read width and height as big-endian u32 and require both to be 24. Return a specific 422 code for each failure (`image_not_png`, `image_bad_size`).
- Consider also checking that the bytes end with IEND. Skip a full decode.
- Choose the Drive file name server-side, for example `devtype-<typeId>-<random>.png`. Never use a client filename. Always upload with mimeType `image/png`.
- R7 order for PUT: the wrapper first, then id check, pool, read and validate the body (422), then the DB row lookup scoped by org (404), then `getDrive()`. When it is null, return 503 `images_unavailable`. After that comes the Drive call.
- Map every `DriveError` and `DriveConfigError` to a fixed 502 or 503 code (`images_unavailable` or `drive_error`). Never forward `err.code`, and never map `drive_auth` to 401/403.

*DB and Drive ordering*
- PUT: read the old `image_drive_file_id` → upload the new file → one UPDATE `... where org_id=$1 and id=$2` that sets the new id and `image_version = image_version + 1`, ideally compare-and-set on the old id → after commit, delete the old file on a best-effort basis (log, never fail the request).
- If the UPDATE fails or matches no row, delete the new file, also best effort.
- Image DELETE and type DELETE: the DB write first (set null, or delete the row), then delete the Drive file after commit, best effort. A leftover orphan in Drive is acceptable. A DB row that points at a missing file is not.
- If Drive is off, DELETE of an image or type should still succeed in the DB and skip the Drive delete. This leaves an orphan in Drive. Log it, and name it in the plan as a known follow-up (a sweep job), not a blocker.
- Add a per-type guard such as `select ... for update` on the row, so two concurrent PUTs cannot both delete the other's new file.

*Image GET*
- Look up the row with `org_id = scope.orgId` and `id`, and require a non-null file id. A miss gives 404, including across orgs.
- Then call `getFile`. Check the PNG signature on the bytes. If it fails, return a 5xx with a fixed code.
- Response headers: `Content-Type: image/png` fixed (never echo Google's), `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-cache`, and `ETag: "<imageVersion>"`.
- Honour `If-None-Match` with a 304. Do this before calling Drive, which saves a Drive round trip.
- Consider `Content-Disposition: inline` and `Content-Security-Policy: sandbox`.

*Schema*
- `device_types(org_id, id uuid, name, name_key generated or stored as lower(btrim(name)), slot, image_drive_file_id, image_version int not null default 0, created_at, updated_at)`.
- Add a unique index on `(org_id, name_key)`, a check constraint on the slot list, and the name length. The slot values should come from the SIM-035 constant in `src/lib/sprites/device-slots.ts`, kept in sync by a test.
- A duplicate name gives 409 `name_taken`, caught as a unique violation.
- Seeding: the migration seeds the orgs that exist now. For later orgs, seed lazily on first list or first admin write, with `insert ... on conflict do nothing` in the same query path.
- Problem: an admin who deletes a seeded type could see it come back. So add a per-org `device_types_seeded_at` marker, or seed only when the org has zero rows and no marker. Planner to decide. The marker is safer.

*Layout*
- `SeatDevice = { type: string; deviceType: {id, slot, imageVersion, hasImage} | null }`. Add it as an optional-additive field so existing consumers and fixtures keep compiling.
- Resolve with a LEFT JOIN on `lower(btrim(devices.type)) = device_types.name_key` and `org_id`. Use the same normalization function in SQL and TS, and add a test for it.
- Do not include the image bytes or the Drive id. The map fetches `GET .../image` with the bearer and uses `?v=<imageVersion>` as a cache buster.

*Drive off*
- The catalog CRUD works. The list returns `hasImage` as stored. The image PUT, and the GET when a row has an image, return a fixed 503 `images_unavailable`. DELETE of an image works in the DB as described above.

*Slice size*
- It is large for one slice because the migration is a High path, and it adds a catalog, a binary route and a layout change. I suggest two slices.
  - SIM-036.2a: migration, seed, catalog CRUD, layout `deviceType` resolution, and the spec update.
  - SIM-036.2b: image PUT/DELETE/GET, `readBytes`, PNG validator, Drive ordering, fake-Drive tests.
- If kept as one, run the plan gate on the migration first.

**Risks**
- A late 401/403 mapped from `drive_auth` would let `apiFetch` re-send the upload (R7).
- Orphan files in Drive after a failure between the upload and the commit.
- Two orgs sharing a name in the `lower(btrim())` index: make sure the index includes `org_id`.
- Seed resurrection after an admin deletes a seeded type.
- Prod secrets are not deployed (A6 from SIM-036.1), so the image endpoints stay at 503 until the deploy ticket lands.

**Open questions**
1. Should the status for an oversized or non-PNG body be 413 or 422? The ticket says 422 for both, so I assume 422 throughout.
2. Seed approach for orgs created after the migration: lazy with a marker, or at first Admin access?
3. Should deleting a type that is in use by devices warn? The ticket says no, but a `delete-impact` route like rooms and groups have would be cheap. It is probably a later slice.
4. Which values go in the slot list? Confirm they match the SIM-035 constants.
5. Max number of types per org, as a cap, for example 100 (also bounds the Drive folder size).
