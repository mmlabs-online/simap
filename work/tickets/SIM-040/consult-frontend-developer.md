## Findings

### Part 1: release version in the shell
- `Dockerfile` has no `ARG`. `RUN NEXT_TELEMETRY_DISABLED=1 pnpm build` is an inline variable ("never ENV" comment), and the runtime stage sets only NODE_ENV/HOSTNAME/PORT.
- `release.yml` (`build and push`, docker/build-push-action@v6, lines ~89-101) has no `build-args`. The tag is `steps.version.outputs.tag`, already validated as `vX.Y.Z` and higher than the last tag.
- `ci.yml` `image` job builds `simap:ci-local` with no arg and runs `scripts/check-image.sh`. The `release.yml` verify step runs the same script on the pushed digest.
- Existing build-time pattern: `NEXT_PUBLIC_*` is read in `src/proxy.ts`, `src/ui/auth/runtime.ts`, `AuthGate.tsx`. `.env.example` lists the names.
- `AppShellView.tsx` is a presentational, router-free component. It takes `session` and `actions` as props and has tests in `AppShellView.test.tsx`. The header has the brand, orgName, dev badge and avatar. The nav rail (lg) is `w-[88px]`, and `session` gates it. All copy is in `src/ui/copy/shell.ts` (`shellCopy`).
- `AppShell.tsx` wraps the view, and `src/app/dev/shell/page.tsx` also renders it.

### Part 2: device type images
- `IMAGE_LIMITS = { px: 24, maxBytes: 20480 }` in `src/lib/validate/png.ts`. It is used by:
  - `validatePng`, which has the final check `width === px && height === px`;
  - the route `src/app/api/device-types/[id]/image/route.ts` (`readBytes(req, IMAGE_LIMITS.maxBytes)`);
  - the client check `checkImageFile` in `src/ui/deviceTypes/device-type-image.ts` (it reuses `validatePng`, so no separate size logic);
  - the hint in `src/ui/copy/deviceTypes.ts:23`, a template built from `IMAGE_LIMITS.px` and `maxBytes`.
- Hard-coded copy that will go stale in `src/ui/copy/api.ts:63-64`: `image_bad_size` = "exactly 24 x 24 pixels", `image_too_large` = "limit is 20 KB".
- Stale comments that mention the old limits:
  - `src/server/drive/client.ts:34` ("at most 20 KB under D61");
  - `src/lib/sprites/device-slots.ts:68` ("24 x 24").
  The drive client's max file size may need a check if it is derived from 20 KB. I did not read it.
- Room map:
  - `placement.ts:20` has `DEVICE_IMAGE = 24`. Lines 270-280 emit an `image` op with `w/h = DEVICE_IMAGE`, centred in the desk frame `f` (`floor((f.w - 24)/2)`).
  - `paint.ts:72-75` already calls `ctx.drawImage(src, op.x, op.y, op.w, op.h)`. The 5-argument form scales to the op size, and `imageSmoothingEnabled = false` is set at line 63. So the painter needs no change. Only the op size is fixed at 24.
  - Because the slot is the 24 px box, a 100 px image drawn into it is downscaled with nearest-neighbour, which looks bad. The fix is to draw into a slot size, as the ticket says.
- Admin preview: `DeviceTypeThumb.tsx` is a 48 px `<img>` with `object-contain` and pixelated rendering. It already fits a larger image into its box. Pixelated is wrong for downscaling a 100 px image.
- Tests that pin 24: `placement.test.ts:369-371`, `paint.test.ts:111-131`, plus the PNG validator and `device-type-image` tests.

## Recommendations

### Version (AC 1-5)
1. Use a build-time constant (no request, no secret).
   - Dockerfile: `ARG SIMAP_VERSION=dev` in the build stage, then `RUN SIMAP_VERSION="$SIMAP_VERSION" NEXT_PUBLIC_SIMAP_VERSION="$SIMAP_VERSION" NEXT_TELEMETRY_DISABLED=1 pnpm build`. Keep it as an inline variable, not `ENV`, so there is no runtime leak.
   - `release.yml`: add `build-args: SIMAP_VERSION=${{ steps.version.outputs.tag }}` to the build step. The tag is already shape-validated.
   - `ci.yml` `image` job: no change. The default `dev` keeps `check-image` working.
