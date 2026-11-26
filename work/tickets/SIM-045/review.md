# Review — SIM-045

## Attempt 1 — 2026-11-26
Verdict: REWORK

Reviewed commit a6dc761 (`git show a6dc761`), slice A only (AC2 moved to SIM-045.1). The plan's "Questions for Ming" defaults apply.

### Checks (run by reviewer)
- `pnpm format:check`: "All matched files use the correct format." (893 files), exit 0
- `pnpm typecheck && pnpm check:layers`: exit 0, "check-layers: 838 files, no violations"
- `pnpm test`: "Test Files 319 passed | 1 skipped (320)", "Tests 3203 passed | 7 skipped (3210)", exit 0. Matches impl-log.
- `pnpm build`: exit 0, `ƒ /portal` is in the route list
- `pnpm test:db`: not run (CI only; no DB or server code changed)
- Render smoke (reviewer, read-only, scratch files outside the repo):
  - `next dev` with no dev token: at 390 px, `/portal`, `/portal?tab=profile` and `/devices` all show the AuthGate sign-in screen with no page error and scrollWidth 390. The portal itself cannot be seen without an Identity login.
  - So I SSR-rendered `PortalTabs` + `MyDevicesView` (3 rows with Vietnamese names, one Overdue, Load more, a notice) + `ProfileTabView` with the built `.next` CSS and loaded them in Chrome at 390x844. Result: no element wider than the viewport (scrollWidth 390), tabs 44 px tall and of equal width, and the long email wraps.
  - Not covered by the smoke: keyboard, routing and live data.

### Acceptance criteria
- [x] AC1 (slice A): My Portal in nav for every tier; horizontal, keyboard-operable tabs, addressable by `?tab=`; 390 px. Evidence:
  - `nav.test.ts › every tier has portal; isActive on /portal`
  - `portal-state.test.ts › parsePortalTab`, `› portalTabHref`, `› nextTabIndex`
  - `PortalTabs.test.tsx` (roving tabIndex, aria-selected, aria-controls)
  - Key wiring at `PortalTabs.tsx` (onKeyDown → `nextTabIndex` → `onSelect` + focus); URL via `router.replace(portalTabHref(...))` in `PortalPage.tsx`; Suspense around `useSearchParams` (build green)
  - 390 px: the render smoke above
  - The live keyboard and reload check could not be run (no Identity login).
- [ ] AC2: moved to SIM-045.1 (not verified here, by plan).
- [ ] AC3: My devices with placement, expiry, Overdue, rule-based actions, "Waiting for my confirmation" with Confirm/Decline, overdue banner. FAILED, see Issue 1: the Confirm/Decline result can be hidden behind an older row-action notice. The rest has evidence:
  - `portal-state.test.ts › portalHandlers …` (no edit/delete/takeBack/assign/editHolding; a pending transfer offers only cancel; overdue offers extend + give back)
  - `MyDevicesView.test.tsx`
  - `devices-api.test.ts › listMine`
- [x] AC4: Profile edits the display name with the existing validation; email and role read-only. Evidence: `ProfileTabView.tsx` uses `validateProfileName` / `DISPLAY_NAME_MAX`; `ProfileTab.tsx` uses `profilePatchInit` + `mapPatchResult` (`src/ui/org/profile-form.ts`); `ProfileTabView.test.tsx`; `portal-state.test.ts › profileOutcome`.
- [x] AC5: only the caller's own data; a deactivated member gets the same refusal. Evidence (code review):
  - The portal calls only `/api/devices/mine`, `/api/handoffs?box=incoming`, `/api/handoffs/count`, `/api/me` and the existing device action routes, and reads no id from the URL.
  - `/portal` sits under `src/app/(app)/layout.tsx` (AuthGate).
- [x] AC6: Devices nav hidden for Users, `/devices` redirects Users client-side before any data hook, `/devices/[id]` untouched. Evidence:
  - `nav.ts` sets `minTier: "manager"`; `nav.test.ts`
  - `portal-state.test.ts › devicesPageRedirect`
  - `DevicesPage.tsx`: the wrapper returns `null` before `DevicesPageContent` mounts, so no `/api/devices?placement=` request is made
  - `AppShellView.test.tsx › … a User has no Devices entry`
- [x] AC7: unit tests for the tab state / URL parsing, action rules and badge count. Evidence: `portal-state.test.ts` (`portalBadgeTotal`, `portalBreakdown`), `AppShellView.test.tsx › portal badge`.

