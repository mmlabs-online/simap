Status: READY

# Plan — SIM-028.1: Browser dev-token mode (AuthGate skips Identity under `pnpm dev`)

> **High paths: this plan touches none.** Every file below was compared with `high:` in `.github/risk-tiers.yml` and
> `## High paths` in `.claude/loop.config.md`. `src/ui/auth/**` and `src/lib/identity/**` are not High (the High auth
> globs are `src/server/**/auth*`, `src/server/identity/**` and `src/server/http/**`), and no touched file is named
> `config.*`. **The ticket's own Gate is still `plan-approval`, so Ming approves this plan before implementation.** The
> security reviewer runs too (Areas include `security`).
>
> **Decisions for Ming:** three numbered decisions with defaults, in `## Assumptions`. None blocks the plan.

## Scope summary
- `work/tickets/SIM-028.1/ticket.md` Goal: "Under `pnpm dev` (dev-token mode from SIM-028) the browser opens simap signed
  in and never calls mmlabs Identity, so local development works without CORS."
- Ticket Scope:
  - "`AuthGate` renders a lazy `DevGate` only when `process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_SIMAP_DEV_TOKEN === "1"`; the Identity gate is otherwise unchanged."
  - "`DevGate`: never builds the Identity runtime; `/api/me` through a dev `apiFetch` (no `Authorization`, one send); maps
    the result to ready / profile / no-access / retry / `DevTokenView` (token invalid → `pnpm dev:token`; no org →
    `pnpm dev:token --org <uuid>`), each with "Check again"; a 401 mid-session flips to token-invalid."
  - "Session `devToken` flag and an amber "Dev token" badge in the shell; sign-out and org switch hidden."
  - "`ProfileView` / `NoAccessView` `onSignOut` optional."
  - "`pnpm check:dev-bundle`: after `pnpm build`, fails if `.next/static/**` contains dev-token strings."
- Ticket Out of scope: "Server side, token script and launcher (SIM-028). Org switching on a dev token. Adding
  `check:dev-bundle` to CI (follow-up for the workflow owner)."
- `work/decisions.md` D56 (as quoted in the SIM-028 plan): "under `pnpm dev` the server adds it as bearer to same-origin
  `/api/*` and the browser never calls Identity."
- SIM-028 plan, Decision B: client mode is `NEXT_PUBLIC_SIMAP_DEV_TOKEN=1` ANDed with the literal
  `process.env.NODE_ENV === "development"`; no probe route. Decision F: `ProfileView.onSignOut` and
  `NoAccessView.onSignOut` become optional (button hidden when absent); `Session` gains `devToken?: true`.
- D2 (Vitest, no jsdom) and D36 (UI copy in `src/ui/copy/`). R1, R3, R4, R5 apply.

### Consult open questions, answered from the code
1. **Does `MeView.ready` / `readMeResult` carry `org`? No.** `/api/me` sends it, but `readMeResult` keeps only `tier`,
   `email`, `member` (`src/lib/identity/flow.ts` l.122-125; `MeResult` l.50), and `flow.test.ts` l.182-184 pins that shape
   with `toEqual`. This plan does not extend it. Showing the org is option B of Decision 1.
2. **Different badge for `dev:prod`?** `scripts/dev-prod.mjs` l.82-88 builds its env through `devEnv`, so it sets the same
   flag and the browser cannot tell the two modes apart. Not in this ticket unless Ming picks option C of Decision 1.
3. **Hidden or disabled sign-out? Hidden (removed) in dev-token mode.** The ticket says "hidden". The condition is
   `session.devToken`, not `actions.signOut`, so the existing disabled state for a non-dev session with no action
   (`AppShellView.tsx` l.125-130) does not change.
4. **Sentinel or runtime read of the copy file? A hard-coded sentinel, guarded by a test.** The `.mjs` script cannot import
   the TS copy. `check-dev-bundle.test.ts` reads `src/ui/copy/dev-token.ts` and fails if the sentinel is no longer in it.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | With a valid scoped token file, `pnpm dev` + `http://localhost:3000` shows the app signed in, and the browser network log has no request to `api.mmlabs.online`. | Reviewer part: `dev-flow.test.ts › devViewForMe …ready`, `dev-fetch.test.ts › sends same-origin with no Authorization`, `DevGate.test.tsx › the dev graph never imports the Identity runtime`, and code reading (`getAuthRuntime` is called only in `IdentityGate`). The live run needs a real token: see Ming step 2. |
