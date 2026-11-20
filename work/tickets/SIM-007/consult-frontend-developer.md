# Consult — frontend-developer — SIM-007 (2026-11-20, batch 2026-11-20-4)

SIM-007 consult (frontend). Read-only; no files changed.

## Findings
- **Identity client** is `src/ui/auth/identityClient.ts`. It has no `orgs()` method. `token(accountId)` posts `{audience, account_id}` with no `org_id`. The exact `/auth/orgs` response shape and the `org_access_denied` status/body are not documented in the repo; only spec AUT-06, spec §4 (lines 91-94) and `docs/requests/org-admin-api-org-members.md` mention them. Confirm the contract (probably consumers.md in the Identity repo) before coding the parser.
- **Token store** is `src/ui/auth/tokenStore.ts`, a closure holding `id`, `token` and a `generation` epoch. It already has `reset()` and `adopt()`. The account id lives in `localStorage` key `mm_account_id`, validated by UUID regex, in `accountId.ts`. `renew()` handles only `session_invalid`, `not_member` and `email_unverified`; there is no org concept.
- **Cross-tab channel** `authChannel.ts` messages are keyed by `accountId` only. A token minted for org A in one tab would be adopted by a tab on org B. This is a real bug risk once orgs exist.
- **AuthGate** is `src/ui/auth/AuthGate.tsx`. Its `View` union has no org screens. Every entry runs `/api/me` through `runCheck` → `viewForMe`. `org_required` (403) → `noOrg` → `NoOrgView`, which is a dead end ("No organization selected yet"). The pure decisions live in `src/lib/identity/flow.ts` (`viewForMe`, `meErrorView`, `viewForTokenError`, `readMeResult`). `MeResult.me` is only `{tier, email}`.
- **Server** `withAuth` (`src/server/http/with-auth.ts`) returns 403 `org_required` when the token's `org` is null, so a token minted without `org_id` yields `org_required`. `/api/me` already exists (`src/app/api/me/route.ts`, with a test). SIM-007 extends it to create the member and return member and org name.
- **Shell** already has the slots. `Session` (`src/lib/session.ts`) has `orgName?`. `ShellActions.switchOrg?` is in `src/ui/session.tsx`. `AppShellView` renders the org name and a `swap_horiz` IconButton disabled when `switchOrg` is absent. No shell change is needed except hiding the button for a single org (see below).
- **Remount mechanism:** `<Fragment key={view.generation}>` in the `ready` case remounts all children. This is the hook for clearing cached data.
- **Copy:** `src/ui/copy/auth.ts` (has `noOrg`), `src/ui/copy/api.ts` (`org_required: "No organization selected yet"`), `src/ui/copy/shell.ts` (`actions.switchOrg` exists).
- **Existing tests:** `views.test.tsx` (renderToStaticMarkup), `flow.test.ts`, `tokenStore.test.ts` with `fakeTabs`, `copy.test.ts`.

## Recommendations
1. **Identity client** (AC1, AC4). Add `orgs(accountId): Promise<{id, name}[]>` (GET `/auth/orgs`, cookie mode, 5 s timeout, UUID-validated ids, trimmed names, dedupe). Change `token(accountId, orgId?)` to send `org_id` when given. Map `org_access_denied` to a new `AuthError` code (add it to `src/lib/identity/types.ts` and `errors.ts`).
2. **Pure decision module `src/lib/identity/orgs.ts`**, no React, following the `flow.ts` style:
   - `decideOrg(orgs, remembered): {kind:"enter", org} | {kind:"pick", orgs} | {kind:"none"}`.
   - One org → `enter`, even if the remembered id differs.
   - Several orgs, remembered id still listed → `enter`. Otherwise → `pick`.
   - Zero → `none`.
   - Also here: `defaultDisplayName(email)` (local part, trimmed, NFC, capped at the name limit; fall back to "" if empty), `validateDisplayName` (trim, NFC, non-empty, max length, reject control characters). Put the shared validator in `src/lib/validate/` so the server `PATCH /api/me` reuses it (R1 lets the server import lib).
