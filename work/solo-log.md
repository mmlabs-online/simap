# Solo log

| Date | Summary | Files | Checks |
|---|---|---|---|
| 2026-11-20 | Fix `test:db`: resolve the vitest bin via the exported `vitest/package.json` (CI step failed with ERR_PACKAGE_PATH_NOT_EXPORTED) | `scripts/test-db.mjs` | format ✓; vitest starts locally; DB run in CI |
| 2026-11-25 | Add a ready-to-paste request for the deployment repo: write simap's Google Drive secrets to the host env file (D61, M-46) | `docs/requests/deployment-simap-drive.md` | docs only (no code) |
| 2026-11-25 | Hide the Groups entry from the sidebar nav (Group/Project features on hold, D65); `/groups` page, API and data kept | `src/lib/nav.ts`, `src/lib/nav.test.ts`, `src/ui/AppShellView.test.tsx`, `work/decisions.md` | format ✓ typecheck ✓ layers ✓ test ✓ (2537 passed) build ✓ |
| 2026-11-26 | Spec hygiene: mark OQ-8 (D25), OQ-41–45 (D63) and OQ-54–61 (defaults approved 2026-11-26) answered; pixel character wording "derived from `sub`" → "derived from the member id" (Member entity, LAY-06, POR-06; matches SIM-047) | `docs/spec-v1.md`, `work/solo-log.md` | format ✓ typecheck ✓ layers ✓ test ✓ (3284 passed) build ✓ |
