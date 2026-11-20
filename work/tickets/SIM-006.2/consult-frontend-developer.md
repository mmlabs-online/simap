# Consult — frontend-developer (SIM-006.2, 2026-11-20)

## Findings

1. **D52 puts the sign-in screen in the pixel column.** Style guide §1 says the pixel style on sign-in is art, frames, headings and decoration only. Body text, forms and numbers stay in the clean kit font. The slice S2 plan (written before D52) assumes plain kit `Card`/`FilledInput`/`Button` in `AuthLayout`, so no plan line gives the sign-in screen any pixel treatment.
2. **There are no sprite assets yet.** `public/` holds only `.gitkeep`, and `office.png`, `office.json` and `scene.signin` do not exist. SIM-024 (atlas and placeholder art) is BLOCKED, and `assets/art/` has only `CREDITS.md`. S2 cannot depend on `scene.signin`.
3. **Tokens and fonts.** The tokens in `src/app/globals.css` are Material-style (`--primary`, `--surface-*`), mapped through `@theme inline`. I did not find the style-guide palette (outline `#2a3140`, teal `#14b8a6`, etc.) there. I did not check whether a pixel font is loaded. The guide only forbids pixel fonts for body text.
4. **Wiring.** `(app)/layout.tsx` currently uses `SessionProvider value={null}`. `session.tsx` already has `SessionProvider` with `actions` (`signOut`, `refreshPermissions`, `switchOrg`). `AuthGate` can wrap `AppShell` as planned, and the shell reads `useSession` and `useShellActions`, so no shell change is needed. The `/sign-in` page sits outside `(app)`, so `SignInRoute` needs its own runtime and gate.
5. **Testability without jsdom.** The plan's `renderToStaticMarkup` views (props only) are the right approach. All effects live in `AuthGate` and `SignInRoute`. They are covered by S1 `flow.test.ts` plus code review.
6. **Env and config.** `src/lib/identity/config.ts` already takes `production` as an argument and falls back to production constants. `runtime.ts` must evaluate `process.env.NODE_ENV === "production"` at build time, as the security review follow-up asks.
7. **Turnstile.** Next inlines `NEXT_PUBLIC_*` only when it is written as a literal `process.env.NEXT_PUBLIC_X`, not through a variable or a destructured `process.env`.
8. **Security follow-ups.** The security review asks for the build-time production flag, the `invalid_credentials` copy and a retry view for 5xx from `/api/me`. The plan lists `RetryView` and the `retry` state, but it does not say that a 5xx or network error from `/api/me` must map to `retry` rather than to sign-in or noAccess. It also left runtime CSP to the S2 page and header work, and the plan has no CSP item.

## Recommendations

1. **Pixel treatment stays thin and CSS-only in S2 (AC1, AC7).** `AuthLayout` wraps `Card` with a pixel frame (CSS border or `box-shadow` stepped corners, outline `#2a3140`) and a decorative header strip. Add the style-guide palette entries as CSS variables (for example `--px-outline`, `--px-accent`) in `globals.css`, and add only the colours S2 uses. Forms, copy and buttons stay on the kit.
2. **Put the art behind one swappable slot.** Add a `SignInScene` component that renders `<img src="/sprites/scene-signin.png" alt="" aria-hidden>` when the asset exists. Until it does, use a CSS/SVG placeholder with `image-rendering: pixelated` and integer scaling. Hide it below the `md` breakpoint so the form stays first on small screens. Do not block S2 on SIM-024.
3. **Accessibility that must hold.**
   - Art is `alt=""`, decorative, and never carries state.
   - Text and borders on pixel frames keep contrast of at least 4.5:1 and 3:1.
   - Focus rings stay visible on the framed inputs.
   - Errors go in `role="alert"`.
   - Turnstile has a labelled container.
   - Under `prefers-reduced-motion`, any pixel animation is off.
   - Headings use at most one pixel display font via `next/font`, as a local woff2 with `display: swap`. Check its licence and add it to `CREDITS.md`.
