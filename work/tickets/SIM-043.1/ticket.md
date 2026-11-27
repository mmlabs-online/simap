# SIM-043.1: Super-admin org picker badge and 429 Retry-After (D86 client contract)

| Field | Value |
|---|---|
| State | IN_PROGRESS |
| Priority | P2 |
| Size | S |
| Areas | ui, api |
| Gate | none |
| Depends on | SIM-043 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-27 |
| Claimed by | claude@2026-11-27T04:08:28Z |
| PR | — |

## Goal
The org picker understands D86's `access` field and shows super-admin orgs as support access, and token renewal
respects Identity's rate limit. Slice 2 of SIM-043 (split approved by Ming 2026-11-27).

## Scope reference
Decision D86 (amends D75); SIM-043 `plan.md` → Split proposal and Q8 defaults (approved).

## Scope
- `OrgChoice.access?: "member" | "super_admin"` (`src/lib/identity/types.ts`).
- `parseOrgs` (`src/ui/auth/identityClient.ts`) reads `access` from each item (or the nested org); a missing value
  means `member` (older Identity); unknown values are dropped as not openable and excluded from the "non-empty list,
  zero parsed" error check.
- A "Support access" badge on `super_admin` orgs in `OrgPickerView` and `OrgSwitcherDialog`; copy in `src/ui/copy/`.
- `tokenStore.background()` re-arms after 429 `rate_limited` at `max(RETRY_MS, Retry-After)`.

## Out of scope
- Server-side grant, audit, `/api/me` (SIM-043); picker search; personal-tab polish for super admins (follow-ups).

## Acceptance criteria
- [ ] `parseOrgs` returns `access` per org; missing = `member`; unknown values are dropped and do not trigger the
  zero-parsed error.
- [ ] Super-admin orgs show a "Support access" badge in the picker and the switcher; member orgs look as today.
- [ ] A 429 `rate_limited` during background renewal waits at least `Retry-After` before retrying; the current token
  is kept while it lives.
- [ ] Tests in `identityClient.test.ts`, `tokenStore.test.ts` and the org view tests cover the cases above.

## Notes / answers from Ming
- 2026-11-27: created from the SIM-043 split ("duyệt SIM-043, tách slice 2"), Q8 defaults approved.

## Handoff
