## Attempt 1 — 2026-11-27 (SLICE 1 of 7: tokens foundation)

Plan approved with defaults Q1–Q17. Slices 2–7 not started.

### Files touched
| File | Required because |
|---|---|
| `src/styles/tokens.css` | new: all brief tokens (light), derived tokens (Q1, Q6, Q11), dark values; `@theme static` for utilities, `:root` for non-utility tokens and shadows |
| `src/app/globals.css` | imports tokens.css; old token names re-pointed to the new tokens (compat layer); DM Sans family; `.text-h2` 32/40; focus ring 2px `--color-focus`; reduced motion `animation/transition: none`; durations; `@utility shadow-card/dialog/pixel`; `--container-*`, `--spacing-control/sidebar` aliases |
| `src/app/layout.tsx` | Manrope -> DM_Sans (`--font-dm-sans`) |
| `src/lib/color/contrast.ts` (+ test) | pure WCAG helpers for the AA tests, no new package |
| `src/lib/color/tokens.test.ts` | token presence/once, dark coverage, AA pairs both themes, focus/border 3:1, focus rule, reduced motion, `@theme inline` collision guard |
| `src/lib/breakpoints.ts` (+ test) | one source for JS media queries (md 800, lg 1024, xl 1280); test pins them to tokens.css |
| `src/ui/auth/SignInScene.tsx`, `SmallWorld.tsx`, `src/ui/roomlayout/LayoutEditorPage.tsx` | use `MEDIA.*` (SignInScene 768 -> 800 to match `md:`) |

### Tests added / changed
- `src/lib/color/contrast.test.ts` (parseHex/isOpaque, contrast formula, Q1 numbers, mixSrgb)
- `src/lib/color/tokens.test.ts` (all plan rows; 9 tests)
- `src/lib/breakpoints.test.ts`
- No existing test changed.

### Checks (actual output summary)
- format:check: pass (oxfmt run on changed files)
- typecheck: pass (after the layout.tsx fix below)
- check:layers: `1009 files, no violations`
- test: `386 passed | 1 skipped (387) files; 3779 passed | 7 skipped` (full run before the layout fix; layout.tsx has no tests; the 3 color/breakpoint files re-run green, 14 tests)
- build: pass. Built CSS: `.bg-canvas{background-color:var(--color-canvas)}`, `[data-theme=dark]` overrides colours, `.shadow-card{box-shadow:var(--shadow-card)}`, `--breakpoint-md:800px`, no "manrope". `@theme static` is supported.
- `git diff main -- package.json pnpm-lock.yaml`: empty.

### Deviations from the plan
- `--color-border-strong` is `#889282` (plan `#8A9484`): the plan value measured 2.998:1 on canvas, below 3:1; the test caught it.
- DM Sans: `next/font` types reject the `vietnamese` subset, so `subsets: ["latin", "latin-ext"]` (plan Approach 3 / Q9 fallback). Ming checks "Nguyễn Thị Ngọc Ánh" after the slice.

### Canvas motion check
`rg "requestAnimationFrame|setInterval" src/ui`: only `WalkLayer.tsx` (already gated by reduced motion via `useWalks`/`idleOn`) and `EditorCanvas.tsx:199` (one-shot paint). No code change.

### Visible differences (slice 1)
Font Manrope -> DM Sans; canvas #F6F6F5 -> #F8F9FB; ink #1C1C1C -> #272931; secondary text #6B6B6B -> #475569; borders -> #E1E4DE / #E8ECE0; "warn" blue -> amber #855C15; errors #DC2626 -> #B44C46; focus ring black+orange halo -> green 2px; dark theme neutral greys -> blue-grey; `font-mono` users become real monospace; `.text-h2` headings 30 -> 32px; `md:` layouts switch at 800 not 768 (Button, AuthLayout, SignInScene, DeviceTable, IncomingTransfers, OverdueBanner, PendingExtensions, PendingReturns); orange accents #FB5729 -> #ED5B35; reduced motion removes skeleton pulse and dialog pop entirely. Buttons stay near-black until slice 3. Contrast: all pairs in the plan table are asserted >= 4.5 (text) / 3 (non-text) in both themes by `tokens.test.ts`.

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- `--accent-shadow` and `--field-focus` still derive from `--accent-orange`; removal belongs to slices 3/7.

### Scope self-check
- Could the diff be smaller? No; mostly declarative tokens and tests.
- Diff size: see commit.

## Slice 2 — Token guard (attempt 1)

### Files touched
- `scripts/check-tokens.mjs` (new): rules table, `findViolations`, `isScanned`, `isAllowed`, `ALLOWLIST`, `compareToPending`, `scanRepo`, CLI (`--list`). Required because: the guard.
- `scripts/check-tokens.test.ts` (new): rule, allowlist, pending, ratchet, repo and CLI tests (15 tests). Required because: R5, AC 1b.
- `scripts/check-tokens.pending.json` (new): generated with `node scripts/check-tokens.mjs --list`: 65 files, 373 violations in total. Required because: ratchet.
- No `package.json`, `CLAUDE.md`, loop.config or `src/` change; the test runs inside `pnpm test`.

### Rules
hex, color-fn, shadow-arb, rounded-arb, font-arb, text-arb, ease-arb, duration-arb, arbitrary-px, spacing-scale (allowed steps 0,1,2,3,4,5,6,8,12 and px), css-radius, css-shadow, css-font-size, css-font-family; patterns as in the plan, comments stripped first.
Permanent allowlist: `src/styles/tokens.css` (defines token values), `src/lib/sprites/**` (pixel-art data), `src/ui/roomlayout/paint.ts` (canvas art colours), `src/ui/portal/photo-canvas.ts` (canvas photo colours), `src/ui/groups/group-form.ts` (default group colour is user data).

