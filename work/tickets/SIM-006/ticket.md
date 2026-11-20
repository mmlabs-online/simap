# SIM-006: Browser sign-in with mmlabs Identity

| Field | Value |
|---|---|
| State | IN_PROGRESS |
| Priority | P0 |
| Size | M |
| Areas | security, ui |
| Gate | plan-approval |
| Depends on | SIM-003, SIM-005 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-20 |
| Claimed by | claude@2026-11-20T07:24:39Z |
| PR | — |

## Goal
People sign in with their mmlabs account on simap's sign-in page and keep a renewed access token in memory, like tudocuatui and ricotdin.

## Scope reference
spec AUT-01, AUT-02, §3 Auth; D4, D7, D33.

## Scope
- Port tudocuatui `src/features/auth/` (identityClient, tokenStore, refreshLock, authChannel, accountId) to simap with app key `simap`.
- Sign-in page: email + password, Turnstile when asked, "Continue as <email>" for accounts on this browser, links to Identity sign-up and forgot-password; join step (`/auth/apps/simap/join`) on click.
- An `apiFetch` used by all UI data calls: bearer header, re-mint once and retry after a 401/403 (D7), sign-out on `session_invalid`.
- Sign-out (`/auth/logout`), "refresh permissions" action in the shell, English error copy (copy files, D36).
- Wire the SIM-003 session context to the real token store.

## Out of scope
- Org picker and member profile (SIM-007). Invitations (SIM-009).

## Acceptance criteria
- [ ] A signed-out visit to any app page shows the sign-in page; after sign-in the user lands back on the page.
- [ ] The token is only in memory (not in a cookie, `localStorage` or URL) and is renewed before `exp`; two tabs share one renewal.
- [ ] A 403 from simap triggers one re-mint and one retry; a second 403 shows "You don't have permission".
- [ ] Sign-out ends the session in this tab and in other tabs.
- [ ] Unit tests cover token renewal timing, error-code → screen mapping and the retry rule.

## Technical notes
- Files: `src/ui/auth/*` (or `src/lib/identity/*`), `src/app/sign-in/*`, `.env.example` if a public config name is needed; reference tudocuatui `src/features/auth/*`, ricotdin AUT-05.
- Risks / open questions: Manual check end to end needs M-1 (Identity app `simap` registered with the dev origin).

## Test plan
- Unit: tokenStore timing, retry rule, error mapping.
- Manual: sign in / out / two tabs against Identity once M-1 is done.

## Notes / answers from Ming
- Plan approved (2026-11-20, batch 2026-11-20-2) — Ming: "duyệt hết; câu 20 tách 3 phần; câu 34 dùng metadata.referrer; còn lại theo đề xuất". Split: this ticket = slice S1 (auth library) only; S2 → SIM-006.2 (sign-in gate UI), S3 → SIM-006.3 (account pages). Q34: Referrer-Policy via metadata.referrer (no next.config.ts change, applies to SIM-006.3). Q17: reuse tudocuatui's Turnstile widget key for now; own widget before go-live (SIM-021). Q18: no jsdom/testing-library. Q35: no Resend on /verify-email. Q16b: SIM-006.3 records a decision superseding D33's link targets and updates spec AUT-01 / Out of scope.
- 2026-11-20 (batch 2026-11-20-2, Q16): Ming: simap hosts its own sign-up and forgot-password pages, as ricotdin does, calling the same org-admin-api auth endpoints (replaces the D33 'link to Identity flows' reading). Plan to be revised; plan approval still pending.

## Handoff
