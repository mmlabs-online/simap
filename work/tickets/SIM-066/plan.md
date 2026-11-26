Status: READY

# Plan — SIM-066: Redesign My Portal → Profile layout and the portal tab bar

This plan covers **slice 1**. The visual redesign of the pixel character card (the stage, the Front/Back toggle, the
hairstyle preview cards and the swatch check marks) is proposed as slice 2 (SIM-066.1); see `## Split proposal`.

## Scope summary
- `docs/spec-v1.md` POR-01: "The three tabs are horizontal, keyboard-operable and addressable by URL (e.g.
  `?tab=seat|devices|profile`); the default tab is My seat. Works at 390 px." and "The My Portal nav badge counts…"
  (the badge is in `AppShellView`, not in the tab bar; it is not touched).
- POR-04: "The member edits their own display name (existing own-display-name API, D17; same validation)." and "Email
  and simap role are shown read-only with 'managed in mmlabs' (AUT-04)."
- POR-05: "The member uploads a real image as their profile photo, replaces it or removes it." (The flow is unchanged
  and the photo still saves on upload.)
- POR-06: "The member customises the 32 px layered avatar … from preset choices per layer: skin, hair colour, hair
  style, shirt colour … No free colour input and no upload." and "A live preview shows the character front and back
  at 1× and 2× before saving. 'Reset' goes back to the look derived from the member id." and "A member without a
  stored look keeps the derived look".
- D36: "all user-facing text lives in copy files". D52: clean UI kit for the portal. D71: the photo and the pixel
  character are separate things.
- Ticket: tab bar with icon and label tabs, an accent underline, a "You" chip on Profile and a full-width divider. A
  "Profile settings" header. Left column: Personal information and Workspace membership. Right column: Your pixel
  character. A footer with the save status, Cancel and "Save changes". One column at 390 px. Copy in
  `src/ui/copy/portal.ts`. Out of scope: any API, schema or validation change, new avatar parts or colours, and the
  contents of the My seat and My devices tabs.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | The tab bar has icons, an accent underline and a "You" chip on Profile, and keeps the tab roles, arrow keys, `?tab=` URLs and badge counts. | `src/ui/portal/PortalTabs.test.tsx` (existing assertions unchanged plus icon/chip/selected-class cases). `src/ui/layout-blocks.test.tsx › TabBar`. `src/ui/portal/portal-state.test.ts` (nextTabIndex, parsePortalTab, portalTabHref unchanged and still green). The diff does not touch `PortalPage.tsx`, `AppShell*` or the `useSet*Badge` hooks. |
| 2 | Header, Personal information and Workspace membership on the left, pixel character on the right; one column below `lg`. | `ProfileTabView.test.tsx › renders the header and the three cards in order inside a 1-col / lg:2-col grid` (asserts `grid-cols-1` and `lg:grid-cols-2`, DOM order personal → membership → character → footer). Visual check: see `## Ming verification after merge`. |
| 3 | Display name keeps today's validation and limit, with a live counter; email and role are read-only. | `profile-draft.test.ts › nameLength counts NFC code points` (Vietnamese NFD input). `ProfileTabView.test.tsx › counter, required marker, readOnly email, role badge for every tier`. `validateProfileName` and `DISPLAY_NAME_MAX` are unchanged in the diff. |
| 4 | Only the existing preset values, a live front/back preview, and Reset returns to the derived look. | `PixelLookPicker.test.tsx` (radio counts from the ramps, four previews, Reset character button). `pixel-look-state.test.ts › resetDraft → derived; lookSaveAction "reset" when a stored look exists`. |
| 5 | Cancel discards edits, "Save changes" saves through the existing APIs, the footer shows the save state, and nothing goes to browser storage. | `pixel-look-state.test.ts › discard / lookDirty / lookSaveAction`. `profile-draft.test.ts › footerStatus`. `ProfileTabView.test.tsx › footer disabled states and status roles`. `rg -n "localStorage\|sessionStorage" src/ui/portal` returns nothing new. Only `/api/me` PATCH and `/api/me/pixel-look` PUT/DELETE are called (`ProfileTab.tsx` diff). |
| 6 | Unit/render tests cover the tab bar, the layout regions and the save/cancel state. | The tests listed under `## Tests to write`. `pnpm test` is green. |
| — | Checks | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build` all pass. |

## Ming verification after merge
- The look at 1280 px and 390 px in the light and dark themes: the accent underline and text contrast, the "You"
  chip, the cards, the footer, and the tab bar not overflowing at 390 px.
- A real save round trip against Identity (`pnpm dev` with the dev token): edit the name and the character → Save
  changes → reload; Cancel; Reset character → Save changes → the room map shows the derived look.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/ui/tab-keys.ts` (new) | Move `nextTabIndex` here from `portal-state.ts` (lines 28-35), unchanged. | The generic `TabBar` must not import from a feature folder. | No |
