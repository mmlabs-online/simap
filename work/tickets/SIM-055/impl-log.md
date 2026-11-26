
# Implementation log — SIM-055

## Attempt 1
### Files touched
- `src/lib/sprites/signin-scene.ts` (new): scene data + `signinDrawList`. Required because AC1. Nudge vs plan: cabinet at x=9, small plant at x=10 (plant.small at x=11 overhung the box by 2 px, bounds were 386 wide).
- `src/lib/sprites/signin-scene.test.ts` (new), `src/ui/auth/SignInScene.test.ts` (new): planned tests.
- `src/ui/auth/SignInScene.tsx`: client component, `md` gate, atlas via leaf imports, `paintSignInScene`.
- `src/ui/auth/AuthLayout.tsx`, `src/ui/org/OrgPickerView.tsx` (`scene={false}`), `src/ui/Button.tsx` (`data-variant`), `src/app/globals.css` (tokens, `.px-*` rules).
- `src/ui/auth/views.test.tsx`, `src/ui/org/org-views.test.tsx`: extended.

### Tests added
signin-scene.test.ts (7), SignInScene.test.ts (2, `document` stubbed for the tint canvas), views.test.tsx (+2, updated 1), org-views.test.tsx (+1).

### Checks
- format:check: all matched files use the correct format
- typecheck: exit 0; check:layers: 895 files, no violations
- test: 343 files passed | 1 skipped; 3392 passed | 9 skipped
- build: compiled successfully (run before test-only edits)
- test:db: 22 files, 344 tests passed

### Out-of-plan files
None. main had not moved in touched files.

### Follow-ups
- Manual visual pass (1280/320 px, dark theme, atlas blocked) not done by the implementer; reviewer/Ming to check.

### Scope self-check
Only plan files changed; no new copy strings, fonts, libraries or animation.
