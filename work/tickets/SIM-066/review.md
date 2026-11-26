## Attempt 1 — 2026-11-26
Verdict: PASS

Scope: slice 1 per plan.md (slice 2 "Pixel character card visuals" is the proposed follow-up SIM-066.1). Plan approved with defaults (ticket Notes, batch 2026-11-26-7).

### Checks (run by reviewer)
- `pnpm format:check`: exit 0, "All matched files use the correct format." (1023 files)
- `pnpm typecheck`: exit 0 (route types generated, tsc clean)
- `pnpm check:layers`: exit 0, "check-layers: 968 files, no violations"
- `pnpm test`: exit 0, "Test Files 366 passed | 1 skipped (367)", "Tests 3569 passed | 7 skipped (3576)"
- `pnpm build`: exit 0
- `pnpm test:db`: CI-only; no DB or server change in this diff.

These match the impl-log numbers.

### Acceptance criteria
- [x] 1. Tab bar has icons, an accent underline and a "You" chip, and keeps the tab roles, arrow keys, `?tab=` and badges. Evidence: `src/ui/TabBar.tsx` (roles, roving tabIndex and `nextTabIndex` carried over unchanged from the old `PortalTabs`; selected tab gets `border-primary text-primary`; the chip is an `aria-hidden` Pill). `PortalTabs.test.tsx`: the original test is unchanged and a new icons/chip/selected test was added. `layout-blocks.test.tsx › TabBar` (x2). `portal-state.ts` re-exports `nextTabIndex` from `src/ui/tab-keys.ts` with the same body. The diff does not touch `PortalPage.tsx`, `AppShell*` or the badge hooks. All tests green.
- [x] 2. Layout: header, left cards and right character card; one column below lg. Evidence: `ProfileTabView.tsx` (`grid grid-cols-1 lg:grid-cols-2`) and `ProfileTabView.test.tsx › renders the header and the three cards in order inside a 1-col / lg:2-col grid`. The visual check is listed for Ming below.
- [x] 3. Display name keeps its validation and limit, has a live counter, and email and role are read-only. Evidence: `ProfileTab.tsx` saveAll calls the unchanged `validateProfileName` before any request. `DISPLAY_NAME_MAX` is unchanged and `maxLength` is kept. `profile-draft.test.ts › nameLength counts NFC code points` (Vietnamese NFD case). `ProfileTabView.test.tsx` covers the counter/required marker, the readOnly email with the managed hint, and the role badge for every tier.
- [x] 4. Only preset values, a live front/back preview, and Reset goes back to the derived look. Evidence: `PixelLookPicker.test.tsx` (radios from the ramps, four previews, "Reset character" disabled when `!canReset` or locked). `pixel-look-state.test.ts › resetDraft`, `lookSaveAction "reset"`. `usePixelLook.persist` sends `api.reset()` (DELETE) for the reset action.
- [x] 5. Cancel discards edits, Save changes uses the existing APIs, the footer shows the state, and nothing goes to browser storage. Evidence: `pixel-look-state.test.ts › discard / lookDirty / lookSaveAction`, `profile-draft.test.ts › footerStatus`, `ProfileTabView.test.tsx › footer …`. The only calls are `PATCH /api/me` (`profilePatchInit`) and `createPixelLookApi` save/reset. `grep -rn "localStorage|sessionStorage" src/ui/portal` finds nothing.
- [x] 6. Tests cover the tab bar, the layout regions and save/cancel state. Every test in the plan's "Tests to write" table exists under its planned name (checked with grep) and passes.

### Ming verification after merge
- Check the layout at 1280 px and 390 px in the light and dark themes: accent underline and text contrast, the "You" chip, the cards, the footer, and that the tab bar does not overflow at 390 px.
- Do a real save round trip (`pnpm dev` with the dev token): edit the name and the character → Save changes → reload. Then Cancel. Then Reset character → Save changes → check the room map shows the derived look.

### Issues
None.

### Rules (CLAUDE.md)
No violations found.
- R1: all changes are in `src/ui/**` and `src/lib/icons.ts`, and check:layers is clean.
- R3/R6/R7: no server, env or route changes.
- R4: all 29 changed source files are in the plan's file list. `ProfilePhotoSection.test.tsx` was listed as conditional and its change is justified in the impl-log.
- R5: checks are green and the new logic has tests.
- D36: copy is in `src/ui/copy/portal.ts` and no-literals passes.

### Blockers from review agents
None.

### Nits (do not block)
- `src/ui/portal/usePixelLook.ts:26`: `useAtlas()` runs even when `memberId` is null, which loads the sprite atlas the character card never shows. The old `PixelLookSection` mounted only with a member id.
- `src/ui/SectionCard.tsx:31-32`: the `<section aria-labelledby>` sits inside `Card`'s div instead of being `Card as="section"` as the plan said. The impl-log records this (Card takes no aria props). The accessible result is the same.
- `src/ui/portal/ProfileTab.tsx` saveAll ignores `persist()`'s return value and reads errors from `look.state.notice` instead. This works, but the returned value is unused.
- No render or interaction test covers the `ProfileForm` orchestration itself (partial failure: name fails and look succeeds, or the reverse). The plan did not require one, and the pure helpers it builds on are tested.

### Follow-ups (out of scope)
- Slice 2, SIM-066.1 (stage, Front/Back toggle, hairstyle cards, swatch check marks; open questions Q-A and Q-B).
- Warn about unsaved changes when switching tabs (plan assumption 7).
- A container-level test of `ProfileForm` save/cancel with mocked `apiFetch` (partial-failure paths).

### Blockers from review agents
- None (no review trigger matched: no security area, no trigger paths).
