# Review — SIM-036.6

## Attempt 1 — 2026-11-25
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check`: exit 0, "All matched files use the correct format." (713 files)
- `pnpm typecheck && pnpm check:layers`: exit 0, "check-layers: 659 files, no violations"
- `pnpm test`: exit 0, "Test Files 251 passed | 1 skipped (252)", "Tests 2454 passed | 7 skipped (2461)". This matches impl-log.
- `pnpm build`: exit 0
- `pnpm test:db`: not run (CI-only, needs Postgres). The diff touches no server or DB code.

### Acceptance criteria
- [x] 1a: upload rejects a non-PNG, a non-24 × 24 image or a file over 20 KB before sending. Evidence: `device-type-image.test.ts` › checkImageFile (7 cases, including "size 20481 gives image_too_large and never calls arrayBuffer" and the 20480 boundary). `device-type-image.ts:15-25` checks the size before reading. `DeviceTypeFormDialog.tsx` `pick()` stages `replace` only when the check returns `ok`. `putImage` is called only from `saveDeviceType` (`device-type-save.ts:51-54`).
- [x] 1b: a valid image shows in the preview and in the list after save. Evidence: `imageFieldView` › "replace shows the staged url"; `DeviceTypeImageField.test.tsx` › "preview img has the url, width/height 48 and pixelated rendering"; `DeviceTypesView.test.tsx` › "row shows the image when imageUrl returns a url; placeholder otherwise"; `device-type-save.test.ts` › "create + replace: POST then PUT with the created id, done". `onDone` reloads the list. `useList.reload` keeps the `ready` status, so the cache re-syncs on the new `imageVersion` without dropping other entries. The manual upload check is Ming's step.
- [x] 1c: images load with the bearer as `blob:` URLs. Evidence: `device-types-api.test.ts` › "getImage reads a blob through the fetcher; a non-PNG content type is internal"; `image-url-cache.test.ts` (7 cases: dedupe, revoke on a new version, prune, dispose, late result, limit 4, failed load). `useDeviceTypeImages.ts:18-23` loads through `api.getImage` (the bearer `apiFetch`) and `URL.createObjectURL`.
- [x] 2: server image refusals show inline. Evidence: `device-type-save.test.ts` › `it.each` over `image_not_png`, `image_bad_size`, `image_too_large`, `images_unavailable`, `drive_error` and `image_changed`. Each gives `imageFailed` with the saved DTO and `imageSaveFailed + apiErrorMessage(code)`. The dialog's `imageFailed` branch sets `current = saved` and the dialog `error`, and keeps the dialog open.
- [x] 3: component tests cover the image check (fabricated PNG bytes, wrong size, over 20 KB, non-PNG). Evidence: `device-type-image.test.ts:62-108`. The PNG helper writes real CRCs.
- [x] 4 (should-fix from SIM-036.3): the slot `<legend>` is the first child of its `<fieldset>`. Evidence: `DeviceTypeFormDialog.test.tsx` › "every fieldset starts with its legend", plus the restructured markup in `DeviceTypeFormFields`.
- [x] 5: copy lives in `src/ui/copy/deviceTypes.ts` and the checks are green. Evidence: the copy diff, the no-literals test is in the green run, and the list alt uses the `DECORATIVE` constant.

Ming verification after merge (not verified here; the PR should carry it): on the deployed app with Drive configured, as Admin, create a type with a 24 × 24 PNG and see the pixelated thumbnail in the list. Then pick a 32 × 32 PNG, a JPEG renamed `.png` and a PNG over 20 KB, and see the inline message each time with no request sent. Remove the image, Save, and see the placeholder.

### Issues
None.

### Rules (CLAUDE.md)
No violations found.
- R1: all new code is under `src/ui/**` and imports only `@/lib/*`, `../copy/*` and local modules. check:layers is clean.
- R4: every changed source file is in the plan's file list. The other changed files are ticket work files.
- R5: every new pure module has tests.
- D36: all copy is in the copy file.
- No High path is touched. No route, schema or env change.

### Blockers from review agents
None. No review trigger path was changed.

### Nits (do not block)
- `useDeviceTypeImages.ts:15,24,27`: `ref` is written but never read. It can be removed.
- `useDeviceTypeImages.ts:37`: the returned callback's identity changes only with `cache`, not on `bump`. This works because the page re-renders and neither `ListSection` nor the View is memoized. A future `React.memo` on the rows would stop thumbnails from appearing.
- `DeviceTypeFormDialog.tsx` `pick()`: if the dialog unmounts while `checkImageFile` is pending, the blob URL created afterwards is never revoked. The leak is tiny and only happens in that rare case.

### Follow-ups (out of scope)
- A11 (from the plan and impl-log): the dialog grows by about 90 px. A scrollable `EntityFormDialog` body may be needed on short viewports.
