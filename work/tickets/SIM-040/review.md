## Attempt 1 — 2026-11-25
Verdict: REWORK

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format."
- `pnpm typecheck && pnpm check:layers` — exit 0, "check-layers: 731 files, no violations"
- `pnpm test` — exit 0, "Test Files 276 passed | 1 skipped (277); Tests 2808 passed | 7 skipped (2815)" (matches impl-log)
- `pnpm build` (no var) — exit 0; `grep -rl v9.9.9 .next/static` finds nothing; the bundle reads
  `….env.NEXT_PUBLIC_SIMAP_VERSION` from the empty client env and falls back to `"dev"` (same pattern as the existing
  `NEXT_PUBLIC_MM_IDENTITY_BASE`).
- `NEXT_PUBLIC_SIMAP_VERSION=v9.9.9 pnpm build` — exit 0; `grep -rl 'v9.9.9' .next/static` →
  `.next/static/chunks/2pdet6372hdhd.js`, inlined as `(t="v9.9.9").length<=32&&/^v(0|…/.test(t)?t:"dev"`.
- `pnpm test:db` — skipped (CI-only, no DB change in this ticket).
- `scripts/check-image.sh` / `docker build` — not run (no Docker here). Reviewed by reading, see AC 4/5.

### Acceptance criteria
- [x] 1 Tag `vX.Y.Z` reaches the UI — evidence: `release.yml:98` `build-args: SIMAP_VERSION=${{ steps.version.outputs.tag }}`
  (in `with:`, not a `run:` block); `Dockerfile:14-16` `ARG SIMAP_VERSION=dev` + inline
  `NEXT_PUBLIC_SIMAP_VERSION="$SIMAP_VERSION"` on the build `RUN`; `release-files.test.ts` "build and push passes the
  tag…" and "Dockerfile" cases pass; local v9.9.9 build grep above. The tag is produced only after the guard at
  `release.yml:54` (`^release/(0|[1-9]…)…$`), which matches `parseVersion`'s regex. Real release: Ming verification.
- [x] 2 `dev` without the arg, build does not fail — evidence: `version.test.ts` "undefined and empty give dev"; no-var
  build green and contains no tag; `Dockerfile` default `dev`; `AppShellView.test.tsx` "dev version renders dev…".
- [x] 3 Visible to every signed-in tier, copy in `src/ui/copy/` — evidence: `AppShellView.tsx:126-131` inside the
  `session &&` block; `AppShellView.test.tsx` "shows the version for user, manager and admin; not when signed out";
  strings in `src/ui/copy/shell.ts:18-22`.
- [x] 4 No secret / build data in the client, value validated — evidence: only `NEXT_PUBLIC_SIMAP_VERSION` is read, as a
  literal (`src/ui/app-version.ts:4`), through the anchored regex + 32-char cap (`src/lib/version.ts`); `version.test.ts`
  covers junk/newline/long. Runtime stage has no `ARG`/`ENV` change (`Dockerfile:18-20`, only
  `NODE_ENV HOSTNAME PORT`), so `check-image.sh` "image config" (exactly those three among `SIMAP_|NEXT_…`) and
  "no secrets" (name grep) still hold; the build-stage `RUN` is not in the final image's history. `next.config.ts`
  untouched. `.env.example` adds a commented name only, no value.
- [x] 5 Tests and checks green — evidence: Checks above. The CI `image` job (check-image) runs on the PR; by reading it
  should stay green (no runtime env change, no new file in the final image).
- [x] 6 24–100 px square, ≤ 100 KB accepted; refusals unchanged — evidence: `png.ts:2,68-71`; `png.test.ts` "limits",
  "accepts square PNGs at 24, 48, 64 and 100 px", bad list (23, 24×25, 100×99, 101, 0, 0xffffffff);
  `device-type-image.test.ts` 100/101 and maxBytes/maxBytes+1; `image-routes.test.ts` 422 cases and "a 100x100 PNG
  padded to maxBytes reaches the service"; `drive/client.ts:38` `DRIVE_MAX_BYTES = 128 * 1024` with
  `client.test.ts` "accepts IMAGE_LIMITS.maxBytes bytes; DRIVE_MAX_BYTES covers them". Only device types use
  `validatePng`/`IMAGE_LIMITS` (grep), so map item images (D66) are unaffected.