| `src/ui/TabBar.tsx` (new) | Generic WAI-ARIA tab bar (shared block, props below). | Tab bar restyle; reused by later redesigns. | No |
| `src/ui/PageHeader.tsx` (new) | Shared page/section header (props below). | "Profile settings" header; reused by SIM-067 and SIM-069. | No |
| `src/ui/SectionCard.tsx` (new) | Shared titled card (props below). | The three Profile cards; reused by SIM-067 and SIM-069. | No |
| `src/ui/FormFooterBar.tsx` (new) | Shared status-plus-actions footer (props below). | Profile footer bar. | No |
| `src/ui/Chip.tsx` | Add `Pill` (props below); `Chip` and `FilterChips` unchanged. | "You", "Read only" and "Live preview" pills. | No |
| `src/ui/FilledInput.tsx` | Add an optional `trailingIcon?: IconName` (an `aria-hidden` icon after the input). | Lock icon on the read-only email field. | No |
| `src/ui/index.ts` | Export `TabBar`, `PageHeader`, `SectionCard`, `FormFooterBar` and `Pill`. | Kit barrel. | No |
| `src/lib/icons.ts` | Add `auto_awesome`, `check`, `desktop_windows`, `lock`, `restart_alt` and `upload`, in alphabetical order. | Mockup icons (`src/lib/icons.test.ts` enforces sorted, unique names). | No |
| `src/ui/layout-blocks.test.tsx` (new) | Render tests for the shared blocks. | R5. | No |
| `src/ui/portal/portal-state.ts` | Re-export `nextTabIndex` from `../tab-keys` (so `portal-state.test.ts` and its callers are unchanged); add `PORTAL_TAB_ICONS: Record<PortalTab, IconName>` = `{ seat: "chair", devices: "desktop_windows", profile: "person" }`. | Tab icons; the existing id contract stays. | No |
| `src/ui/portal/PortalTabs.tsx` | Becomes a thin wrapper over `TabBar` with the same exported name and props. | Tab bar restyle with no change for `PortalPage.tsx`. | No |
| `src/ui/portal/profile-draft.ts` (new) | Pure helpers: `nameLength`, `nameDirty` and `footerStatus` (below). | Pure logic first (planner rule 6). | No |
| `src/ui/portal/profile-draft.test.ts` (new) | Unit tests. | R5. | No |
| `src/ui/portal/pixel-look-state.ts` | Add `lookDirty`, `lookSaveAction`, `resetDraft` and `discard`; change `canReset`; remove `canSave`; success notices in `afterSave` and `afterReset` become `null`. | One footer save model; Reset becomes a draft action. | No |
| `src/ui/portal/pixel-look-state.test.ts` | Update for the changes above. | R5. | No |
| `src/ui/portal/usePixelLook.ts` (new) | Hook with the GET, PUT and DELETE logic now in `PixelLookSection.tsx` lines 21-53, exposing the state, `choose`, `resetDraft`, `discard` and `persist()`. | The footer must save the character together with the name. | No |
| `src/ui/portal/PixelLookSection.tsx` | **Delete** (its logic moves into `usePixelLook.ts`, its rendering into `ProfileTab`). | As above. | No |
| `src/ui/portal/ProfileTab.tsx` | Container owns the name draft, the look hook, `saveAll` and `cancel`; renders the new view inside a `<form>`. | One save and cancel for name plus character. | No |
| `src/ui/portal/ProfileTabView.tsx` | Pure layout: `PageHeader`, a grid with two columns, `FormFooterBar`. | Mockup layout. | No |
| `src/ui/portal/PersonalInfoCard.tsx` (new) | `SectionCard` with the photo slot, the display name field with a counter, and the read-only email. | Left column, card 1. | No |
| `src/ui/portal/MembershipCard.tsx` (new) | `SectionCard` with the org tile, name and "Your organization", plus `RoleBadge` and the managed note. | Left column, card 2. | No |
| `src/ui/portal/ProfilePhotoSection.tsx` | Restyle only: remove the visible "Photo" `h3`, upload label styled as an outlined button with an `upload` icon, avatar 72 px, hint unchanged plus "Photo changes save right away." Props unchanged. | Mockup; makes it clear the photo is outside the footer save. | No |
| `src/ui/portal/ProfilePhotoSection.test.tsx` | Adjust only if an assertion depends on the removed heading (today none does). | R5. | No |
| `src/ui/portal/PixelLookPicker.tsx` | Wrap in `SectionCard` ("Your pixel character", sparkle, "Live preview" pill); remove Save and the notice block; Reset becomes "Reset character" (icon `restart_alt`) in the card footer with "Made of pixels. Uniquely yours."; show the load-failure line only when `status === "failed"`; new props (below). The previews and swatch groups are otherwise unchanged in this slice. | Right column. | No |
| `src/ui/portal/PixelLookPicker.test.tsx` | Update for the removed Save, the renamed Reset and the new props. | R5. | No |
| `src/ui/portal/PortalTabs.test.tsx` | Add cases (below); existing assertions stay. | R5. | No |
| `src/ui/portal/ProfileTabView.test.tsx` | Rewrite for the new props and layout. | R5. | No |
| `src/ui/copy/portal.ts` | New keys, and removal of keys left unused (below). | D36; `src/ui/copy/no-literals.test.ts`. | No |

