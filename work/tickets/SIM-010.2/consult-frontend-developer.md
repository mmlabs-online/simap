# Consult — frontend-developer — SIM-010.2 (2026-11-20, batch 2026-11-20-4)

**SIM-010.2 consult: what changed on main that the Slice B plan must adapt to** (read-only; checked ticket.md, SIM-010 plan.md Slice B lines 73-90 and 196-211, src/ui/*, auth/*, copy/*, decisions D47/D52). I did not find or read my earlier consult-frontend-developer.md.

## Findings
1. **apiFetch access.** The plan says `RoomsPage` gets `fetcher = apiFetch` from "SIM-006's `src/ui/api/`". That path does not exist. It is now `useApiFetch()`, exported from `@/ui` (`src/ui/auth/api-fetch-context.tsx`). It throws if there is no `ApiFetchProvider`. `AuthGate` renders the provider only in the `ready` state, and `src/app/(app)/layout.tsx` already wraps every app page in `AuthGate` > `AppShell`.
   - Because of this, `RoomsPage` renders only when a session exists. The plan's `useRooms` "waits for a session before fetching" is unnecessary.
   - `useSession()` returns a `Session | null` (`{tier, email}`). Inside the gate it is non-null, but keep the `null` guard for typing.
2. **Remount on session generation.** `AuthGate` wraps children in `<Fragment key={generation}>`, so a re-sign-in remounts the page. `useRooms` needs no cross-session cache or reset logic. It should still guard against setState after unmount.
3. **apiFetch type and error behaviour** (`src/lib/api/fetch.ts`): `apiFetch(input, init) → Promise<Response>`, `input` must start with `/api/`.
   - It adds the bearer token and sets `cache: "no-store"` itself.
   - On a 401, or a 403 other than `org_required`, it re-mints the token and retries once. After the retry, a 403 **throws** `ApiAccessError(forbidden | member_deactivated)` instead of returning a Response. A 401 calls `onAuthLost` (AuthGate goes to sign-in) and throws. `org_required` also throws. `signed_out` also throws.
   - 5xx and network errors are returned or thrown untouched.
   - So `createRoomsApi` must map `ApiAccessError` as well as `{error:{code}}` bodies. A Response parse alone is not enough. Treat a thrown `ApiAccessError` as an error code (`forbidden`, `member_deactivated`). Network `TypeError` becomes `unavailable`.
   - The fetcher type should be `ApiFetch` from `@/lib/api/fetch` (a `lib` type, so the `ui` → `lib` import is fine under R1).
4. **Copy convention (SIM-022).** Copy lives in `src/ui/copy/<feature>.ts` and is imported as `../copy/rooms` or `@/ui/copy/rooms`.
   - `no-literals.test.ts` scans all `.tsx` files under `src/ui` and `src/app` (not tests, not `src/app/api`). It flags JSX text and literal `aria-label|title|placeholder|alt|label|subtitle|submitLabel|cancelLabel|emptyText|description` props. `// copy-ok: <reason>` on the same line exempts a line.
   - `copy.test.ts` already auto-collects every `src/ui/copy/*.ts` via `import.meta.glob` and checks NFC, non-empty, no `??`. The plan's step "Add `roomsCopy` to copy.test.ts" is therefore **not needed**; drop it. `roomsCopy` must still not hold empty strings. Function-valued entries are skipped by `strings()`, which only descends strings and objects, so they are not checked.
   - Copy files must have no Vietnamese diacritics.
   - `apiCopy.errors` and `apiErrorMessage(code)` (`src/ui/copy/api.ts`) already exist and already include `room_code_taken` ("This room code is already used.") and `room_not_empty`, because Slice A added them to `API_ERROR_CODES`. `roomsCopy.errors` should **reuse** `apiErrorMessage`, not duplicate it. Only room-specific text (field validation messages, rename warning, delete impact) goes in `roomsCopy`.
   - `kitCopy.cancel` and `kitCopy.saving` are already the `EntityFormDialog` defaults. Do not redefine them.
   - Existing `shellCopy.pages.rooms.title` and `.empty` are used by the current page. Reuse the title; `roomsCopy` may own its own empty-state text.
5. **No jsdom.** Tests use `renderToStaticMarkup` in the node environment (`views.test.tsx` imports it as `html`). This matches the plan's `RoomsView.test.tsx` approach. Dialogs are not rendered in tests: `EntityFormDialog` calls `showModal` in an effect and returns `null` when closed. So the form and delete logic must be extracted as pure functions to be testable without jsdom:
   - the form state to validator mapping,
   - the `field` to copy-message mapping,
   - the error code to message mapping,
   - a rename-warning predicate,
   - the delete-flow reducer, or at least a pure `nextDeleteStep(impact)`.
   Put them in `src/lib/rooms/*` or `src/ui/rooms/*.ts` and unit-test them. `rooms-api.test.ts` should use a fake fetcher that also throws `ApiAccessError`.
6. **Dialog kit** (`src/ui/EntityFormDialog.tsx`) takes props `open`, `title`, `subtitle`, `submitLabel`, `submitting`, `error` (a string rendered in `role=alert`), `onClose`, `onSubmit` and children. `DialogField` takes `label`, `icon` (an `IconName` from `@/lib/icons`) and the input props. Check that an icon such as `grid_view` or `meeting_room` exists in `@/lib/icons`.
   - The `DeleteRoomDialog` confirmation can reuse `EntityFormDialog` with the impact list as children and a destructive submit label. The kit has no confirm dialog and no destructive button style. Use `EntityFormDialog` with `submitLabel` from copy. Avoid inventing a new kit component (kit changes are outside the Slice B file list).
   - The dialog's `error` prop takes one string, so inline field errors need `aria-invalid` and a visible per-field message, which `DialogField` does not provide. The simplest option is to put the field message into the dialog-level `error`, which is already `role=alert`.
7. **D47/D52.**
   - D47: no map, canvas or sprites; no seat list or seat add/delete (SIM-012); no room switcher; cards link nowhere (the detail route is SIM-012's). SIM-015.1 is blocked.
   - D52: room browser is an end-user "pixel" surface, but pixel decisions (D41-D46) are not on main. Room/seat *tables* and management are the clean UI kit.
   - So use the clean kit now: Card, Button, tokens, no pixel fonts or art. The occupancy ring is a plain SVG. Keep `RoomCard` presentation-only (props: `name`, `code`, `occupied`, `total`) so a later pixel-art restyle touches only `RoomCard` and `OccupancyRing`.
   - Management actions (New/Edit/Delete) stay in the clean kit.
8. **Tier check.** `atLeastTier` lives in `src/lib/tier.ts`. The page has no `rooms/[roomCode]` conflict: the existing route files `rooms/[roomCode]/page.tsx` and `edit/page.tsx` are untouched.
9. **Page file.** `src/app/(app)/rooms/page.tsx` is currently a server component that renders `PageSkeleton`. Per R1 pages import only `@/ui` and `@/lib`. Render `<RoomsPage />` from `@/ui` and **add it to `src/ui/index.ts`** (the plan lists `index.ts` as Slice B-only). The page stays a server component and needs no `"use client"` itself.

## Recommendations
- **AC4 UI half.** `RoomsPage` computes `canManage = atLeastTier(session.tier, "admin")`, hides actions (not disabled), and passes `canManage` to the pure `RoomsView`. The test "user/manager see no New room, Edit or Delete buttons; admin sees them" asserts that the Edit/Delete/New labels (taken from `roomsCopy`) are absent from the markup. A server 403 can still arrive if the session tier is stale. Handle a thrown `forbidden` in a mutation by closing the dialog, showing `apiErrorMessage("forbidden")`, and calling `useShellActions().refreshPermissions?.()`.
- **`useRooms(api)`.** Statuses `loading|error|ready`. `reload` is stable. Ignore a stale response after unmount or on a newer reload (a request counter). `api` is created once with `useMemo(() => createRoomsApi(useApiFetch()), [apiFetch])`.
- **Q22 uppercasing.** `onChange` → `toUpperCase()`. Also set `autoCapitalize="characters"` and `spellCheck={false}` on the code input. Uppercase only the typed value, then re-validate through `validateRoomCreate/Patch` (which normalises again, so the server stays the authority). Move the cursor-safe behaviour into a controlled input: plain `toUpperCase()` on a controlled input in React is fine for ASCII, because the code regex excludes `ß`-like characters anyway.
- **Delete flow.** Add a pure step function `deleteStep(impact)` → `"plain"|"forced"`. On a 409 `room_not_empty`, reload the impact and stay in the dialog. `reload()` runs after every mutation, including a 404 (the room was deleted elsewhere).
- **Copy.** Components import `../copy/rooms`; keep `aria-label` values on the SVG ring coming from `roomsCopy.occupancyLabel(n, total)`. In JSX do not write text between tags (including `&nbsp;` or a literal "%"). Render `{roomsCopy.percent(p)}`.
- **Tests (R5).** `occupancy.test.ts`, `rooms-api.test.ts` (list/create/update/impact/remove(force), body-code parsing, `ApiAccessError` mapping, network error), `RoomsView.test.tsx` (loading with `aria-busy`, empty, error with `role=alert` and Retry, ready grid, admin-only buttons) and pure form/delete helper tests. Add the new tsx files under `src/ui/rooms/` and make sure `no-literals` and `pnpm check:layers` pass (UI imports only `@/lib/*` and `@/ui/*`, never `@/server`).
- **Update the plan notes** in the ticket Handoff: replace "SIM-006's `src/ui/api/`" with `useApiFetch`; the "Depends on" line already lists SIM-006.2 (the plan says SIM-006).

## Risks
- A thrown `ApiAccessError` that `createRoomsApi` does not catch would leave `useRooms` on "loading" forever. Make sure every catch path sets `status:"error"`.
- Plain `toUpperCase()` plus a controlled input moves the caret to the end when editing mid-string. Minor; acceptable for codes of up to 32 characters.
- The `no-literals` regex is heuristic: a `label=` or `title=` prop with a literal string in any tsx fails the test. Dynamic strings built in code are not detected, so reviewers must check those by eye.
- `EntityFormDialog` mounts the `<dialog>` only when `open`, and focus returns to the previously focused element on close. If the opener button is removed from the DOM (the list reloads and the card is re-keyed), focus is lost. Use stable `key={room.id}` on cards so the Edit button survives `reload()`.
- A 403 from a stale tier triggers a token re-mint and retry (an extra round trip) before the error surfaces.
- The plan's size estimate (~700 lines) is still plausible, but the extracted pure helpers add several small files; keep them in `src/ui/rooms/`.

## Open questions
- Is a `grid_view` or similar icon available for the dialog fields? Confirm in `@/lib/icons`. If not, a kit-level icon change is outside the slice and needs to be listed as a follow-up.
- Should the stale-tier 403 trigger `refreshPermissions` (small extra scope) or only show the error message? I recommend only the message plus a Retry, to stay inside R4.
- Should `RoomsPage` export from `@/ui/index.ts` (touches a shared file, low risk) or should the page import `@/ui/rooms/RoomsPage` directly? Both are legal under R1; the existing pattern is the barrel.

Files: work/tickets/SIM-010.2/ticket.md, work/tickets/SIM-010/plan.md, src/ui/auth/api-fetch-context.tsx, src/lib/api/fetch.ts, src/ui/copy/api.ts, src/ui/copy/copy.test.ts, src/ui/copy/no-literals.test.ts, src/ui/EntityFormDialog.tsx, src/ui/index.ts, src/app/(app)/rooms/page.tsx, src/app/(app)/layout.tsx