3. **Where it plugs into the gate:**
   - Add Gate views `orgPicker {orgs, error?}` and `profile {defaultName, error?}`. Add `OrgPickerView` and `ProfileView` to `views.tsx`; they take props only so they can render without runtime. Copy goes in new files `src/ui/copy/org.ts` and `src/ui/copy/profile.ts`, or inside `auth.ts`; follow the D36 per-feature convention.
   - Change `viewForMe` for `org_required` to `{kind:"needOrg"}`. In `apply`, `needOrg` calls `client.orgs(accountId)`, then `decideOrg`: `enter` → `store.selectOrg(id)` then `runCheck`; `pick` → picker; `none` → the existing `NoOrgView` with the "You are not in any organization yet" copy and how to get access.
   - Extend `/api/me` 200 with `{tier, email, org:{id?,name}, member:{displayName|null}}` (first call creates the member). Extend `readMeResult` and `MeResult.me` to match. `viewForMe` returns `{kind:"profile"}` when the display name is not yet confirmed. The first-visit screen then does `PATCH /api/me` and re-runs the check.
   - First-visit detection: "first visit" must be a persisted flag, not "name == default". Suggest a nullable `display_name` plus a `profile_completed_at` column (R2, forward-only migration, no auto-fill on insert). That way a concurrent first call stays idempotent (`insert ... on conflict (org_id, sub) do nothing`, then select) and a refresh mid-form re-shows the screen.
   - `PATCH /api/me` should store the NFC form, validate server-side, and return 422 on a bad name. The server must never trust the client's NFC.