### Issues
#### Issue 1 — 🔴 blocker — correctness (wrong or hidden feedback in My devices)
- **Where**: `src/ui/portal/MyDevicesTab.tsx:112` (`notice={notice ?? incomingNotice}`), with `incomingNotice` at l.55.
- **Expected**: The notice region always shows the result of the user's latest action. A Confirm or Decline right after a row action shows its own success or error text (`confirmOutcome` / `declineOutcome`).
- **Actual**: The host's `notice` (from `useDeviceDetailActions`) wins whenever it is non-null, and it stays set after a dialog action until the next dialog opens. Example: Transfer device A ("Transfer … sent"), then Confirm an incoming transfer. The page still shows "Transfer … sent". A failed Confirm (e.g. a conflict error notice) is never shown, so the user gets no feedback that the action failed. The reverse also happens: opening a dialog clears the host notice, and an old incoming notice comes back. The impl-log lists this under Follow-ups. It is a defect in AC3's Confirm/Decline flow, not a follow-up.
- **Fix instruction**:
  - In `MyDevicesTab.tsx`, keep one shown notice: `const [shown, setShown] = useState<Notice | null>(null)`.
  - Add `useEffect(() => setShown(notice), [notice])`. The host creates a new object per action, so the effect fires on every new host notice and on its clear.
  - In `act`, call `setShown(null)` at the start and `setShown(outcome.notice)` after the call, instead of using `incomingNotice`.
  - Pass `notice={shown}` and delete `incomingNotice`.
  - Pull the "latest source wins" choice into a small pure helper if you want to unit-test it. At least record the manual sequence above in impl-log.
  - Do not change `useDeviceDetailActions`.

#### Issue 2 — 🟡 should-fix — correctness (failed refresh shows two errors and Retry drops rows)
- **Where**: `src/ui/portal/useMyDevices.ts:58`, `src/ui/portal/MyDevicesView.tsx:79` and l.96, `MyDevicesTab.tsx:114`.
- **Expected**: The hook's own doc says "a failed refresh keeps the rows". A refresh that fails after an action should show one error (the host already shows `devicesCopy.detail.refreshFailed` through `finishAction`) and keep the table usable.
- **Actual**: `refresh` sets `status: "error"`. The view then shows the error card with Retry above the table, plus the host's "refresh failed" notice, which is two error messages. Retry calls `reload()`, which resets to the skeleton.
- **Fix instruction**:
  - On a failed `refresh`, keep `status: "ready"` and only return `{ ok: false, code }`. The host's notice already reports it.
  - Alternatively, leave status alone and render the error card only when `devices.length === 0`.
  - Add a `MyDevicesView` test: `status="error"` with rows renders the table.

### Rules (CLAUDE.md)
No violations found:
- R1: `check:layers` is clean; `src/ui/portal/**` imports ui and `@/lib` only; the page imports `@/ui`.
- D36: copy is in `src/ui/copy/portal.ts` / `shell.ts`.
- R2, R3, R6, R7: not touched (no server, API, migration or env changes).
- R4: every changed file is in the plan's file list; no High path changed.

### Blockers from review agents
None (no review trigger path changed).

### Nits (do not block)
- `ProfileTabView.test.tsx`: the plan listed a test for the "required" error. Only the `invalid` prop path is tested. The local `required` path needs a submit, so it cannot be tested in SSR. Consider a pure test of `validateProfileName("   ")` here or point to the existing test.
- `portal-state.test.ts › profileOutcome`: `access` checks only the tone. Assert `apiErrorMessage("forbidden")` as the text.
- `MyDevicesView.test.tsx`: the "in my inventory" placement is not asserted (impl-log notes it).
- `ProfileTab.tsx`: after a save, the input keeps the raw typed value, not the normalized one that was saved. This is harmless.
- `useMyDevices.ts:40`, `reload` error: `{ ...INITIAL, status: "error" }` also clears rows. That is fine for the first load.

### Follow-ups (out of scope)
- Ming / local run with an Identity login:
  - User and Manager at 390 px and desktop: Left/Right/Home/End on the tabs, reload keeps `?tab=profile`.
  - Each owner action from My devices, and Confirm/Decline updating the badge at once.
  - `/devices` as a User shows no `GET /api/devices?placement=` in the Network tab.
  - Deactivated member on `/portal`.
- "Waiting for my confirmation" is only an `aria-label` and is not visible. `IncomingTransfers` keeps its own "N incoming transfers" heading. Decide in SIM-045.1 whether a visible heading is wanted.