No file matches a High path.

### Shared building blocks (contract for SIM-067 and SIM-069)
All of these are copy-free: every string comes in through props. They are styled only with theme tokens (`primary`,
`on-surface`, `on-surface-variant`, `outline-variant`, `surface-*`), never with hex values from the mockup.

- **`TabBar`** (`src/ui/TabBar.tsx`)
  ```ts
  export type TabBarItem<T extends string> = { id: T; label: string; icon?: IconName; chip?: string };
  export function TabBar<T extends string>(p: {
    tabs: readonly TabBarItem<T>[];
    active: T;
    onSelect: (id: T) => void;
    ariaLabel: string;
    tabIdOf: (id: T) => string;
    panelIdOf: (id: T) => string;
  }): JSX.Element;
  ```
  - Markup: `role="tablist"` with a full-width `border-b border-outline-variant` and `overflow-x-auto`.
  - Each tab is a `button role="tab"` with `aria-selected`, `aria-controls`, a roving `tabIndex` and `nextTabIndex`
    on keydown, exactly the current `PortalTabs` lines 17-45.
  - Each tab has the classes `-mb-px border-b-2 min-h-11 px-3 whitespace-nowrap flex-1 sm:flex-none`.
  - Selected tab: `border-primary text-primary`. Others: `border-transparent text-on-surface-variant`.
  - The icon is rendered with `Icon` (decorative, `aria-hidden`).
  - `chip` renders as `<Pill tone="accent" decorative label={chip} />`, so the accessible name stays the label.
- **`PageHeader`** (`src/ui/PageHeader.tsx`)
  ```ts
  { title: string; subtitle?: string; aside?: ReactNode; level?: 2 | 3; id?: string }
  ```
  - Renders the title as `h2` by default; `PortalPage` keeps the single `h1`.
  - The subtitle is a `p text-sm text-on-surface-variant`.
  - The aside is right-aligned at `sm` and up and wraps below the title on mobile.
- **`SectionCard`** (`src/ui/SectionCard.tsx`)
  ```ts
  {
    headingId: string; title: string; subtitle?: string; icon?: IconName;
    titleAdornment?: ReactNode; aside?: ReactNode; footer?: ReactNode;
    divided?: boolean /* default true */; className?: string; children: ReactNode;
  }
  ```
  - Renders `<Card as="section" aria-labelledby={headingId}>` with an `h3` header.
  - When `divided` is true, a divider (`border-b border-outline-variant`) sits under the header.
  - The body is padded `p-5` (`p-4` below `sm`).
  - The optional `footer` sits after the body, with a `border-t`.
- **`Pill`** (in `src/ui/Chip.tsx`)
  ```ts
  { label: string; tone?: "accent" | "neutral" | "success"; icon?: IconName; decorative?: boolean }
  ```
  - A small rounded label (`text-[11px] font-bold px-2 py-0.5`).
  - Tones:
    - `accent`: `bg-primary-container text-on-primary-container`, or the closest existing tokens. The implementer
      checks which token names exist in the global CSS and records them in the impl-log.
    - `neutral`: `bg-surface-high text-on-surface-variant`.
    - `success`: a tertiary or success container token.
  - `decorative` sets `aria-hidden`.
