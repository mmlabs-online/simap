Status: READY

# Plan — SIM-050: Hide other members' email from Users

## Scope summary
Ticket goal: "A User no longer receives other members' email addresses from the members API or search".
Ticket scope: `GET /api/members` and `/api/members/[id]`: for a User, other members' `email` is null (in SQL); own row keeps it. Search member group: for a User, do not match on other members' email. UI shows nothing / "-" where withheld.
Spec: MEM-02 (spec-v1.md l.398-401), D69; OQ-58 (l.836) "*Answered 2026-11-26: default approved by Ming*": Users keep the Members page with "names, employee code, seats". Email is not in that list, so withholding it is consistent with the approved default (see Assumptions).

Finding (corrects the ticket's technical notes): the DSH-02 search (`src/server/search/search.ts` l.165-179) already neither selects nor matches `m.email` (match is display_name + employee_code only; `search.db.test.ts` l.87 and l.126 already assert "email not matched" and no `email` key). The only email-matching search is the Members list `q` filter (`manage.ts` l.163). So "search" work = that filter, plus keeping the DSH-02 tests as the regression guard.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | For a User, other members' `email` is null in list and detail; caller's own row keeps it | `manage.db.test.ts` › "User tier: other members' email is null in list and detail, own row keeps it" |
| 2 | For a User, searching by another member's email returns no member result; name still works | `manage.db.test.ts` › "User tier: q by another member's email matches nothing; q by name and by own email still match"; DSH-02 unchanged: existing `search.db.test.ts` l.87 test stays green |
| 3 | Manager and Admin responses and search unchanged | `manage.db.test.ts` › existing l.280 list-search test (email matched) stays green; new case asserts Manager and Admin see all emails |
| 4 | UI renders withheld email without errors | `MembersView.test.tsx` › "renders a dash when email is null"; `pnpm typecheck` |
| 5 | Per-tier unit and DB tests for members and search | tests below; `pnpm test`, `pnpm test:db` (CI) |

## Ming verification after merge
None.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/server/members/manage.ts` | `MemberRow.email` becomes `string \| null` (l.69); `toDto` passes it through (l.92); `memberSelect` l.119 selects `case when <emailVisible> then m.email end as email`; `listMembers` l.160-164 drops the `m.email` like-term when tier is User; `loadMember` l.185-198 passes the viewer sub | email withheld in SQL and not searchable | no |
| `src/lib/members/types.ts` | `MemberDto.email: string \| null` (l.40) with comment "null: withheld from a User for another member (MEM-02, D69)" | contract | no |
| `src/ui/members/MembersView.tsx` | l.144 render `m.email ?? "-"` | no crash on null | no |
| `src/ui/members/EditMemberDialog.tsx` | l.77 `subtitle={member.email ?? undefined}` (check prop type first); Edit dialog is Manager+ so null is not expected, this is for typing only | typecheck | no |
| `src/ui/members/MembersView.test.tsx` | add null-email case | AC4 | no |
| `src/server/members/manage.test.ts` | adjust fixture only if typing needs it (l.30) | typecheck | no |
| `src/server/members/manage.db.test.ts` | add per-tier tests | AC1-3 | no |
| `src/server/search/search.db.test.ts` | no change expected; edit only if a per-tier assertion is missing (assert a User also gets no email-based hit) | AC2 | no |

Not touched: `src/server/search/search.ts` (already email-free). Check `src/ui/members/member-form.ts` and any other `MemberDto.email` consumer via `pnpm typecheck`; fix only type fallout.

## Data model / migration
None.

## API contract
| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| GET | `/api/members` | unchanged | `items[].email: string \| null` (null for a User on other members' rows) | unchanged | any tier |
| GET | `/api/members/[id]` | unchanged | `email: string \| null` (same rule) | unchanged | any tier |

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `manage.db.test.ts` › User tier: other members' email null in list, own row keeps it | AC1 list |
| `manage.db.test.ts` › User tier: detail of another member has null email, own detail keeps it | AC1 detail |
| `manage.db.test.ts` › User tier: q by another member's email returns nothing; q by name (with diacritics) and employee code work; q by own email returns own row | AC2 (members filter) |
| `manage.db.test.ts` › Manager and Admin: emails present, q by email still matches | AC3 |
| `MembersView.test.tsx` › renders "-" for null email | AC4 |
| `search.db.test.ts` existing "email not matched" test | AC2/AC3 DSH-02 guard (verify it runs for the User tier too; add a User-tier assertion if absent) |

Edge cases: null `m.sub` (use `coalesce(..., false)` as the existing `visible` expression does), email with uppercase/diacritics, `%`/`_` in q.

## Approach
1. Reuse the existing `visible` expression (`m.sub = $sub`), which is already User-only; add a separate email visibility so Manager/Admin stay `null`-visible-free (no case). Simplest: `memberSelect(refCap, visible)` uses `visible` for the email case as well (same condition: own row only for a User, always for Manager+). Keep the `$2` bind order untouched.
2. In `listMembers`, build the `q` conditions as display_name + employee_code, adding the email term only when `visible === null` (Manager+).
3. Widen types, fix UI null handling, add tests. R1/R6/R7: no layer change, queries remain org-scoped, no new auth codes.

## Specialist input used
None (fast lane).

## Assumptions
- Ming approved the OQ-58 default (names, employee code, seats) on 2026-11-26; the ticket asks to confirm email is not included. This plan treats that default as the answer (D69 privacy intent) and is not BLOCKED; the orchestrator may surface it to Ming at the approval round if desired.
- Detail `updateMember` result (`manage.ts` l.255) loads with `viewerSub = null` (Manager+), so email stays present there.
- `src/server/members/manage.ts` is a possible hotspot if SIM-051/SIM-052 touch members code; neither is expected to (devices 404, room map). Expect no rebase.
- Estimated size: well under 150 changed lines.

## Blocking questions
None

## Split proposal
None