### Deviation
- The plan's `hex` regex required a digit, which contradicts its own test list (`#fff`, `#FFFF` must flag; `#bad` must not) and missed `"#ffffff"` in Avatar.tsx. Used: 6 or 8 hex digits always; 3 or 4 digits need a digit or one repeated letter (`#fff`, `#FFFF`). `href="#bad"` and `&#123;` still pass.

### Pending list (file: count)
Largest: `src/app/globals.css` 69, `AppShellView.tsx` 32, `EntityFormDialog.tsx` 28, `Chip.tsx` 16, `Button.tsx` 12, `MapItemEditor.tsx` 11, `SeatOverlay.tsx` 10, `SeatsView.tsx` 10, `SeatDetailPanel.tsx` 9, `MapItemEditorDetails.tsx` 8. `Avatar.tsx` 1 (`"#ffffff"`, Q-S2-2). The other 55 files have 1 to 7 each; full table = `scripts/check-tokens.pending.json`. Spot-checked: Chip.tsx and Button.tsx (arbitrary hits consistent with rg), SeatOverlay.tsx (rgba tooltip, lines 20/165/166), Avatar.tsx:33; no allowlisted file is listed (test enforces).

### Mutation check
`bg-[#fff]` appended to non-pending `src/ui/AppShell.tsx` and `p-7` to pending `src/ui/Chip.tsx`: the repo test failed for both ("now 1, pending 0", "now 17, pending 16"); reverted (git status clean of src changes).

### Known gaps (not fixed, R4)
Inline style numbers (`borderRadius: 12`), non-hex/rgb/hsl style strings, `font-bold/extrabold` weights (slice sweeps, Q7).

### Checks
- format:check: pass (`All matched files use the correct format`)
- typecheck: pass
- check:layers: `1009 files, no violations`
- test: `387 passed | 1 skipped (388) files; 3794 passed | 7 skipped (3801)`
- build: pass

### Out-of-plan files
None. Follow-ups: none.

### Scope self-check
Only the four planned files; no `src/` edits.

## Slice 3 (attempt 1) — UI kit

### Files touched
Kit (per plan Files table): `src/ui/{Button,Chip,Card,SectionCard,FilledInput,EntityFormDialog,RoleBadge,SegmentedFilter,TabBar,FormFooterBar,PageHeader,PageSkeleton,Avatar}.tsx`, `src/ui/auth/fields.tsx`, `src/ui/dashboard/StatTile.tsx`, `src/app/globals.css` (`.state-layer:not(:disabled)`, `.field-box` focus rules, checkbox/radio accent-color, `.status-dot` removed, scrollbar tokens), `src/app/dev/shell/KitGallery.tsx` + `src/ui/copy/gallery.ts` (pixel button, six pills, checkbox, SegmentedFilter), `scripts/check-tokens.pending.json`.
Tests: `kit.test.tsx`, `layout-blocks.test.tsx`, `SegmentedFilter.test.tsx`, `Avatar.test.tsx`, `portal/MyRequestRow.test.tsx`, `lib/color/tokens.test.ts`.
Defaults used for Q-S3-1..5.

### Out-of-plan files
`src/ui/requests/DecisionDialog.test.tsx:76`: asserted attribute order `<button type="submit" disabled`; the kit Button now emits `class`/`data-variant` between, so the regex became `/<button type="submit"[^>]*disabled/`. Assertion intent unchanged (plan allows tests asserting changed kit markup).

### Rename map (old -> new)
`bg-primary text-on-primary` (filled) -> `bg-workspace-action text-on-action` (hover `enabled:hover:bg-workspace-action-hover`); `text-on-surface` -> `text-text-primary`; `text-on-surface-variant` -> `text-text-secondary`; `border-outline-variant` -> `border-divider` (cards, dividers) / `border-border` (controls); `border-outline` -> `border-border-strong`; `bg-surface-high|low` -> `bg-canvas|bg-surface`; `rounded-md3(-lg)` -> `rounded-lg|rounded-xl`; `rounded-full` buttons -> `rounded-lg`; `*-container` pills -> `bg-{success,warning,danger,info}-tint text-{...}`; `text-error` -> `text-danger`; `font-extrabold|bold` -> `font-semibold|font-medium`; `text-[13px]|text-sm` -> `text-label`, `text-[11px]|text-xs` -> `text-caption`; `min-h-11|min-h-[44px]` -> `min-h-control`; `focus-within:*` field glow -> `.field-box`.

### Pending before -> after
373 -> 293. Removed keys (11): Avatar 1, Button 12, Card 3, Chip 16, EntityFormDialog 28, FilledInput 4, RoleBadge 6, SectionCard 1, SegmentedFilter 2, auth/fields 1, StatTile 2. `globals.css` 69 -> 65. Regenerated with `node scripts/check-tokens.mjs --list`; diff confirmed only these changes. `node scripts/check-tokens.mjs` exits 0.

### Built-CSS confirmations
Tailwind accepts `duration-(--duration-ui)` (emitted `transition-duration:var(--duration-ui)`); preflight `font:inherit` present, so `font-[inherit]` was safely dropped; `.field-box` in the built CSS.