- **`FormFooterBar`** (`src/ui/FormFooterBar.tsx`). This block is optional for SIM-067 and SIM-069.
  ```ts
  {
    status: FooterStatus; // type declared and exported in this file
    cancelLabel: string; saveLabel: string; busyLabel: string;
    canCancel: boolean; canSave: boolean; busy: boolean; onCancel: () => void;
  }
  export type FooterStatus = { tone: "saved" | "dirty" | "busy" | "error"; text: string; detail?: string };
  ```
  - Layout: `border-t border-outline-variant pt-4 flex flex-wrap items-center justify-between gap-3`, in flow, not
    sticky.
  - The status shows a `check` icon when `saved`. It is a `role="status"` paragraph, or `role="alert"` when `error`.
  - Cancel is a `Button variant="tonal" type="button"`.
  - Save is a `Button type="submit"` showing `busyLabel` while busy, with a `check` icon.

## Data model / migration
None.

## API contract
None. The existing calls are reused unchanged: `PATCH /api/me` (`profilePatchInit`), and `GET`, `PUT` and `DELETE
/api/me/pixel-look` (`createPixelLookApi`).

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/ui/layout-blocks.test.tsx › TabBar renders tablist, roving tabIndex, aria-controls, selected tab has border-primary text-primary` | Shared tab bar. |
| `src/ui/layout-blocks.test.tsx › TabBar icons and chip are aria-hidden; chip text is inside the selected tab button` | Icon and chip a11y. |
| `src/ui/layout-blocks.test.tsx › PageHeader renders h2 by default, h3 with level=3, subtitle and aside` | Header. |
| `src/ui/layout-blocks.test.tsx › SectionCard is a section labelled by its h3; subtitle, aside and footer slots render only when given` | Card. |
| `src/ui/layout-blocks.test.tsx › Pill tones map to classes; decorative sets aria-hidden` | Pill. |
| `src/ui/layout-blocks.test.tsx › FormFooterBar: status role=status, error role=alert; Save is submit and disabled when !canSave or busy; Cancel disabled when !canCancel or busy; busy label` | Footer. |
| `src/ui/portal/PortalTabs.test.tsx › each tab has its PORTAL_TAB_ICONS icon; only Profile shows portalCopy.tabChips.profile; selected tab has text-primary` | Criterion 1. |
| `src/ui/portal/profile-draft.test.ts › nameLength counts NFC code points ("Ánh" NFD → 3; "Nguyễn Thị Ánh" → 14; emoji → 1)` | Counter (domain focus: diacritics). |
| `src/ui/portal/profile-draft.test.ts › nameDirty: equal → false; any difference (including whitespace) → true` | Dirty flag. |
| `src/ui/portal/profile-draft.test.ts › footerStatus: busy → saving; errors → error with all texts; dirty → unsaved; clean → saved with detail "Saved to your account"; busy wins over errors` | Footer state (criterion 5). |
| `src/ui/portal/pixel-look-state.test.ts › lookDirty: false after load (stored or derived); true after choose; false after choosing back; true after resetDraft with a stored look; false after resetDraft with none stored` | Dirty flag. |
| `src/ui/portal/pixel-look-state.test.ts › lookSaveAction: null when clean; "save" for a changed draft; "reset" when a look is stored and draft equals derived` | Save routing. |
| `src/ui/portal/pixel-look-state.test.ts › resetDraft sets draft = derivedChoice(memberId) without touching saved; ignored while busy` | Deferred reset (POR-06). |
| `src/ui/portal/pixel-look-state.test.ts › discard sets draft = saved ?? derived and clears notice; ignored while busy` | Cancel. |
| `src/ui/portal/pixel-look-state.test.ts › canReset: false while loading or busy, false when draft equals derived, true otherwise` | Changed rule (replaces the old canReset test). |
| `src/ui/portal/pixel-look-state.test.ts › afterSave and afterReset success leave notice null; failures keep draft and set the error notice` | Updated existing tests. |
| `src/ui/portal/ProfileTabView.test.tsx › renders the header and the three cards in order inside a 1-col / lg:2-col grid` | Criterion 2. |
| `src/ui/portal/ProfileTabView.test.tsx › counter shows nameLength/DISPLAY_NAME_MAX and is in aria-describedby; required marker aria-hidden; input required and maxLength` | Criterion 3. |
| `src/ui/portal/ProfileTabView.test.tsx › email is a readOnly input (not disabled) described by the managed hint; Read only pill` | Criterion 3. |
| `src/ui/portal/ProfileTabView.test.tsx › role badge renders for user, manager and admin; org name and initial from orgName; fallback without orgName shows only "Your organization"` | Membership card and Q3. |
| `src/ui/portal/ProfileTabView.test.tsx › field error invalid/required → aria-invalid and error text; no autofocus` | Kept from today's tests. |
| `src/ui/portal/ProfileTabView.test.tsx › footer: clean → Save and Cancel disabled; dirty → enabled; busy → disabled with saving label; character slot null → no character card` | Criterion 5. |
| `src/ui/portal/PixelLookPicker.test.tsx` (updated) | Keeps the radio, fieldset, aria-label, preview and atlas cases. Save is gone. "Reset character" is disabled when `!canReset` or `locked`. The card is labelled by its heading. A load-failure line shows only when `status="failed"`. |

## Approach
1. **Icons and the kit.** Add the six icon names to `ICON_NAMES`, in alphabetical order. Create `tab-keys.ts`,
   `TabBar`, `PageHeader`, `SectionCard`, `FormFooterBar` and `Pill`, and add `trailingIcon` to `FilledInput`. Export
   them from `src/ui/index.ts` and write `layout-blocks.test.tsx`.
2. **Tab bar.**
   - `portal-state.ts`: re-export `nextTabIndex` and add `PORTAL_TAB_ICONS`.
   - `PortalTabs.tsx`: map `tabs` to `TabBarItem`s and render `<TabBar …>`:
     - `label: portalCopy.tabs[t]`
     - `icon: PORTAL_TAB_ICONS[t]`
     - `chip: portalCopy.tabChips[t]`, where `tabChips` is `{ profile: "You" }` and is typed as
       `Partial<Record<PortalTab, string>>`
     - `tabIdOf={tabId}`, `panelIdOf={panelId}`, `ariaLabel={portalCopy.tablistLabel}`
   - `PortalPage.tsx` and the badge hooks are not touched.
3. **Pure state.**
   - `pixel-look-state.ts`:
     - `lookDirty(s) = !sameLook(s.draft, s.saved ?? derivedChoice(s.memberId))`
     - `lookSaveAction(s)`: `null` when not dirty; `"reset"` when `s.saved !== null` and the draft equals
       `derivedChoice`; otherwise `"save"`
     - `resetDraft(s)` and `discard(s)`: both return `s` while busy
     - `canReset = idle && !sameLook(draft, derived)`
     - Remove `canSave`. `afterSave` and `afterReset` set `notice: null` on success.
   - `profile-draft.ts`: `nameLength(raw) = [...raw.normalize("NFC")].length`, `nameDirty(draft, saved)`, and
     `footerStatus({ busy, dirty, errors: string[] }): FooterStatus` (the type is imported from `src/ui/FormFooterBar`;
     a pure `.ts` file importing a type only is fine).
4. **`usePixelLook(memberId: string | null)`.**
   - Moves lines 22-53 of `PixelLookSection.tsx`. When `memberId` is null, the hook is inert.
   - Returns `{ state, atlas, choose(key, v), resetDraft(), discard(), persist(): Promise<string | null> }`.
   - `persist` runs `lookSaveAction`:
     - `"save"` → `api.save(draft)` → `afterSave`
     - `"reset"` → `api.reset()` → `afterReset`
     - It resolves to the error text, or `null` on success or when there is nothing to do.
   - Delete `PixelLookSection.tsx`.
5. **`ProfileTab` container.**
   - Keep the `/api/me` load, `Load` and the loading/error cards (lines 16-91). After load it holds:
     - `savedName` and `draftName`
     - `nameError: "required" | "invalid" | null`
     - `nameNotice: string | null` (a name save error text)
     - `busy`
     - `look = usePixelLook(memberId)`
   - `dirty = nameDirty(draftName, savedName) || lookDirty(look.state)`
   - `saveAll`:
     1. Return if busy or not dirty.
     2. If the name is dirty, run `validateProfileName`. If that fails, set `nameError` and stop: nothing is saved.
     3. Set `busy`.
     4. Run in parallel: the name PATCH (only when the name is dirty, with the same try/catch and `mapPatchResult`
        and `profileOutcome` as lines 56-70) and `look.persist()`.
     5. Name saved → `savedName = draftName = check.value`. Name invalid → `nameError = "invalid"`. Retry or access
        → `nameNotice = notice.text`.
     6. Clear `busy`.
     - A part that succeeded is no longer dirty, and a part that failed stays dirty. Neither request is re-sent.
   - `cancel` resets `draftName = savedName`, clears `nameError` and `nameNotice`, and calls `look.discard()`.
   - `footerStatus` gets `errors = [nameNotice, look.state.notice if tone error and status ready].filter(Boolean)`.
     When `nameError` is set, it also gets `copy.footer.fixName`.
   - Render `<form noValidate onSubmit={(e) => { e.preventDefault(); void saveAll(); }}>` wrapping `ProfileTabView`,
     so Enter in the name field saves.
6. **`ProfileTabView` (pure).**
   - Props:
     ```
     name, email, tier, orgName?, nameError, onNameChange, busy,
     photo: ReactNode, character: ReactNode | null,
     footer: { status, canSave, canCancel }, onCancel
     ```
   - Renders `PageHeader` with `copy.title` and `copy.subtitle`. Its aside is a `lock` icon plus `copy.visibility`.
   - Then a `div.grid grid-cols-1 lg:grid-cols-2 gap-6 items-start`:
     - The left `div.flex.flex-col.gap-6` holds `PersonalInfoCard` and `MembershipCard`.
     - The right holds `character` (omitted when null).
   - Then `FormFooterBar`. Drop `max-w-md`.
   - **`PersonalInfoCard`:** the `photo` slot first, then the name field:
     - Label "Display name" with `<span aria-hidden="true">*</span>` in `text-primary`.
     - `FilledInput id="portal-name" icon="person" required maxLength={DISPLAY_NAME_MAX}`, `readOnly={busy}`.
     - Under the field, a row with the hint (`copy.nameHint`, id `portal-name-hint`) on the left and the counter
       (`copy.counter(nameLength(name), DISPLAY_NAME_MAX)`, id `portal-name-count`, not a live region) on the right.
     - On error, the error `small role="alert"` replaces the hint.
     - `aria-describedby` is the hint (or error) id plus the counter id.
   - Then a divider and the email field:
     - Label "Email address" with `<Pill tone="neutral" label={copy.readOnly} />`.
     - `FilledInput id="portal-email" icon="mail" trailingIcon="lock" readOnly value={email}`,
       `aria-describedby="portal-email-hint"`.
     - Hint `copy.emailManaged`.
   - **`MembershipCard`:** `SectionCard` with `icon="group"` and no subtitle. A row holds:
     - a 44 px rounded tile with `initials(orgName)` (from `@/lib/format`), or the `group` icon when there is no
       orgName
     - `orgName` in bold over `copy.membership.yourOrg`. Without orgName, only `copy.membership.yourOrg` shows, in
       bold.
     - a right-aligned `<RoleBadge tier={tier} />` for every tier
     - The note `copy.membership.managed` sits below.
7. **`PixelLookPicker`.**
   - New props:
     ```
     draft, isDerived, status, locked, canReset, atlas, atlasFailed, onChoose, onReset
     ```
   - Wrapped in `SectionCard`:
     - `headingId="pixel-look-heading"`, `title=copy.heading`, `subtitle=copy.subtitle`
     - `titleAdornment={<Icon name="auto_awesome" />}` (decorative)
     - `aside={<Pill tone="success" decorative label={copy.livePreview} />}`
     - `footer`: `copy.tagline` on the left, and a `Button variant="tonal"` (or text) with a `restart_alt` icon and
       `copy.reset` on the right, `type="button"`, disabled when `!canReset || locked`.
   - Body: the existing previews, `copy.mapsCaption` ("This is how you appear on room maps"), the `automatic` line,
     and the four existing fieldsets unchanged.
   - When `status === "failed"`, show the `copy.loadFailed` line.
   - `ProfileTab` passes:
     - `locked = busy || look.state.busy !== null || look.state.status === "loading"`
     - `onReset = look.resetDraft`
8. **`ProfilePhotoSection` restyle.**
   - Avatar on the left; the upload label (a bordered button with the `upload` icon) and the hint on the right.
   - Remove/Replace stay as they are. Error and notice stay as they are.
   - Remove the "Photo" `h3`: the card title names the region and the label names the control.
9. **Copy (`src/ui/copy/portal.ts`).**
   - Add:
     - `tabChips: { profile: "You" }`
     - `profile.title` "Profile settings", `profile.subtitle` "Manage your personal details and your little digital
       self.", `profile.visibility` "Only visible to your workspace"
     - `profile.personal { title "Personal information", subtitle "The basics. Let your teammates know it's you." }`
     - `profile.nameHint` "This is how you'll appear in your workspace."
     - `profile.counter(n, max)` → `${n}/${max}`
     - `profile.emailLabel` "Email address", `profile.readOnly` "Read only", `profile.emailManaged` "Managed by your
       organization in mmlabs."
     - `profile.membership { title "Workspace membership", yourOrg "Your organization", managed "Your role and access
       are managed by your organization in mmlabs." }`
     - `profile.footer { saved "All changes saved", savedDetail "Saved to your account", dirty "Unsaved changes",
       saving "Saving...", save "Save changes", cancel "Cancel", fixName "Check your display name." }`
     - `photo.hint`: append " Photo changes save right away."
     - `character.heading` "Your pixel character", `subtitle` "Small pixels. Big personality.", `livePreview` "Live
       preview", `mapsCaption` "This is how you appear on room maps", `tagline` "Made of pixels. Uniquely yours.",
       `reset` "Reset character"
   - Remove the keys that become unused: `profile.heading`, `profile.save`, `profile.saving`, `profile.saved`,
     `profile.email`, `profile.role`, `profile.managed`, `photo.heading`, `character.hint`, `character.save`,
     `character.saving`, `character.resetting`, `character.saved` and `character.resetDone`.
   - Keep `profile.errors.retry` (the name save error).
   - `pnpm typecheck` catches any remaining reference.
10. **Rules.**
    - R1: everything stays in `src/ui/**` and `src/lib/icons.ts`, and nothing imports `src/server/**`.
      `pnpm check:layers` confirms this.
    - D36: every string lives in copy; `no-literals.test.ts` guards this. `*` is not a letter, so it passes the scan;
      if the scan flags it, use `// copy-ok: required marker`.
    - R7 and R6 are untouched (no route changes). Both writes are idempotent if `apiFetch` re-sends them on 401/403.
    - R4: My seat and My devices contents are not touched.
    - R5: the tests above, and all checks run green.
11. Run `pnpm format`, then the four checks.

## Specialist input used
- frontend-developer:
  - Adopted:
    - Shared blocks with copy-free props (`TabBar`, `PageHeader`, `SectionCard`, `Pill`, plus the footer as
      `FormFooterBar`).
    - `PortalTabs` as a thin wrapper that keeps the id contract.
    - The new icon names, kept sorted.
    - A single dirty/save controller with pure helpers in `pixel-look-state.ts` and a new `profile-draft.ts`.
    - Requests run in parallel, with each part's outcome handled separately.
    - Deferred Reset.
    - A `<form>` with a submit Save and `noValidate`.
    - `readOnly` email with a lock icon.
    - `session.orgName` with a fallback, and `RoleBadge` for all tiers.
    - The layout `grid-cols-1 lg:grid-cols-2`, with "Profile settings" as `h2` and card titles as `h3`.
    - No `aria-live` on the counter.
    - All copy in `portal.ts`.
  - Changed: the icon for My devices is `desktop_windows` rather than `devices`, because the mockup shows a monitor.
  - Deferred to slice 2: `ChoiceSwatch`/`OptionCard` with check marks, 44 px swatch hit areas, and hairstyle cards
    with previews.
  - Rejected: a sticky mobile footer. `AppShellView` has a bottom nav bar below `lg` (lines 60-66), so a sticky
    footer would stack on it.
- ux-architect:
  - Adopted:
    - The container/pure-view split, with small card components.
    - Name validation before any request. If the name is invalid, nothing is saved.
    - Partial-failure reporting with no re-send of the part that succeeded.
    - Save and Cancel disabled when clean.
    - Status `role="status"`, errors `role="alert"`.
    - Reset as a draft action persisted with `api.reset()`.
    - A "Photo changes save right away" hint.
    - An `aria-hidden` `*` with a `required` input.
    - Tokens only.
    - Decorative sparkle and "Live preview".
    - The chip `aria-hidden`, so the tab name stays "Profile".
    - An in-flow footer.
    - No unsaved-change warning when switching tabs (follow-up).
  - Changed: "Managed by your organization" becomes "Managed by your organization in mmlabs." so it also meets POR-04's
    "managed in mmlabs".
  - Deferred to slice 2: the radio-group Front/Back toggle and the dotted stage.

## Assumptions
These are the defaults for Ming's approval round; each can be overturned at PLAN or PR.
1. **(Ticket Q1)** "Save changes" covers the display name and the character together. The photo still saves on upload
   (unchanged), with the hint "Photo changes save right away." Cancel reverts the name and the character only.
2. **(Ticket Q2)** The footer reads "All changes saved · Saved to your account" when clean, "Unsaved changes" when dirty
   and "Saving..." while busy, with an error line on failure. Nothing mentions the browser, and nothing is written to
   browser storage.
3. **(Ticket Q3)** The org name comes from `session.orgName` (already set by AuthGate and shown in the shell header).
   Without it, the card shows only "Your organization" and an icon tile. The role badge (`RoleBadge`) shows for every
   tier, including User, as POR-04 requires.
4. **Reset character is deferred:** it sets the draft to the derived look and marks it unsaved, so Cancel can undo it
   and "Save changes" persists it through `DELETE /api/me/pixel-look`. This is a behaviour change from today's
   immediate reset. POR-06's result ("goes back to the look derived from the member id") is unchanged. A draft that is
   chosen by hand but equals the derived look, while a look is stored, is also saved as a reset (stored look cleared).
   The rendered look is identical.
5. **The "You" chip is decorative** (`aria-hidden`), so the tab's accessible name stays "Profile".
6. **The footer is in flow, not sticky.** At 390 px a sticky footer would stack on the shell's bottom nav.
7. **No warning when leaving the tab with unsaved changes.** Switching tabs unmounts the panel and drops the drafts,
   as it does today for the name. A warning is listed as a follow-up.
8. **The "managed" wording:** the mockup's "Managed by your organization." becomes "Managed by your organization in
   mmlabs." (and the same for the role note) to keep POR-04's "managed in mmlabs".
9. **The photo hint keeps today's accurate text** ("Choose any photo up to N MB. It is cropped…"), not the mockup's "PNG
   or JPG. Square image, up to 256 KB.", which does not match the existing crop-and-resize flow (OQ-56 limits).
10. **"Only visible to your workspace"** is read as visible to members of the caller's org (the members list and maps
    show the photo and look org-wide; no one outside the org sees them).
