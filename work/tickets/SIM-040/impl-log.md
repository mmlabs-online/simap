## Attempt 1 — 2026-11-25

### Files touched
| File | Required because |
|---|---|
| `Dockerfile`, `.github/workflows/release.yml`, `.env.example` | Build arg `SIMAP_VERSION` passed inline as `NEXT_PUBLIC_SIMAP_VERSION` (AC 1, 2, 4); `.env.example` has a commented name only |
| `README.md` | One sentence in "Release and deploy" |
| `scripts/release-files.test.ts` | Build arg and Dockerfile cases |
| `src/lib/version.ts`, `src/lib/version.test.ts` (new) | `parseVersion`, `DEV_VERSION` |
| `src/ui/app-version.ts` (new) | `APP_VERSION` from the literal env read |
| `src/ui/AppShellView.tsx`, `AppShellView.test.tsx`, `src/ui/copy/shell.ts` | `version` prop and header span; copy in `shellCopy.version` |
| `src/lib/validate/png.ts`, `png.test.ts` | D68 limits (24-100 px, 100 KB) |
| `src/ui/copy/deviceTypes.ts`, `src/ui/copy/api.ts` | Hint and error copy derived from `IMAGE_LIMITS` |
| `src/ui/deviceTypes/device-type-image.ts`, `.test.ts`, `DeviceTypeThumb.tsx` | `thumbRendering`, onLoad-based rendering |
| `src/server/drive/client.ts`, `client.test.ts` | `DRIVE_MAX_BYTES` 128 KB (blocker in plan), invariant test |
| `src/app/api/device-types/image-routes.test.ts` | New limits, 101x101, padded 100x100 reaches the service |
| `src/ui/roomlayout/paint.ts`, `paint.test.ts` | Smoothing for downscaled image ops, `smoothFor` |
| `src/lib/sprites/placement.ts`, `device-slots.ts` | Comments only |
| `docs/spec-v1.md` | Line 271 and change-log row (D68) |

### Tests added / changed
- `src/lib/version.test.ts` (pass-through, undefined/empty, malformed)
- `src/ui/AppShellView.test.tsx` › version (tiers and signed out; dev title)
- `scripts/release-files.test.ts` › build arg; Dockerfile ARG/ENV cases
- `src/lib/validate/png.test.ts` › limits, 24/48/64/100 ok, extra bad sizes
- `src/ui/deviceTypes/device-type-image.test.ts` › 100x100, 101x101, maxBytes+1, padded maxBytes, `thumbRendering`
- `src/app/api/device-types/image-routes.test.ts` › 422 cases updated, padded 100x100 reaches service
- `src/server/drive/client.test.ts` › accepts maxBytes, `DRIVE_MAX_BYTES >= IMAGE_LIMITS.maxBytes`
- `src/ui/roomlayout/paint.test.ts` › 100 px smoothing, 24 px no smoothing, `smoothFor`

### Checks (actual output summary)
- format:check: exit 0, "All matched files use the correct format."
- typecheck: exit 0
- check:layers: exit 0, "731 files, no violations"
- test: exit 0, "Test Files 276 passed | 1 skipped (277); Tests 2808 passed | 7 skipped (2815)"
- build: exit 0 (no env var)
- local version proof: `NEXT_PUBLIC_SIMAP_VERSION=v9.9.9 pnpm build` exit 0; `grep -rl 'v9.9.9' .next/static` found `.next/static/chunks/2pdet6372hdhd.js`. Not rebuilt without the var afterwards.
- check-image (`scripts/check-image.sh`) / `docker build`: NOT run, Docker is not available here. CI `image` job and Ming's release verification cover it.

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- Larger map slot (A1) if Ming wants images bigger, not just sharper.
- SIM-037.10 also edits AppShellView files; expect a rebase (A6).

### Scope self-check
- Could the diff be smaller? No, every change maps to a plan row.
- Diff size: about +227 / -33 lines tracked, plus 3 new files.