2. Add `src/lib/version.ts` (pure, in lib). `parseVersion(raw: string | undefined): string` returns the value if it matches `/^v\d+\.\d+\.\d+$/`, otherwise `"dev"`. Export `APP_VERSION = parseVersion(process.env.NEXT_PUBLIC_SIMAP_VERSION)`.
   - Next only inlines `process.env.NEXT_PUBLIC_X` when it is written literally, so keep that literal access.
   - An empty or unset value gives `dev`, so the `pnpm dev` AC holds.
3. `shellCopy.version = (v: string) => \`simap ${v}\``. For `dev` this renders "simap dev"; the planner should decide the wording.
4. Placement: a small text in the header, or the nav rail footer. The rail only exists when `session` is set and is hidden below lg (bottom bar), so use the header for "visible to every signed-in tier" on all viewports.
   - Suggested: in the `session &&` block, next to the avatar/RoleBadge, `<span className="hidden sm:inline text-[11px] text-on-surface-variant">`. Or add an optional prop `version?: string`, defaulting to `APP_VERSION` and overridable in tests. That avoids mocking the env.
5. Tests:
   - Unit-test `parseVersion` with `v1.2.3`, undefined, "", `1.2.3`, `v1.2`, `v1.2.3-rc`, `v1.2.3\n` (check the `$` anchor) and a long junk string.
   - Render `AppShellView` with a signed-in session for each tier and assert the text. Assert it is absent or harmless when signed out (the ticket says signed-in).
   - Optional: a `check-image`/CI step that `grep`s the built `.next/static` for the tag is probably overkill. A manual check after release is what the ticket plans.
6. Document `SIMAP_VERSION` (build arg, not a secret) in `README` "Release and deploy". `.env.example` is not needed for a build arg, or add a comment.
7. `release.yml` and the `Dockerfile` are High paths, so this needs plan approval.

### Images (AC 6-7)
1. `png.ts`: replace `px` with `minPx: 24, maxPx: 100`, `maxBytes: 102400`. The final check becomes `width === height && width >= minPx && width <= maxPx`; keep it as `image_bad_size`.
   - The order is unchanged: structure first (`image_not_png`), then size. The route and client need no logic change.
   - Update the doc comment to D68.
   - Check that the route's `readBytes` cap and any body limit (Next `proxyClientMaxBodySize`, if set) allow 100 KB.
   - Check the DB column, if there is a `bytea` size CHECK or limit. R2 would need a forward-only migration if one exists. Grep `db/migrations` for 20480 or `octet_length`.
2. Copy:
   - Hint: `PNG, square, ${minPx} x ${minPx} to ${maxPx} x ${maxPx} px, up to ${maxBytes/1024} KB`.
   - `api.ts` image_bad_size: "The image must be square, from 24 x 24 to 100 x 100 pixels." image_too_large: "The limit is 100 KB." Better to derive both from `IMAGE_LIMITS` as `deviceTypes.ts` does, to prevent drift. Check `copy/api.ts` is allowed to import lib.
   - Update any test that asserts the old strings.
3. Map scaling. Define the slot's drawn size in `placement.ts`. Keep `DEVICE_IMAGE` as the slot box (24), or raise it; this is a product choice, see the open question. The op keeps `w = h = slot` and `paint.ts` already scales with `drawImage(src, x, y, w, h)`.
   - Because the op is square and the image is validated square, there is no aspect-ratio work.
   - For quality when downscaling 100 px to 24 px, set `ctx.imageSmoothingEnabled = true` (with `imageSmoothingQuality = "high"`) only for image ops, then restore it. Nearest-neighbour downscaling of 100 to 24 is non-integer and noisy, which is the "broken" look Ming mentioned.
   - Alternative: pre-scale once per image into a cached offscreen canvas at slot size × zoom, to avoid re-filtering every frame. Probably unnecessary.
   - If upscaled small images (24 to 32 px slot) should stay crisp, choose smoothing by `src.width <= slot`. This needs the natural width at paint time; `CanvasImageSource` has width/height for `HTMLImageElement` and `ImageBitmap`, so it is feasible but adds branching. A simpler rule is smoothing off when the source is no larger than the op, on otherwise.
