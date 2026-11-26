## Attempt 1 — 2026-11-26 (slice 1)

### Files touched
| File | Required because |
|---|---|
| src/lib/icons.ts | six mockup icons, kept sorted |
| src/ui/tab-keys.ts, TabBar.tsx, PageHeader.tsx, SectionCard.tsx, FormFooterBar.tsx (new) | shared kit blocks per plan |
| src/ui/Chip.tsx, FilledInput.tsx, index.ts | `Pill`, `trailingIcon`, barrel exports |
| src/ui/portal/portal-state.ts, PortalTabs.tsx | re-export `nextTabIndex`, `PORTAL_TAB_ICONS`; thin TabBar wrapper |
| src/ui/portal/profile-draft.ts (new) | `nameLength`, `nameDirty`, `footerStatus` |
| src/ui/portal/pixel-look-state.ts | `lookDirty`, `lookSaveAction`, `resetDraft`, `discard`, new `canReset`; `canSave` removed; success notices null |
| src/ui/portal/usePixelLook.ts (new), PixelLookSection.tsx (deleted) | hook with GET/PUT/DELETE and `persist()` |
| src/ui/portal/ProfileTab.tsx, ProfileTabView.tsx, PersonalInfoCard.tsx, MembershipCard.tsx | single Save/Cancel container, pure layout, two cards |
| src/ui/portal/ProfilePhotoSection.tsx, PixelLookPicker.tsx | restyle; picker inside SectionCard, Save removed |
| src/ui/copy/portal.ts | new keys; unused keys removed |
| tests: layout-blocks, PortalTabs, profile-draft, pixel-look-state, PixelLookPicker, ProfileTabView, ProfilePhotoSection | R5 |

### Tests added / changed
- layout-blocks.test.tsx (TabBar x2, PageHeader, SectionCard, Pill, FormFooterBar), PortalTabs.test.tsx (icons/chip/selected), profile-draft.test.ts (3), pixel-look-state.test.ts (lookDirty, lookSaveAction, resetDraft, discard, canReset, afterSave/afterReset), PixelLookPicker.test.tsx (updated), ProfileTabView.test.tsx (rewritten, 6).
- Pill accent tone uses existing tokens `bg-primary-container text-on-primary-container`; neutral `bg-surface-high text-on-surface-variant`; success `bg-tertiary-container text-on-tertiary-container` (all exist in globals.css).

### Checks (actual output summary)
- format:check: All matched files use the correct format.
- typecheck: clean. check:layers: 968 files, no violations.
- test: 366 files passed, 1 skipped; 3569 passed, 7 skipped.
- build: exit 0.
- `rg localStorage|sessionStorage src/ui/portal`: nothing.

### Out-of-plan files
None. (ProfilePhotoSection.test.tsx was in the plan as conditional: its label regex needed to allow the new upload icon span.)

### Follow-ups (noticed, not done)
- `profile.saved` copy key is kept: `profileOutcome` in portal-state.ts (and its test) still uses it, so it is not unused.
- SectionCard wraps a `<section aria-labelledby>` inside `Card` (div) because `Card` does not accept aria props; changing `Card` was out of plan.
- Photo-section upload failure/notice text and the look save error (shown in the footer) are unchanged in behaviour; no warning on tab switch with unsaved edits (plan follow-up).
- Slice 2 (SIM-066.1) not started.

### Scope self-check
- Could the diff be smaller? No.
- Diff size: see git diff --stat.
