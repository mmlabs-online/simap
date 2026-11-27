## Slice 6a — Attempt 1

## Security review: SIM-071 slice 6a (commit 99fbcef, read from the working tree)

**Verdict: no blockers and no should-fix items.** I found no change outside styling to auth or check-in behaviour. I couldn't run git, so I checked the current files against the plan's 6a Files table (`/home/user/simap/work/tickets/SIM-071/plan.md` lines 1995–2031) and the impl-log entry (`/home/user/simap/work/tickets/SIM-071/impl-log.md` lines 289–324), not against an actual diff.

### Findings

**🔴 Blocker:** none.

**🟡 Should-fix:** none.

**💭 Notes**

1. **The DevGate production-data warning is still shown, but it is less prominent.** `/home/user/simap/src/ui/auth/DevGate.tsx`:
   - The guard is unchanged (lines 46–47): `process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_SIMAP_DEV_PROD === "1"`. It only picks the badge and grants no access.
   - `withNotice` still wraps every screen outside the shell (lines 66–74, used at 197–213).
   - The notice keeps `role="alert"`, its `title` tooltip, `fixed inset-x-0 top-0 z-50` and the label plus tooltip text (lines 54–63).
   - Only the colours changed: solid red became `bg-danger-tint border-danger text-danger`, as the plan specifies (line 2006, Q-S6-10).
   - `--color-danger-tint` mixes danger with surface (`/home/user/simap/src/styles/tokens.css:41,142`), so the bar stays opaque over the header.
   - It is now a pale tint, not a solid red bar. That is a planned design choice, but Ming should confirm in the browser under `pnpm dev:prod` that it still reads as a warning.
   - `/home/user/simap/src/ui/auth/DevGate.test.tsx:77-82` still asserts the label is present when the flag is on and absent when it is off.
2. **The Turnstile slot still renders and keeps its size.**
   - Sign-in (`/home/user/simap/src/ui/auth/views.tsx:69-70,140`): `showTurnstile` is unchanged. It is shown when `turnstileRequired` is set or the error code is `turnstile_required` / `turnstile_failed`.
   - Sign-up (`/home/user/simap/src/ui/auth/account-views.tsx:121`) and forgot password (`/home/user/simap/src/ui/auth/account-views.tsx:190`): the slot is always rendered.
   - `min-h-[65px]` became `min-h-16.25`, which is `calc(var(--spacing) * 16.25)`. The project doesn't override `--spacing`, so that is still 65 px (impl-log line 306, and there is no `--spacing:` override in `globals.css`).
   - `TurnstileWidget` was not touched (`size: "flexible"`, line 41).
3. **Possible clipping of Turnstile on narrow phones (not new in 6a).**
   - `.aw-frame` has `overflow: hidden` (`/home/user/simap/src/app/globals.css:512`). This came from SIM-068 (`/home/user/simap/work/tickets/SIM-068/plan.md:134`), not from this slice.
   - Turnstile's flexible size has a minimum width of 300 px. At viewports under about 382 px (the `px-5` gutters, `p-5` card padding and 1 px borders take about 82 px), the widget could be cut off on the right.
   - This is an availability issue, not a security bypass. If it is real, it belongs in a follow-up, not in 6a. Ming can check it at 375 px during the planned verification.
4. **No change to handlers, token handling or disabled controls.**
   - Every `onSubmit` / `onClick` / `disabled={submitting|busy}` in `views.tsx`, `account-views.tsx`, `accept-views.tsx` and `DevGate.tsx` is the same pattern as before.
   - DevGate's `apiFetch` / `onAuthLost` / `saveProfile` are untouched (`/home/user/simap/src/ui/auth/DevGate.tsx:102-184`).
   - Check-in is the same:
     - `/home/user/simap/src/ui/checkin/CheckinPopup.tsx:63-66,105,172-178`: dialog `onCancel` goes to `onJustLook`, focus return is at 41–53, check-in is disabled on `busy || selected === null`.
     - `/home/user/simap/src/ui/checkin/CheckinButton.tsx:29`.
     - `/home/user/simap/src/ui/checkin/WhosHere.tsx:59-61`: `disabled={!row.focusable}` is unchanged; only the `opacity` dimming was replaced by `disabled:cursor-not-allowed`.
   - The new `display: none` rules in `globals.css:563-567` hide only the decorative `aria-hidden` world parts (`SmallWorld.tsx:101,126,131,136`). `.aw-world-side` and `.aw-world-path` have `pointer-events: none` (`globals.css:702,718`). No form control or link is hidden or covered.
   - `.aw-card [data-variant="filled"]` (`globals.css:538-548`) changes only colour and shadow.
5. **No secrets or env values reach the client.**
   - In `src/ui`, `process.env` is read only for the existing public flags: `NEXT_PUBLIC_SIMAP_DEV_TOKEN`, `NEXT_PUBLIC_SIMAP_DEV_PROD`, `NEXT_PUBLIC_MM_IDENTITY_BASE`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (a public site key) and `NEXT_PUBLIC_SIMAP_VERSION`.
   - None of these were added in 6a.
   - The check-in files have no `process.env`, `localStorage`/`sessionStorage` or raw `fetch` (`CheckinPage.tsx` uses `useApiFetch()` as before).
   - `globals.css` adds no `url(...)`, `@import` or remote resource.
6. **Something to confirm with git.** The only file outside the plan, according to the impl-log, is `DevGate.test.tsx` (the assertion `bg-red-600` → `bg-danger-tint`). The orchestrator should confirm with `git diff --stat main...claude/modest-allen-yru4g8` that nothing else in `src/ui/auth` or `src/lib` changed, especially `tokenStore.ts`, `runtime.ts`, `identityClient.ts`, `AuthGate.tsx` and `TurnstileWidget.tsx`. Plan acceptance items S6a-10 and S6a-11 cover this.

### Follow-ups (out of scope)
- Check whether Turnstile is clipped inside `.aw-frame` at viewports of 375 px and below. If so, let the frame overflow or reduce the card padding on small screens (point 3).
