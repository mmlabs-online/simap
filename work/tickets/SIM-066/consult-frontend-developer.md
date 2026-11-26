## SIM-066 consult (frontend), read-only

### Findings
- **PortalTabs.tsx** is a flex row of `role=tab` buttons, with `nextTabIndex` and a roving tabIndex. Tab labels come from `portalCopy.tabs[tab]`. The selected tab gets `border-primary text-on-surface`; there is no icon and no chip. It only needs a restyle, and the behaviour should stay as it is.
- **Badge counts are not in the tab bar.** They are the nav badges in AppShell, set by `useSetRequestBadge` and `useSetHandoffBadge` from MySeatTab and MyDevicesTab. A tab-bar restyle cannot affect them, so the "keeps badge counts" criterion is satisfied as long as those hooks are left alone.
- **Icons:** `src/lib/icons.ts` `ICON_NAMES` is a Material Symbols subset, alphabetical, and an icon must be added there before use.
  - Already present: `chair`, `event_seat`, `person`, `mail`, `group`, `edit`.
  - Missing for the mockup: a laptop/devices icon (`devices`), `lock`, `upload`, `check`, `restart_alt`, `auto_awesome`.
  - The array must stay sorted. Check whether a test or the font href builder depends on the list.
- **Shared UI today:** `Card` (rounded, `bg-surface-low`, outline, shadow), `Chip` (static) and `FilterChips` (a radiogroup in a tonal track) in `Chip.tsx`, `RoleBadge` (tier badge, admin is solid), `FilledInput`, `Button` (variants incl. tonal), `Avatar`. `RoleBadge` already covers the Admin badge in "Workspace membership".
- **ProfileTab.tsx** loads `/api/me` for `name` and `memberId`. It passes `session.email` and `session.tier` to ProfileTabView, which owns the name state, validation (`validateProfileName`), `DISPLAY_NAME_MAX` and the PATCH through `profilePatchInit`. Photo and character are injected as `sections`.
- **Three separate save flows today:**
  - Name: a form submit through the `ProfileTab.save` PATCH.
  - Character: `PixelLookSection` owns the picker state (`pixel-look-state.ts`) and its own save/reset against `/api/me/pixel-look`. `PickerState` already has `saved` and `draft`, and `canSave` is effectively a dirty flag. Reset calls the API immediately, which sets `saved` to null (derived).
  - Photo: saved on upload, through the shared own-photo store.
- **Org name:** `Session` has an optional `orgName` (`src/lib/session.ts`), set in AuthGate from the org list and already shown in AppShellView. It can be used for Workspace membership with a fallback when undefined. The role comes from `session.tier` and `shellCopy.tiers`.
- **Pixel picker today:** four previews (front/back at 1x/2x) and plain swatch radios in `has-[:checked]:ring` labels with an `sr-only` input. `LookPreview` takes `view` and `scale`, which suits a Front/Back toggle with one large preview. Hairstyle uses the options `[1,2,3]` with `copy.styleName`. Hairstyle cards with a small preview need a `LookPreview` per style: pass `{...draft, style: n}` at scale 1, front view. This needs the atlas; if it is null, show text only.

### Recommendations
1. **Shared building blocks** (put in `src/ui/` or `src/ui/portal/`, with copy-free props, for SIM-067 and SIM-069 to reuse):
   - `TabBar` / `TabItem`: generic version of PortalTabs, with props `tabs: {id, label, icon, chip?}[]`, `active`, `onSelect`, `ariaLabel`, `idOf` and `panelIdOf`. It has a full-width `border-b border-outline-variant` and a selected tab with a `border-b-2 border-primary text-primary` underline (use `-mb-px` so it overlaps the divider). It keeps the roving tabindex and arrow keys, and renders the icon `aria-hidden`. PortalTabs becomes a thin wrapper with the existing exports, so the id contract in portal-state stays.
   - `PageHeader`: `{title, subtitle, aside?}`. Here the aside is the lock icon plus "Only visible to your workspace".
   - `SectionCard`: Card plus a header with `title`, `subtitle`, optional `icon` and `aside`, a divider under the header, a body slot and an optional footer slot (used for "Made of pixels… Reset character"). Use `<section aria-labelledby>`.
   - `Pill` (extend `Chip.tsx`): a small tonal pill with tones `accent` ("You"), `neutral` ("Read only") and `success` ("Live preview"). Keep `RoleBadge` for the role.
   - `StickyActionBar` / `FormFooter`: status on the left, actions on the right. SIM-067 and SIM-069 may not need it, so it is optional.
   - `ChoiceSwatch` / `OptionCard`: the selected state is a ring plus a check icon (not colour alone). This is extracted from the swatch radios in PixelLookPicker.
   Add all the new icons to `ICON_NAMES`, alphabetically.
