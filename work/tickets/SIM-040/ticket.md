# SIM-040: Show the release version in the UI and allow device type images up to 100 × 100 px

| Field | Value |
|---|---|
| State | MERGED |
| Priority | P2 |
| Size | M |
| Areas | ui, api, architecture |
| Gate | plan-approval |
| Depends on | — |
| Needs Ming | — |
| Attempts | 1 |
| Created | 2026-11-25 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/97 |

## Goal
Every signed-in user can see which release of simap is running (for example "simap v0.1.9"), so a bug report or a
check after a deploy names the exact version. Admins can also upload larger device type images (square, up to
100 × 100 px), because 24 × 24 px is too small and looks broken on the layout (D68).

## Scope reference
No spec section covers this. Ming asked for it directly (2026-11-25, "thêm feature hiện thị version release của
app"); the planner records it as a new decision. Related: `.github/workflows/release.yml` (tag `vX.Y.Z`, image
`mingming21400/simap`), README "Release and deploy", D3/D8.
- Device type images: D68 (2026-11-25, Ming) amends D61's "square PNG, 24 × 24 px, at most 20 KB" to "square PNG,
  24 × 24 to 100 × 100 px, at most 100 KB", for device types only (map item images, SIM-039.4, decide later).

## Scope
- Pass the release tag into the image at build time: `release.yml` passes the tag as a build arg; the `Dockerfile`
  turns it into a value the app can read (build-time constant or runtime env).
- Expose the version to the UI (no new secret, no request needed if it is a build-time constant).
- Show it in the app shell (place chosen by the plan: shell footer, account menu or similar), with the copy in
  `src/ui/copy/`.
- Local dev and any build without a tag show `dev`.
- Device type images (D68): accept any square PNG from 24 × 24 to 100 × 100 px, at most 100 KB, in the shared PNG
  validator (`src/lib/validate/png.ts`, `IMAGE_LIMITS`), the upload route and the admin page's client check and hint
  copy. The room map draws the image scaled to the device's slot size; the admin list preview fits its box.

## Out of scope
- A changelog or "what's new" page.
- Changing how versions are chosen or tagged in `release.yml`.
- Map item images (SIM-039.4) and images already stored (a stored 24 × 24 image stays valid).

## Acceptance criteria
- [ ] An image built by `release.yml` for tag `vX.Y.Z` shows exactly `vX.Y.Z` in the UI.
- [ ] `pnpm dev` and a build without the build arg show `dev`; the build does not fail without it.
- [ ] The version is visible to every signed-in tier in the app shell; copy lives in `src/ui/copy/` (D36).
- [ ] No secret or other build data reaches the client bundle (R3); the value is validated (`vX.Y.Z` or `dev`).
- [ ] Unit test for the version helper and the shell markup; checks green; the image check (`check-image`) still passes.
- [ ] A square PNG from 24 × 24 to 100 × 100 px and at most 100 KB is accepted by the device type upload (server and
      client check); a non-square image, one larger than 100 × 100 or smaller than 24 × 24, or a file over 100 KB is
      refused with the existing codes; existing 24 × 24 images still load and draw.
- [ ] On the room map a device type image of any accepted size draws inside its slot at the slot's size, without
      breaking the desk drawing; the admin list preview fits its box.

## Technical notes
- Files: `Dockerfile`, `.github/workflows/release.yml` (High paths, so plan approval), `next.config.*` or a small
  `src/lib/` helper, `src/ui/AppShellView.tsx`, `src/ui/copy/shell.ts`; images: `src/lib/validate/png.ts`,
  `src/app/api/device-types/[id]/image/route.ts`, `src/ui/deviceTypes/**`, `src/ui/copy/deviceTypes.ts`,
  `src/lib/sprites/placement.ts` / `src/ui/roomlayout/paint.ts` (draw scaled to the slot).
- Risks / open questions: build-time (`NEXT_PUBLIC_*`, baked into the bundle) vs runtime env read by the server; the
  CI `image` job and `check-image` must keep working when no tag is passed.

## Test plan
- Unit: version helper (`vX.Y.Z`, missing → `dev`, bad value → `dev`); shell renders the version; PNG validator at
  24, 64, 100 and 101 px, non-square, 100 KB boundary; map draw op scales a 100 px image to the slot.
- Manual: after the next release, the deployed app shows the new tag; upload a 100 × 100 device type image and see it
  on a desk and in the admin list.

## Notes / answers from Ming
- 2026-11-25: requested by Ming ("thêm feature hiện thị version release của app").
- 2026-11-25 (Ming): add to this ticket: "ảnh 24x24 pixel quá nhỏ để lên layout bị vỡ, giới hạn 100x100pixel đi".
  Answers: square, at most 100 × 100 px (D68); at most 100 KB; device types only; merge into SIM-040.

- 2026-11-25: Plan approved (Ming: "duyệt SIM-040"), assumptions A1-A7 as written (A1: map device image box stays 24 px).

## Handoff

### 2026-11-25 — claude — BLOCKED
- Agent calls: 3 (frontend-developer×1 42k, api-platform-engineer×1 51k, planner×1; default models)
- Done: plan READY (`plan.md`): build arg SIMAP_VERSION → NEXT_PUBLIC_SIMAP_VERSION at build time, parseVersion helper, version after the brand in the header; IMAGE_LIMITS square 24–100 px / 100 KB, copy from the limits, DRIVE_MAX_BYTES 64→128 KB (added to scope, consultant blocker), smoothing for large images on the map, thumbnail rendering helper, spec line update.
- In progress / next: Ming approves A1-A7 (M-69), in particular A1 (map slot stays 24 px).
- Gotchas: High paths Dockerfile, release.yml, .env.example; security review will run (server/drive).

### 2026-11-25 — claude — DONE
- Agent calls: 9 (frontend-developer×1 42k, api-platform-engineer×1 51k, planner×1 104k, implementer×2 (64k default, 19k sonnet), reviewer×2 (64k, 23k), security-ai-generated-code-auditor×2 (45k, 21k sonnet); first review/security dispatch failed on a usage limit and was re-run; ~430k total)
- Done: release version in the header via build arg (Dockerfile, release.yml); device type images square 24–100 px / 100 KB (D68), Drive cap 128 KB, map smoothing, thumbnail rendering, spec update. Review attempt 1 REWORK (spec change-log row in the wrong table), attempt 2 PASS; security no 🔴/🟡; PR https://github.com/mmlabs-online/simap/pull/97.
- In progress / next: Ming checks the header version after the next release and a 100 px upload on production.
- Gotchas: check-image not run locally (no Docker), CI covers it; A1 keeps the 24 px map box.