4. **Remembering the org** (safe). Store only the org UUID in `localStorage` (key e.g. `mm_org_id:<accountId>`, so account A's org is never applied to account B). Validate it with the UUID regex on read, like `accountId.ts`. Reads and writes are try/catch best effort. It is not a secret. Authorization comes only from the minted token's `org` claim (R6), so a tampered value can at worst get `org_access_denied` or a not-listed id, which is dropped through `decideOrg`. Clear it on sign-out, `forget` and `session_invalid`, same as `forgetStored`. Put it in `src/ui/auth/orgId.ts` next to `accountId.ts`, plus a `store.orgId()` / `store.selectOrg(id)` pair.
5. **Token store changes.**
   - `selectOrg(id)`: `reset()` (this bumps `generation`), set the org, persist it, `renew()` with `org_id`.
   - `renew()` passes the org. On `org_access_denied`: clear the stored org and token, keep the account, and `notify` so the gate shows the picker (add the code to `NOTIFY_CODES` and to `viewForTokenError`: `{kind:"pickOrg", error}` → relist orgs → picker, with a notice).
   - Include `orgId` in the cross-tab `authChannel` token message and drop it when it differs from `orgId` (this tab). Otherwise a switch in tab 1 poisons tab 2. This is a protocol change to `authChannel.ts` and its tests; flag it.
   - Whether another tab following a switch is desired is a product choice; the simple answer is that tabs ignore mismatched orgs and leave each tab as is.
6. **Switching clears cached data** (AC1, AC "nothing from the previous org stays on screen").
   - `switchOrg` in the Gate: `++seq`, `flushSync(setView checking)` (the unmount-first pattern from `signOut`), `store.selectOrg(new)`, `runCheck`.
   - Bump `generation` on every org change, including re-entry to `ready` from `checking` after a switch. Today `ready` keeps `generation` only when `prev.kind === "ready"`, and a switch goes through `checking`, so `++generation.current` already happens. Add a test or comment so nobody "optimizes" this.
   - Clear any module-level caches (none exist yet; add an `onOrgChange` hook or a rule that later data layers key by org or live below the keyed Fragment). Avoid SWR/React Query global caches without a `clear()` call. Call out in the plan that future tickets must key caches by org id.
   - The switcher UI: a list or dialog opened from the shell IconButton, reusing `OrgPickerView` (with a "current" marker and Cancel).
   - `Session` gets `orgName` and `orgCount` (or `canSwitchOrg`). Pass `switchOrg` only when the org list has more than one entry, so the IconButton is disabled or hidden for single-org users. Verify the list on open; do not trust a stale one.
7. **org_access_denied** (AC4). The pure mapping in `flow.ts`: `{kind:"pickOrg", error}`. The Gate clears the remembered org, re-lists, and decides again: if exactly one org is left it enters it; if none it shows `noOrg`. This is the same `decideOrg` with `remembered=null`, so there is no loop. The denied org must be excluded from the immediate auto-enter (pass an `exclude` id), otherwise a list that still includes a suspended org loops forever. Show a notice ("You no longer have access to that organization"). Also handle a mid-session denial from the background renewal (`store.subscribe`), which already routes through `apply(viewForTokenError…)`.
8. **Tests without jsdom.**
   - `orgs.test.ts` (pure): `decideOrg` table (0, 1, 2+, remembered valid/invalid/other-account, exclude), `defaultDisplayName` (edge cases: no `@`, plus-tags, dots, non-ASCII, NFC vs NFD, empty, long), `validateDisplayName`.
   - `flow.test.ts`: `org_required` → `needOrg`, `org_access_denied` → `pickOrg`, plus the 200 body with a not-yet-confirmed profile → `profile`.
   - `identityClient.test.ts`: `orgs()` parsing, `token()` sending `org_id`, error mapping.
   - `tokenStore.test.ts` with fakes: `selectOrg` persists and re-mints with the org, the old in-flight `/token` is dropped (generation), `org_access_denied` clears the org, and the channel ignores a different-org token.
   - `views.test.tsx` via `renderToStaticMarkup`: `OrgPickerView` (list, disabled/submitting state, error notice, a11y: a labelled list/radio group, buttons with names), `ProfileView` (prefilled default, required marker, error), `NoOrgView` copy, and the shell: `AppShellView` with `orgName` and with/without `switchOrg`.
   - Add the new copy files to `copy.test.ts` if it enumerates them.
   - Server: the first `/api/me` creates exactly one member under concurrency (`Promise.all` of N calls) in `pnpm test:db`; PATCH stores NFC.
   - A thin gate-level test is hard without jsdom; keep the Gate transitions in a pure reducer if you want coverage (optional, see questions).
9. **UI a11y:** picker as a list of buttons (or a radio group) with a focus-visible style, the first item autofocused, an `aria-live` notice for denied, a form with a label and `autocomplete="nickname"`, `maxLength`, and a visible error for the profile screen. Reuse `AuthLayout`, `Notice`, `Button` from the existing views.
10. **Files.** The ticket lists `src/ui/org/*`; the gate and store changes also touch `src/ui/auth/*` and `src/lib/identity/*`, so state that in the plan to stay within R4. A migration is needed for `profile_completed_at`, if you accept it (R2).

## Risks
- Wire contract for `/auth/orgs` and `org_access_denied` is unverified (see Findings). Do not guess field names; check with Ming or the Identity docs.
- The cross-tab token leak between orgs (see Findings and Rec 5) is the largest safety risk; it is easy to miss.
- A loop on a suspended org that still appears in `/auth/orgs` (Rec 7).
- Stale data on switch: any module cache or in-flight fetch from the old org must be dropped. In-flight `apiFetch` calls started before the switch could resolve after remount; the keyed Fragment unmounts the component, but check `ApiFetch` for an abort signal or a generation check.
- Concurrent first `/api/me` creates duplicates unless the unique key is `(org_id, sub)`; confirm the `members` table has it (the migration README says every unique key starts with `org_id`).
- Showing a profile screen for "first visit" based on the default name would re-prompt users who accepted the default; use a persisted flag.
- `Session.orgName` has to come from the server (the token carries only the id). Do not take the name from the client's list for display after a restart without the server's answer (acceptable for display, but the `/api/me` value is authoritative).
- localStorage per-account key leaves stale entries for other accounts on a shared device; harmless but clear on sign-out.

## Open questions
1. What is the exact `/auth/orgs` response and the `org_access_denied` status/body? Does `/auth/token` accept `org_id` as documented in the spec?
2. SIM-008 is a dependency: does it already cover the members table and the DB shape (unique `(org_id, sub)`, nullable `display_name`)? If not, is a `profile_completed_at` column acceptable?
3. Should other tabs follow an org switch, or stay on their own org (recommended: ignore, per-tab org)?
4. Does a single-org user see the switcher at all (recommended: hidden or disabled)? Does the picker also show for a remembered org that is still valid (recommended: auto-enter)?
5. Display-name rules: max length, allowed characters, and whether Identity's display name later replaces the default (D17).
6. Is a small pure reducer for gate transitions acceptable, so the org flow is testable without jsdom, or should the ticket stay with the pure decisions and static-markup views only?