2. **Tab bar:** the "You" chip is only on Profile. Add a `chip` field to the portal tab config in copy (`portalCopy.tabChips.profile`) rather than hardcoding it. It must be inside the tab button, so the accessible name becomes "Profile You". Check that this is acceptable, or set `aria-label` on the tab or hide the chip with `aria-hidden` and rely on the label. The existing PortalTabs test uses `toContain`, so it still passes. Add tests for the icon, the chip and the selected class. Arrow-key tests could use a small fake or `fireEvent` if the test setup has one; the current test is `renderToStaticMarkup` only.
3. **Single dirty/save controller** (the key structural change). Lift state up into ProfileTab, or a `useProfileDraft` hook, so the footer can cover name plus character:
   - Name: `draftName` against `savedName`.
   - Character: reuse `pixel-look-state` (`draft` vs `saved`, or derived).
   - `dirty = nameChanged || lookChanged`.
   - Save changes runs the name PATCH and the look PUT in sequence, or with `Promise.all` handling each outcome separately. Handle partial failure by keeping the failed part dirty and showing a specific error. Photo is excluded and still saves on upload.
   - Cancel resets `draftName` to the saved name and the look draft to `saved ?? derived`, and clears errors.
   - Reset character: set the draft to derived locally and make it part of the dirty state, so Cancel can undo it. This is a **behaviour change**, since Reset today calls the API at once. `api.reset()` would then be called on Save when the draft is derived and `saved !== null`. Alternatively keep the immediate reset (simpler, less risky) and say so in the PR. Recommend the deferred version, as the footer implies it.
   - The footer status shows "Unsaved changes" when dirty, "All changes saved" otherwise, "Saving…" while busy, and an error with `role=alert`. Use `role="status"` for the status text. Disable Save changes when not dirty or while busy. "Nothing is saved to browser storage" is already satisfied; do not add localStorage.
   - Add pure helper functions to `pixel-look-state.ts` and `portal-state.ts` (for example `lookDirty`, `afterLocalReset`) so the tests stay as unit tests, as now.
   - Wrap the page in a `<form>` with the Save changes button as the submit, so Enter in the name field saves. Keep `noValidate`.
   - `useOwnPhoto` and ProfilePhoto should not be affected.
4. **Component split:** ProfileTabView becomes the layout (header, two columns, footer). It takes `PersonalInfoCard`, `MembershipCard`, `CharacterCard` and `FooterBar` as small pure components. Move the name field into the personal card with a counter `{name.length}/{DISPLAY_NAME_MAX}` (`aria-describedby` points at the hint and counter; do not put `aria-live` on the counter, to avoid chatter). `PixelLookPicker` becomes presentational: a single large preview with a Front/Back toggle (use a radiogroup like `FilterChips`; the view state is local to the card), the name tag below the preview, the dotted stage (CSS radial-gradient), and the hairstyle cards. Remove the Save/Reset buttons and notice from the picker.
5. **Email field:** a read-only `<input readOnly>` with a mail icon and a lock icon. Use `readOnly`, not `disabled`, so it is focusable and copyable. Label it "Email address" with a "Read only" pill, and give the hint "Managed by your organization" an id used in `aria-describedby`.
6. **Membership card:** the org name comes from `session.orgName`, with the initial in a tile, falling back to a generic label if undefined. Show `RoleBadge tier={session.tier}` for all tiers (POR-04). Avoid the AuthGate hack of hardcoding the org name.
7. **Layout:** `grid grid-cols-1 lg:grid-cols-2 gap-6`. At 390 px the order is header, personal, membership, character, footer. The footer is sticky at the bottom on mobile (`sticky bottom-0 bg-surface` with a border) only if it does not clash with the AppShell bottom nav; check the shell. Drop `max-w-md`. Keep the PortalPage `h1` (a single h1), and make "Profile settings" an `h2`. Use semantic headings: `h2` for the page and `h3` for the card titles.
8. **A11y:**
   - Swatch groups stay as `fieldset`/`legend` with radio inputs, which keeps arrow-key navigation within a group and the existing aria-labels (`copy.option`). Add a visible check mark plus the ring for the selected state (not colour alone).
   - Keep `focus-visible` outlines and 44px targets on mobile (swatches are about 28 px now, which is small; use `min-h-11` hit areas or 36 px swatches at least).
   - Check contrast of the accent text on both themes with theme tokens (`text-primary`), not hardcoded hex. The mockup's orange on a pale pill needs a check against `on-primary-container`-type tokens.
