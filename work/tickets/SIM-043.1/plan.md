Status: READY

# Plan — SIM-043.1: Super-admin org picker badge and 429 Retry-After (D86 client contract)

## Scope summary
- `work/decisions.md` D86 (2026-11-27, amends D75): "`GET /auth/orgs` items carry `access: "member" | "super_admin"`
  (unknown values = not openable); … handle 429 `rate_limited` (30 super-admin mints per account per hour). Tokens last
  up to 3600 s (no `sid`)."
- `work/tickets/SIM-043/plan.md` → Split proposal, slice 2: `OrgChoice.access?`; `parseOrgs` reads `access` from the
  item or the nested org and drops unknown values without hitting the zero-parsed `unknownError`; a "Support access"
  badge in `OrgPickerView` and `OrgSwitcherDialog` with copy in `src/ui/copy/`; `tokenStore.background()` honours
  `retryAfterSeconds` for `rate_limited`; tests in `identityClient.test.ts`, `tokenStore.test.ts`, `org-views.test.tsx`.
- Q8 defaults (approved 2026-11-27): a missing `access` means `member`; unknown values are dropped and excluded from the
  "non-empty list, zero parsed" check; `super_admin` orgs get a "Support access" badge; a 429 `rate_limited` on
  background renewal re-arms at `max(RETRY_MS, Retry-After)`.

No High path is touched (checked against `.claude/loop.config.md` High paths). Client-side only; no server change.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | `parseOrgs` returns `access` per org; missing = `member`; unknown values dropped and do not trigger the zero-parsed error | `identityClient.test.ts` › "orgs: access is read from the item or the nested org; missing means member", › "orgs: unknown access values are dropped; a list with only unknown values returns [] and does not reject unknown". `pnpm test`. |
| 2 | Super-admin orgs show a "Support access" badge in picker and switcher; member orgs look as today | `org-views.test.tsx` › "OrgPickerView: super_admin org shows the Support access badge, member org does not", › "OrgSwitcherDialog: same". Existing tests in that file stay green unchanged. `orgs.test.ts` › "decideOrg keeps access" proves the badge data survives the AuthGate path. |
| 3 | A 429 `rate_limited` during background renewal waits at least `Retry-After` before retrying; the current token is kept while it lives | `tokenStore.test.ts` › "background renewal: rate_limited re-arms at max(RETRY_MS, Retry-After), token kept". |
| 4 | Tests in `identityClient.test.ts`, `tokenStore.test.ts` and the org view tests cover the above | The tests named above exist and `pnpm test` is green. |

