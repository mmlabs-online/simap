## Findings

### Part 1: release tag into the image

- `.github/workflows/release.yml`
  - The tag is `steps.version.outputs.tag`, which is always `vX.Y.Z` (branch regex enforced).
  - `docker/build-push-action@v6` (lines 89-101) passes no `build-args`, and the header comment says "no version build arg".
  - `cache-from/to type=gha,scope=image` is shared with the CI image job.
  - The workflow also writes `SIMAP_VERSION=$TAG` into the deployment repo's `release.env`. That is a compose-side runtime value, not read by the app today.
  - The file is a High path.
- `Dockerfile`
  - The build stage runs `RUN NEXT_TELEMETRY_DISABLED=1 pnpm build` (line 15), with an "inline variable, never ENV" comment.
  - The runtime stage sets only `NODE_ENV`, `HOSTNAME` and `PORT`.
- `next.config.ts` has no `env` block. The only existing `NEXT_PUBLIC_*` vars are `NEXT_PUBLIC_MM_IDENTITY_BASE`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and the dev flags. They are read in `src/proxy.ts`, `src/ui/auth/runtime.ts` and `AuthGate`.
- `scripts/check-image.sh` is shared by the CI `image` job and the release workflow's "verify pushed digest" step. Two assertions constrain the design:
  - "no secrets in image" fails on any env NAME in `.Config.Env` matching `KEY|SECRET|TOKEN|PASSWORD`. A name like `SIMAP_RELEASE_TAG` is fine. `*_TOKEN_*` names are not.
  - "image config" requires that the `NEXT_` / `SIMAP_` / `MM_IDENTITY_` / `DATABASE_URL` env set in the image equals exactly `HOSTNAME`, `NODE_ENV` and `PORT`. A runtime `ENV SIMAP_VERSION=...` or `ENV NEXT_PUBLIC_...` in the Dockerfile would therefore FAIL the check.
  - The history check also rejects `NEXT_TELEMETRY.*ENV` and `DATABASE_URL` in `docker history`. A `RUN` line carrying the inline version would show in history but is not matched, so that is OK.
- The CI `image` job (ci.yml lines 64-90) is `docker/build-push-action@v6` with no build-args, `load: true`, tag `simap:ci-local`, then `check-image.sh`. It builds without a tag today, so any build-arg must be optional with a default.

### Part 2: device type image limits (D68)

- `src/lib/validate/png.ts`
  - `IMAGE_LIMITS = { px: 24, maxBytes: 20480 }` (line 2).
  - `validatePng` reads width and height from IHDR and compares them only at line 69: `width === px && height === px`. Everything else (CRC, chunks, APNG) is size-independent.
  - `PngResult` codes are `image_not_png` and `image_bad_size`.
- Consumers of `IMAGE_LIMITS`:
  - the route (`readBytes(req, IMAGE_LIMITS.maxBytes, "image/png")`);
  - `src/ui/deviceTypes/device-type-image.ts` (client check, lines 15 and 22);
  - `src/ui/copy/deviceTypes.ts:23`, which builds the hint from `IMAGE_LIMITS.px` and `maxBytes/1024`.
- Route `src/app/api/device-types/[id]/image/route.ts` (PUT)
  - `readBytes` refuses an over-cap content-length or stream with `too_large`, which the route maps to `image_too_large`. Any other reason maps to `image_not_png`.
  - Changing `IMAGE_LIMITS.maxBytes` is enough there. `readBytes` itself takes the cap as a parameter.
- Error codes are already registered in `src/lib/api/error.ts:53-55` (`image_not_png`, `image_bad_size`, `image_too_large`). The AC says "existing codes", so no new code is needed.
- Copy in `src/ui/copy/api.ts:63-64` is hardcoded:
  - `image_bad_size`: "The image must be exactly 24 x 24 pixels."
  - `image_too_large`: "The image is too large. The limit is 20 KB."
  - Both must change and should derive from the limits.