9. **Copy** goes in `src/ui/copy/portal.ts` (D36), and the `no-literals.test.ts` guard may fail on any literal JSX text, so keep all strings in copy. New keys: page title/subtitle/note, card titles and subtitles, the counter format, the pills ("You", "Read only", "Live preview"), "A little you", Front/Back, "Reset character", "Made of pixels. Uniquely yours.", the footer statuses and the Cancel/Save labels. Use "Saved to your account" in place of the mockup's "Stored on this browser" (open question 2).
10. **Tests:** update `ProfileTabView.test.tsx`, `PixelLookPicker.test.tsx` and `PortalTabs.test.tsx`, since the buttons they look for will move or change. Add tests for the dirty/cancel/save state (pure functions), the layout regions (headings, cards, footer) and the counter. Run `pnpm typecheck`, `pnpm check:layers`, `pnpm format:check` and `pnpm test`.

### Risks
- Deferring Reset changes POR-06 behaviour (today it is immediate). If Reset stays immediate, Cancel will not undo it; tell Ming either way.
- Partial-save failure (name OK, look failed) must not leave the UI claiming "All changes saved". R7 is not at issue, since the calls are separate requests, but `apiFetch` re-sends once on 401/403; both calls are idempotent PATCH/PUT, so repeats are safe.
- The "You" chip changes the tab's accessible name (see recommendation 2).
- Hairstyle previews need the atlas; with `atlasFailed` or a null atlas, fall back to text cards.
- `ICON_NAMES` must stay alphabetical and the Google Fonts subset must include the new names; there may be a font URL test in `kit.test.tsx`.
- A mobile sticky footer may overlap the bottom nav.
- Scope creep: build the shared blocks (TabBar, PageHeader, SectionCard, Pill) only as far as SIM-066 needs, but with generic props so SIM-067 and SIM-069 can reuse them without a second refactor (R4).

### Open questions
1. Q1 default: yes, Save changes covers name plus character; photo saves on upload (as now).
2. Q2 default: "Saved to your account".
3. Q3 default: org name from `session.orgName` (fallback needed when absent) and the role badge shown to all tiers.
4. Reset character: deferred (undoable with Cancel) or immediate (as now)? Recommend deferred.
5. Does "You" mean anything beyond decoration (for example "this tab is about you")? If it is purely decorative, hide it from assistive tech.
6. Is the sticky footer wanted on mobile, and does the shell have a bottom nav at 390 px?

Key files: /home/user/simap/src/ui/portal/PortalTabs.tsx, ProfileTab.tsx, ProfileTabView.tsx, ProfilePhotoSection.tsx, PixelLookSection.tsx, PixelLookPicker.tsx, pixel-look-state.ts, /home/user/simap/src/ui/Card.tsx, /home/user/simap/src/ui/Chip.tsx, /home/user/simap/src/ui/RoleBadge.tsx, /home/user/simap/src/lib/icons.ts, /home/user/simap/src/lib/session.ts.
