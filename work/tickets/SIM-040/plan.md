Status: READY

# Plan: SIM-040, show the release version in the UI and allow device type images up to 100 × 100 px

## Scope summary
No spec section covers the version label. Ming asked for it directly (ticket, "Notes / answers from Ming"):
> 2026-11-25: requested by Ming ("thêm feature hiện thị version release của app").

Ticket scope (quoted):
> - Pass the release tag into the image at build time: `release.yml` passes the tag as a build arg; the `Dockerfile`
>   turns it into a value the app can read (build-time constant or runtime env).
> - Expose the version to the UI (no new secret, no request needed if it is a build-time constant).
> - Show it in the app shell (place chosen by the plan: shell footer, account menu or similar), with the copy in
>   `src/ui/copy/`.
> - Local dev and any build without a tag show `dev`.
> - Device type images (D68): accept any square PNG from 24 × 24 to 100 × 100 px, at most 100 KB, in the shared PNG
>   validator (`src/lib/validate/png.ts`, `IMAGE_LIMITS`), the upload route and the admin page's client check and hint
>   copy. The room map draws the image scaled to the device's slot size; the admin list preview fits its box.

`work/decisions.md` D68 (2026-11-25, Ming):
> Device type images may be any square PNG from 24 × 24 to 100 × 100 px, at most 100 KB (amends D61's "24 × 24 px, at
> most 20 KB"): 24 px is too small and looks broken on the layout. The map draws the image scaled to the device's slot.
> Device types only; map item images (SIM-039.4) decide later. Done in SIM-040.

**Scope addition (R4, recorded here so it is in scope):** `DRIVE_MAX_BYTES = 64 * 1024` in
`src/server/drive/client.ts:35` caps every Drive upload (`:348`) and download (`:126`, `:138`). Without raising it, a
valid 65–100 KB PNG passes `validatePng` and `readBytes` and then fails at Drive with `drive_too_large`. That code
`driveFailure` in `src/server/device-types/image.ts:39-43` maps to the generic drive error, so the user sees the wrong
message. The ticket's file list does not name this file, but AC 6 cannot pass without the change
(consult-api-platform-engineer.md, "Blocker found"). The change raises the cap and adds an invariant test.

**Spec update:** `docs/spec-v1.md:271` still says "an optional 24 × 24 px PNG image". Under CLAUDE.md ("the spec
wins; flag the conflict") this ticket updates that line to D68 and adds a change-log row, so the spec and code agree.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | An image built by `release.yml` for tag `vX.Y.Z` shows exactly `vX.Y.Z` in the UI. | `scripts/release-files.test.ts` › "build and push passes the tag as build arg SIMAP_VERSION" and `Dockerfile` cases (see Tests). Local proof: `NEXT_PUBLIC_SIMAP_VERSION=v9.9.9 pnpm build && grep -rl 'v9.9.9' .next/static` finds the chunk; `pnpm start` then shows `v9.9.9` beside "simap" in the header. Optional if Docker is available: `docker build --build-arg SIMAP_VERSION=v9.9.9 -t simap:v .`, then `docker run --rm --entrypoint sh simap:v -c "grep -rl v9.9.9 .next/static"`. The real release goes under Ming verification. |
| 2 | `pnpm dev` and a build without the build arg show `dev`; the build does not fail without it. | `src/lib/version.test.ts` (unset/empty → `dev`). `pnpm build` with no var is green (Checks). `Dockerfile` default `ARG SIMAP_VERSION=dev` is asserted in `release-files.test.ts`. The CI `image` job (no build-args) stays green. With `pnpm dev`, the header shows `dev`. |
| 3 | The version is visible to every signed-in tier in the app shell; copy lives in `src/ui/copy/` (D36). | `src/ui/AppShellView.test.tsx` › "shows the version for every signed-in tier, not when signed out". Strings live in `shellCopy.version` (`src/ui/copy/shell.ts`). |
| 4 | No secret or other build data reaches the client bundle (R3); the value is validated (`vX.Y.Z` or `dev`). | Only `process.env.NEXT_PUBLIC_SIMAP_VERSION` is read, as a literal, in `src/ui/app-version.ts`, and it passes through `parseVersion` (anchored regex). `version.test.ts` covers junk, newline and long input. The Dockerfile sets the var inline on the build `RUN` only (no `ENV`, no `ARG` in the final stage). `check-image.sh` "image config" and "no secrets" stay green in CI. Diff review: `next.config.ts` is not touched. |
| 5 | Unit test for the version helper and the shell markup; checks green; the image check (`check-image`) still passes. | `pnpm test`, `pnpm typecheck && pnpm check:layers`, `pnpm format:check`, `pnpm build` locally. CI `image` job (`scripts/check-image.sh`) green on the PR. |
| 6 | A square PNG from 24 × 24 to 100 × 100 px and at most 100 KB is accepted by the device type upload (server and client check). Refused with the existing codes: a non-square image, one larger than 100 × 100 or smaller than 24 × 24, or a file over 100 KB. Existing 24 × 24 images still load and draw. | `png.test.ts` (24, 64, 100 ok; 23, 101, 24×25, 100×99, 0, 0xffffffff → `image_bad_size`). `device-type-image.test.ts` (100×100 ok; 102400 bytes ok; 102401 → `image_too_large`; 101×101 → `image_bad_size`). `image-routes.test.ts` (102401 content-length and body → 422 `image_too_large`; a 100×100 PNG padded to 102400 bytes reaches the service). `drive/client.test.ts` (a 102400-byte upload is accepted; `DRIVE_MAX_BYTES >= IMAGE_LIMITS.maxBytes`). The existing 24×24 cases stay green. |
| 7 | On the room map, a device type image of any accepted size draws inside its slot at the slot's size, without breaking the desk drawing. The admin list preview fits its box. | `paint.test.ts` › "a 100 px source draws at the op size (24) with smoothing on for that op only" and "a 24 px source keeps smoothing off". `placement.test.ts` › existing "catalog image op ... w: 24, h: 24" stays green (the op size does not depend on the source). `device-type-image.test.ts` › `thumbRendering` cases. `DeviceTypesView.test.tsx` / `DeviceTypeImageField.test.tsx` stay green (48 px box, `object-contain`). Manual in `/dev/roommap` if Drive is configured locally; otherwise Ming verifies. |

## Ming verification after merge
- After the next release (`release/X.Y.Z`), the deployed app shows `vX.Y.Z` beside "simap" in the header.
- On production (Drive configured), upload a 100 × 100 PNG of about 60–100 KB to a device type. It saves, shows in
  the admin list at 48 px, and draws on a desk on the room map at the same size as before, smooth rather than jagged.
  An existing 24 × 24 image still draws as before.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `Dockerfile` | In the build stage, between `COPY . .` (line 13) and the build `RUN` (line 15): `ARG SIMAP_VERSION=dev`. Change line 15 to `RUN NEXT_PUBLIC_SIMAP_VERSION="$SIMAP_VERSION" NEXT_TELEMETRY_DISABLED=1 pnpm build`. Update the comment (inline, never ENV; the value is the public release tag). No `ARG`/`ENV` in the runtime stage. | AC 1, 2, 4 | **Yes** |
| `.github/workflows/release.yml` | `build and push` step (lines 89-101): add `build-args: SIMAP_VERSION=${{ steps.version.outputs.tag }}` under `with:`. It is not in a `run:` block, so the existing "no ${{ inside run blocks" test holds. Header line 6: "(no version build arg)" becomes "(plus the SIMAP_VERSION build arg, shown in the UI, SIM-040)". | AC 1 | **Yes** |
| `.env.example` | Add a commented name with a one-line note: `# NEXT_PUBLIC_SIMAP_VERSION=  (set only by the Docker build from the release tag; unset shows "dev")`. No value. | R3 (names listed) | **Yes** |
| `README.md` | "Release and deploy" (line 162+): one sentence saying the workflow passes the tag as build arg `SIMAP_VERSION` and the header shows it (`dev` without it). | Docs | No |
| `scripts/release-files.test.ts` | New cases for the build arg and the Dockerfile (see Tests). | AC 1, 2, 4 | No |
| `src/lib/version.ts` (new) | Pure `parseVersion(raw: string \| undefined): string`. Returns `raw` if it matches `/^v(0\|[1-9]\d*)\.(0\|[1-9]\d*)\.(0\|[1-9]\d*)$/` and is at most 32 chars, otherwise `"dev"`. Exports `DEV_VERSION = "dev"`. No `process.env` in lib. | AC 2, 4 | No |
| `src/lib/version.test.ts` (new) | Unit tests. | AC 5 | No |
| `src/ui/app-version.ts` (new) | `export const APP_VERSION = parseVersion(process.env.NEXT_PUBLIC_SIMAP_VERSION);` with a literal access, so Next inlines it, like `src/ui/auth/runtime.ts:30`. | AC 1, 2, 4 | No |
| `src/ui/AppShellView.tsx` | New optional prop `version?: string` (default `APP_VERSION`). In the header's first `session && (...)` block (line 120), before the org name: `<span title={shellCopy.version.title(v)} className="flex-none whitespace-nowrap text-[11px] font-semibold text-on-surface-variant">{shellCopy.version.label(v)}</span>`. Shown only when signed in, on all viewports. | AC 3 | No |
| `src/ui/AppShellView.test.tsx` | Version cases. | AC 3, 5 | No |
| `src/ui/copy/shell.ts` | `version: { label: (v: string) => v, title: (v: string) => (v === "dev" ? "Development build (no release tag)" : \`simap release ${v}\`) }`. | D36 | No |
| `src/lib/validate/png.ts` | `IMAGE_LIMITS = { minPx: 24, maxPx: 100, maxBytes: 102400 } as const`. Final check (lines 68-69): `width === height && width >= minPx && width <= maxPx`, else `image_bad_size`. Doc comment → D68. | AC 6 | No |
| `src/lib/validate/png.test.ts` | Update the `limits` case (line 68). Move `[48,48]` from the bad list to the ok list. Add the size cases. | AC 6 | No |
| `src/ui/copy/deviceTypes.ts` | Hint (line 23): `PNG, square, ${minPx} x ${minPx} to ${maxPx} x ${maxPx} px, up to ${maxBytes / 1024} KB` → "PNG, square, 24 x 24 to 100 x 100 px, up to 100 KB". | AC 6 | No |
| `src/ui/copy/api.ts` | Lines 63-64 derive from `IMAGE_LIMITS` (import from `@/lib/validate/png`; ui → lib is allowed). `image_bad_size`: "The image must be square, from 24 x 24 to 100 x 100 pixels." `image_too_large`: "The image is too large. The limit is 100 KB." | AC 6 | No |
| `src/ui/deviceTypes/device-type-image.ts` | No logic change to `checkImageFile` (it already uses `IMAGE_LIMITS.maxBytes` and `validatePng`). Add pure `thumbRendering(naturalWidth: number \| null, box: number): "pixelated" \| "auto"`. `null` or `<= box` gives `pixelated`; larger gives `auto`. | AC 7 | No |
| `src/ui/deviceTypes/device-type-image.test.ts` | Replace the 20480/20481 cases with 102400/102401 (from `IMAGE_LIMITS.maxBytes`). Add 100×100 ok, 101×101 bad, and `thumbRendering` cases. | AC 6, 7 | No |
| `src/ui/deviceTypes/DeviceTypeThumb.tsx` | Keep `SIZE = 48` and `object-contain`. Track `naturalWidth` from `onLoad` in state, keyed by URL. Inline `imageRendering` is `thumbRendering(natural, SIZE)`. Drop the static `[image-rendering:pixelated]` class so the style alone decides. Doc comment updated. Before load it stays `pixelated`, so the current SSR tests hold. | AC 7 | No |
| `src/server/drive/client.ts` | Line 34-35: `DRIVE_MAX_BYTES = 128 * 1024`, a coarse safety cap above the largest org image (device types 100 KB D68, map items 64 KB D66). Comment updated. No other change. | AC 6 (blocker) | No (`src/server/` triggers the security review) |
| `src/server/drive/client.test.ts` | Add "a 102400-byte upload is not refused" and the invariant `DRIVE_MAX_BYTES >= IMAGE_LIMITS.maxBytes`. The existing `DRIVE_MAX_BYTES + 1` cases follow the constant. | AC 6 | No |
| `src/app/api/device-types/image-routes.test.ts` | Lines 153-154: use `IMAGE_LIMITS.maxBytes + 1` (102401). Add `pngOf(101, 101)` → `image_bad_size`, and "a 100×100 PNG padded to 102400 bytes reaches the service (200)". | AC 6 | No |
| `src/ui/roomlayout/paint.ts` | Image branch (lines 72-75): if `smoothFor(src, op.w)`, set `ctx.imageSmoothingEnabled = true`, set `ctx.imageSmoothingQuality = "high"`, draw, then set `imageSmoothingEnabled = false`. Otherwise draw as today. Export `smoothFor(src, w)`, which is true when the source's natural width (`naturalWidth`, else numeric `width`, else 0) is greater than `w`. | AC 7 | No |
| `src/ui/roomlayout/paint.test.ts` | New image cases. The existing `{}` source case stays (width 0 → no smoothing). | AC 7 | No |
| `src/lib/sprites/placement.ts` | Comment only (line 19): `DEVICE_IMAGE` is the slot box. Every catalog image (24–100 px, D68) is drawn scaled to this square. Value stays 24. | AC 7 | No |
| `src/lib/sprites/device-slots.ts` | Comment only (line 68): "catalog image (24 x 24)" becomes "catalog image (24–100 px, drawn in the 24 px slot box, D68)". | Accuracy | No |
| `docs/spec-v1.md` | Line 271: "an optional 24 × 24 px PNG image" becomes "an optional square PNG image, 24 × 24 to 100 × 100 px, at most 100 KB (D68)". Add a §12 change-log row: `2026-11-25 \| D68 (SIM-040): device type images may be square PNGs from 24 × 24 to 100 × 100 px, at most 100 KB; the map scales them to the slot.` | CLAUDE.md "the spec wins" | No |

`src/ui/AppShell.tsx` and `src/app/dev/shell/page.tsx` need no change, because the prop defaults to `APP_VERSION`.
`next.config.ts`, `.github/workflows/ci.yml`, `scripts/check-image.sh` and the DB are **not** touched.

## Data model / migration
None. No column or CHECK in `db/migrations` ties the size to 20 KB or 24 px: images live in Drive and the DB stores
only file id and version (SIM-036.5). Stored 24 × 24 images stay valid, because 24 is inside the new range, and GET
does not re-validate.

## API contract
| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| PUT | `/api/device-types/{id}/image` | body `image/png`, at most **102400** bytes (was 20480), square **24–100 px** (was exactly 24) | unchanged (200 DTO) | unchanged: 422 `image_too_large`, `image_not_png`, `image_bad_size`; 404; 503 | admin (unchanged) |

No new endpoint. The version is a build-time constant, so no request is needed.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/version.test.ts` › "v1.2.3 and v0.1.9 and v10.20.30 pass through" | AC 1 |
| `src/lib/version.test.ts` › "undefined and empty → dev" | AC 2 |
| `src/lib/version.test.ts` › "1.2.3, v1.2, v1.2.3-rc, v01.2.3, ' v1.2.3', 'v1.2.3\\n', 'dev', a 200-char junk string → dev" | AC 4 |
| `src/ui/AppShellView.test.tsx` › "shows the version for user, manager and admin; not when signed out" (passes `version="v1.2.3"`; asserts the text and the `title` "simap release v1.2.3"; signed out has no `v1.2.3`) | AC 3 |
| `src/ui/AppShellView.test.tsx` › "dev version renders `dev` with the development title" | AC 2, 3 |
| `scripts/release-files.test.ts` › "build and push passes the tag as build arg SIMAP_VERSION" (the build step contains `build-args: SIMAP_VERSION=${{ steps.version.outputs.tag }}`) | AC 1 |
| `scripts/release-files.test.ts` › "Dockerfile: ARG SIMAP_VERSION=dev only in the build stage, inline NEXT_PUBLIC_SIMAP_VERSION on the pnpm build RUN, no ENV with SIMAP or NEXT_PUBLIC" (reads `Dockerfile`; splits at the second `FROM`; the runtime part has no `ARG` and no `SIMAP_VERSION`) | AC 1, 2, 4 |
| `src/lib/validate/png.test.ts` › "limits" → `{ minPx: 24, maxPx: 100, maxBytes: 102400 }` | AC 6 |
| `src/lib/validate/png.test.ts` › "accepts square PNGs at 24, 48, 64 and 100 px" | AC 6 |
| `src/lib/validate/png.test.ts` › "image_bad_size" list: 23×24, 24×23, 23×23, 24×25, 100×99, 101×101, 0×0, 0xffffffff² | AC 6 |
| `src/ui/deviceTypes/device-type-image.test.ts` › "100 x 100 PNG is ok", "101 x 101 gives image_bad_size", "size maxBytes+1 gives image_too_large and never calls arrayBuffer", "a valid PNG padded to exactly maxBytes is ok" | AC 6 |
| `src/ui/deviceTypes/device-type-image.test.ts` › "thumbRendering: null and 24 and 48 → pixelated; 49 and 100 → auto" | AC 7 |
| `src/app/api/device-types/image-routes.test.ts` › "422 cases" updated (maxBytes+1 by header and body, 101×101) and "a 100×100 PNG of maxBytes reaches the service" | AC 6 |
| `src/server/drive/client.test.ts` › "createFile accepts IMAGE_LIMITS.maxBytes bytes" and "DRIVE_MAX_BYTES covers IMAGE_LIMITS.maxBytes" | AC 6 |
| `src/ui/roomlayout/paint.test.ts` › "a 100 px source draws at the op size with smoothing on for that op, then off" (the log has `set imageSmoothingEnabled true`, `set imageSmoothingQuality high`, `drawImage src 10 12 24 24`, then `set imageSmoothingEnabled false`) | AC 7 |
| `src/ui/roomlayout/paint.test.ts` › "a 24 px source draws 1:1 with smoothing never turned on" | AC 6 (existing images), 7 |
| `src/ui/roomlayout/paint.test.ts` › "smoothFor: naturalWidth, plain width, missing width" | AC 7 |

## Approach
1. **Version helper.** Add `src/lib/version.ts` and its test first (pure logic first). Add `src/ui/app-version.ts` with the
   literal `process.env.NEXT_PUBLIC_SIMAP_VERSION` read. R1: ui → lib only. `pnpm check:layers` enforces it.
2. **Shell.** Add `shellCopy.version` and the `version` prop with its span in `AppShellView`, plus the tests. D36:
   every string lives in `src/ui/copy/shell.ts`.
3. **Build transport.** Change the `Dockerfile` ARG and inline env, then `release.yml` `build-args`, then the
   `release-files.test.ts` cases, `.env.example` and README. R3: the tag is public and inline on the build `RUN`
   only. Nothing enters the runtime `.Config.Env`, so `check-image.sh` "image config" (exactly HOSTNAME/NODE_ENV/PORT)
   and "no secrets" (no KEY/SECRET/TOKEN/PASSWORD names) still pass. The CI `image` job passes no arg and gets
   `dev`. Keep the `ARG` after `COPY . .`, so the `pnpm install` layer cache is unaffected.
4. **Image limits.** Change `png.ts` `IMAGE_LIMITS` and the check, fix the compile errors (only
   `src/ui/copy/deviceTypes.ts` reads `.px`), then the copy in `api.ts` and `deviceTypes.ts`. Raise `DRIVE_MAX_BYTES`.
   Update the tests. R7: no auth code changes; size refusals stay 422.
5. **Map draw.** In `paint.ts`, turn smoothing on only around an image op whose source is larger than the op box. The
   op size (24 world px, `DEVICE_IMAGE`) and position are unchanged, so the desk drawing and sort order are unchanged.
   Only the `placement.ts` and `device-slots.ts` comments change.
6. **Admin preview.** `thumbRendering` and the `DeviceTypeThumb` change.
7. **Spec.** Update line 271 and add the change-log row.
8. Run the Checks: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`. Then run the
   local proof for AC 1: `NEXT_PUBLIC_SIMAP_VERSION=v9.9.9 pnpm build`, then grep `.next/static`. Record the result in
   `impl-log.md`.

Rules: R1 (layers as above), R3 (no secrets; the name is listed in `.env.example`), R4 (Drive cap and spec line added
to scope here), R5 (every new function has tests), R6/R2 (no DB change), R7 (unchanged).

## Specialist input used
- frontend-developer
  - Adopted: the build-time `NEXT_PUBLIC_SIMAP_VERSION` via inline `ARG`, a validating helper, and a `version` prop
    defaulting to the constant (no env mocking in tests).
  - Adopted: the header placement over the nav rail, because the rail is hidden below lg and absent in some layouts.
  - Adopted: `IMAGE_LIMITS` min/max; copy derived from the limits; smoothing only for downscaled image ops;
    `pixelated` kept only for sources at or below the 48 px box.
  - Adjusted: the helper's env read moves to `src/ui/app-version.ts`, so `src/lib` stays free of `process.env` (no
    lib file reads env today).
  - Rejected: an offscreen pre-scale cache, which is unnecessary at these sizes.
  - Rejected: grepping `.next/static` in CI, which is overkill; the reviewer does a local proof instead.
- api-platform-engineer
  - Adopted: no runtime `ENV`, because `check-image.sh` allows exactly three app env names. The `build-args` value
    stays in `with:`, not in a `run:` block.
  - Adopted: the `DRIVE_MAX_BYTES` blocker, added to scope. It becomes a separate coarse constant (128 KB) with an
    invariant test, not `IMAGE_LIMITS.maxBytes`, because map item images (D66, 64 KB) share the client.
  - Adopted: the route and client test updates and the spec line update.
  - Rejected (optional): a CI build with `SIMAP_VERSION=v0.0.0`, which would change the shared GHA cache scope for
    little gain.

## Assumptions
For Ming to confirm or change at plan approval:
- **A1 Map slot draw size and smoothing.** The slot box stays **24 world px** (`DEVICE_IMAGE`). That is 48–96 screen
  px at zoom 2–4, the same footprint on the desk as today. A larger source therefore adds detail rather than size: a
  100 px image at zoom 3 draws into 72 device px with high-quality smoothing instead of being pixel-doubled from 24.
  Smoothing is on only when the source is wider than 24 px, so existing 24 px images stay crisp and look exactly as
  before. Enlarging the slot (for example to 32 px) would change the desk composition and needs tuning in
  `/dev/roommap`, so it is left as a follow-up if Ming wants images bigger on the desk, not just sharper.
- **A2 Version placement and wording.** The label is small muted text right after the "simap" brand in the header,
  shown only when signed in, on every viewport. It reads as "simap v0.1.9", like the ticket's example. Without a tag
  it shows `dev` ("simap dev"), with a tooltip "Development build (no release tag)". The tooltip for a release is
  "simap release vX.Y.Z". The version is not shown on the signed-out or sign-in screens (the ticket says signed-in).
- **A3 Spec line.** This ticket updates `docs/spec-v1.md:271` to D68 and adds a §12 change-log row.
  `docs/requests/deployment-simap-drive.md:78` (a past request to the deployment repo) is left unchanged as history.
- **A4 Transport.** The version is a build-time constant only. It is not exposed through `/api/healthz` or read from
  the deployment's `release.env` `SIMAP_VERSION` at runtime (the consultant's Q3); that would need a deployment-repo
  change. A dev who sets `NEXT_PUBLIC_SIMAP_VERSION` in `.env.local` can show a fake but well-formed version. This is
  harmless and documented in `.env.example`.
- **A5 Drive cap.** `DRIVE_MAX_BYTES` goes to 128 KB. It is a safety cap, not a product limit; the product limits stay
  in `IMAGE_LIMITS` (100 KB) and the D66 map item validator (64 KB, SIM-039.4).
- **A6 Hotspot.** SIM-037.10 (state DONE, PR not merged) also edits `src/ui/AppShellView.tsx`,
  `src/ui/AppShellView.test.tsx` and `src/ui/copy/shell.ts` (`badgeLabels` prop, `pendingReturns` copy). Expect a
  rebase. The changes touch different lines (header vs nav rail and badge copy).
- **A7 Thumb onLoad.** `DeviceTypeThumb` URLs are blob URLs created after mount, so `onLoad` always fires on the
  client. Until it fires, the image renders `pixelated`, the current behaviour.

## Blocking questions
None.

## Split proposal
None. Estimated diff is about 300 changed lines: about 120 for the version part, about 190 for the images part, mostly
tests. That fits one implement/review cycle.