- **Blocker found: `DRIVE_MAX_BYTES = 64 * 1024` in `src/server/drive/client.ts:35`.**
  - It is enforced on upload (line 348, `createFile` throws `drive_too_large`) and on download (lines 126 and 138, `getFile`).
  - A PNG between 64 KB and 100 KB would pass `validatePng` and `readBytes`, then fail at Drive with `drive_too_large`. It would not fail on read-back either.
  - The comment at line 34 says "images are at most 20 KB under D61".
  - `drive_too_large` is not a code the UI copy knows (verify its mapping in `src/server/device-types/image.ts`; I only saw it in the test's code list). It would probably surface as a 5xx or a generic error.
  - `DRIVE_MAX_BYTES` is also in the test `client.test.ts` (uses `DRIVE_MAX_BYTES + 1`, so it follows the constant).
  - The map item image spec (D66) also says "at most 64 KB" and shares this client, so it must stay valid.
  - Fix: raise `DRIVE_MAX_BYTES` to at least 100 KB (102400), or better `IMAGE_LIMITS.maxBytes`, keeping it a coarse safety cap. This is not in the ticket's listed files, so the plan must add it (R4: record it as in scope).
- Other places that hardcode 24:
  - `src/lib/sprites/placement.ts:20`: `export const DEVICE_IMAGE = 24`. The image draw op uses it for w/h and centring within the slot frame. Tests are at `placement.test.ts:369-371` and `src/ui/roomlayout/paint.test.ts:111-131` (`drawImage ... 24, 24`).
  - This is what makes a 100 px image overflow. The draw size must come from the slot's size (the slot frame from `device-slots.ts`) instead of a fixed 24, centred. Beware: if the slot is smaller than 24 anywhere, check that case too.
  - The `device-slots.ts:68` comment mentions 24 x 24.
  - Admin list preview: look in `src/ui/deviceTypes/**` for an `<img>` with a fixed size. I did not read those components, so check that it uses a bounded box with `object-contain`.
- Existing tests to update:
  - `src/lib/validate/png.test.ts:68` asserts `IMAGE_LIMITS` equals `{px:24,maxBytes:20480}`. Lines 70-74 and 114-115 cover size cases.
  - `src/app/api/device-types/image-routes.test.ts:153-154` uses 20481 (content-length and body). Line 157 uses `pngOf(23, 24)`, which stays invalid under a 24 minimum.
  - `src/ui/deviceTypes/device-type-image.test.ts:63-87` covers 24 x 24, 16 x 16 and 24 x 32 as bad size, and 20481 and `png(24,24,20480)` as the size boundary.
  - `src/server/request/read-bytes.test.ts` uses its own 20480 literal, which is independent and can stay.
  - The new tests the ticket asks for are 24, 64, 100, 101, non-square and the 100 KB boundary.
- Stored 24 x 24 images stay valid. The range 24-100 includes 24, so no migration and no re-validation is needed. Reads (GET) do not re-validate, and the 64 KB download cap covers existing images, which are at most 20 KB.
- `docs/spec-v1.md:271` (24 x 24 px PNG image) and `docs/requests/deployment-simap-drive.md:78` still say 24 x 24. The spec wins over tickets, so the planner should update the spec line to D68 (or note the conflict).

## Recommendations

1. **Version transport: use a build arg to a build-time constant, not a runtime env.**
   - A runtime env would need `ENV` in the image, which `check-image.sh` forbids (it allows exactly three app envs). A compose-injected `SIMAP_VERSION` would also need a deployment-repo change, outside this repo.
   - Add `ARG SIMAP_VERSION=dev` in the build stage of the Dockerfile only (not the final stage, so it never lands in `.Config.Env`).
   - Pass it inline on the build line, for example `RUN NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_SIMAP_VERSION="$SIMAP_VERSION" pnpm build`. This matches the existing "inline, never ENV" convention.
   - `ARG` values appear in `docker history`, but the tag is public, so that is fine. The `check-image` history grep does not match it.
   - Alternative that avoids the `NEXT_PUBLIC_` prefix: an `env: { ... }` entry in `next.config.ts`, or generating a `src/lib` constant. Both keep the same effect, so prefer the simplest: `NEXT_PUBLIC_SIMAP_VERSION`, read in a small `src/lib/version.ts` helper.
   - `NEXT_PUBLIC_*` is inlined at build time. Because `process.env.NEXT_PUBLIC_X` must be referenced literally to be inlined, the helper must reference it literally and not through dynamic access.
2. **Helper (`src/lib/version.ts`)**
   - Pure function: accept the raw value, return it if it matches `^v\d+\.\d+\.\d+$`, otherwise `"dev"`. This covers unset, empty and malformed input.
   - It validates the value (AC R3) and cannot leak other build data, since only this one value is exposed.
   - Test cases: valid, missing, empty, `v1.2`, `1.2.3`, a value with whitespace or newline, and a long junk value.
3. **release.yml**
   - Add `build-args: SIMAP_VERSION=${{ steps.version.outputs.tag }}` to the build-push step.
   - The value is derived from a regex-validated branch name, so there is no injection risk. Keep it in `with:` and do not interpolate it into a `run:` shell.
   - Update the header comment that says "no version build arg".
   - Optional: also add a cheap post-build assertion in "verify pushed digest" (for example, grep the tag in `.next/static` of the pulled image). That is the only way to mechanically prove AC 1.
4. **CI `image` job and `check-image.sh`**
   - No change is needed for the build (no arg means `dev`).
   - Optionally add a check-image assertion that the image has no `SIMAP_VERSION` or `NEXT_PUBLIC_SIMAP_VERSION` in `.Config.Env`. Existing assertions already enforce this.
   - To test the arg path in CI, the image job could pass `build-args: SIMAP_VERSION=v0.0.0` and check that the string appears in `.next/static`. This changes the shared cache scope, so it is optional.
   - A build with no arg must succeed and show `dev`. The `ARG` default handles that.
5. **`pnpm dev`** shows `dev` automatically, because the variable is unset.
6. **Image limits**
   - Set `IMAGE_LIMITS = { min: 24, max: 100, maxBytes: 102400 }` (or similar). Keep one source: change the `png.ts` check to `width === height && width >= min && width <= max`. Keep the codes (`image_bad_size` for out-of-range or non-square).
   - Make the copy in `src/ui/copy/api.ts` and `deviceTypes.ts` derive from the limits (or at least update the text). For example: "The image must be square, from 24 x 24 to 100 x 100 pixels." and "The limit is 100 KB." Update the hint to "PNG, square, 24 to 100 px, up to 100 KB".
   - Raise `DRIVE_MAX_BYTES` (see the blocker), and add a client test for it plus a route-level test that a 100 KB PNG passes.
   - In `placement.ts` / `paint.ts`, replace the fixed `DEVICE_IMAGE = 24` with the slot size. Add a test that a 100 px image draws at the slot's size (the ticket's test plan item).