### Visible differences
- Filled buttons, selected FilterChip, dialog Save, Tab "You" pill: ink -> coral action #D3441F (hover #B93B19), white text. Sign-in/check-in buttons keep their colour (`.aw-card`/`.px-card` overrides until slice 6) but get 14 px labels and 44/48 px height.
- Buttons/IconButtons: pill -> 8 px corners; `sm` 36 -> 44 px tall (row actions grow ~8 px); labels 13/15 -> 14 px; weight 700 -> 500; disabled opacity 40 -> 50 % with not-allowed cursor and no hover/state layer.
- Secondary border divider -> border, hover border-strong; danger button on danger-tint.
- FilterChips: 8 px track, 6 px chips, 44 px tall. SegmentedFilter: bordered canvas track, selected = border + surface + card shadow, 44 px.
- Cards 16 -> 12 px radius; hover darkens border instead of a larger shadow.
- Dialogs 20 -> 16 px, surface background, dialog shadow, title 18 px/600, width 448 px, captions 14 px sentence case, strong field borders, green 2 px focus ring on the field box (no glow); footer uses kit Buttons.
- Role badges 12 px/500, 4 px radius, Manager info-blue tint, Admin solid ink. Pills 12 px, neutral on canvas, new `info` tone.
- PageHeader 18 px/600; section card titles 600; stat values 24 px Title, labels 14 px; auth labels 14 px ink, errors 12 px danger, notices 8 px radius.
- Tabs: underline coral (workspace-primary), active label ink 600. Scrollbar thumb uses border tokens. Checkbox/radio fill with the action colour.
- Interim: hand-rolled `bg-primary` buttons outside the kit stay ink (InvitePeople, AppShellView skip link, SeatOverlay tag).

### Checks
- format:check: `All matched files use the correct format`
- typecheck: pass
- check:layers: `1009 files, no violations`
- test: `387 passed | 1 skipped (388) files; 3809 passed | 7 skipped (3816)`
- build: pass

### Scope self-check
Only the planned files plus the one test noted above. Follow-ups: none.

## Slice 3 (attempt 2) — rework of review "Slice 3 — Attempt 1"

### Files touched
- `src/ui/requests/DecisionDialog.test.tsx:76`: regex now `/<button type="submit"[^>]*disabled=""/`. Required because the attempt-1 regex also matched `disabled:cursor-not-allowed` in the class list and was vacuous (issue 1). This corrects the attempt-1 "Out-of-plan files" note, which wrongly said the assertion intent was unchanged.
- `src/ui/kit.test.tsx`: Button disabled test loops all six variants and requires the `enabled:` prefix only (dropped the `hover:` branch and the filled-only bare-hover line); new IconButton test applies the same check to inactive and active (issue 2).

### Checks
- format:check: `All matched files use the correct format`
- typecheck: pass
- check:layers: `1009 files, no violations`
- test: `387 passed | 1 skipped (388) files; 3810 passed | 7 skipped (3817)`

### Scope self-check
Only the two test files named in review issues 1 and 2, plus this log. Follow-ups: none.

## Slice 4 (attempt 1) — Shell, sidebar and page containers

### Files touched
- `src/ui/AppShellView.tsx`: all shell class strings per Approach 1, new `data-slot="nav-indicator"` span, brand-mark `style` removed, signed-out wrapper `page-content`, doc comment. Required because it is the slice's subject.
- `src/ui/RoomSwitcher.tsx`: select classes (Approach 2).
- `src/app/globals.css`: `@utility page-content` / `page-library` (nested `@media`, accepted by Tailwind 4.3), `--accent-shadow` deleted.
- 20 feature files + `PageSkeleton.tsx` + `src/app/dev/shell/KitGallery.tsx`: `p-4 lg:p-6` → `page-content` / `page-library` only (the pre-edit `rg` gave exactly the 31 expected lines; all swapped, none left). Library: DeviceTypesView, MapItemsView, SeatsPage, SeatsView, LayoutEditorPage. `CreditsPage` / `LayoutEditorPage` class order changed to put the container first (wrapper only).
- `scripts/check-tokens.pending.json`: removed `src/ui/AppShellView.tsx`.
- Tests: `AppShellView.test.tsx` (3 asserts updated, 7 new tests), `RoomSwitcher.test.tsx` (1), `src/ui/page-container.test.ts` (new), `src/lib/color/tokens.test.ts` (1).
- The extra `rg -ln "lg:p-|md:p-"` hits were all the same files already in the table; no other page wrapper found.

### Rename map additions
`border-outline-variant` → `border-divider`; `text-on-surface(-variant)` → `text-text-primary/secondary`; `bg-error-container text-on-error-container` → `bg-danger-tint text-danger`; `p-4 lg:p-6` → `page-content`/`page-library`; dev badge amber/red palette → `warning`/`danger` tints.

### Pending before/after
`node scripts/check-tokens.mjs --list` diffed against the committed file: only `src/ui/AppShellView.tsx: 32` removed; globals.css stays 65; every other count unchanged.

### Built CSS
`pnpm build`; in `.next/static/chunks/*.css`: `.page-content{width:100%;max-width:var(--width-content);padding:var(--space-4);margin-inline:auto}` plus `@media (min-width:800px){…padding:var(--space-6)}` and `@media (min-width:1280px){…padding-inline:var(--space-8)}`; `.page-library` identical with `--width-library`. Nested `@media` worked, no `@variant` fallback needed.

