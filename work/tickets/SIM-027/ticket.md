# SIM-027: Security headers, CSP and apiFetch hardening before go-live

| Field | Value |
|---|---|
| State | DONE |
| Priority | P1 |
| Size | M |
| Areas | security, architecture |
| Gate | plan-approval |
| Depends on | SIM-006.2 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-20 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/31 |

## Goal
Before go-live the app sends security headers and a Content-Security-Policy, and the browser API client never follows redirects, which restricts how an XSS or a misrouted response can exfiltrate the in-memory token (CSP cannot stop exfiltration by navigation; Q25).

## Scope reference
Ming 2026-11-20 batch 2026-11-20-3 Q14 ("separate security ticket before SIM-021"). Follow-ups: SIM-001 security review (security headers), SIM-003 (CSP nonce/hash for the inline theme script), SIM-006 security-review 💭1 (`redirect: "error"`) and 💭2 (rule: handlers never return 401/403 after a side effect), SIM-006.2 Δ7 (runtime CSP), SIM-004 follow-ups.

## Scope
- Security headers (`nosniff`, `frame-ancestors 'none'`/`X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) and a CSP that allows the inline theme script (nonce or hash), Turnstile (`challenges.cloudflare.com`) and the Identity origin, via `next.config.ts` headers or `src/proxy.*`.
- `apiFetch` uses `redirect: "error"` (+ test).
- Write the rule "route handlers never return 401/403 auth codes after a side effect" into CLAUDE.md Rules.

## Out of scope
- Self-hosting fonts (separate follow-up) unless the CSP requires it.

## Acceptance criteria
- [ ] Every page response carries the agreed security headers and CSP; the sign-in flow, theme script and Turnstile still work under it (scripted check against the built server).
- [ ] `apiFetch` refuses redirects (test).
- [ ] The 401/403 rule is in CLAUDE.md Rules.
- [ ] All loop checks green.

## Technical notes
- High paths: `next.config.*` / `src/proxy.*` → Gate plan-approval.
- Must land before SIM-021 go-live.

## Test plan
- Unit: apiFetch redirect. Scripted: curl the built server for headers; manual browser check by Ming for CSP violations.

## Notes / answers from Ming
- 2026-11-20 (batch 2026-11-20-3): created from Ming's approval ("duyệt hết theo đề xuất").

- Plan approved (2026-11-20, batch 2026-11-20-5): "ok hết" — Q21–Q29 take the defaults (nonce CSP in src/proxy.ts; HSTS max-age only; no report-only; Identity-client redirect → debt; goal reworded; COOP; CSP in dev; Permissions-Policy; Referrer-Policy). High tier: Ming merges.

## Handoff

### 2026-11-21 — claude — DONE
- Agent calls: 3, tokens ~160k total (implementer×1 default 56k, reviewer×1 default 57k, security-ai-generated-code-auditor×1 default 48k)
- Done: resumed from the approved plan (consult/plan from 2026-11-20 kept); implemented attempt 1 on session branch `claude/nifty-fermat-6byyub` (replaces `ticket/SIM-027`); review PASS, security review no 🔴; PR https://github.com/mmlabs-online/simap/pull/31.
- In progress / next: Ming merges; M-14 browser CSP check; follow-ups (unsafe-eval check, favicon matcher, F-1, F-4).
- Gotchas: board row on `main` not updated from this session (session may push only its branch).