## Risks

- **Drive 64 KB cap** (above). Without the fix, valid 65-100 KB uploads fail at the Drive layer, and the UI shows a wrong error.
- Adding `ENV` or `ENV NEXT_PUBLIC_*` in the final stage breaks `check-image.sh`.
- `NEXT_PUBLIC_*` must be present at `pnpm build`. Setting it only at runtime does not change the bundle, so a deployment-side `SIMAP_VERSION` (compose) would be ignored. The release image is pinned by digest and built once, so the build arg is the correct transport.
- GHA layer cache: the arg changes only the build layer, so a release always rebuilds the `pnpm build` layer. This is acceptable, because `COPY . .` already invalidates it.
- `release.yml` is a High path, so the plan needs Ming's approval.
- Image drawing: a 100 px image drawn at 24 px has no smoothing by default if the paint code sets `imageSmoothingEnabled=false`. A scaled-down pixel image may look rough. Check `paint.ts`.
- A larger image raises the data-URL or fetch cost of the map slightly (100 KB max per type). The map caches by `version`, so the impact is small.

## Open questions

1. Is a smaller draw size on the map expected (the slot's size), and what is the slot's size for each kind? The ticket says "slot size", but `DEVICE_IMAGE=24` is used as both the draw size and the slot-fit constant.
2. Should `DRIVE_MAX_BYTES` be derived from `IMAGE_LIMITS.maxBytes`, or stay a separate constant raised to 100 KB? Map item images (D66, 64 KB) share the client.
3. Should the version also be shown when signed out (login screen)? The ticket says signed-in users only, in the shell.
4. Does `src/server/device-types/image.ts` map `drive_too_large` to a UI code? I did not read it. If not, a client error code is needed, or the raised cap makes it unreachable.
5. Update `docs/spec-v1.md:271` to D68 in this ticket? (The spec is the source of truth and currently says 24 x 24.)

Files examined: /home/user/simap/work/tickets/SIM-040/ticket.md, /home/user/simap/Dockerfile, /home/user/simap/next.config.ts, /home/user/simap/.github/workflows/release.yml, /home/user/simap/.github/workflows/ci.yml, /home/user/simap/scripts/check-image.sh, /home/user/simap/src/lib/validate/png.ts, /home/user/simap/src/app/api/device-types/[id]/image/route.ts, /home/user/simap/src/server/request/read-bytes.ts, /home/user/simap/src/server/drive/client.ts.