| 2 | Missing / expired token → `DevTokenView` naming `pnpm dev:token`; unscoped token → the `--org` hint; "Check again" recovers after re-running the script without restarting `pnpm dev`. | `dev-flow.test.ts › 401 / unauthenticated → token invalid`, `› 403 org_required → token needOrg`; `DevGate.test.tsx › DevTokenView invalid / needOrg`. Local run without a real token: `$env:SIMAP_DEV_TOKEN_FILE="<scratch dir>\missing"; pnpm dev`, then `curl -i http://localhost:3000/api/me` → 401. **Never point this at the real token file.** Live recovery: Ming step 3. |
| 3 | In dev-token mode the shell shows the "Dev token" badge and no sign-out or org-switch action; the first-visit profile can still be saved. | `AppShellView.test.tsx › devToken: badge shown, sign-out and switch absent`, `› no devToken: no badge, sign-out still rendered`; `profile-views.test.tsx › no onSignOut → no sign-out button`; `views.test.tsx › NoAccessView without onSignOut`. Code reading: `saveProfile` uses `profilePatchInit` + `mapPatchResult`. Live save: Ming step 4. |
| 4 | `pnpm build` then `pnpm check:dev-bundle` passes: no `DevGate`, `[dev-token]`, `pnpm dev:token` or `.config/simap` in `.next/static/**`; the Identity sign-in path is unchanged in production. | Run `pnpm build && pnpm check:dev-bundle` → exit 0. **Negative control:** add `.next/static/__probe.js` containing `pnpm dev:token`, run the check → exit 1 naming the file and marker, delete the probe. `check-dev-bundle.test.ts` covers the scanner. Diff reading: the `Gate` body is unchanged; `AuthGate` l.61-70 is only renamed to `IdentityGate` and wrapped. |
| 5 | All Checks green; new pure logic (`dev-fetch`, `dev-flow`) and views have Vitest tests. | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`. Tests are listed below. |

## Ming verification after merge
These need M-1 (`work/ming-todo.md` l.11) and a real account:
1. `pnpm dev:token --org <your-org-uuid>`, then `pnpm dev`.
2. **AC1:** open `http://localhost:3000` in Chrome with DevTools → Network, "Preserve log" on. The app is signed in and no
   request goes to `api.mmlabs.online`. Also open `/sign-in`: it redirects into the app. (`/sign-up`, `/forgot-password`,
   `/reset-password` and `/verify-email` are outside `AuthGate` and still use Identity: do not test AC1 on them.)
3. **AC2:** rename the token file and click "Refresh permissions" → the "No usable dev token" screen. Restore the file →
   "Check again" → signed in, with no dev-server restart. Run `pnpm dev:token` without `--org` → reload → the `--org` hint.
   Run it again with `--org` → "Check again" → signed in.