- [x] 7 Map draws scaled in the slot; thumb fits its box — evidence: `paint.ts:45-51,82-90` (smoothing on only around a
  downscaled image op, reset to the `false` set at `paint.ts:71`); `paint.test.ts` 100 px / 24 px / `smoothFor` cases;
  `DEVICE_IMAGE` stays 24; `thumbRendering` + `DeviceTypeThumb.tsx` keep 48 px `object-contain`, `pixelated` before load.
  Manual map check: Ming verification.
- [ ] Plan file row `docs/spec-v1.md` (A3, approved): §12 change-log row — FAILED, see Issue 1.

Ming verification after merge (carry into the PR):
- After the next release, the deployed app shows `vX.Y.Z` beside "simap" in the header.
- On production, upload a 100 × 100 PNG of about 60–100 KB to a device type: it saves, shows at 48 px in the admin list
  and draws smoothly on a desk at the same size as before; an existing 24 × 24 image still draws as before.

### Issues
#### Issue 1 — 🔴 blocker — spec edit in the wrong place
- **Where**: `docs/spec-v1.md:62` (diff hunk `@@ -59,6 +59,7 @@`, §2 "Users and roles").
- **Expected**: per plan.md file table and approved A3, a row
  `| 2026-11-25 | D68 (SIM-040): device type images may be square PNGs from 24 × 24 to 100 × 100 px, at most 100 KB; the map scales them to the slot. |`
  in the §12 "Change log" table (`docs/spec-v1.md:732-734`, newest first, above the D66 row), and the roles table
  untouched.
- **Actual**: the row was inserted as the first data row of the seatMGT role table (between its header separator and
  the `| Admin | simap:admin | …` row), so the roles table now has a bogus "2026-11-25" role with 2 of 4 columns, and
  §12 has no D68 entry. The spec is the source of truth (CLAUDE.md), so this corrupts it.
- **Fix instruction**: delete the line at `docs/spec-v1.md:62`; insert the same row in §12 directly under
  `|---|---|` at line 733 (before the `2026-11-25 | D66:` row). Leave line 271's edit as it is.

### Rules (CLAUDE.md)
No violations found. R1: `src/ui/app-version.ts` → `@/lib/version`, `src/ui/copy/api.ts` → `@/lib/validate/png`
(ui → lib), `check:layers` green; `src/lib/version.ts` reads no env. R3: public tag only, inline build `RUN`, name listed
in `.env.example` without a value. R5: new logic (`parseVersion`, `smoothFor`, `thumbRendering`, limits) has tests;
checks green. R4: every changed file is in the plan (Drive cap and spec line were added to scope in the plan); no
High path beyond those the plan names (`Dockerfile`, `release.yml`, `.env.example`). R2/R6/R7: untouched.

### Blockers from review agents
None. `security-review.md` attempt 1: 🔴 none, 🟡 none.

### Nits (do not block)
- `src/ui/copy/shell.ts:21` compares with the literal `"dev"`; `DEV_VERSION` from `@/lib/version` would keep one source.
- `work/ming-todo.md` M-69 lists A6 = thumbnails and A7 = rebase, while plan.md has A6 = hotspot/rebase and A7 = thumb
  onLoad. Content matches; only the labels are swapped.
- AC 1's "`pnpm start` shows v9.9.9 in the header" step was not done by either side; the chunk grep plus the
  `AppShellView` test cover it.

### Follow-ups (out of scope)
- Larger map slot box (A1) if Ming wants images bigger on the desk, not just sharper.
- Expect a rebase with SIM-037.10 in `AppShellView.tsx`, its test and `copy/shell.ts` (A6).