### Width table
Not measured in a browser (no browser in this environment); computed from the plan formula (viewport − 216 − 2 × padding) and the code read in Approach 4. Needs Ming's eyes at 800/1024 (Q-S4-4).
| Content width | 390 | 800 | 1024 | 1280 |
|---|---|---|---|---|
| Content px | 358 (bottom bar) | 536 | 760 | 1000 |
- Layout editor: 800 desktop-only state (unchanged); 1024 canvas column 456 px, scrolls (expected usable).
- Room map: scrolls horizontally at 800 (536 px).
- Possibly cramped at 800 (switch to wide layout with 536 px): `md:` device cards/tables, pending extension/return lists; at 1024 `CheckinView` `1fr 300px` (444 px). Follow-up for slices 5/6 if confirmed.

### Visible differences
As the plan list "Visible differences to log (slice 4)", unchanged: 216 px sidebar from 800 with icon+label rows and coral left indicator; 64 px bottom-bar cells with top indicator; brand mark 8 px radius with card shadow; badges 12 px 600; header type scale, 44 px Credits target, 24 px padding from 800; dev/prod badge now tinted warning/danger; room select 44 px; skip link coral; pages centred and capped (1320 / 1600) with 24/32 px padding.

### Checks
- format:check: `All matched files use the correct format`
- typecheck: pass; check:layers: `1027 files, no violations`
- test: `396 passed | 1 skipped (397) files; 3867 passed | 7 skipped (3874)`
- build: pass

### Out-of-plan files / Follow-ups
None out of plan. Follow-up: browser width check at 800/1024 (see table). The "tokens only" test asserts no `style=` containing background/color in the nav (not any `style=`), because `Icon` itself emits `style="font-size:…"`.

### Scope self-check
Only plan files. AppShell.tsx untouched as planned.

## Slice 5a (attempt 1) — Management screens: Members, invitations, Groups, Approvals, Audit, Credits, Org