4. Preview: `DeviceTypeThumb` stays at 48 px. Drop `pixelated` for images over 48 px, or use `image-rendering: auto` for sources above 48 px. You can also keep `pixelated` for 24 px images, since upscaling 24 to 48 is exactly 2x. The `onLoad` natural size is available, or just use `auto` always.
   - Also check `DeviceTypeImageField.tsx` preview and `DeskSlotDiagram.tsx` for fixed 24 or 48 assumptions. I did not read them.
5. Tests:
   - PNG validator at 24, 64, 100 (accept), 23, 101, 24x25 (`image_bad_size`), and a file at exactly 102400 bytes (accept) and 102401 (`image_too_large`, in `device-type-image.test.ts`). Existing PNG fixture helpers may hard-code 24.
   - `placement.test.ts`: the op's w/h equals the slot size regardless of the source image; it has no image-size input today.
   - `paint.test.ts`: the `drawImage` call is `[src, x, y, slot, slot]` with a 100 px mock source.
   - Update `placement.test.ts:369-371` if the slot constant changes.

## Risks
- The `NEXT_PUBLIC_*` value is replaced at `next build` time. A cache hit in the Docker layer or buildx GHA cache (`cache-from: type=gha`) could reuse a build layer with a stale version. The `ARG` change busts the cache for the `RUN pnpm build` layer, but verify. `COPY . .` precedes it, so a different `ARG` value invalidates only from the `ARG` use onward. That is correct, but it means every release rebuilds fully, as it does today.
- Declare `ARG` right before the build `RUN`, in the build stage. If it comes earlier, the `pnpm install` layer cache is lost.
- The `standalone` output may still embed the env in `server.js` config. The version is not secret, so this is fine.
- The version appears in the static client bundle, so a `NEXT_PUBLIC_SIMAP_VERSION` set in a dev `.env.local` could show a fake version in dev. The `parseVersion` validation limits the impact to the format only.
- Raising the image limit 5x (20 KB to 100 KB) means the layout image cache and `useDeviceTypeImages` hold more bytes, and the Drive client limit (`drive/client.ts:34`) may reject. Check it.
- Downscaling in the canvas applies per frame at zoom. With many desks this is cheap, but check the zoom path (`zoom.ts` `fitsCanvas`) is unaffected.
- Stored 24 px images keep drawing in the same slot box, so the AC for existing images holds only if the slot stays 24 or those images are scaled to the new slot. A bigger slot would blow them up with smoothing off (pixelated 2x), so that is acceptable.

## Open questions
1. Slot size on the map: keep the 24 px box and downscale 100 px images into it, or enlarge the slot (for example 32 px) so larger images are not just a sharper 24 px? The ticket says "draws inside its slot at the slot's size", which implies the slot stays fixed, but "24 is too small and looks broken" suggests Ming wants more visible detail. Ask or pick 24 and record it in the plan.
2. Version placement (header vs nav rail footer vs account menu) and wording for `dev`: "simap dev" or just "dev"? The ticket example is "simap v0.1.9".
3. Does the version also need to be exposed via an API (for example `/api/healthz`) for post-deploy checks? The ticket says UI only, and `release.env` already carries `SIMAP_VERSION` in the deployment repo. Using that as a runtime env on the server would avoid rebuilds but would need the compose file to pass it. I recommend not doing that now (out of scope).
4. Any DB constraint tied to 20 KB (migration needed under R2)? I did not check `db/migrations` for it.

Files: /home/user/simap/Dockerfile, /home/user/simap/.github/workflows/release.yml, /home/user/simap/src/ui/AppShellView.tsx, /home/user/simap/src/ui/copy/shell.ts, /home/user/simap/src/lib/validate/png.ts, /home/user/simap/src/ui/deviceTypes/device-type-image.ts, /home/user/simap/src/ui/deviceTypes/DeviceTypeThumb.tsx, /home/user/simap/src/ui/copy/deviceTypes.ts, /home/user/simap/src/ui/copy/api.ts, /home/user/simap/src/lib/sprites/placement.ts, /home/user/simap/src/ui/roomlayout/paint.ts.