4. **AC3:** the amber "Dev token" badge is visible at desktop and phone width; there is no sign-out or org-switch button.
   For an account with no display name yet, the profile form saves and the app opens.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/ui/auth/AuthGate.tsx` | Rename `AuthGate` (l.61-70) to a private `IdentityGate`; add the module-level lazy `DevGate` and a new exported `AuthGate` (Approach 2). `Gate` (l.72-706) is untouched. | Scope bullet 1 | no |
| `src/ui/auth/DevGate.tsx` | New. Default export `DevGate`; named export `DevTokenView`. Do **not** export from `src/ui/index.ts`. | Scope bullet 2 | no |
| `src/ui/auth/DevGate.test.tsx` | New render and import-graph tests. | R5 | no |
| `src/lib/api/dev-fetch.ts` | New, pure: `createDevApiFetch`. | Scope bullet 2 | no |
| `src/lib/api/dev-fetch.test.ts` | New. | R5 | no |
| `src/lib/api/fetch.ts` | l.21: add `export` to `accessCodeOf`. Nothing else. | Reuse the 403 code mapping | no |
| `src/lib/identity/dev-flow.ts` | New, pure: `DevView`, `devViewForMe`, `devMeErrorView`, `loadDevView`, `createSingleFlight`. | Scope bullet 2 | no |
| `src/lib/identity/dev-flow.test.ts` | New. | R5 | no |
| `src/lib/session.ts` | l.4: add `devToken?: true`. | Scope bullet 3, Decision F | no |
| `src/ui/AppShellView.tsx` | Badge after the org name (l.97-99); render the sign-out `IconButton` (l.125-130) only when `!session.devToken`. | Scope bullet 3 | no |
| `src/ui/AppShellView.test.tsx` | Add the two badge tests. | R5 | no |
| `src/ui/copy/shell.ts` | Add `devToken: { badge: "Dev token", tooltip: "Signed in with a local development token" }`. | D36 | no |
| `src/ui/copy/dev-token.ts` | New: `devTokenCopy` (text in Approach 4). Imported only by `DevGate.tsx`. | D36 | no |
| `src/ui/org/ProfileView.tsx` | l.29 `onSignOut?:`; l.88-90 render only when set. | Scope bullet 4 | no |
| `src/ui/org/profile-views.test.tsx` | Add a test with and without `onSignOut`. | R5 | no |
| `src/ui/auth/views.tsx` | `NoAccessView` only: l.255 `onSignOut?:`; l.260-262 render only when set. `NoOrgView` (l.232-243) is not touched. | Scope bullet 4 | no |
| `src/ui/auth/views.test.tsx` | Add a `NoAccessView` test without `onSignOut`. | R5 | no |
| `scripts/check-dev-bundle.mjs` | New: exports `FORBIDDEN`, `findForbidden(dir)`; `main()` behind the guard of `check-layers.mjs` l.84. | Scope bullet 5 | no |
| `scripts/check-dev-bundle.test.ts` | New. | R5 | no |
| `package.json` | Add `"check:dev-bundle": "node scripts/check-dev-bundle.mjs"`. No dependency change. | Scope bullet 5 | no |
| `README.md` | Replace "Local development" steps 7-8 (l.41-44). **Not in the ticket's file list:** see Decision 3. | Step 7 becomes false after this ticket | no |

**Do not edit:** `.claude/**`, `CLAUDE.md`, `.github/workflows/**`, `src/lib/security/headers.ts`, `src/proxy.ts`,
`next.config.ts`, `src/server/**`, `scripts/dev.mjs`, `scripts/dev-prod.mjs`, `src/lib/identity/flow.ts`.

## Data model / migration
None.

## API contract
| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|

None. No endpoint changes. The browser uses the existing `GET` and `PATCH /api/me`.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/api/dev-fetch.test.ts › sends same-origin with no Authorization, even if the caller passes one; keeps other headers` | AC1 |
| `… › forces cache no-store and redirect error over caller values` | SIM-027 parity |
| `… › refuses non-/api/ input (https://…, //host/api/x, /apix) without sending` | SIM-027 parity |
| `… › 401: one send, onAuthLost("unauthenticated"), throws ApiAccessError unauthenticated` | one send, mid-session |
| `… › 403 org_required: one send, onAuthLost("org_required"), throws org_required` | Decision 2 |
| `… › 403 forbidden / member_deactivated / unreadable body: one send, no onAuthLost, throws the mapped code (unreadable → forbidden)` | no-access |
| `… › 200, 400 and 5xx are returned untouched after one send; a network error rethrows` | retry path |
| `src/lib/identity/dev-flow.test.ts › devViewForMe: 200 → ready; needsProfile → profile` | AC1, AC3 |
| `… › 401 / unauthenticated → token invalid` | AC2 |
| `… › 403 org_required → token needOrg` | AC2 |
| `… › 403 forbidden / member_deactivated → noAccess; 5xx and network → retry` | scope mapping |
| `… › devMeErrorView: ApiAccessError signed_out and unauthenticated → invalid; org_required → needOrg; forbidden / member_deactivated → noAccess` | AC2 |
| `… › devMeErrorView: an object with an Identity code (session_invalid, not_member, email_unverified) and a TypeError → retry; never a sign-in, join or org view` | no Identity screen in dev |
| `… › loadDevView never rejects (fetch rejection → retry)` | gate safety |
| `… › createSingleFlight: two joins before settle → one run, same value; a join after settle → second run; reset() → next join runs again; a stale settle does not clear a newer flight` | StrictMode, Check again |
| `src/ui/auth/DevGate.test.tsx › DevTokenView invalid names pnpm dev:token and the --org hint, with Check again` | AC2 |
| `… › DevTokenView needOrg names pnpm dev:token --org <uuid>, with Check again` (assert on escaped HTML) | AC2 |
| `… › DevGate first render shows the checking view and not its children` | fail closed |
| `… › the dev graph never imports the Identity runtime` (reads the sources of `DevGate.tsx`, `dev-fetch.ts`, `dev-flow.ts`; none mentions `runtime`, `tokenStore`, `identityClient`, `@/lib/dev-token`) | Scope bullet 2 |
| `src/ui/AppShellView.test.tsx › devToken: badge shown, sign-out and switch absent` | AC3 |
| `… › no devToken: no badge, sign-out still rendered` | production unchanged |
| `src/ui/org/profile-views.test.tsx › no onSignOut → no sign-out button; with it → button` | AC3 |
| `src/ui/auth/views.test.tsx › NoAccessView without onSignOut has the message and no button` | Decision F |
| `scripts/check-dev-bundle.test.ts › clean synthetic dir → no findings` | AC4 |
| `… › each FORBIDDEN marker in a nested file (including a .map) → finding with file and marker` | AC4 |
| `… › missing dir and empty dir → throws` | no false pass |
| `… › the sentinel is present in src/ui/copy/dev-token.ts and no marker is in src/ui/copy/shell.ts` | copy drift |

## Approach
1. **Prove the bundle first.** Add `AuthGate`, a stub `DevGate` importing `copy/dev-token.ts`, and the check script, then
   run `pnpm build && pnpm check:dev-bundle`. Next must drop the lazy chunk in production; this has not been observed yet
   for this client pattern. **If a marker survives, stop and report it in `impl-log.md`.** Do not weaken the marker list
   or move the guard.
2. **`AuthGate.tsx`.** The guard stays one inline literal, with no helper or destructure:
   ```tsx
   const DevGate =
     process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_SIMAP_DEV_TOKEN === "1"
       ? lazy(() => import("./DevGate"))
       : null;

   export function AuthGate(props: { children: ReactNode; onReady?: () => void }) {
     if (DevGate)
       return (
         <Suspense fallback={<CheckingView />}>
           <DevGate {...props} />
         </Suspense>
       );
     return <IdentityGate {...props} />;
   }
   ```
   The split keeps hook order valid. **`onReady` must be forwarded:** `SignInRoute.tsx` l.11 relies on it to leave
   `/sign-in`.
3. **Pure modules.**
   - `createDevApiFetch({ fetchFn = (...a) => fetch(...a), onAuthLost })` returns an `ApiFetch`. It applies the `/api/`
     guard (`fetch.ts` l.48), deletes `Authorization`, sets `cache: "no-store"` and `redirect: "error"`, and sends once.
     401 → `onAuthLost("unauthenticated")`, throw. 403 → `await accessCodeOf(res)`; on `org_required` call
     `onAuthLost("org_required")`; throw the code. Anything else is returned.
   - `DevView` = `ready {tier,email}` | `profile {tier,email,displayName}` | `token {reason: "invalid" | "needOrg"}` |
     `noAccess {code}` | `retry {error}`.
   - `devViewForMe(result)` wraps `viewForMe`: `signedOut` → token invalid, `needOrg` → token needOrg, the rest unchanged.
   - `devMeErrorView(err)` **must not call `meErrorView`**: that returns sign-in, join and org views (`flow.ts` l.93-101).
     Map `ApiAccessError` directly; anything else is `retry` with `{ code: "network" }`.
   - `loadDevView(apiFetch)`: `/api/me` → `readMeResult` → `devViewForMe`, catching into `devMeErrorView`.
   - `createSingleFlight(run)`: `{ join(), reset() }`. The shared value is a `DevView`, never a `Response` (a body can be
     read once).
4. **Copy (`src/ui/copy/dev-token.ts`).**
   - `invalidTitle: "No usable dev token"` (**the sentinel**)
   - `invalidBody: "Run pnpm dev:token, then check again. If you started with pnpm dev:prod, run pnpm dev:token --org <the org in the banner>. The server console names the exact cause."`
   - `needOrgTitle: "Dev token has no organization"`
   - `needOrgBody: "Run pnpm dev:token --org <uuid>, then check again."`
   - `checkAgain: "Check again"`

   The browser only sees a plain 401 for missing, malformed, expired, wrong-org and refused requests, so the copy must not
   claim one cause.
5. **`DevGate.tsx`** (`"use client"`). Props: `{ children, onReady? }`. No store, timers, `BroadcastChannel` or
   `setAuthLostHandler`.
   - State: `view` (`checking` or a `DevView`, with `generation` and `session` when ready), `status`; refs `seq`,
     `generation`, `busy`, `viewRef`, `onReadyRef`, following `Gate`.
   - Create `apiFetch` and the flight once, in a `useState` initializer. **`apiFetch` must keep its identity:** feature
     pages memoize on it (for example `AuditPage.tsx` l.41).
   - `onAuthLost(code)`: return unless `viewRef.current.kind === "ready"`. Otherwise bump `seq`, `flight.reset()`, set
     `viewRef.current` to the token view **synchronously**, then `setView`. Parallel 401s from feature screens therefore
     flip it once.
   - Mount effect: `const s = ++seq.current; flight.join().then((v) => s === seq.current && apply(v))`. StrictMode's second
     run joins the same request, and only the newest epoch applies it.
   - `check()` ("Check again", Retry): bump `seq`, `flight.reset()`, set `checking`, then join.
   - `refreshPermissions`: only while ready; bump `seq`, `flight.reset()`, join, apply. Ready stays on the same generation.
   - `apply(v)`: entering ready from any other view takes a new generation (`Fragment key`), as in `Gate` l.236.
     `session = { tier, email, devToken: true }`.
   - `saveProfile`: `apiFetch("/api/me", profilePatchInit(name))` → `mapPatchResult`. `saved` →
     `devViewForMe(await readMeResult(out.res))`; `access` → `devMeErrorView(out.error)`; `invalid` / `retry` stay on the
     form, as in `Gate` l.525-551.
   - `onReady` effect as in `Gate` l.370-372.
   - Render: ready → `SessionProvider` with `actions={{ refreshPermissions }}` + `ApiFetchProvider` +
     `<Fragment key={generation}>`. Others → `CheckingView`, `RetryView`, `NoAccessView` and `ProfileView` (no `onSignOut`),
     `DevTokenView`.
   - `DevTokenView({ reason, onCheckAgain })`: `AuthLayout` + `Notice kind="error"` + full-width `Button`, as `RetryView`.
6. **Shell.** Inside the `session &&` block after the org name:
   ```tsx
   {session.devToken && (
     <span
       title={shellCopy.devToken.tooltip}
       className="inline-flex flex-none items-center whitespace-nowrap rounded-[8px] border border-amber-500 bg-amber-300 px-2 py-[3px] text-[10px] font-extrabold uppercase tracking-[0.06em] text-amber-950"
     >
       {shellCopy.devToken.badge}
     </span>
   )}
   ```
   Fixed amber classes read in both themes and need no new token (the Tailwind palette is available: `globals.css` l.1, no
   `--color-*` reset). It has text (not colour alone), is not dismissible, and has no `hidden lg:*` class.
7. **`scripts/check-dev-bundle.mjs`.** Node built-ins only.
   - `FORBIDDEN = ["DevGate", "[dev-token]", "pnpm dev:token", ".config/simap", "dev-token", "dev:token", "No usable dev token"]`.
     The ticket's four markers, the two broader strings of the current README check (so replacing it weakens nothing), and
     the sentinel. Minification renames `DevGate`, so that marker alone proves little.
   - `findForbidden(dir)` walks every file, including `.map`, and matches on the raw `Buffer`. It throws if `dir` is
     missing or holds no files.
   - `main()` scans `.next/static`, prints `file: marker` only (never file content), and exits 1 on findings or a throw. It
     is not chained into `pnpm build`: `.dockerignore` excludes `scripts/` from the image build (SIM-028 split proposal).
8. **README l.41-44** becomes:
   > 7. With a valid token, `pnpm dev` opens the app signed in at `http://localhost:3000` with a "Dev token" badge and no
   >    sign-out or org switch; app routes never call Identity from the browser. If the token is missing, expired or has
   >    no org, the app names the command to run, and "Check again" picks up the new token without a restart. The sign-up,
   >    password and email-link pages still call Identity and fail under CORS in dev.
   > 8. After `pnpm build`, run `pnpm check:dev-bundle`: it fails if dev-token code is in the client bundle.
9. Run all Checks and the AC4 negative control. Record the outputs in `impl-log.md`.

How the rules are met:
- **R1:** `DevGate` imports ui and lib only; the new lib files import lib only; `check:layers` covers it.
- **R3:** no new env name; the token never reaches the browser, and the flag is a boolean set by the launcher.
- **R4:** only the files above. **R5:** tests above. **R2, R6:** no schema or query change; the server still scopes by the
  verified token.
- CSP: no change. `/api/me` is same-origin, and the lazy chunk loads under the existing nonce and `strict-dynamic`.

## Specialist input used
From `consult-frontend-developer.md`:
- **Adopted:** inline literal guard with the import only in the true branch (§1); DevGate as the only importer of dev
  modules; sentinel marker and absent-directory failure (§1); no CSP change (§2); the 401 / 403 mapping table (§4);
  copy that does not claim a cause and always carries the `--org` hint (§4, Risks); local `onAuthLost` instead of
  `setAuthLostHandler` (§4); idempotent flip (Risks); badge visible below `lg`, permanent, text not colour alone (§5).
- **Adopted with a change:** single-flight for `/api/me`, but **per `DevGate` instance, not module-level** (§3). StrictMode
  keeps refs and state across its simulated remount, as the consult notes. A module-level promise would also be shared
  between the `(app)` and `/sign-in` gates and survive HMR, with no benefit.
- **Rejected:** `role="status"` on the badge (§5): it is a live region, and this label never changes. Its text is already
  readable by assistive technology.
- **Rejected:** Recommendation 7 (add the check to `.claude/loop.config.md` and `CLAUDE.md`): agents must not edit
  `.claude/**`, and the ticket excludes CI. Listed as a follow-up below.
- **Deferred to Decision 1:** org id in the badge (§5, open question 1) and a `dev:prod` flag (open question 2).

## Assumptions
### Decisions for Ming (defaults chosen; approve or override at the plan gate)
1. **How visible is production data under `pnpm dev:prod`?** It uses this same browser mode, and every write is real. The
   terminal banner says so, but the browser cannot tell `dev:prod` from local dev.
   - **A (default): same "Dev token" badge in both modes; open a follow-up ticket.** Keeps to the ticket's scope.
   - B: also show a short org id in the badge tooltip. Needs `org` carried through `/api/me` parsing (`flow.ts` and its
     exact-shape tests). About 15 lines. It identifies the org, but does not say the data is production.
   - C: a distinct red "Production data" badge through a new `NEXT_PUBLIC_SIMAP_DEV_PROD=1` set by `scripts/dev-prod.mjs`.
     This is the option that actually closes the risk, but it widens the ticket into the SIM-029 launcher. **Recommended
     as the follow-up ticket.**
2. **Should a token that loses its org mid-session also flip the screen?** The ticket names only "a 401 mid-session".
   - **Default: yes**, a mid-session 403 `org_required` flips to the `--org` hint. This happens when `pnpm dev:token` is
     re-run without `--org`. Cost: one branch in `dev-fetch`.
   - Alternative: 401 only. Feature screens would then show their generic error until a reload.
3. **May this ticket edit `README.md` (not in its file list)?**
   - **Default: yes**, steps 7-8 only. Step 7 says the UI "still shows the Identity sign-in" until SIM-028.1, which becomes
     false on merge.
   - Alternative: leave it and open a docs follow-up.

### Follow-ups (not in this ticket)
- **For Ming / the workflow owner:** add `pnpm check:dev-bundle` to `.github/workflows/ci.yml` after `pnpm build` (l.58).
- **For Ming:** add it to `.claude/loop.config.md` → Checks and to the `CLAUDE.md` Commands list. Agents do not edit
  `.claude/**`, and this plan leaves `CLAUDE.md` unchanged.
- Production-data badge for `dev:prod` (Decision 1, unless Ming picks B or C now).

### Other assumptions
- The size is about 400 non-test lines (`DevGate` about 190, the rest small), at the limit of one cycle. No split: the
  gate, its pure modules and its bundle check are only useful together.
- AC1's "no request to `api.mmlabs.online`" applies to `AuthGate` routes. The sign-up, password and email-link pages sit
  outside it and are unchanged (SIM-028 plan, Other assumptions).
- `NoAccessView` has no button in dev mode. A reload re-checks. The ticket asks for "Check again" on `DevTokenView` only.
- A request sent before a token fix and answered 401 after "Check again" can flip the view once more; "Check again"
  recovers. Not worth extra code in a dev-only path.
- Production cannot enable this mode: `next build` inlines `NODE_ENV` as `production` (SIM-028 plan, `define-env.js` l.76),
  `next.config.ts` does not set `allowDevelopmentBuild`, and neither the `Dockerfile` nor `.github/workflows/` sets the flag.
- Reviewers and implementers do not need a real token, and must not read the real token file or any `.env*` file.
- **Hotspots:** no other ticket is `IN_PROGRESS`, `REVIEW` or `DONE` on the board. SIM-027's `fetch.ts` change is merged,
  so the ticket's rebase risk no longer applies.

## Blocking questions
None.

## Split proposal
None. This ticket is slice 2 of the approved SIM-028 split.
