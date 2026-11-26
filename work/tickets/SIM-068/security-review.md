# Security review — SIM-068

## Attempt 1

**Summary:** PASS from a security view. I found no blockers and nothing that should be fixed. This attempt adds no script, image or connect host, adds no font host, makes no CSP change and adds no link or control, and it leaves the credential, Identity and Turnstile flow alone.

This was a read-only review. I had only Read, Grep and Glob, so I could not run `git diff` and checked the current file contents against the impl-log's list of touched files.

### Findings

💭 **Font and CSP: fine as is.** In `src/app/layout.tsx:16-22`, Fraunces is loaded through `next/font/google`. It has `preload: false` and `display: "swap"`, and it is served from `/_next/static/media`. The impl-log says the build output has `src:url(../media/*.woff2)` and no new host. `font-src 'self'` in `src/lib/security/headers.ts:36` already covers that, so `buildCsp` does not need to change.

💭 **The preconnects are not new.** Lines 38-39 of layout.tsx point at `fonts.googleapis.com` and `fonts.gstatic.com`. They serve the Material Symbols icon stylesheet that was already there (`src/lib/icons.ts:42`), and both hosts were already in `style-src` and `font-src`. Fraunces does not use them.

💭 **No new inline script or style.** The theme script is the existing nonce'd one. `next/font` only adds a class name (`serif.variable`) on `<html>`. All the new styling sits in the append-only `/* SIM-068 auth world (aw-*) */` block in `src/app/globals.css:467-610`. That block uses plain colour tokens with no `url()`, `@import` or outside resource, so it is just bundled CSS and needs no CSP change.

💭 **Credential flow untouched.** In `src/ui/auth/views.tsx:41,62,83`, `landing` is a boolean passed to `AuthLayout` and nothing else. The form, `submit`, `validateSignIn`, password state and `onSignIn` are unchanged. In `src/ui/auth/AuthGate.tsx:693`, the only change is the bare `landing` prop. `signUpHref`/`forgotHref` are still the same fixed same-origin paths, and the Turnstile slot is untouched.

💭 **No new links or controls, so no redirect risk.** `src/ui/auth/AuthLayout.tsx` adds only static text (`<p>`, `<h1>`/`<h2>`, `<em>`), with no `<a>`, button, `href` or `target`. All the text comes from the static `authCopy.world` in `src/ui/copy/auth.ts:39-53`, which contains no URLs and no user or query input. Nothing new is rendered with `dangerouslySetInnerHTML`.

💭 **Decorative parts are hidden from screen readers.** The logo icon (line 26), the divider (line 30) and the strip mark (line 47) all have `aria-hidden="true"`. The tagline, hero, portal title and footer are real text and are correctly left visible. With `landing` on there is one `h1` (the hero) and the card heading drops to `h2`; with it off the card title stays `h1`.

💭 **No secrets.** The touched source holds only copy text, colour values and font settings.

💭 **Build-time network fetch.** `next/font/google` downloads Fraunces from Google when the app is built, just as Manrope already does. This is not a risk in the running app, but the build needs to reach Google, and if it can't the image build fails. That is already true today, so it is only noted here.

### Follow-ups (out of scope)
- If the project later wants the CSP to drop Google hosts completely, the Material Symbols stylesheet would need to be self-hosted. Then `fonts.googleapis.com`/`fonts.gstatic.com` and both preconnects could be removed. This ticket doesn't affect that.
- I did not look at the content of `assets/art/CREDITS.md`. It is documentation only and nothing executes it.
