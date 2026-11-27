# Security review — SIM-043.1

## Attempt 1

Security review of SIM-043.1, attempt 1 (read-only)

Scope and method: I had no shell in this run, so I could not run `git diff origin/main`. I reviewed the files listed in `impl-log.md` by reading the changed ranges directly:
- src/ui/auth/identityClient.ts
- src/ui/auth/tokenStore.ts
- src/lib/identity/types.ts, orgs.ts, errors.ts
- src/ui/org/OrgPickerView.tsx, OrgSwitcherDialog.tsx
- src/ui/copy/org.ts

I did not run the checks myself. The orchestrator should confirm they are green.

Findings

No 🔴 blockers. No 🟡 should-fix.

🟢 Notes:

1. `src/ui/auth/identityClient.ts:92-100`: the client-side `access` value is display-only, which is correct. Its only consumers are the badge conditions at `OrgPickerView.tsx:39` and `OrgSwitcherDialog.tsx:74`, plus pass-through in `orgs.ts:40`. Server-side authority still comes only from the verified token claim (`src/server/identity/verify.ts:156` `org_access` → `with-auth.ts:16` → `api/me/route.ts:22,38`). A tampered or spoofed `/auth/orgs` body could change a label, but it cannot grant anything.
   - Unknown values are dropped. That includes `null`, because `item.access !== undefined` treats `null` as present. This fails closed, which is right.
   - The `unopenable` counter only stops the "zero parsed" error when an item had a valid id and name and was then dropped for its access value. A truly malformed body still rejects with `unknown` (line 102), so this does not create an empty-list bypass.
   - Precedence: a top-level `item.access` overrides the nested org's value. That is fine, since both come from the same Identity response.

2. `src/ui/org/OrgPickerView.tsx:41`, `OrgSwitcherDialog.tsx:76`: the badge text is a static copy constant rendered as JSX text. Server data never becomes markup, so there is no injection surface. Org names were already escaped by React and trimmed/NFC-normalised (line 100).

3. `src/ui/auth/tokenStore.ts:231-239`: the Retry-After handling is bounded and cannot be abused.
   - `retryAfterSeconds` comes only from `toAuthError` (`errors.ts:35-44,58-62`). It must match `^\d{1,9}$` or be a finite positive number, is rounded up, and is capped at 86400 s. The extra `Number.isFinite` / `> 0` guard is redundant but harmless.
   - The delay has a floor of `RETRY_MS` (15 s), so a hostile or buggy `Retry-After: 0` cannot cause a tight renewal loop against Identity.
   - It re-arms only while `now() + delay < expiresAt`, and `armAt` also clamps to `MAX_TIMER_MS`. The current token is kept on 429: the `catch` in `renew` clears it only for session_invalid, not_member, email_unverified and org_access_denied.
   - A large Retry-After stops the re-arm, which is a safe failure. The next on-demand `getToken` retries, and the deviation is already in the impl-log follow-ups.

4. R3: no secrets, env values or logging were added. `toAuthError` still never echoes server text.

5. Not a finding, just noting where the risk sits. The real access-control risk of D86 is in the SIM-043 server grant, which is already merged. This slice changes no authorization path.

Follow-ups (out of scope)
- None security-relevant beyond the existing impl-log follow-up (Retry-After over about 45 s stops background re-arm).

Verdict: PASS (security). The client-side `access` field only drives a badge and fails closed on unknown values, and the Retry-After wait has both a floor and a cap. Caveat: my review covered the files listed in impl-log.md, not a `git diff` (no shell this run).
