**UX/architecture consult for SIM-066 (read-only; I read the ticket, mockup, ProfileTab, ProfileTabView, PixelLookSection, PixelLookPicker (top), PortalTabs, PortalPage, session)**

## Findings
- Tab bar: `PortalTabs.tsx` already has the ARIA roles, roving tabIndex, `nextTabIndex` arrows and `?tab=` handling (via PortalPage). Only the visuals change. It renders no badge counts. `PortalTabs` and `PortalPage` have no badge code, so the "My Portal badge counts" are probably in the nav shell. I did not search the shell. They are untouched by this ticket; just make sure the tab restyle does not remove anything the existing tests assert.
- Profile today: `ProfileTab` owns the `/api/me` load and the name PATCH. `ProfileTabView` is a pure form with its own Save. `PixelLookSection` owns a separate state machine (`pixel-look-state`: draft, canSave, canReset, `afterSave`, `afterReset`) and API (`/api/me/pixel-look`) with its own Save and Reset buttons. `ProfilePhoto` saves on upload.
- Session already has `email`, `tier` and optional `orgName`. No new API is needed for the membership card.
- Reset today calls the API (`api.reset()`). The mockup places "Reset character" inside the card, while "Save changes" and "Cancel" sit in the footer. This is the main design tension.
- The picker already uses radio inputs with `sr-only` and a `has-[:checked]` ring. This is a good a11y base. Keep radios and add a check mark overlay for the selected state (do not rely on colour or ring alone).
- Mockup differences to note: a "Live preview" chip and a sparkle icon (decorative, `aria-hidden`); "A LITTLE YOU" stage caption; a small role badge; the subtitles "Small pixels. Big personality." and "Made of pixels. Uniquely yours.". Add all of these to `copy/portal.ts`.

## Recommendations
1. **Tab bar (POR-01):**
   - Keep the `PortalTabs` logic as is. Per tab, add a Material-style icon span (`aria-hidden`) plus a label.
   - Use an accent bottom border and `text-primary` for the selected tab. Keep `flex-1` off at desktop (content-width tabs, `gap`) and make the bar scroll or fit at 390 px.
   - Add a "You" chip on Profile only. Put it inside the button and include it in the accessible name only if wanted; a safe option is `aria-hidden` plus a visually hidden nothing, so the name stays "Profile" and existing tests that match the name still pass.
   - Selected text must keep AA contrast in light and dark. Check the accent against the surface in both themes.
   - The divider is the existing `border-b` on the tablist (make it full width).
2. **Page structure:** `ProfileTab` (container) → `ProfileTabView` (pure layout). The layout is a header, then `grid lg:grid-cols-2 gap-6` with a left stack (Personal information, Workspace membership) and the right character card (it stacks to one column below `lg`, which covers 390 px), then a footer bar. Split into small presentational components (`ProfileHeader`, `PersonalInfoCard`, `MembershipCard`, `PixelCharacterCard`, `ProfileFooterBar`) to keep each file small and testable.
3. **Single dirty/save model (open question 1):**
   - Lift the character draft state into the Profile container. The simplest option is to keep `pixel-look-state` and have `PixelLookSection` expose `{dirty, save, discard, busy}` through a small hook (`useProfileDraft`) or by lifting the reducer to `ProfileTab`.
   - Footer "Save changes" runs name validation first. If the name is invalid, show the field error and do not save anything.
   - If valid, save the name and the look. Run the two requests as `Promise.allSettled` and report partial failure precisely ("Name saved, character not saved"). Only the failed part stays dirty.
   - Cancel resets the name and the look draft to the last saved values. Nothing goes to browser storage.
   - Disable Save and Cancel when not dirty. Show the status as a polite live region (`role="status"`): "All changes saved", "Unsaved changes", "Saving…", or an error as `role="alert"`.
   - Add `beforeunload` or a tab-switch warning only if cheap. Otherwise list it as a follow-up. Note that switching tabs unmounts the panel and drops the drafts silently; either accept and document this, or keep the drafts mounted. Flag it for Ming.
