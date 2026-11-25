## Attempt 1

## Security review: SIM-040, attempt 1

**Verdict: no blockers, nothing to fix.** I found no 🔴 or 🟡 findings. All four focus areas hold. The review was read-only: I used Read and Grep only, ran no checks, and read no `.env*` values (I grepped only the `SIMAP_VERSION` name line in `.env.example`).

### Findings

**1. Nothing but the release tag reaches the client bundle or the image env (R3)** 🟢
- `/home/user/simap/Dockerfile:15-17`: `ARG SIMAP_VERSION=dev` is declared after `COPY . .`, in the build stage only. The value is passed inline on the `pnpm build` RUN, never as `ENV`.
- The runtime stage (`:19-35`) has no `ARG` or `ENV` for it. So the final image's `.Config.Env` is still only `NODE_ENV`, `HOSTNAME` and `PORT`, and both `scripts/check-image.sh` checks (`:20-21` no secret-like names, `:36` exact env set) still apply unchanged. Build-stage layers do not appear in the final image history.
- `/home/user/simap/src/ui/app-version.ts:4` reads exactly one `NEXT_PUBLIC_*` name, as a literal, through `parseVersion`. Nothing else new is exposed, and `next.config.ts` is not touched.
- `/home/user/simap/src/lib/version.ts:4-8`: the pattern is anchored, and in JS `$` without the `m` flag does not match before a trailing newline. With the 32-character limit, only `vX.Y.Z` or `dev` can be rendered.
- `/home/user/simap/.env.example:30` lists the name commented out, with no value.

**2. No workflow script injection from the tag** 🟢
- `/home/user/simap/.github/workflows/release.yml:54-57` builds `TAG` only from the bash `=~` capture of `^release/(digits).(digits).(digits)$` on `$GITHUB_REF_NAME`, which comes in through the environment, not through `${{ }}`.
- The new `build-args: SIMAP_VERSION=${{ steps.version.outputs.tag }}` (`:98`) sits in a `with:` input, not in a `run:` block, and the value can only be `v<digits>.<digits>.<digits>`.
- No new `${{ }}` was added inside a `run:` block. The test at `scripts/release-files.test.ts:106-108` pins this line.

**3. Upload size limits are still enforced end to end** 🟢
- `/home/user/simap/src/app/api/device-types/[id]/image/route.ts:28` calls `readBytes(req, IMAGE_LIMITS.maxBytes, "image/png")` before any side effect. The route stays admin-only through `withAuth` (`:38`), and size refusals stay 422 (R7).
- `/home/user/simap/src/server/request/read-bytes.ts:15` refuses a declared `content-length` over the cap. `:27` refuses again during streaming and cancels the stream, so a missing or false header does not get around the cap.
- `/home/user/simap/src/server/drive/client.ts:38`: `DRIVE_MAX_BYTES` is now 128 KB, above the 100 KB product limit. It is still applied to uploads (`:351`) and to downloads by header (`:129`) and while streaming (`:141`).
- `client.test.ts:208-209` asserts `DRIVE_MAX_BYTES >= IMAGE_LIMITS.maxBytes`, so the two limits cannot silently drift apart.
- The device type image route is still the only `readBytes` caller and the only path that uploads to Drive.

**4. PNG validation is not weakened** 🟢
- `/home/user/simap/src/lib/validate/png.ts:68-69` requires `width === height && width >= 24 && width <= 100`. Non-square, under 24 px, over 100 px, 0 and 0xffffffff all fail with `image_bad_size`.
- The structural checks are unchanged (`:31-67`): signature, CRC on every chunk, IHDR first with length 13, at least one IDAT, no APNG, IEND last with nothing after it.
- At 100 × 100 px there is no decompression-bomb risk.

**5. Map draw change** 🟢
- `/home/user/simap/src/ui/roomlayout/paint.ts:83-89` only turns smoothing on around one image op and off again. The draw size stays at the op's `w`/`h`, so a larger source image cannot change the drawn size.

### Follow-ups (out of scope)
None.