4. **Views are props-only and tested with `renderToStaticMarkup`.**
   - Assert markup for each view state.
   - Assert that no `<img>` lacks `alt`.
   - Assert that `SignInView` contains no email address in the `invalid_credentials` text.
   - Test `copy.test.ts` for every `AuthErrorCode`.
   - If the gate's state-selection logic has more than trivial branching, extract a pure `gateReducer` or `viewForState` into `src/lib/identity` or `src/ui/auth` and unit test it. That covers AC1, AC3b and AC4b beyond code review.
5. **`runtime.ts`.** Write `process.env.NEXT_PUBLIC_MM_IDENTITY_BASE` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` as literals, pass `process.env.NODE_ENV === "production"` as the `production` flag, and keep the lazy singleton. Add a test that `identityBaseFrom(override, true)` ignores the override (already covered in `config.test.ts`; just cite it).
6. **Gate 5xx path.** Map a 5xx or network error from `apiFetch("/api/me")` to `RetryView` (retry action, no sign-out). Map 401 to sign-in, and `ApiAccessError("forbidden")` to `NoAccessView`. Add a row to `views.test.tsx` for `RetryView`, and test the mapping if you extract the pure function from recommendation 4.
7. **Turnstile.** `TurnstileWidget` loads the script lazily, shows nothing without `siteKey`, and takes `resetKey` to re-render. The sign-in view shows it only when the flow asks for it. Clean up on unmount.
8. **Ming-owned env names.** `NEXT_PUBLIC_MM_IDENTITY_BASE` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` go into `.env.example` as names with no values. Both are optional outside production because of the production fallback. Do the `.env.example` edit as a Ming step, as the ticket says.
9. **No new High-path files.** S2 touches no High paths per the plan table. Keep it that way: no `next.config.ts` change in S2 (S3 owns the Referrer-Policy change).

## Risks

- **Scope creep from D52.** A full pixel scene, the atlas pipeline and a pixel font could turn S2 into an art ticket. Mitigation: the placeholder slot in recommendation 2, and art arrives with SIM-024.
- **Font licence and bundle.** A pixel font adds a bundle cost and a licence record. Mitigation: heading only, local woff2, subset to Latin.
- **Build-time inlining.** If `NEXT_PUBLIC_*` is read through a helper or a destructured `process.env`, Next will not inline it and the override silently never applies. A test cannot catch this; review it by reading.
- **Gate flash.** The gate renders `checking` first, so signed-in users never see the sign-in screen flash. Make sure the SSR output and first client render are identical (no `window` access during render) to avoid hydration warnings.
- **Shared Turnstile key.** The production key is shared with tudocuatui (noted in the security review). This is not an S2 blocker but is a SIM-021 item.
- **Runtime CSP** is not covered anywhere in S2; XSS on the simap origin would expose the in-memory token.

## Open questions (with proposed defaults)

1. Does S2 include any pixel art beyond a CSS frame and decorative strip? Default: no. Add a swappable `SignInScene` slot with a CSS/SVG placeholder, and use `scene.signin` when SIM-024 delivers it.
2. Which pixel font for headings, if any? Default: none in S2 (system or kit font with pixel-styled frame only); revisit with Ming when art lands.
3. Where do style-guide palette variables live? Default: add only the used entries to `globals.css` under a `--px-*` prefix, and map the ones needed through `@theme inline`.
4. Should S2 add a CSP header for the sign-in surface? Default: no (it would touch `next.config.ts`, a High path); file a `debt` issue and handle it in S3 or a security ticket.
5. Should the plan's `RetryView` mapping for 5xx be an acceptance criterion row? Default: add it to AC1's verification list rather than a new AC.
6. Re-plan needed? Default: no re-plan. Just apply the D52 delta above and the security-review follow-ups inside the existing slice, and record them in the ticket's `plan.md` or Handoff.