11. **Hairstyle names stay "Style 1/2/3".** The mockup's "Classic / Side sweep / Long" are not defined anywhere, and
    naming the art is copy only; Ming can supply names. This matters only in slice 2.
12. **Name editing while saving:** the name input is `readOnly` and the picker is locked while a save runs, so a save
    result never overwrites newer typing.
13. **No member id** (`/api/me` without a member): the character card is omitted (as today) and the left column shows
    alone.
14. **Hotspots:** no ticket is `IN_PROGRESS`, `REVIEW` or `DONE` on the board. SIM-067 and SIM-069 (same batch, both
    depend on this ticket) will edit `src/ui/copy/portal.ts`, `src/lib/icons.ts`, `src/ui/index.ts` and possibly
    `src/ui/Chip.tsx`, so expect rebases on those files after this merges.

## Blocking questions
None. These questions are non-blocking for slice 1; they are listed with their defaults for the approval round.
- **Q-A (spec conflict, slice 2):** POR-06 says the preview shows "front and back at 1× and 2×". The mockup shows one
  large figure with a Front/Back toggle. Proposed default for slice 2: one large preview (4×) of the selected view on
  the dotted stage, plus small 1× and 2× previews of the same view in the stage corner. The toggle reaches front and
  back at both sizes. Alternative: amend POR-06 to drop the 1×/2× wording. Slice 1 keeps today's four previews, so it
  meets POR-06 as written.