4. **Reset character:** make it a draft-only action that sets the draft to the derived look (`isDerived`) and marks it dirty. It persists on "Save changes", which then calls `api.reset()` (not `save`) when the draft equals derived. This matches the one-footer model and POR-06 ("returns to derived look"). If the current reducer applies Reset immediately through the API, change it with care and update `PixelLookPicker.test.tsx`.
5. **Photo:** unchanged (saves on upload). Add a short hint "Photo saves right away" so the footer's "All changes saved" is not misleading. Restyle `ProfilePhotoSection` only (avatar, Upload button, format hint copy from the existing limits, not hard-coded "256 KB").
6. **Name field:** keep `FilledInput`, `maxLength={DISPLAY_NAME_MAX}`, `validateProfileName`. Add the counter `n/80` from `DISPLAY_NAME_MAX` and put it in the `aria-describedby` chain. Do not announce it on every keystroke (no live region on the counter). Required marker: visual `*` is `aria-hidden`; the input keeps `required`.
7. **Email:** use a read-only input (`readOnly`, with `aria-describedby` pointing to "Managed by your organization") plus a lock icon (`aria-hidden`). Do not use `disabled`, so it stays focusable and copyable. The "Read only" chip is text, not colour only.
8. **Pixel character card:** the live preview is a front/back toggle (a two-radio group or `aria-pressed` buttons; use a radio group). Keep the stage as a dotted background (CSS radial-gradient with a token colour). The name tag shows the draft display name (live) with truncation. Hairstyle cards: radio cards with a small preview (reuse `LookPreview` or the atlas, scale 1; if the atlas fails, show text only). Swatches: min 32 px visible, 44 px hit area on touch, check mark for the selected one. Keep `aria-label` text for colour swatches ("Skin tone 2 of 5").
9. **Tokens:** use existing tokens (`primary`, `on-surface`, `outline-variant`, `surface-*`) and the portal UI kit (D52). Do not hard-code the mockup's hex values. Check the accent in dark theme. Footer: a sticky bottom bar is optional. If sticky, add safe padding so it does not cover content at 390 px. The simplest option is to keep it in flow at the end of the page.
10. **Layers (R1):** all of this stays under `src/ui/portal` and `src/ui/copy`. No server imports. Copy goes in `src/ui/copy/portal.ts` (D36). Delete or replace the now-unused strings (old per-section Save buttons, the `managed` text).
11. **Tests:** update `PortalTabs.test.tsx` (icons are `aria-hidden`, "You" chip, selected state, arrow keys, roles). Update `ProfileTabView.test.tsx` and add tests for layout regions (headings or landmarks by name), the counter, read-only email, the role badge, and dirty, save, cancel, partial-failure and reset states. Update `PixelLookPicker.test.tsx` for the removed Save button. No new API tests are needed.

## Defaults for the open questions
1. **Yes.** "Save changes" covers display name + character together. The photo keeps saving on upload, with an inline hint. Cancel reverts the name and the character only.
2. **Yes, change the copy.** Use "All changes saved · Saved to your account" (shorter: "All changes saved"). The unsaved state reads "Unsaved changes". Do not mention the browser, since nothing goes to browser storage (a criterion).
3. **Org name:** `useSession().orgName` (already in `Session`, optional). Fallback if undefined: hide the org name line and show only the generic "Your organization" label (avoid an empty or "undefined" row). Org initial = first letter of `orgName`. **Role badge:** show it for every tier, including User (POR-04 says role is shown read-only to everyone), using `shellCopy.tiers[tier]` as today. Describe the role with text, not just badge colour.

## Risks
- Reset semantic change (draft-only vs immediate API) touches the existing state machine and tests. Medium risk of regressions in `pixel-look-state`; keep reducer functions pure and add cases.
- Two requests on one Save can partially fail; a half-saved state must be visible and retryable. Do not re-send a succeeded part.
- Tab switch discards unsaved drafts (the panel unmounts). Decide: accept, warn, or keep state in the page.
- R7: not affected (no API change), but `apiFetch` retries once on 401/403; a repeated PATCH is idempotent here, so fine.
- The "You" chip and icons may break existing tab tests that match the accessible name; keep the chip `aria-hidden` or exclude it from the name.
- The "Only visible to your workspace" note must be true. Check POR-05/OQ-57 and the members list (the User tier sees all members of the org, so the org-wide claim is acceptable). Confirm the copy wording with Ming, since the photo or look is visible to org members and maybe to nobody else.
- Atlas load failure: the preview and hairstyle card previews need a graceful fallback (existing `atlasFailed` path).
- Dark theme and 390 px are manual checks only; the swatch ring plus check must be visible on both themes.

## Open questions (beyond the three)
- Sticky vs in-flow footer bar? (Default: in-flow.)
- Should leaving the tab with unsaved changes warn? (Default: no warning for now; list as a follow-up.)
- Is the mockup's "Live preview" chip and sparkle icon decorative only? (Default: yes, `aria-hidden`.)

Files reviewed: /home/user/simap/work/tickets/SIM-066/ticket.md, /home/user/simap/work/tickets/SIM-066/mockup-profile.png, /home/user/simap/src/ui/portal/{PortalTabs,PortalPage,ProfileTab,ProfileTabView,PixelLookSection,PixelLookPicker}.tsx, /home/user/simap/src/ui/session.tsx, /home/user/simap/src/lib/session.ts.
