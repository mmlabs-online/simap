# Security review — SIM-007

## Attempt 1
Agent: `security-ai-generated-code-auditor` (read-only; no checks run). Result: **0 🔴, 2 🟡, 7 🟢**.

- 🟡 1 `src/lib/validate/member.ts:8,16` — `normalizeDisplayName` rejects only `\p{Cc}`; format chars (`\p{Cf}`: U+200B, U+2060, bidi overrides U+202A–202E / U+2066–2069) and fillers (U+115F, U+1160, U+3164, U+FFA0) pass. Invisible names pass the DB `btrim(display_name) <> ''` check; a right-to-left override can render as another person's name in Manager lists / approvals. Fix: reject `\p{Cf}` (optionally allow ZWJ/ZWNJ between letters/emoji) and the fillers; require at least one `\p{L}|\p{N}|\p{S}|\p{P}`. Tests: `"​"`, `"a‮b"`, `"ㅤ"`, `"́"` rejected.
- 🟡 2 `src/lib/validate/member.ts:26-27` — `defaultDisplayName` strips `\p{Cc}` after `clean`, so an email like `"\u0007 \u0007"` yields `" "` → insert fails `members_display_name_check` → 500. A whitespace-only token email fails `members_email_check` → 500 instead of 403. Fix: strip `[\p{Cc}\p{Cf}]` before `clean`; in `getOrCreateMember` (`members.ts:84`) treat `email?.trim() === ""` as null (403, no insert).
- 🟢 3 Authz and org scoping correct: `withAuth({tier:"user"})`, tier only from `org_roles`, `sub`/`org` from the verified token, strict PATCH body, every query via `orgQuery` with `org_id = $1`; no IDOR.
- 🟢 4 No SQL injection (bound parameters only); insert race handled by `on conflict do nothing` + re-select in one transaction, one `member.create` audit row; `for update` before the status check in `setOwnDisplayName`.
- 🟢 5 Audit meta has no PII; errors return codes only; only SQLSTATE logged; `Cache-Control: no-store`.
- 🟢 6 Deactivated: GET returns own status; PATCH 403 `member_deactivated`. `memberGate = allowAll` until SIM-011 — SIM-011 must land before go-live.
- 🟢 7 GET creates the member; bearer token in memory, no cookies → no CSRF exposure.
- 🟢 8 Lone surrogates become U+FFFD via node-pg; optional: reject `\p{Cs}`.
- 🟢 9 R1/R3 hold.

Follow-ups: SIM-011 reuses `normalizeDisplayName` with the 🟡 1 hardening and blocks deactivated members in `memberGate`; consider a DB guard (`char_length(display_name) <= 80`, non-printing chars) in a later migration.

## Attempt 2
Agent: `security-ai-generated-code-auditor` (read-only; no checks run). Result: **0 🔴, 0 🟡, 5 🟢** — both attempt-1 🟡 resolved, no new should-fix issue.

- 🟢 1 Attempt-1 🟡 1 resolved (`src/lib/validate/member.ts:12-15,24`): `INVISIBLE` = `[\p{Cc}\p{Cf}` + U+115F/U+1160/U+3164/U+FFA0`]/u`, `VISIBLE` = `[\p{L}\p{N}\p{S}\p{P}]/u` required, checked after NFC + whitespace collapse; tests `member.test.ts:48-54`. Minor gap: U+115F, U+1160, U+FFA0 untested; consider `\u` escapes in the class.
- 🟢 2 Attempt-1 🟡 2 resolved: `defaultDisplayName` strips invisible chars before `clean`, never blank (`member.ts:29-36`); whitespace-only email → 403, no insert (`members.ts:54,84`; `members.db.test.ts:146-150`).
- 🟢 3 No over-rejection of Vietnamese names: NFD composed by NFC first, `\p{Mn}` not rejected (`member.test.ts:22-24,35-36`, `members.db.test.ts:92-94`). Trade-off: ZWJ/ZWNJ rejected (some Persian/Indic names, ZWJ emoji sequences).
- 🟢 4 No ReDoS; `g` flag only on the replace regex, `.test()` regexes are non-global; `u` flag everywhere.
- 🟢 5 Optional hardening for SIM-011: U+2800 (braille blank, `\p{So}`) and `\p{Co}`/`\p{Cn}`/`\p{Cs}` still pass.

Follow-ups unchanged: SIM-011 `memberGate` before go-live; DB guard `char_length(display_name) <= 80` in a later migration.
