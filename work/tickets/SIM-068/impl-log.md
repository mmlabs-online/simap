
## Attempt 1 (slice 1)

Files touched (all per plan): `src/ui/auth/AuthLayout.tsx` (new frame, `landing` prop), `src/ui/auth/views.tsx`
(`landing` prop + pass-through only), `src/ui/auth/AuthGate.tsx` (`landing` on the signed-out `SignInView`),
`src/ui/copy/auth.ts` (`world` block), `src/app/layout.tsx` (Fraunces import, `--font-serif` variable on `<html>`),
`src/app/globals.css` (append-only block under `/* SIM-068 auth world (aw-*) */`), `src/ui/auth/views.test.tsx`,
`src/ui/org/org-views.test.tsx`, `src/ui/auth/world-palette.test.ts` (new).

Tests added: views.test.tsx "frame" (3), "landing" (6), updated "pixel surface" block; world-palette.test.ts (3: AA
contrast with proposed palette values passing unchanged, tokens/append-only, no animation/transition).

Checks: `pnpm format:check` all matched files correct; `pnpm typecheck` ok; `pnpm check:layers` 959 files, no
violations; `pnpm test` 365 files... 3565 passed | 9 skipped (365 files passed, 1 skipped); `pnpm build` ok (Fraunces
fetched at build; `.next/static/chunks/*.css` has `@font-face` Fraunces italic with `src:url(../media/*.woff2)`, no new
host); `pnpm test:db` 23 files, 365 tests passed. Not run: manual browser check at 390 px.

Out-of-plan files: `assets/art/CREDITS.md` (one "Fonts (D85)" note: Fraunces, OFL 1.1), because D85 says the licence is
also recorded in the credits and the orchestrator asked for it.

Follow-ups: none. Slice 2 (four rooms) is SIM-068.1.

Scope self-check: no change to form fields, links, buttons, Identity calls, Turnstile, headers/CSP, `--px-*` or `.px-*`.