### Files touched
- `src/ui/table.ts` (new): `TABLE_HEAD/CELL/ROW/REFS` (R-g). Required because five copies of the table classes drift.
- Members: `MembersView.tsx`, `PendingInvitations.tsx`, `MemberPhotoSection.tsx`, `DeactivateMemberDialog.tsx`, `ReactivateMemberDialog.tsx`. Invitations: `InvitePeople.tsx` (kit `Button`), `InviteDialog.tsx` (kit retry `Button`). Groups: `GroupsView.tsx`, `ListSection.tsx`, `DeleteDialog.tsx`. Requests: `ApprovalsView.tsx` (Pill via `requestStatusLook`), `RequestRowActions.tsx`, `DecisionDialog.tsx`. `audit/AuditView.tsx`, `credits/CreditsPage.tsx`, `org/{ProfileView,OrgPickerView,OrgSwitcherDialog}.tsx`. Each required because it is in the 5a Files table (R-a..R-g applied; rename map as in the plan's R-a/R-b, reused by 5b/5c).
- `scripts/check-tokens.pending.json`: 5 keys removed (see below).
- Tests: `src/ui/page-container.test.ts` (recursive scan), `src/ui/screen-tokens.test.ts` (new), and the 7 listed view tests extended.

### Pending before/after
`node scripts/check-tokens.mjs --list` diffed against the committed file: only the 5 planned keys removed (`audit/AuditView.tsx` 3, `invitations/InviteDialog.tsx` 5, `invitations/InvitePeople.tsx` 2, `members/MembersView.tsx` 4, `members/PendingInvitations.tsx` 3 = 17); globals.css stays 65; no other count changed. 261 -> 244. `node scripts/check-tokens.mjs` exits 0. Every touched pending file reached 0 (R-h), nothing needed an allowlist.

### Visible differences
- Members: "Invite people" near-black pill -> coral action Button, 8 px, 44 px, 14 px 500. Status column -> green "Active" / grey "Deactivated" pills with a dot; deactivated rows on `bg-canvas`, no 60 % fade. Table headers 11 px 800 -> 12 px 600 uppercase; member name 700 -> 600; borders divider. Pending invitations heading 18 px 800 -> 600. Row action group wraps.
- Invite dialog: notices 13 -> 14 px; Retry pill -> 8 px outlined 44 px Button.
- Groups: section headings (formerly unstyled because `text-h3` is undefined) -> 18 px 600; names/codes 700/800 -> 600; row actions wrap.
- Approvals: decided chips -> green / red / grey pills with a dot; times 12 px secondary; Approve/Reject lost redundant `min-h-11` (already 44 px).
- Audit: headers as Members; entity id and metadata 12 px.
- Credits: title 24 px 800 -> 32 px 600; pack names 700 -> 600.
- Profile / org picker / switcher: profile label 12 px secondary -> 14 px ink; hint/error 12 px; switcher radio rows 44 px with 20 px radio.
- Page titles Members, Groups, Approvals, Audit: 32 px 800 -> 600.

### Checks
- format:check: `All matched files use the correct format`
- typecheck: pass; check:layers: `1029 files, no violations`
- test: `397 passed | 1 skipped (398) files; 3874 passed | 7 skipped (3881)`
- build: pass

### Out-of-plan files / Follow-ups
None out of plan. Follow-up: none. Not browser-verified (no browser here).

### Scope self-check
Only the 5a Files table; no copy, props, `aria-*`, `src/app` or `src/lib` change.

## Slice 5b (attempt 1) — Devices and device types

### Files touched
- Devices (19, `src/ui/devices/`): `DevicesView`, `DeviceTable` (kit `TABLE_*`, `lg` switch), `device-labels` (`Pill` for Overdue and pending), `DeviceRowActions`, `OverdueBanner`, `IncomingTransfers`, `PendingReturns`, `PendingExtensions` (`md:` to `lg:`), `DeviceDetailView`, `DeviceHistory`, `NoteField` (kit textarea box), `AssignDeviceDialog`, `ExtendDeviceDialog`, `TransferDeviceDialog`, `ReturnDeviceDialog`, `DeviceFormDialog`, `PlaceDeviceDialog` (kit retry `Button`, 44 px radio rows), `DeleteDeviceDialog`, `TakeBackDeviceDialog`.
- Device types (7, `src/ui/deviceTypes/`): `DeviceTypesView`, `DeviceTypeFormDialog`, `DeviceTypeImageField` (kit buttons, `field-box` file picker), `DeviceTypeSpriteField`, `DeviceTypeThumb`, `DeskSlotDiagram`, `DeleteDeviceTypeDialog`.
- `scripts/check-tokens.pending.json`: 16 keys removed. Each file is in the 5b Files table; defaults Q-S5b-1..6 applied.
- Tests: `src/ui/screen-tokens.test.ts` (26 files added to `MIGRATED`, `LEGACY` widened to `container[\w-]*`, kit-Button list gains 2 files, new `lg` and `TABLE_*` tests) and 13 view tests extended with "tokens" describes (no existing assert removed).

### Pending before/after
`node scripts/check-tokens.mjs --list` diffed against the committed file: only removals, exactly the 16 planned `src/ui/devices*` keys (AssignDeviceDialog 5, DeviceDetailView 4, DeviceFormDialog 4, DeviceHistory 1, DeviceRowActions 1, DeviceTable 2, ExtendDeviceDialog 5, NoteField 7, OverdueBanner 1, PlaceDeviceDialog 1, ReturnDeviceDialog 5, TransferDeviceDialog 5, device-labels 4, DeviceTypeFormDialog 4, DeviceTypeImageField 7, DeviceTypeSpriteField 4 = 60); no other count changed. 244 -> 184 violations. The file was replaced by the `--list` output; `node scripts/check-tokens.mjs` exits 0.

### Visible differences
- Devices list: at 800-1023 px the stacked device cards replace the table (table from 1024). Incoming transfers, pending returns, pending extensions and the overdue banner stay stacked (buttons under the text) up to 1023 and go side-by-side from 1024 (was 800).
- Table headers 11 px 800 -> 12 px 600 uppercase, divider under the header row, divider row borders.
- "Overdue" chip -> red pill with a dot; "Transfer / Return / Extension pending" chip -> amber pill with a dot (list, cards, detail, overdue banner). "You" and Primary/Secondary chips unchanged.
- Device name and room links stay ink (now a token); detail "Back" link is 44 px tall.
- Page titles 32 px 800 -> 600; section headings 18 px 800 -> 600 (history and detail `text-h3` was undefined, so those were 16 px 800). Card device names and history kinds 700 -> 600.
- Small gaps in owner/details cells 2 -> 4 px, chip rows 6 -> 4 px.
- Dialogs (assign, note/expiry, transfer, give back, extend, device form, device type form): captions and legends uppercase 11 px 800 grey -> 14 px 500 ink; note box 8 px corners, stronger border, ring around the box on focus; "No expiry" checkbox and every radio row 44 px with a 20 px control.
- Place dialog: "Retry" underlined text -> 44 px outlined button; seat rows 8 px corners.
- Device types: "Choose/Replace image" pill -> 8 px bordered secondary-style 44 px picker; "Remove" -> red danger button, "Keep current image" -> outlined button; type names 700 -> 600; row actions wrap.
- DeskSlotDiagram: now `fill-canvas stroke-divider`, chair `fill-divider`, marker ink. The check of what the desk rect looked like before (`fill-surface-container-high` has no theme key, so it likely fell back to the SVG default black fill) was NOT done: no browser is available here. Please check in the browser.

### Checks
- format:check: pass (exit 0); typecheck: pass; check:layers: `1033 files, no violations`
- test: `399 passed | 1 skipped (400) files; 3933 passed | 7 skipped (3940)` (first run had 4 failures in my new test regexes, fixed)
- build: pass
- Plan step 6 `rg` over `src/ui/devices` and `src/ui/deviceTypes` (non-test): no legacy hits (only `stroke-text-primary` in DeskSlotDiagram, which is the new ink token).

### Out-of-plan files / Follow-ups
None out of plan. Follow-up: DeskSlotDiagram fill check in a browser; `border-strong` for the diagram if too light (Q-S5b-5). Not browser-verified.

### Scope self-check
Only the 5b Files tables, tests, pending and this log; no copy, props, ids, `aria-*`, `src/app` or `src/lib` change.

## Slice 5c (attempt 1) — Dashboard, search, rooms and seats chrome

### Files touched (all in the "Slice 5c addendum" Files tables)
- Dashboard (2): `DashboardView`, `ExportCard` (`StatTile` unchanged, added to `MIGRATED`).
- Rooms (4): `RoomCard` (code link `hover:underline`, actions `items-center`), `OccupancyRing` (`stroke-divider` track, `stroke-text-primary` arc, `text-caption` percent), `RoomsView`, `DeleteRoomDialog`.
- Search (1): `SearchView` (Deactivated badge -> neutral `Pill dot`).
- Seats (7): `SeatsView` (`TABLE_*`, `TH`/`TD` removed, unclipped scroll region, kit `Button variant="text"` seat codes, 44 px back link), `SeatDetailPanel` (`bg-surface` + `shadow-dialog`, Q-S5c-3), `MemberPickerDialog` (44 px radio rows, kit retry / Load more), `SeatActions`, `ConfirmSeatDialog`, `SeatTagsDialog`.
- 5b nits (3): `PlaceDeviceDialog` (two `{" "}` dropped), `DeviceDetailView.test.tsx` (back link pinned to `href="/devices"`), `DevicesView.test.tsx` (Edit-button count check).
- Defaults taken for Q-S5c-1..5 (mechanical ring colours, icon + text seat status, `bg-surface` panel, ink links unchanged, seat-code button keeps kit `px-4`).

### Tests
- `screen-tokens.test.ts`: `MIGRATED` + 18 files, kit-Button list + `SeatsView`/`MemberPickerDialog`, shared-table test now loops over `DeviceTable` and `SeatsView`.
- New "tokens" tests in `DashboardView`, `RoomsView`, `SearchView`, `SeatsView`, `SeatDetailPanel`, `MemberPickerDialog` (2 tests); extended `SeatActions` notices and `SeatActionDialogs` confirm body. No existing assert removed (the `DeviceDetailView` nit assert is stricter).

### Pending before/after
`scripts/check-tokens.pending.json`: 8 keys removed (DashboardView 6, ExportCard 4, OccupancyRing 2, RoomCard 6, SearchView 3, MemberPickerDialog 1, SeatDetailPanel 9, SeatsView 10 = 41). 30 keys / 183 -> 22 keys / 142 (corrected totals; the earlier "244 -> 184" and "184 -> 143" were one too high). The diff also drops the trailing comma on the new last entry (`SeatOverlay`). `node scripts/check-tokens.mjs`: `22 files, no violations outside the pending list`.

### Visible differences
As listed in the plan's "Visible differences to log (slice 5c)": titles 800 -> 600; 13 px hints -> 14 px; ring percent 12 px · 600; Deactivated search badge -> grey dot pill; room table headers/cells on the shared table classes, seat codes are 44 px text buttons, global focus ring around the card; seat panel white with dialog shadow; member picker 44 px rows and kit buttons; place-device retry spacing. Not browser-verified (no browser here).

### Checks
- format:check: pass ("All matched files use the correct format")
- typecheck: pass; check:layers: `1033 files, no violations`
- test: `399 passed | 1 skipped (400) files; 3940 passed | 7 skipped (3947)` (first run had one failure in my new picker test, which counted the search label too; fixed)
- build: pass
- `node scripts/check-tokens.mjs`: exit 0
- Plan step 6 `rg` over dashboard/rooms/search/seats (non-test): no hits other than `text-text-primary` / `stroke-text-primary`.

### Out-of-plan files / Follow-ups
None out of plan. Follow-ups: browser check of the room table focus ring at 390 px, the `OccupancyRing` ink arc in dark mode, and the seat-code button 16 px indent (Q-S5c-5); toned ring / status pills await thresholds from Ming (Q-S5c-1/2).

### Scope self-check
Only the 5c Files tables, tests, pending and this log; no copy, props, ids, `data-*`, `aria-*`, `src/app` or `src/lib` change.

## Slice 6a (attempt 1)
Scope: auth screens, check-in, globals.css `.aw-*` / `.px-frame` and removal of `--aw-*`, `.px-card`, `.px-strip`, `.px-title`; `world-palette.test.ts` replaced by a `tokens.test.ts` describe. Defaults taken for Q-S6-1..16.

### Files touched
- `src/app/globals.css`: per the rule table. `--aw-*` blocks deleted; `.aw-*` re-pointed to `--color-*`, `--text-*`, `--space-*`, `--radius-*`, `--shadow-*`; `.aw-headline` Display with a Hero `@media (width >= 1024px)`; `.aw-serif` keeps Fraunces on pixel-primary; `.aw-card [data-variant="filled"]` pixel-primary + hover + `--shadow-pixel` + disabled; `.aw-room` ring is now an `outline`; `.px-frame` is a 4 px pixel-green border with `--shadow-pixel`; `.px-strip`, `.px-title`, `.px-card` rules deleted. `.px-stage`, `.px-heading`, `.px-scene*` and everything before line 369 untouched. Both marker comments kept.
- Auth: `AuthLayout` (`max-w-100`, `max-w-204`, `gap-8`, `aw-heading text-subtitle`), `DevGate` (danger tint notice), `account-views`, `views`, `accept-views` (`min-h-16.25`, `text-label font-normal`, secondary hints).
- Check-in: `CheckinPopup` (frame, title bar `bg-tile`, `border-3 border-pixel-primary`, `size-5 accent-pixel-primary`, `variant="pixel"` and `tonal`, 44 px rows), `CheckinButton` (`variant="pixel"`, no `px-card`), `CheckinView`, `CheckinPage` (standalone links, notice tokens), `WhosHere` (44 px rows, `hover:bg-canvas`, no opacity), `PixelHead` (`bg-tile`).
- `scripts/check-tokens.pending.json`: 6 keys removed, `globals.css` 65 -> 32.
- Tests: `world-palette.test.ts` deleted; `src/lib/color/tokens.test.ts` (new text/non-text pairs, `LARGE_TEXT_PAIRS`, "auth world and pixel chrome" describe, 9 checks); `src/ui/screen-tokens.test.ts` (`MIGRATED` +14, kit-Button list +3, "pixel chrome" test); `CheckinPopup`, `CheckinButton`, `CheckinView`, `WhosHere`, `views`, `account-views` tests.

### R-i map applied
`--aw-bg` cream, `--aw-ink` text-pixel, `--aw-muted` text-secondary, `--aw-line` divider, `--aw-strip` tile, `--aw-accent` pixel-primary, `--aw-on-accent` on-action, `--aw-serif-ink` pixel-primary (large text, asserted >= 3); check-in orange buttons -> kit `pixel`; `border-px-outline` -> `border-pixel-primary`; `bg-px-wall` -> `bg-tile`; sprite head `bg-tile`.

### Pending before/after
6 keys removed (AuthLayout 3, DevGate 1, account-views 2, views 1, CheckinPopup 7, CheckinView 2 = 16 violations); `globals.css` 65 -> 32 (`node scripts/check-tokens.mjs --list` reports 32). Total 142 -> 93, 22 -> 16 keys.

### Plan step 4: build output
All compile in 4.3.x, no fallback needed. Built CSS: `min-h-16.25` -> `calc(var(--spacing) * 16.25)`; `border-3` -> `border-width:3px`; `bottom-[calc(--spacing(20)+env(safe-area-inset-bottom))]` -> `calc(calc(var(--spacing) * 20) + env(...))`; `w-[min(--spacing(128),calc(100vw-var(--space-6)))]` -> `min(calc(var(--spacing) * 128), calc(100vw - var(--space-6)))`; `lg:grid-cols-[minmax(0,1fr)_--spacing(75)]` -> `minmax(0,1fr) calc(var(--spacing) * 75)`. The project does not override `--spacing` (Tailwind default 0.25rem), so these are 80 px / 32rem / 300 px / 65 px.

### Visible differences
As listed in the plan's "Visible differences to log (slice 6a)".

### Checks
- `pnpm format:check`: pass ("All matched files use the correct format")
- `pnpm typecheck`: pass
- `pnpm check:layers`: `1032 files, no violations`
- `pnpm test`: exit 0, 398 passed | 1 skipped files; 3952 passed | 7 skipped tests
- `pnpm build`: pass
- `node scripts/check-tokens.mjs`: `16 files, no violations outside the pending list`
- Plan step 3 `rg`-style scan of auth/checkin non-test files: only `text-text-primary` matches, `AuthLayout` `rounded-none!` (kept per plan, Card override) and `RoomThumb` (art, untouched).

### Out-of-plan files / Follow-ups
Out of plan: `src/ui/auth/DevGate.test.tsx` (one assertion `bg-red-600` -> `bg-danger-tint`, required by the planned DevGate notice change). Follow-ups: none new; browser checks as in "Ming verification after merge (slice 6a)".

### Scope self-check
Only the 6a Files tables, tests, pending and this log, plus the DevGate test assertion above; no copy, props, ids, `data-*`, `aria-*`, `src/lib` (except `tokens.test.ts`) or `src/app/layout.tsx` change.

## Slice 6b (attempt 1)
Portal on the Simap tokens, per "Slice 6b addendum — Portal"; defaults taken for Q-S6b-1..7.

### Files touched (all in the plan's Files tables)
- `src/ui/portal/`: `PortalPage`, `MySeatView`, `SeatCard`, `MyRequestsPanel`, `MyRequestRow`, `MyDevicesView`, `MyDevicesTiles`, `MyDevicesTable` (`TABLE_*` from `../table`, `min-w-240`, `min-h-control` select), `ProfileTab`, `ProfileTabView`, `PersonalInfoCard`, `MembershipCard`, `ProfilePhotoSection` (kit `Button` for Remove, `field-box` file picker), `PixelLookPicker` (`pixel-primary`, `outline-focus`, no opacity), `LookStage` (`bg-tile`), `LookPreview` (`bg-divider`). Class strings only; no prop, handler, id, `aria-*`, copy change.
- `scripts/check-tokens.pending.json`: the 5 portal keys removed.
- Tests: `src/ui/screen-tokens.test.ts` (`MIGRATED` +20, kit-Button list +1, shared-table list +1, new "portal character picker uses pixel tokens"); `SeatCard`, `MySeatView`, `MyDevicesTable`, `PixelLookPicker`, `ProfilePhotoSection`, `MyRequestRow`, `MyDevicesTiles`, `LookStage` tests; `src/ui/checkin/CheckinPopup.test.tsx` (6a nit: dead `.replace` calls dropped).

### Pending before/after
5 keys removed (MyDevicesTable 3, PixelLookPicker 3, ProfilePhotoSection 2, ProfileTabView 1, SeatCard 1 = 10 violations). Total 93 -> 83, 16 -> 11 keys (`check-tokens: 11 files, no violations`). Legacy lines in non-test portal `.tsx`: 93 -> 0 (plan `rg` scan: no hits).

### Visible differences
As listed in the plan's "Visible differences to log (slice 6b)".

### Checks
- `pnpm format:check`: pass ("All matched files use the correct format")
- `pnpm typecheck`: pass
- `pnpm check:layers`: `1032 files, no violations`
- `pnpm test`: exit 0, 398 passed | 1 skipped files; 3961 passed | 7 skipped tests
- `pnpm build`: pass (exit 0)
- `node scripts/check-tokens.mjs`: `11 files, no violations outside the pending list`

### Out-of-plan files / Follow-ups
None.

### Scope self-check
Only the 6b Files tables, tests, pending and this log; `src/ui/copy`, `src/lib`, `src/app`, `src/ui/portal/*.ts` untouched.

## Slice 6c (attempt 1)
Roomlayout chrome and map items on the Simap tokens, per "Slice 6c addendum"; defaults taken for Q-S6c-1..17. One PR, no 6d (diff 331 insertions, 174 deletions, about 505 changed lines, under the 600 threshold).

### Files touched (all in the plan's Files tables)
- `src/ui/roomlayout/`: `RoomMap`, `RoomMapSection`, `ZoomControl`, `SeatOverlay`, `LayoutEditorPage`, `LayoutEditor`, `EditorToolbar`, `EditorViews`, `EditorWarnings`, `EditorCanvas`, `GestureOverlay`, `Palette`, `EditorInspector`, `ShortcutList`. Class strings only; no prop, handler, id, `aria-*`, copy change. `WalkLayer` added to `MIGRATED` only.
- `src/ui/mapItems/`: `MapItemsView`, `MapItemCard`, `MapItemEditor` (close is the kit `IconButton`, Save `variant="pixel"`, kit dialog classes), `MapItemEditorAppearance` (`Radios` options are kit outlined `Button`s), `MapItemEditorDetails` (reset confirm `variant="pixel"`), `SpriteBrowser`. `MapItemsPage`, `FramePreview` added to `MIGRATED` only.
- `src/ui/portal/PersonalInfoCard.tsx`: 6b nit (class order).
- `scripts/check-tokens.pending.json`: the 10 keys removed; only `src/app/globals.css` (32) remains.
- Tests: `src/ui/screen-tokens.test.ts` (`MIGRATED` +23, kit-Button list +7, new "map, editor and map items chrome" test), `src/lib/color/tokens.test.ts` (2 pairs), `RoomMap`, `SeatOverlay`, `LayoutEditorViews`, `EditorWarnings`, `MapItemCard`, `MapItemEditor`, `MapItemEditorAppearance`, `MapItemEditorDetails`, `SpriteBrowser` tests.

### Pending and legacy lines before/after
Pending: 11 keys / 83 violations -> 1 key / 32 (`check-tokens: 1 files, no violations outside the pending list`). Legacy lines in non-test `.tsx` of roomlayout and mapItems: 131 -> 0 (plan `rg` scan: only the intended `rounded-full` pills/dots remain; no other hit).

### Build-output check (Approach 5)
After `pnpm build`, the built CSS contains `max-w-145` (`calc(var(--spacing) * 145)`), `grid-cols-[minmax(0,1fr)_--spacing(72)]` (compiled to `minmax(0,1fr) calc(var(--spacing) * 72)`), `w-[calc(100%-var(--space-6))]`, `bg-text-primary/20` (color-mix), `before:h-control`, `aria-checked:border-pixel-primary`, `has-[:checked]:border-pixel-primary`, `text-text-pixel`, `outline-focus`. No fallback was needed.

### Deviation in a test file
`screen-tokens.test.ts` `OTHER` regex: `focus-visible:` became `(?<![\w-])focus-visible:`. The kept `group-focus-visible:flex` on the seat hover tags (shows the tag on keyboard focus, no colour) otherwise matched the per-component focus rule. The plan's own `rg` for S6c-5 has the same hit on `SeatOverlay.tsx:165-166`; only that substring is exempt.

### Visible differences
As listed in the plan's "Visible differences to log (slice 6c)".

### Checks
- `pnpm format:check`: pass
- `pnpm typecheck`: pass
- `pnpm check:layers`: `1032 files, no violations`
- `pnpm test`: exit 0, 398 passed | 1 skipped files; 3967 passed | 7 skipped tests
- `pnpm build`: pass (exit 0)
- `node scripts/check-tokens.mjs`: `1 files, no violations outside the pending list`

### Out-of-plan files / Follow-ups
None out of plan. Follow-up: S6c-5's `rg` in the plan should exclude `group-focus-visible:` (see Deviation).

### Scope self-check
Only the 6c Files tables, tests, pending and this log; `src/ui/copy`, `src/lib` (except `tokens.test.ts`), `src/app`, `*.ts` in roomlayout/mapItems untouched.

## Slice 6c (attempt 2)
REWORK of the review "Slice 6c (attempt 1)": Issue 1 (blocker) and the formatting nits only.

### Files touched
- `src/ui/screen-tokens.test.ts`: required because Issue 1. `OTHER` is now `/opacity-60|(?<!group-)focus-visible:|group-focus-visible:(?!flex(?![\w-]))|focus-within:/`. It exempts only `group-focus-visible:flex`. New test "the focus guard exempts only group-focus-visible:flex" allows `group-focus-visible:flex` and `has-[:focus-visible]:outline-focus`. It rejects `focus-visible:ring-2`, `peer-focus-visible:`, `group-focus-visible:ring-2`, `in-focus-visible:`, `md:focus-visible:` and `group-focus-visible:flex-col`.
- `src/ui/mapItems/MapItemEditor.tsx`, `MapItemEditorAppearance.tsx`, `MapItemEditorDetails.tsx`: required because the nit. Deleted the five empty lines inside JSX attribute lists.
- `src/ui/roomlayout/Palette.tsx`: required because the nit. The `border-l-4 border-transparent aria-pressed:border-pixel-primary` classes now sit before the transition string, as in the other rows.

### Deviation note (updated)
The earlier note that widened `OTHER` to `(?<![\w-])focus-visible:` is superseded. The guard now exempts only `group-focus-visible:flex` (SeatOverlay.tsx:165-166); every other per-component focus class still fails.

### Checks
- `pnpm format:check`: exit 0
- `pnpm typecheck`: exit 0
- `pnpm check:layers`: `1032 files, no violations`
- `pnpm test`: exit 0, 398 passed | 1 skipped files; 3968 passed | 7 skipped tests
- `pnpm build`: exit 0
- `node scripts/check-tokens.mjs`: `1 files, no violations outside the pending list`

### Out-of-plan files / Follow-ups
None.

### Scope self-check
Only the review's Issue 1 and the listed nits.