## Ming verification after merge
- With a staff account on the real Identity (after M-90): the org picker lists a non-member org with the "Support access"
  badge, and member orgs without it. Real 429 behaviour after 30 mints/hour cannot be checked locally.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/identity/types.ts` (:50) | `OrgChoice = { id; name; access?: "member" \| "super_admin" }` | Scope bullet 1 | No |
| `src/ui/auth/identityClient.ts` (`parseOrgs`, :69-97) | Per item read `access` via `firstString(item.access, src.access)`. `undefined` -> `"member"`. `"member"` / `"super_admin"` kept. Any other value: `continue` (dropped) BEFORE the dedupe `seen` set and pushed nothing. Zero-parsed check (:95) changes to count only droppable-because-bad-shape items: track `unopenable` count; throw `unknownError` only when `list.length > 0 && out.length === 0 && unopenable === 0`. Every pushed org gets `access`. Update the doc comment. | AC1 | No |
| `src/lib/identity/orgs.ts` (:40) | `decideOrg` rebuilds `{ id, name }` and would drop `access`. Change to `{ id, name, ...(o.access && { access: o.access }) }`, so existing tests with no `access` still `toEqual`. | AC2 (badge data reaches views) | No |
| `src/lib/identity/orgs.test.ts` | Add "decideOrg keeps access on enter and pick; absent stays absent". | AC2 | No |
| `src/ui/copy/org.ts` | Add `supportAccess: "Support access"` (one shared string, e.g. `orgCopy.badge.supportAccess`). | D36 | No |
| `src/ui/org/OrgPickerView.tsx` (:29-40) | When `o.access === "super_admin"` and not busy, render the badge text after the name inside the button (a `<span>` with small text, e.g. `text-xs`), so the accessible name includes it. Layout classes follow existing tokens (`text-on-surface-variant` as in the switcher). Member orgs render exactly as today. | AC2 | No |
| `src/ui/org/OrgSwitcherDialog.tsx` (:64-79) | Same badge span after the name, next to the existing "Current" marker. | AC2 | No |
| `src/ui/auth/tokenStore.ts` (`background`, :226-233) | In the error handler compute `const wait = isAuthError(err) && err.code === "rate_limited" && Number.isFinite(err.retryAfterSeconds) && err.retryAfterSeconds! > 0 ? err.retryAfterSeconds! * 1000 : 0; const delay = Math.max(RETRY_MS, wait);` then `if (started && id && token !== null && now() + delay < expiresAt) armAt(delay)`. Other errors keep `RETRY_MS`. | AC3 | No |
| `src/ui/auth/identityClient.test.ts` (:352-421 block) | Existing `expected` and the `toEqual` at :398 gain `access: "member"`. Add the new tests. | AC1 | No |
| `src/ui/auth/tokenStore.test.ts` | New test in the `getToken` or a new `describe("background renewal")`. | AC3 | No |
| `src/ui/org/org-views.test.tsx` | Badge tests for both views. | AC2 | No |

Other `OrgChoice` users need no edit because `access` is optional: `AuthGate.tsx` (:39-40, :111, :166-197) passes the
list through; `orgs.test.ts` builds `{id,name}` objects. Implementer must not touch other files without recording why.

## Data model / migration
None.

## API contract
None. Client reads the optional `access` field of `GET /auth/orgs` items (Identity, D86); no simap endpoint changes.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `identityClient.test.ts` › "orgs: access is read from the item or the nested org; missing means member" (flat `access: "super_admin"`, nested under `org`/`organization`, absent, `"member"`) | AC1 |
| `identityClient.test.ts` › "orgs: unknown access values are dropped (`"owner"`, `""`, `null`, `5`, `"SUPER_ADMIN"`, `" super_admin"`); other orgs in the list still parse" | AC1 |
| `identityClient.test.ts` › "orgs: a non-empty list of only unknown-access orgs returns [] (no unknown rejection); a non-empty list of malformed orgs (bad id) still rejects unknown" | AC1, zero-parsed rule |
| `identityClient.test.ts` › update existing `expected` and :398 expectations to include `access: "member"` | regression |
| `orgs.test.ts` › "decideOrg keeps access on enter and pick; absent stays absent" | AC2 |
| `tokenStore.test.ts` › "background renewal: 429 rate_limited with retryAfterSeconds 120 re-arms at 120 s not 15 s; no extra token call before; token still returned by getToken while valid" | AC3 |
| `tokenStore.test.ts` › "rate_limited with Retry-After below RETRY_MS or missing re-arms at RETRY_MS; Retry-After beyond the token's expiry does not re-arm; non-rate_limited error (network) re-arms at RETRY_MS (unchanged)" | AC3 edge cases |
| `org-views.test.tsx` › "OrgPickerView: super_admin org shows 'Support access', member and access-less orgs do not; names intact" | AC2 |
| `org-views.test.tsx` › "OrgSwitcherDialog: badge for super_admin only, 'Current' marker still shown" | AC2 |

The implementer reads `tokenStore.test.ts` `setup` (fake timers/clock) before writing the AC3 tests; no new helper
outside the test file.

## Approach
1. Types first (`types.ts`), then pure/parse logic with tests: `parseOrgs`, `decideOrg` (rule 6).
2. Copy string, then badge in both views (props only; org names stay data, rendered as text, R1: ui imports lib only).
3. `background()` delay change; keep the single in-flight guarantee (no new timers besides `armAt`).
4. Run Checks: `pnpm format:check`, `pnpm typecheck`, `pnpm check:layers`, `pnpm test`, `pnpm build`.
5. Rules: R1 (no server import), R3 (no config), R4 (stay within list). Estimated size ~80 product lines + ~120 test lines.
   Single cycle.

## Specialist input used
None (fast lane, no consult files).

## Assumptions
- `parseOrgs` always sets `access` on returned orgs (`"member"` default), while the type keeps it optional so
  other constructors (tests, `decideOrg` input) stay valid.
- A single org with `super_admin` still auto-enters (existing `decideOrg` behaviour); no badge is shown in that case.
  Super admins with several orgs see the badge in the picker and switcher.
- On-demand renewals (`getToken` with a stale token, `renewNow`) are not delayed by Retry-After; only the
  background timer is, as the ticket scope says. A manual retry from the gate's `rate_limited` view stays user-driven.
- The badge is shown in the picker button text, so the accessible name reads "<org name> Support access".
- Hotspots: `src/ui/auth/tokenStore.ts`, `src/ui/org/*` and `src/lib/identity/*` are not edited by any other open
  ticket that I know of (SIM-043 slice 1 touches `src/server/**`, `src/app/api/me/**`, `src/lib/auth/**`, docs only).
  Rebase risk is low.
- Retry-After parsing is already done in `src/lib/identity/errors.ts` (:44-61); this ticket only reads
  `AuthError.retryAfterSeconds`.

## Blocking questions
None.

## Split proposal
None.
