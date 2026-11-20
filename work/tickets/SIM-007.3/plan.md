Status: READY

# Plan — SIM-007.3: First-visit profile screen

## Scope summary
Source: `work/tickets/SIM-007/plan.md` § Split proposal, S3 (approved 2026-11-20, batch 2026-11-20-4):

> **S3 = new ticket SIM-007.3 "First-visit profile screen"** (area ui; depends on S1 and S2). AC3 (UI). Files:
> `flow.ts` (`readMeResult` reads `member`; 200 with `needsProfile` → `profile` view after the gate is ready),
> `src/ui/org/ProfileView.tsx` (label, `autocomplete="nickname"`, `maxLength` 80, prefilled with the server's
> default name, required, visible error), `AuthGate.tsx` (`PATCH /api/me`, then re-check), `src/ui/copy/profile.ts`,
> client validation via `normalizeDisplayName` from `src/lib/validate/member.ts`.

Ticket AC: "SIM-007 AC3 (UI half): a display name is required on the first visit, prefilled with the server default, stored in NFC." Spec §305: "A member is created on the account's first visit to the org and asked for a display name (D16, D17)."
Server already on main: `GET/PATCH /api/me` return `{ sub, email, org, tier, member: { id, displayName, status, needsProfile } }` (`src/app/api/me/route.ts:12-47`); PATCH body `{ displayName }`, 400 `invalid_request` when invalid, NFC applied server-side.
Out of scope: member management (SIM-011), org picker/switcher (SIM-007.2).

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | A display name is required on the first visit: `GET /api/me` with `member.needsProfile: true` shows the profile screen, not the app | `flow.test.ts` › "viewForMe: 200 with needsProfile → profile view with the server display name"; "needsProfile false → ready"; "member absent → ready" |
| 2 | Prefilled with the server default | `profile-views.test.tsx` › "input value is the initial display name"; `flow.test.ts` › "readMeResult reads member" |
| 3 | Required, visible error, client validation via `normalizeDisplayName` (blank, whitespace-only, control chars, over 80 code points) | `profile-form.test.ts` › table of invalid inputs → error key; `profile-views.test.tsx` › "renders the error with role alert and aria-invalid"; `maxLength=80`, `autocomplete="nickname"`, `required` in markup |
| 4 | Stored in NFC | `profile-form.test.ts` › "NFD `Nguyễn` is sent as NFC" (the request body is built from `normalizeDisplayName`); server NFC is already covered by `members.db.test.ts` (S1) |
| 5 | Submit does `PATCH /api/me`; success enters the app, failure keeps the screen with the entered value and a message (400 → invalid, 5xx/network → try again, 401/403 → existing gate mapping) | `profile-form.test.ts` › "mapPatchResult: 200 needsProfile false → saved; 400 → invalid; 503/network → retry; 401/403 → access"; manual local run in impl-log |
| 6 | Copy follows SIM-022 (English, in `src/ui/copy/profile.ts`, no literals in the component, no Vietnamese diacritics) | `no-literals.test.ts` and `copy.test.ts` stay green |
| 7 | All loop checks green | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build` |

## Ming verification after merge
Sign in to a real org with a never-seen account: the profile screen appears with the email local part prefilled, saving enters the app, a reload does not show it again. Needs the deployed Identity and DB.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/identity/flow.ts` | (after SIM-007.2: `MeView` has `needOrg`, `GateView` has `pickOrg`) `MeResult.me` gains optional `member` (strict guard: `displayName` string, `needsProfile` boolean, else treated as absent); new `MeView` kind `{ kind: "profile"; tier; email; displayName }`; `viewForMe` returns it for 200 + `needsProfile === true`; `readMeResult` fills `member`. No org logic touched | S3 "readMeResult reads member, needsProfile → profile view" | no |
| `src/lib/identity/flow.test.ts` | new cases (below), added next to SIM-007.2's updated `needOrg`/`pickOrg` cases | pure logic first | no |
| `src/ui/org/profile-form.ts` | new, pure: `validateProfileName(raw)` → `{ ok, value }` or `{ ok: false, error: "required" \| "invalid" }`; `profilePatchInit(name)` (method, JSON header, body); `mapPatchResult(res/network)` → `saved` / `invalid` / `retry` / `access` | keeps AuthGate thin and testable | no |
| `src/ui/org/profile-form.test.ts` | new | tests for the above | no |
| `src/ui/org/ProfileView.tsx` | new, in the `src/ui/org/` folder SIM-007.2 creates (beside `OrgPickerView.tsx`), props-only: `initialName`, `email`, `status`, `error`, `onSubmit(name)`, `onSignOut`; label, `autoComplete="nickname"`, `maxLength={80}`, `required`, `aria-invalid`/`aria-describedby`, error Notice. Reuses `AuthLayout`, `Notice`/`Field` (`src/ui/auth/fields.tsx`), `Button`, `authCopy.actions.signOut`; adds no new shared component | S3 | no |
| `src/ui/org/profile-views.test.tsx` | new (separate from SIM-007.2's `org-views.test.tsx` to avoid a merge clash), `renderToStaticMarkup` | view tests | no |
| `src/ui/copy/profile.ts` | new, separate from SIM-007.2's `copy/org.ts`: title, intro, label, hint, submit, saving, field errors (required, invalid), save error (retry) | SIM-022 / D36 | no |
| `src/ui/auth/AuthGate.tsx` | (after SIM-007.2) `View` += `{ kind: "profile"; tier; email; displayName; error?; pending? }` beside `orgPicker`; `apply` case `profile` (`clearAccounts()` like ready; sets view); `saveProfile(name)`: `busy` guard, `++seq`, `apiFetch("/api/me", PATCH)`, then `readMeResult` → `viewForMe` → `apply` (a 200 with `needsProfile: false` goes to `apply(ready)`); errors via `meErrorView` (403 `org_required` → `needOrg` → SIM-007.2's `enterOrg`); render case `profile` → `ProfileView`. `ready` stays the only case rendering `children`; `enterOrg`, `selectAndCheck`, `denied`, `orgList`, switcher are not changed | S3 "PATCH /api/me from the gate" | no |

No file under `src/server/**`, `db/**` or the High paths is touched: risk tier predicted Medium (non-test source changes in `src/lib`, `src/ui`).
Estimated size: ~350 changed lines including tests.

## Data model / migration
None.

## API contract
None changed. Uses the existing `PATCH /api/me` (`{ displayName }` → 200 `{ …, member }`; 400 `invalid_request`; 401/403 per `withAuth`; 503 `unavailable`), tier `user`.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `flow.test.ts` › "readMeResult keeps a well-formed member and drops a malformed one" | member guard |
| `flow.test.ts` › "viewForMe: needsProfile true → profile view carrying tier, email, displayName" | AC1, AC2 |
| `flow.test.ts` › "viewForMe: needsProfile false or member absent → ready" | no regression of existing flow |
| `flow.test.ts` › existing 401/403/5xx cases unchanged | regression |
| `profile-form.test.ts` › "rejects blank, whitespace-only, ZWJ/control chars, 81 code points; accepts 80" | AC3 edge cases (Domain focus) |
| `profile-form.test.ts` › "Vietnamese name: NFD `Nguyễn Văn An` returns NFC; trims and collapses spaces" | AC4 |
| `profile-form.test.ts` › "profilePatchInit builds PATCH with JSON body `{displayName}` only" | AC5 |
| `profile-form.test.ts` › "mapPatchResult: 200 + needsProfile false → saved; 200 + needsProfile true → retry; 400 → invalid; 503 → retry; throw → retry; ApiAccessError → access" | AC5 |
| `profile-views.test.tsx` › "prefilled value, label, autocomplete nickname, maxlength 80, required" | AC2, AC3 |
| `profile-views.test.tsx` › "shows error text with role alert; submitting state disables the button" | AC3, AC5 |
| `profile-views.test.tsx` › "shows the email so the user knows which account; sign-out button present" | UX (default is derived from it) |
| existing `no-literals.test.ts`, copy diacritics test | AC6 |

## Approach
0. Prerequisite: branch from `main` after SIM-007.2 is merged. SIM-007.2 (its Approach 7, [EXT] points) guarantees every org entry (single org, remembered org, picker, switch, restore) ends in `runCheck` → `apply(ready)`. So the "needsProfile → profile" decision lives only in `viewForMe` and covers entry, switch and restore with no change to SIM-007.2's org code. A switch goes through `checking` (flushSync) and `ready` gets a new generation, so after saving the name the keyed Fragment mounts fresh.
1. `flow.ts`: extend types and `viewForMe`/`readMeResult` (pure). Missing or malformed `member` yields `ready` (back-compatible with the pre-SIM-007 body in existing tests); the server always sends `member` since S1.
2. `profile-form.ts` + tests (pure; R1: lives in `src/ui`, imports only `@/lib`).
3. `copy/profile.ts`, then `ProfileView.tsx` + tests.
4. `AuthGate.tsx`: add the view and `saveProfile`. On success use the PATCH response body (it carries `member`) through `readMeResult` → `viewForMe` → `apply`, so no extra GET is needed; if the answer still says `needsProfile`, stay on the screen with the retry message. 401/403 from `apiFetch` go through `meErrorView`, so a deactivated member or a lost session leaves the screen like any other gate state. The gate keeps `ready` unmounted until the name is saved: nothing in the app renders (and no org data is fetched) before that. Rules: R1 (`src/ui` imports `@/lib` only), R3 none, R4 stay in the file list, R5 tests listed.
5. Run all checks; record a local manual run (new account → screen → save → app) in impl-log.

## Specialist input used
None (fast lane: Size S, Gate none).

## Assumptions
- **This plan builds on the SIM-007.2 plan (batch 2026-11-20-5).** The implementation branches from `main` after SIM-007.2 merges. Line references to `AuthGate.tsx` and `flow.ts` are to the SIM-007.2 result, so the implementer re-reads the merged code first. Hotspots shared with SIM-007.2: `src/ui/auth/AuthGate.tsx`, `src/lib/identity/flow.ts`, `flow.test.ts` (this ticket only adds; the rebase should be trivial once 007.2 is on main). Files SIM-007.2 owns and this ticket does not touch: `views.tsx` (`NoOrgView`), `copy/org.ts`, `copy/auth.ts`, `OrgPickerView.tsx`, `OrgSwitcherDialog.tsx`, `org-views.test.tsx`, `tokenStore.ts`, `identityClient.ts`, `orgs.ts`.
- Interplay with SIM-007.2: the switcher and the shell exist only in `ready`, so the profile screen has no switcher (sign-out only). A background `org_access_denied` while on the profile screen is not routed by the `store.subscribe` handler (it acts only when `ready`); the next `PATCH /api/me` then fails with 403/401 and goes through `meErrorView` → `needOrg`/`pickOrg`, so no dead end.
- Non-blocking, proposed defaults (Ming may overrule; none blocks):
  1. Missing/malformed `member` in a 200 `/api/me` → `ready` (not an error). Default kept for compatibility.
  2. Save success uses the PATCH response, no separate re-check call (source said "then re-check"; the response is the same `/api/me` shape, so the effect is equal with one request fewer).
  3. The profile screen offers a "Sign out" action (no skip, no cancel) so a user who does not want to continue is not stuck. Default on.
  4. UI uses the clean UI kit (`AuthLayout`, `Field`), same as SIM-007.2 (D47).
  5. Copy is a first draft in `copy/profile.ts`; wording for Ming to polish later.
- Session shape (`src/lib/session.ts`) is not changed; the display name is not added to the session in this ticket (the shell avatar/name is a later ticket). Follow-up.

## Blocking questions
None.

## Split proposal
None (~350 lines).
