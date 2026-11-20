# Security review — SIM-006.3

## Attempt 1
Agent: security-ai-generated-code-auditor (2026-11-20). Worked from the impl-log file list (no command access); read every new or changed file in `src/lib/identity`, `src/ui/auth`, `src/app/*/page.tsx`, `src/ui/copy/auth.ts`.

**Summary: 0 🔴 / 0 🟡 / 4 💭.** No objection to PASS.

### Checked and sound
- **Link token.** `src/lib/identity/email-link.ts:1,18-23` accepts only `#token=<32-128 base64url>`, never reads `?token=`, and calls `history.replaceState(null, "", path)` before returning whenever a hash or query is present. `VerifyEmailPage.tsx:25-32` / `ResetPasswordPage.tsx:22-29` take it once (ref-guarded, StrictMode-safe) before any network call; token lives only in a `useRef`, never in state, URL, log or error; no `console.*` in `src/ui/auth`. Sent only in a POST body with `credentials: "omit"` and no app header (`identityClient.ts:169-177`, public mode `:64-71`). Ref cleared on terminal outcomes (`VerifyEmailPage.tsx:49`, `ResetPasswordPage.tsx:46`).
- **No verify-on-load.** Verification only from the button (`account-views.tsx:295-337`).
- **Forgot-password enumeration.** `forgotOutcome` (`email-flows.ts:28-41`) passes only `turnstile_*`, `rate_limited`, `validation_error`; everything else → `unknown`. Neutral success copy (`copy/auth.ts:74`).
- **Open redirects.** None; all new links are fixed literals (`AuthGate.tsx:479-480`); no `returnTo`/`next`/search params read.
- **Client secrets.** None added; only the pre-existing public `NEXT_PUBLIC_MM_IDENTITY_BASE`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (`runtime.ts:30-32`).
- **Referrer.** `referrer: "no-referrer"` on all four pages (`src/app/{sign-up,forgot-password,verify-email,reset-password}/page.tsx:5`), tested in `src/app/account-pages.test.ts:14`; no third-party script on verify/reset.
- **Single-use guards.** `busy` ref on every submit (`SignUpPage.tsx:30`, `ForgotPasswordPage.tsx:25`, `VerifyEmailPage.tsx:38`, `ResetPasswordPage.tsx:35`, `AuthGate.tsx:391`); Turnstile token spent and widget reset after every attempt (`SignUpPage.tsx:46-48`, `ForgotPasswordPage.tsx:40-44`).
- **Output encoding.** Sign-up email shown as React text (`account-views.tsx:54`).

### Findings
1. 💭 Sign-up discloses a registered address (`email-flows.ts:13-14`, `copy/auth.ts:122`) — deliberate (plan AC11), Turnstile-limited; mention in the PR.
2. 💭 Forgot-password passes `rate_limited` through (`email-flows.ts:34`); if Identity keys the limit per email it hints the address was targeted. Confirm Identity's keying.
3. 💭 Resend can be clicked again after "sent" (`views.tsx:216`, disabled only while `sending`); Identity's rate limit is the control; optionally disable after `sent`.
4. 💭 Residual token exposure outside the app (browser global history, the email). Server-side mitigation: single-use, short TTL, reset revokes sessions — confirm in Identity.

### Follow-ups (out of scope)
- Confirm Identity: forgot-password rate-limit keying; token single-use + short TTL; reset revokes sessions.
