## Attempt 1 — 2026-11-20

### Files touched
| File | Required because |
|---|---|
| src/lib/identity/email-link.ts (new) | AC9: read token once, strip fragment/query before any call |
| src/lib/identity/email-flows.ts (new) | AC10-12: pure outcome mapping |
| src/ui/auth/fields.tsx (new) | Notice/Field/linkClass/ShowPasswordToggle moved out of views.tsx (no duplication) |
| src/ui/auth/views.tsx | import from fields; UnverifiedView optional Resend (AC12) |
| src/ui/auth/account-views.tsx (new) | props-only SignUp/Forgot/Reset/VerifyEmail/LinkChecking views |
| src/ui/auth/{SignUp,ForgotPassword,VerifyEmail,ResetPassword}Page.tsx (new) | containers |
| src/ui/auth/AuthGate.tsx | sign-up/forgot hrefs; resend handler |
| src/ui/copy/auth.ts | new screen strings (D36) |
| src/ui/index.ts | export the four pages (R1) |
| src/app/{sign-up,forgot-password,verify-email,reset-password}/page.tsx (new) | routes, metadata.referrer no-referrer (Q34) |
| src/lib/identity/email-link.test.ts, email-flows.test.ts, src/ui/auth/account-views.test.tsx, src/ui/auth/views.test.tsx, src/app/account-pages.test.ts | planned tests |
| work/decisions.md | D53 |
| docs/spec-v1.md | AUT-01, AUT-03, section 9 non-goals |

### Tests added / changed
- email-link.test.ts: readLinkToken accept/reject table; takeLinkToken (valid, invalid hash, ?token= query, empty, second call).
- email-flows.test.ts: all five outcome tables.
- account-views.test.tsx: SignUp/Forgot/Reset/Verify/LinkChecking views.
- views.test.tsx: UnverifiedView Resend, sent/rate-limited/sending, without onResend.
- account-pages.test.ts: metadata.referrer, title, default export takes no props.
- Not written: the plan's "field errors wire aria-invalid" view test (needs interaction, no DOM test lib, A8); Field markup is unchanged from the moved code and covered by existing SignInView behaviour.

### Checks (actual output summary)
- typecheck: exit 0 (next typegen + tsc); check:layers: 167 files, no violations
- format:check: all matched files use the correct format
- test: 61 files, 573 tests passed
- build: exit 0; /sign-up, /forgot-password, /verify-email, /reset-password are static (○)

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- docs/spec-v1.md line 37 still says "no local accounts, no passwords and no self-signup"; not in the plan's line list, left as is.
- Differences from tudocuatui views were not checked against `origin/main` of that repo (not available here); views were written from the plan's description.
- Sign-up / forgot views show errors in a Notice only; outcome `field` is computed but not rendered per field.

### Scope self-check
- Could the diff be smaller? No.
- Diff size: see git show --stat.