- **Q-B (slice 2):** names for hairstyles 1-3, if wanted (default: keep "Style 1/2/3").

## Split proposal
The full ticket is about 900 product lines plus about 450 test lines, more than one implement/review cycle.

- **Slice 1, this plan (SIM-066):**
  - The shared kit blocks (`TabBar`, `PageHeader`, `SectionCard`, `Pill`, `FormFooterBar`)
  - The tab bar restyle
  - The Profile page header and the two-column layout
  - The Personal information and Workspace membership cards
  - The footer with the single Save/Cancel model and deferred Reset
  - The pixel character picker moved into its card (Save removed, "Reset character" in the card footer), with
    today's previews and swatch groups

  This slice meets all six acceptance criteria and gives SIM-067 and SIM-069 the shared blocks. The estimate is about
  550 product lines plus about 400 test lines; tests and copy account for most of the size.
- **Slice 2, proposed follow-up SIM-066.1 "Pixel character card visuals":**
  - The dotted stage with a large preview and the Front/Back toggle (`FilterChips`), with the name tag (live draft
    name) and the 1×/2× answer from Q-A
  - Hairstyle option cards with a `LookPreview` at 1× per style (text-only when the atlas is missing)
  - Swatches at 32 px with a 44 px hit area and a check mark plus ring for the selected state
  - Widening `LookPreview.scale` to include 4

  It touches only `PixelLookPicker.tsx`, `LookPreview.tsx`, their tests and copy, at about 200 lines.
