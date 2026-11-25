# Solo log

| Date | Summary | Files | Checks |
|---|---|---|---|
| 2026-11-20 | Fix `test:db`: resolve the vitest bin via the exported `vitest/package.json` (CI step failed with ERR_PACKAGE_PATH_NOT_EXPORTED) | `scripts/test-db.mjs` | format ✓; vitest starts locally; DB run in CI |
| 2026-11-25 | Add a ready-to-paste request for the deployment repo: write simap's Google Drive secrets to the host env file (D61, M-46) | `docs/requests/deployment-simap-drive.md` | docs only (no code) |
| 2026-11-25 | Hide the Groups entry from the sidebar nav (Group/Project features on hold, D65); `/groups` page, API and data kept | `src/lib/nav.ts`, `src/lib/nav.test.ts`, `src/ui/AppShellView.test.tsx`, `work/decisions.md` | format ✓ typecheck ✓ layers ✓ test ✓ (2537 passed) build ✓ |
