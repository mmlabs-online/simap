## Attempt 1 — 2026-11-27 (SLICE 1 of 7: tokens foundation)
Verdict: PASS

Scope of this review: slice 1 only, judged against plan.md "Files to create / modify (slice 1)", "Tests to write
(slice 1)", "Approach (slice 1)" and the slice-1 rows of the AC table. Plan approved with defaults Q1–Q17
(ticket.md Notes, 2026-11-27).

### Checks (run by reviewer)
All run on HEAD 6d8556b (includes the final layout.tsx change), clean working tree.
- `pnpm format:check` — exit 0 ("Finished in 85ms on 1064 files").
- `pnpm typecheck` — exit 0 ("Types generated successfully", tsc clean).
- `pnpm check:layers` — exit 0 ("check-layers: 1009 files, no violations").
- `pnpm test` (full) — exit 0: "Test Files 386 passed | 1 skipped (387); Tests 3779 passed | 7 skipped (3786)". Matches impl-log.
- `pnpm build` — exit 0. Built CSS (`.next/static/chunks/3uymp3y6mxi4t.css`): `.bg-canvas{background-color:var(--color-canvas)}`, `.shadow-card{box-shadow:var(--shadow-card)}`, `.text-h2{font-size:var(--text-display);line-height:var(--text-display--line-height)}`, `--breakpoint-md:800px`, `--text-display--line-height:40px`, `[data-theme=dark]{--color-workspace-primary:…}` block present, media queries at 800/1024/1280 (no 768), reduced-motion block `transition:none!important;animation:none!important`, `--font-dm-sans:"DM Sans"`, no "manrope". `@theme static` is supported (Tailwind 4.3).
- `pnpm test:db` — CI-only; slice touches no DB code.

### Acceptance criteria (slice 1 rows)
- [x] AC 1 tokens.css defines every brief token once (light) + dark value per colour token; `@theme` maps them — evidence: `src/lib/color/tokens.test.ts` › "defines every brief token exactly once (light)" and "every --color-* token has a value in dark…" green; `grep -c -- "--color-canvas"` on built CSS = 1 file; `@theme inline` collision guard green (`--color-surface` removed from inline block, globals.css).
- [x] AC 3 (slice-1 part: focus ring) — tokens.test.ts › "focus ring uses --color-focus, 2px, with an offset"; focus 3:1 on canvas/surface/cream/tile both themes asserted; `.px-card` filled focus re-pointed to `--color-focus` (globals.css:417-420).
- [x] AC 4 (CSS part) — tokens.test.ts › "reduced-motion block sets animation and transition to none"; built CSS confirms. Canvas check recorded in impl-log (only WalkLayer, already gated; EditorCanvas one-shot). `idle.test.ts` / `walk.test.ts` green in the full run.
- [x] AC 5 — `rg -n -i manrope src` → no hits; `git diff origin/main...HEAD -- package.json pnpm-lock.yaml` empty; `layout.tsx` imports `Fraunces, DM_Sans` only. `vietnamese` subset fallback verified as forced: next/font types give `DM_Sans` `subsets?: Array<'latin' | 'latin-ext'>` (Q9 default fallback, comment in layout.tsx:10-11).
- [x] AC 6 — tokens.test.ts › "light pairs pass AA (text 4.5:1)" / "dark pairs pass AA", plus non-text 3:1 (focus, border-strong); pair table matches the plan's list (text-primary/secondary on canvas/surface, text-pixel on cream/tile, on-action on action/action-hover/pixel/pixel-hover, 4 feedback colours on surface/canvas/own tint). Coral `--color-workspace-primary` correctly not asserted for text (Q1).
- [x] AC 6b (slice-1 part) — full `pnpm test` green with no existing test changed; impl-log has "Visible differences (slice 1)" matching plan Approach 6; viewport checks are Ming's.
- [x] Breakpoints drift guard — `src/lib/breakpoints.test.ts` green; SignInScene uses `MEDIA.md` (800, matches `md:block`), SmallWorld `MEDIA.xl`, LayoutEditorPage `MEDIA.lg` (same strings as before).
- [x] Contrast helper unit tests — `src/lib/color/contrast.test.ts` (parser, formula, Q1 numbers, mixSrgb) green.

Ming verification after merge (carry to the PR): open the app light and dark at 390 / 800 / 1024 / 1280 px, tab
through one screen, toggle OS reduced motion; font is DM Sans and "Nguyễn Thị Ngọc Ánh" renders without odd glyphs
(latin-ext only, per-glyph fallback accepted under Q9); page background is the new canvas; focus ring is green;
sign-in vignette appears from 800 px (was 768).

### Issues
None.

### Scope
Changed code files = exactly the plan's slice-1 list (tokens.css, globals.css, layout.tsx, contrast.ts/.test.ts,
tokens.test.ts, breakpoints.ts/.test.ts, SignInScene.tsx, SmallWorld.tsx, LayoutEditorPage.tsx). Other changes are
workflow files (`work/ming-todo.md` M-95, ticket/plan/consult/impl-log). No High path touched. Deviations recorded in
impl-log and acceptable: `--color-border-strong` `#889282` instead of `#8A9484` (plan value measured 2.998:1 on
canvas; the test caught it, Q6 intent kept); DM Sans without `vietnamese` (plan's stated fallback). Removed legacy
variables (`--focus-ring`, `--text-hero/-h2/-small`, `.text-hero`, `--font-manrope`) have no remaining users
(`rg` over `src` and `docs`: no hits). `data-theme` is set only on `<html>`, so the legacy `:root` aliases resolve
against the dark tokens correctly.

### Rules (CLAUDE.md)
No violations found. R1: new lib files import nothing outside lib; ui imports `@/lib/breakpoints` (check:layers
clean). R3: no env/secrets. R4: within plan. R5: checks green, new logic (contrast helpers, token invariants,
breakpoints) has tests. R2/R6/R7 not touched.

### Blockers from review agents
None.

### Nits (do not block)
- `SignInScene.tsx:8`, `SmallWorld.tsx:25`, `LayoutEditorPage.tsx:21`: the `@/lib/breakpoints` import sits after the relative imports, while other `@/` imports in these files come first. Cosmetic.
- `tokens.css` dark block repeats the light values for workspace-primary/hover/action/on-action (Q5 says "= light values"); needed only so the dark-coverage test passes. Fine, but a comment on that line would save a later reader a question.
- Plan Q6 said `#8A9484` gives about 3.2:1; it measures 2.998:1 on canvas. The test caught it, so the plan's number was wrong, not the code.

### Follow-ups (out of scope)
- `--accent-shadow` and `--field-focus` still derive from `--accent-orange` (impl-log); removal belongs to slices 3/7.
- Left for later slices (per plan Split proposal), so not part of this verdict: AC 1b token grep guard and pending list (slice 2, emptied in slice 7); AC 2 coral/pixel-green button variants and component mapping (slices 3, 6); AC 3 44 px targets, `text-label`/`text-caption`, no 13 px text, weight snap Q7/Q8 (slices 3–6); sidebar Q3 (slice 4); management sweep (slice 5); pixel surfaces, `.aw-*`/`.px-*` re-point, Hero/Display headline Q10, `world-palette.test.ts` replacement (slice 6); removal of the compat alias layer and `--px-*` move into tokens.css, final brief self-check (slice 7).

### Blockers from review agents
- None (no review trigger matched).

## Slice 2 — Attempt 1
Verdict: PASS

### Checks (run by reviewer)
- format:check pass; typecheck pass; check:layers `1009 files, no violations`; build pass.
- `pnpm test`: `387 passed | 1 skipped (388) files; 3794 passed | 7 skipped (3801)`; `scripts/check-tokens.test.ts` 15/15. Matches impl-log.
- Mutations (restored afterwards, tree clean): `bg-[#fff]` appended to non-pending `src/ui/AppShell.tsx` fails the repo test ("now 1, pending 0"); `p-7` in pending `src/ui/Chip.tsx` fails ("now 17, pending 16"); raising `Avatar.tsx` pending 1 to 2 (an unrecorded shrink) fails.

### Acceptance (S2-1..S2-6)
| # | Result | Evidence |
|---|---|---|
| S2-1 | Met | RULES in `scripts/check-tokens.mjs:29-84` equal the plan table (all 14 rule ids, same regexes except hex); rules tests green, including `text-[13px]` flagged |
| S2-2 | Met | `ALLOWLIST` `check-tokens.mjs:11-20` is exactly the five plan entries, each with a reason; allowlist tests green; Avatar/SeatOverlay not allowlisted |
| S2-3 | Met | the three mutations above |
| S2-4 | Met | diff against origin/main has no `package.json`, `CLAUDE.md`, `.claude/loop.config.md` change; test is in the `pnpm test` run |
| S2-5 | Met | changed files: the 3 new scripts files plus work/ files (impl-log, ticket state, plan); no `src/` change |
| S2-6 | Met | see Checks |

### Hex deviation: accepted
The plan regex `(?=[0-9a-fA-F]*\d)` could not flag `#fff`/`#FFFF`, which the plan's own test list requires, and would miss `"#ffffff"` in Avatar.tsx. The implementer's version (6/8 digits always; 3/4 digits need a digit or one repeated letter) satisfies every listed case (`#bad`, `&#123;`, `#12`, `#12345` pass; `#fff`, `#FFFF`, `#ed5b35`, `#ED5B35AA` flag) and is recorded in impl-log. Residual false negative: 3/4-letter non-repeating colours such as `#abc` or `#bad` used as a real colour are not caught (indistinguishable from anchors); acceptable.

### Rules (CLAUDE.md)
No violations. R1 (no `src/` imports from scripts), R3, R4 (only planned files), R5 (guard tested). R2/R6/R7 not touched.

### Blockers
None.

### Should-fix / nits (do not block)
- 💭 `check-tokens.test.ts:16-18` reads the pending file with a bare `readFileSync`, so it throws if slice 7 deletes the file; the plan says the test treats a missing file as `{}`. Slice 7 must make that read tolerant (or empty the file instead of deleting it). The CLI already handles ENOENT.
- 💭 `compareToPending` `stale` also lists files with count 0 only because `counts` omits them; fine, but a pending key for an allowlisted file is caught only by the "pending" format test (works).
- 💭 `scanRepo()` runs at module load in the test (outside `it`); a read error would fail the whole file. Cosmetic.

### Ming verification after merge
None (no visible change).

### Follow-ups
- Slice 7: delete the pending file and make the test tolerant of its absence; Q-S2-2 (Avatar `#ffffff`) handled in slice 3.

### Blockers from review agents (slice 2)
- None (no review trigger matched).

## Slice 3 — Attempt 1
Verdict: REWORK

Date: 2026-11-27. Scope: slice 3 (UI kit) only, against plan.md "## Slice 3 addendum — UI kit".

### Checks (run by reviewer)
- `pnpm format:check`: exit 0, "All matched files use the correct format."
- `pnpm typecheck`: exit 0.
- `pnpm check:layers`: exit 0, `check-layers: 1009 files, no violations`.
- `pnpm test`: exit 0, `Test Files 387 passed | 1 skipped (388)`, `Tests 3809 passed | 7 skipped (3816)`. Matches impl-log.
- `pnpm build`: exit 0.
- `node scripts/check-tokens.mjs`: exit 0, `53 files, no violations outside the pending list`.

### Acceptance criteria (S3-1..S3-10)
- [x] S3-1 Button variants. Evidence: `src/ui/Button.tsx` variants map equals Approach 1 (filled `bg-workspace-action text-on-action enabled:hover:bg-workspace-action-hover`, pixel `bg-pixel-primary ... shadow-pixel`, tonal/outlined surface + border, danger tint); kit.test "variants map to brief tokens and keep data-variant" green. `/dev/shell` visual check in light/dark is listed for Ming below.
- [x] S3-2 44 px / 14-12 px / no 700-800. Evidence: plan grep over the 15 kit files returns only `rounded-full` in Avatar.tsx:28,45 and Chip.tsx:113,115 (Pill and dot), exactly as expected; kit/layout-blocks/SegmentedFilter tests assert `min-h-control`/`size-control`.
- [x] S3-3 Fields and focus. Evidence: `EntityFormDialog.tsx` FIELD_BOX and `FilledInput.tsx` use `field-box ... border-border-strong rounded-lg`, no `focus-within:`; globals.css adds `.field-box:focus-within` after the global `:focus-visible` rule and the `@layer base` accent-color rule; tokens.test "field box ring, checkbox accent, state layer and no status-dot" green. Keyboard-tab through the gallery dialog is a Ming check.
- [x] S3-4 Cards/dialog/badges. Evidence: Card.tsx `rounded-xl border border-divider bg-surface shadow-card`; dialog `rounded-2xl bg-surface shadow-dialog max-w-md`; RoleBadge class map per Approach 5, no inline style; Pill tints incl. `info`; corresponding kit/layout-blocks tests green.
- [x] S3-5 No legacy aliases. Evidence: plan grep (`on-surface|outline-variant|surface-high|primary-container|error-container|rounded-md3|field-focus|card-shadow`) over kit files: no hits; kit.test "no legacy alias or weight" green. Avatar default inline values kept on the compat alias per Q-S3-2.
- [x] S3-6 Pending shrink. Evidence: `git diff origin/main...HEAD -- scripts/check-tokens.pending.json` shows only the 11 kit keys removed and `src/app/globals.css` 69 -> 65; guard exits 0.
- [x] S3-7 No caller API change. Evidence: typecheck green; only additions `pixel`/`info`, IconButton `size` removed (no caller passes it: `rg` for `IconButton` with `size=` has no hits). Diff stat lists only Files-table files plus the one out-of-plan test (judged below) and work/ files.
- [x] S3-8 Contrast. Evidence: 4 new `NON_TEXT_PAIRS` in `src/lib/color/tokens.test.ts`, suite green.
- [ ] S3-9 Checks green; existing tests changed only for class strings. Checks are green, but the DecisionDialog.test.tsx edit is not a class-string update: it turned an assertion vacuous. See Issue 1.
- [x] S3-10 impl-log "Slice 3" has files, rename map, pending before/after, visible differences, built-CSS confirmations and checks. (Its claim "Assertion intent unchanged" for DecisionDialog.test is wrong; see Issue 1.)

### Out-of-plan test edit (DecisionDialog.test.tsx): not accepted as written
Touching the test is justified (plan allows tests whose asserted kit markup changed, and the kit Button now emits `class` before `disabled`). The new regex is not: `/<button type="submit"[^>]*disabled/` matches the class token `disabled:cursor-not-allowed` that every kit Button now carries, so it passes whether or not the button is disabled. Reviewer probe (temporary test file, removed, tree clean): `renderToStaticMarkup(<Button type="submit">Save</Button>)` with no `disabled` prop MATCHES the regex. The test named "...disables submit" therefore no longer checks that DecisionDialog passes `submitting` through.

### Issues
#### Issue 1 — 🔴 blocker — vacuous test assertion (R5)
- **Where**: `src/ui/requests/DecisionDialog.test.tsx:76`
- **Expected**: the assertion fails when the submit button is not disabled.
- **Actual**: `/<button type="submit"[^>]*disabled/` also matches `class="... disabled:cursor-not-allowed ..."`, so it always passes.
- **Fix instruction**: change it to `expect(html).toMatch(/<button type="submit"[^>]*disabled=""/);` (same form as `src/ui/kit.test.tsx:204`). Optionally also assert `render(target(), { submitting: false })` does not match it. Correct the impl-log "Out-of-plan files" note accordingly.

#### Issue 2 — 🟡 should-fix — Button disabled-hover test weaker than the plan
- **Where**: `src/ui/kit.test.tsx:112-114`
- **Expected** (plan Tests table, "Button disabled"): every class token containing `hover:` starts with `enabled:`, for every variant.
- **Actual**: the loop covers only `filled, pixel, tonal, text` (omits `outlined`, `danger`) and accepts `c.startsWith("enabled:") || c.startsWith("hover:")`, so a bare `hover:` class (which would style disabled buttons) passes for every variant except `filled` (line 115).
- **Fix instruction**: loop over all six variants and assert `expect(c.startsWith("enabled:")).toBe(true)`; drop the `|| c.startsWith("hover:")` branch. Also apply the same check to IconButton (inactive state uses `enabled:hover:*`). The current code already satisfies the stricter test.

### Rules (CLAUDE.md)
- R5: Issue 1 (a changed test no longer tests its behaviour).
- R1: no violations (`check:layers` clean; edits in ui/pages/lib only, KitGallery imports `@/ui`). R3, R4: no violations (only planned files plus the one justified-in-principle test file). R2/R6/R7 not touched.

### Blockers from review agents
- None (no review trigger matched).

### Nits (do not block)
- 💭 `src/ui/PageSkeleton.tsx:17` and `KitGallery.tsx` h1 keep `text-h2` (plan only asked for the weight/colour change, so in-plan); slices 4-7 should map it to `text-display`/`text-title` per Q16.
- 💭 `DialogSelect` input gained `placeholder:text-text-secondary`, which has no effect on a `<select>`. Harmless.
- 💭 FilterChips with `min-h-control` chips plus `p-1` give a ~54 px track; fine for targets, worth a look in Ming's visual pass.

### Ming verification after merge
- Open `/dev/shell` and two management screens (Members, Devices) at 390 / 800 / 1280 px in light and dark; check coral filled buttons, pixel button, 44 px row actions, a dialog with keyboard focus (one ring per field box, none doubled), checkbox fill, badges and pills.

### Follow-ups (out of scope)
- Q-S3-1: merge `tonal`/`outlined` (now identical) in a later slice.
- Q-S3-2: Avatar default background/colour off the compat alias in slice 7.

## Slice 3 — Attempt 2
Verdict: PASS

Date: 2026-11-27. Scope: rework of Issues 1 and 2 from "Slice 3 — Attempt 1" (commit c133bee); the rest of slice 3 was accepted in attempt 1 and is unchanged.

### Checks (run by reviewer)
- `pnpm format:check`, `pnpm typecheck`, `pnpm check:layers` (1009 files, no violations), `pnpm test`, `pnpm build`: all exit 0.
- `node scripts/check-tokens.mjs`: exit 0, `53 files, no violations outside the pending list`.

### Issue resolution
- Issue 1 (blocker): `DecisionDialog.test.tsx:76` now matches `disabled=""`, same form as `kit.test.tsx:204`; it no longer matches the `disabled:cursor-not-allowed` class. Resolved.
- Issue 2 (should-fix): `kit.test.tsx` Button loop covers all six variants and asserts `startsWith("enabled:")` only; new IconButton test covers active and inactive. Resolved.
- Diff of c133bee touches only those two test files plus impl-log; no scope issue. No rule violations (R1-R7).

### Ming verification after merge
- Unchanged from attempt 1: `/dev/shell` plus Members and Devices at 390 / 800 / 1280 px, light and dark.

### Follow-ups
- Unchanged (Q-S3-1, Q-S3-2).

### Blockers from review agents (slice 3)
- None (no review trigger matched).

## Slice 4 — Attempt 1
Verdict: PASS

Date: 2026-11-27. Scope: slice 4 (shell, sidebar, page containers), commit 05a29b1 against plan.md "Slice 4 addendum" S4-1..S4-10.

### Checks (run by reviewer)
- `pnpm format:check`: exit 0, "All matched files use the correct format".
- `pnpm typecheck`: exit 0. `pnpm check:layers`: exit 0, "1027 files, no violations".
- `pnpm test`: exit 0, "396 passed | 1 skipped (397)" files, "3867 passed | 7 skipped (3874)" tests (matches impl-log).
- `pnpm build`: exit 0.
- `node scripts/check-tokens.mjs`: exit 0, "52 files, no violations outside the pending list"; `--list` has no `AppShellView.tsx` entry.

### Acceptance criteria
- [x] S4-1 Sidebar from 800 replaces the rail. Evidence: test "sidebar from md, no lg: classes in the nav"; `rg "88px|lg:w-|lg:flex-col|useState" src/ui/AppShellView.tsx` returns no hits; no collapse state; built CSS contains `.md\:w-sidebar`.
- [x] S4-2 Selected entry is explicit. Evidence: test "active entry has one indicator inside its link" (admin `/rooms/A1` → `/rooms`, user `/` → `/`; `aria-hidden`, `bg-workspace-primary`); link has `aria-[current=page]:bg-canvas font-semibold`, icon `filled={active}`; slice-3 contrast tests green.
- [x] S4-3 Targets of at least 44 px and the type scale. Evidence: nav links `md:min-h-control`/`min-h-16`, Credits `min-h-control min-w-control`, skip link `focus:min-h-control`, select `min-h-control` (AppShellView and RoomSwitcher tests); `rg "text-\[" AppShellView.tsx RoomSwitcher.tsx` returns no hits.
- [x] S4-4 Tokens only. Evidence: test "uses tokens only" (6 renders: LEGACY, PALETTE, 700/800, arbitrary text/rounded/shadow/tracking/leading, arbitrary px); brand-mark `style` removed (diff); pending key gone.
- [x] S4-5 Page container. Evidence: `page-container.test.ts`, tokens.test "page containers cap the width…"; built CSS: `.page-content{width:100%;max-width:var(--width-content);padding:var(--space-4);margin-inline:auto}` plus `@media (min-width:800px){.page-content{padding:var(--space-6)}` and `@media (min-width:1280px){.page-content{padding-inline:var(--space-8)}`; the same for `.page-library` with `--width-library`.
- [x] S4-6 No behaviour change. Evidence: the earlier AppShellView/RoomSwitcher tests are unchanged apart from the 3 dev-badge class asserts; `git diff origin/main...HEAD -- src/ui/copy src/lib` touches only `tokens.test.ts` (planned test); `git diff -U0` of the 20 feature files, PageSkeleton and KitGallery shows only `p-4 lg:p-6` → `page-content`/`page-library` (CreditsPage and LayoutEditorPage put the container first, other classes kept); library/content split matches Q-S4-1. `rg "p-4 lg:p-6" src` finds only the test's own literal.
- [x] S4-7 Pending: one key removed (`src/ui/AppShellView.tsx: 32`); check-tokens exits 0; globals.css stays 65.
- [x] S4-8 Width table recorded (computed, not measured in a browser; stated honestly and moved to Ming's verification). `git diff --stat` shows only files from the Files table plus work files.
- [x] S4-9 Checks green; the test diffs are class-string updates plus new tests.
- [x] S4-10 impl-log "Slice 4" has files, rename map, pending, built CSS, width table, visible differences and checks.

Note: the plan's "31 lines" for the wrapper swaps is a plan miscount; its own table lists 29, and the diff swaps all 29 with zero left over.

### Recorded deviation: nav `style=` assertion (accepted)
The plan asks that "the `<nav>` markup has no `style=`". The test asserts no `style` that contains `background`/`color`. Reason: the kit `Icon` (`src/ui/Icon.tsx:27`) always sets `style={{ fontSize: size }}`, and the plan keeps the `Icon` call unchanged, so a blanket ban cannot pass without changing the kit outside the plan. The narrowed assertion still catches the brand-mark inline fill this slice removed. Accepted. A tighter form is in Nits.

### Issues
None blocking. One 🟡 test-strength gap, carried forward rather than reworked because the criterion is met today (rg: zero hits) and slice 5 edits these same files.
- `src/ui/page-container.test.ts:35-37`: the plan asks for a scan of every non-test `.tsx` under `src/ui` and `src/app` for `p-4 lg:p-6`. The test checks only the 23 listed files, so a new page with the old padding would not fail. Slice 5 should replace it with a recursive scan (`readdirSync(..., { recursive: true })`, filter `.tsx` and not `.test.`).

### Rules (CLAUDE.md)
No violations found. R1: check:layers clean, no new imports. R3: none. R4: only planned files. R5: new tests cover the shell, select, containers and the globals rule. R2/R6/R7 not touched.

### Blockers from review agents
None (no review trigger matched).

### Nits (do not block)
- 💭 `AppShellView.test.tsx` "sidebar from md": `expect(classesOf(html, /<\/?div/)).toBeDefined()` and `expect(nav).toBeDefined()` are always true (dead asserts); drop them.
- 💭 "header controls" test does not assert the version span's `text-caption` (plan row lists it).
- 💭 The nav `style=` assertion could be stricter: every `style="…"` inside `<nav>` matches `^font-size:\d+px;?$`.

### Ming verification after merge
- As in the plan's "Ming verification after merge (slice 4)": Admin at 390 / 800 / 1023 / 1024 / 1280 px, light and dark (bottom bar below 800, sidebar from 800, all 11 entries reachable, clear active entry, readable badges); skip link on the first Tab; room map and layout editor at 1024 (456 px canvas column, Q-S4-4); Devices and My Portal at 800; a monitor of at least 1600 px (1320 / 1600 caps); dev and prod token badges with `pnpm dev`.
- The width table in impl-log was computed, not measured. Ming's browser pass is the real check.

### Follow-ups (out of scope)
- Slice 5: recursive `p-4 lg:p-6` scan in `page-container.test.ts` (see Issues).
- Possibly cramped layouts named in the impl-log width table (`md:` device cards/tables at 800, `CheckinView` `1fr 300px` at 1024): slices 5/6 if Ming confirms.

### Blockers from review agents (slice 4)
- None (no review trigger matched).

## Slice 5a — Attempt 1
Verdict: PASS

Date: 2026-11-27. Scope: slice 5a (Members + invitations, Groups, Approvals, Audit, Credits, Org), commit eac0b23 against plan.md "Slice 5 addendum — Management screens" (rules R-a..R-h, 5a Files table, S5a-1..S5a-10).

### Checks (run by reviewer)
- `pnpm format:check`: exit 0, "All matched files use the correct format".
- `pnpm typecheck`: exit 0. `pnpm check:layers`: exit 0, "1029 files, no violations".
- `pnpm test`: exit 0, "397 passed | 1 skipped (398)" files, "3874 passed | 7 skipped (3881)" tests (matches impl-log).
- `pnpm build`: exit 0.
- `node scripts/check-tokens.mjs`: exit 0, "52 files, no violations outside the pending list".
- `pnpm test:db`: CI-only, not affected (no server/DB change).

### Acceptance criteria
- [x] S5a-1 Token utilities only; R-a/R-b/R-c applied. Evidence: `screen-tokens.test.ts` green (19 MIGRATED files: the 18 screen files + `table.ts`, plan patterns copied verbatim, plus `opacity-60|focus-visible:|focus-within:`). The plan's rg over `src/ui/{members,invitations,groups,requests,audit,credits,org}/*.tsx` gives hits only in test files (`not.toContain("text-[")` literals). A wider sweep (legacy aliases, `font-heading`, `leading-[`, `tracking-[`, half-step spacing, `[Nrem|px]`) over the same folders: no hits.
- [x] S5a-2 No off-scale text. Evidence: `rg "text-(xs|sm|lg|2xl)\b"` on the glob: no hits. h1s on Members/Groups/Approvals/Audit/Credits are `text-display`; section h2s (ListSection, PendingInvitations, Credits) `text-subtitle`; metadata `text-caption`. Tests: MembersView "uses the token type scale…", ApprovalsView h1, GroupsView h2, AuditView `<th>`.
- [x] S5a-3 44 px targets, no hand-built buttons. Evidence: `rg "<button" src/ui/invitations` hits only a test regex; RequestRowActions test asserts `min-h-control` and no `min-h-11`; MembersView row actions each `min-h-control`; InviteDialog retry `data-variant="outlined"` + `min-h-control`; org-views: 2 radio labels `min-h-control`, 2 inputs `size-5`.
- [x] S5a-4 InvitePeople uses kit Button. Evidence: diff is only the `Button` import and `<Button onClick={() => setOpen(true)}>{invitationsCopy.open}</Button>`; `Button.tsx:37,43` defaults `variant="filled"`, `type="button"`; screen-tokens "invitation entry points use the kit Button only".
- [x] S5a-5 Status text labels, toned pills, no dimming. Evidence: `MembersView.tsx:163-167` Pill success/neutral with `statusLabels`; deactivated row `bg-canvas`, no `opacity-60`; `ApprovalsView.tsx:125-130` Pill with `requestStatusLook(it.status).tone` (`my-requests.ts:25-33`: approved success, rejected danger, cancelled neutral); pending rows render no pill (Q-S5-4 default). Tests: MembersView "status pills…", ApprovalsView "decided rows carry a toned pill…".
- [x] S5a-6 Pending shrinks by exactly 5 keys. Evidence: `git diff origin/main...HEAD -- scripts/check-tokens.pending.json` removes only AuditView 3, InviteDialog 5, InvitePeople 2, MembersView 4, PendingInvitations 3; totals 52 keys / 261 → 47 keys / 244; keys sorted; globals.css 65; check-tokens exits 0; screen-tokens pending test green.
- [x] S5a-7 Recursive container scan. Evidence: `page-container.test.ts:6-9,41-43` uses `readdirSync(..., { recursive: true, encoding: "utf8" })` on `../ui/` and `../app/`, backslash-normalised, `.tsx` not `.test.tsx`, asserts > 100 files. Reviewer reproduction of the scan: 194 files, includes unlisted `app/layout.tsx`, 0 hits of `p-4 lg:p-6`, so adding the string to any unlisted file fails the test.
- [x] S5a-8 No behaviour/copy/prop/aria change. Evidence: `git diff origin/main...HEAD --stat -- src/ui/copy src/lib src/app` empty; screen diffs are class strings, the planned Pill swaps, two kit Button swaps (same handler, label, type) and removal of `className="min-h-11"`; ids, `aria-*`, `tabIndex`, `ref` unchanged. Existing test asserts unchanged except the RequestRowActions `min-h-11` row the plan rewrites.
- [x] S5a-9 Only planned files. Evidence: `git diff --stat origin/main...HEAD` = 19 screen/kit files + pending json + 9 test files + `work/tickets/SIM-071/{plan,impl-log,ticket}.md`; all in the 5a Files table (ticket.md is workflow state). No High path touched.
- [x] S5a-10 Checks green; impl-log "Slice 5a (attempt 1)" has files, pending before/after (with per-key counts), visible differences matching the plan list, checks, out-of-plan "None". The rename map is referenced, not copied ("rename map as in the plan's R-a/R-b"); acceptable since the plan section is the single source 5b/5c reuse.

Additional reviewer check: `TABLE_CELL` carries `font-normal` and the member name cell adds `font-semibold`. Built CSS (`.next/static/chunks/05r_sc27f7bbx.css`) orders `.font-normal` (offset 35698) before `.font-semibold` (35792), so the name renders at 600 as planned.

### Issues
None.

### Rules (CLAUDE.md)
No violations found. R1: new imports are ui → ui (`../table`, `../Button`, `../Chip`, `../portal/my-requests`); `table.ts` imports nothing; check:layers clean. R3: none. R4: only the 5a Files table. R5: new and extended tests cover every rule row. R2/R6/R7 not touched.

### Blockers from review agents
None (no review trigger matched).

### Nits (do not block)
- 💭 `ApprovalsView.test.tsx` cancelled case asserts `bg-canvas` anywhere in the page; a tighter form would match it inside the pill (`/<span[^>]*bg-canvas[^>]*>.*Cancelled/`).
- 💭 `InviteDialog.test.tsx:58` regex depends on attribute order (`min-h-control` before `data-variant`); two separate matches on the `<button>` tag would be order-proof.
- 💭 `screen-tokens.test.ts` failure message uses `re.source.slice(0, 20)`; the matched text is already in the assertion value, so this is fine, just terse.

### Ming verification after merge
- As in plan "Ming verification after merge (slice 5a)": Admin at 390 / 800 / 1280 px, light and dark — Members (coral Invite people, status pills, readable deactivated row, 44 px Edit/Deactivate), invite dialog incl. "sent but not recorded", Groups, Approvals with Approved/Rejected filters, Audit table sideways scroll at 390, Credits, org switcher (two orgs), first-visit profile; keyboard-tab through Members (green focus ring). Not browser-verified by implementer or reviewer.

### Follow-ups (out of scope)
- Q-S5-4: an amber "Pending" pill on Approvals pending rows, if Ming wants it.
- 5b / 5c per the plan outlines (DeviceTable adopts `TABLE_*`; `md` → `lg` device layouts).

### Blockers from review agents (slice 5a)
- None (no review trigger matched).

## Slice 5b — Attempt 1
Verdict: PASS

Date: 2026-11-27. Scope: slice 5b (Devices and device types), commit e1864fd against plan.md "Slice 5b addendum — Devices and device types" (rules R-a..R-h, 5b Files tables, S5b-1..S5b-10).

### Checks (run by reviewer)
- `pnpm format:check`: exit 0 (1091 files checked).
- `pnpm typecheck`: exit 0. `pnpm check:layers`: exit 0, "1033 files, no violations".
- `pnpm test`: exit 0, "399 passed | 1 skipped (400)" files, "3933 passed | 7 skipped (3940)" tests (matches impl-log).
- `pnpm build`: exit 0.
- `node scripts/check-tokens.mjs`: exit 0, "30 files, no violations outside the pending list". `--list` output is identical to the committed `check-tokens.pending.json`.
- `pnpm test:db`: CI-only, not affected (no server/DB change).

### Acceptance criteria
- [x] S5b-1 Token utilities only. Evidence: `screen-tokens.test.ts` green with the 26 files added to `MIGRATED` (19 `ui/devices`, 7 `ui/deviceTypes`, exactly the Files tables); `LEGACY` widened to `container[\w-]*` as planned. The plan's rg (`on-surface|outline-variant|text-error|text-\[|tracking-\[|font-(bold|extrabold)|text-h[23]|rounded-md3|surface-container|secondary-container|error-container`) over both folders, non-test `.tsx`: no hits. Bare `text-primary` check: only `text-text-primary`/`stroke-text-primary`/`fill-text-primary`.
- [x] S5b-2 No off-scale type. Evidence: `rg "text-(xs|sm|lg|2xl)\b"`: no hits. h1s `text-display` (DevicesView.tsx:48, DeviceDetailView.tsx:80, DeviceTypesView.tsx:25); h2s `text-subtitle`; dialog captions `text-label text-text-primary` (= kit `FIELD_CAPTION`, Q-S5b-2 default); `<dt>` `text-caption font-semibold uppercase tracking-wide text-text-secondary`. Tests: DevicesView/DeviceDetailView/DeviceHistory/handoff "tokens" describes.
- [x] S5b-3 44 px targets. Evidence: `rg "<button|min-h-11|py-1\.5"`: no hits. Kit `Button` base has `min-h-control` (Button.tsx:57) for retry, Remove, Keep current; radio/checkbox labels `min-h-control` + inputs `size-5 flex-none` (AssignDeviceDialog, PlaceDeviceDialog seat+role, DeviceTypeFormDialog, DeviceTypeSpriteField); file picker label `field-box ... min-h-control`; back link `inline-flex min-h-control` (DeviceDetailView.tsx:88). Tests: PlaceDeviceDialog, AssignDeviceDialog, DeviceTypeFormDialog (5 rows), DeviceTypeSpriteField (7 rows), DeviceTypesView, ImageField, DeviceDetailView.
- [x] S5b-4 Wide layout from 1024. Evidence: `rg "\bmd:" src/ui/devices src/ui/deviceTypes -g '!*.test.tsx'`: no hits; DeviceTable `hidden lg:block` / `flex flex-col gap-2 lg:hidden`; four card sections `lg:flex-row`; screen-tokens "device lists switch layout at lg" green. Ming checks 800/1024 after merge.
- [x] S5b-5 Toned pills. Evidence: device-labels.tsx `Pill dot tone="warning"` (pending) / `tone="danger"` (overdue), no `var(--error-container)`; OverdueBanner and DeviceDetailView pending use warning Pill; "You" and role chips stay `Chip`. Tests assert `bg-danger-tint`/`bg-warning-tint` in DevicesView, DeviceDetailView, OverdueBanner; plain row has no `bg-danger-tint`.
- [x] S5b-6 Focus without per-component classes. Evidence: `rg "focus(-within|-visible)?:"`: no hits; NoteField textarea wrapped in `field-box` div, textarea `outline-none` (AssignDeviceDialog test `field-box[^>]*><textarea[^>]*outline-none`); ImageField label `field-box`, test asserts no `focus-within:`. Manual Tab check is in Ming's list.
- [x] S5b-7 Pending shrinks by exactly 16 keys. Evidence: `git diff origin/main...HEAD -- scripts/check-tokens.pending.json` = 16 removed lines, nothing added/changed; per-key counts match the plan table (60 violations). Note: summing the JSON gives 46 keys / 243 on main → 30 / 183 now (plan says 244 → 184); the difference is exactly 16 keys / 60 either way, so the off-by-one is in how the total was stated, not in the change.
- [x] S5b-8 No behaviour/copy/prop/id/aria change. Evidence: `git diff origin/main...HEAD --stat -- src/ui/copy src/lib src/app` empty. PlaceDeviceDialog retries: same `onRetryRooms`/`onRetrySeats`, same `devicesCopy.retry` label, kit default `type="button"`, still inside the `role="alert"` div. ImageField Remove/Keep: same `onRemove`/`onUndo`, labels, `disabled`. NoteField `id`, `rows`, `maxLength`, `aria-describedby`, `onChange` unchanged. Test diffs have no removed lines in `*.test.tsx`; the 2 removed lines in `screen-tokens.test.ts` are the planned `LEGACY` widening and the kit-Button list extension.
- [x] S5b-9 Only planned files. Evidence: `git diff --stat origin/main...HEAD` = 26 screen files, 13 test files, `screen-tokens.test.ts`, pending json, `work/tickets/SIM-071/{plan,impl-log,ticket}.md`; all in the 5b Files tables. No High path touched.
- [x] S5b-10 Checks green (above); impl-log "Slice 5b (attempt 1)" has files, pending before/after with per-key counts, visible differences matching the plan list, the DeskSlotDiagram observation (honestly recorded as not browser-checked), checks, out-of-plan "None".

### Judgement: looser back-link assertion (DeviceDetailView.test.tsx)
The test asserts `/<a[^>]*min-h-control[^>]*>/` instead of pinning the back link (`href="/devices"`). In the rendered detail page the only other `<a>` elements are the room link from `PlacementLabel` (device-labels.tsx, `font-semibold text-text-primary underline`, no `min-h-control`); `DeviceNameLink` is not rendered on the detail page. So the regex can only match the back link today, and removing `min-h-control` from DeviceDetailView.tsx:88 would fail the test. Adequate for the plan row ("back link has `min-h-control`"); not a blocker. Tightening is a nit below.

### Issues
None.

### Rules (CLAUDE.md)
No violations found. R1: new imports are ui → ui (`../table`, `../Button`, `Pill` from `../Chip`); check:layers clean. R3: none. R4: only the 5b Files tables. R5: tests extended per the plan's Tests table. R2/R6/R7 not touched.

### Blockers from review agents
None (no review trigger matched).

### Nits (do not block)
- 💭 DeviceDetailView.test.tsx back-link assert: pin it, e.g. match the `<a>` tag containing `href="/devices"` and then assert it contains `min-h-control` (two checks on the same tag, order-proof), so a future 44 px link elsewhere on the page cannot satisfy it.
- 💭 DevicesView.test.tsx "row action buttons are 44 px": `html.match(...) ?? []` with no length check would pass vacuously if the Edit button stopped rendering; add `expect(buttons.length).toBeGreaterThan(0)` like the handoff tests do.
- 💭 PlaceDeviceDialog retry: the `{" "}` text node before the kit Button is now redundant inside a `flex gap-2` container (harmless).
- 💭 Pending totals in plan/impl-log (244 → 184) differ by one from the JSON sum (243 → 183); the delta (60) is right.

### Ming verification after merge
- As in plan "Ming verification after merge (slice 5b)": Admin at 390 / 800 / 1024 / 1280 px, light and dark — Devices list (cards at 800, table at 1024), red Overdue pill, amber pending pill, detail page with history and Load more, Incoming transfers / Pending returns / Pending extensions (buttons beside text only from 1024); every device dialog (captions, green ring on the note box with Tab, 44 px checkbox/radio rows); Device types list, New type form (slot radios, sprite options, Choose image → Remove / Keep current), delete dialog, Tab onto "Choose image" shows the green ring.
- DeskSlotDiagram: compare with the previous look (old `fill-surface-container-high` had no theme key; implementer could not check in a browser).
- Not browser-verified by implementer or reviewer.

### Follow-ups (out of scope)
- Q-S5b-5: `border-strong` for the desk diagram strokes if divider is too light.
- Q-S5b-6: `xl` switch for the device table if 1024 is cramped.
- Q-S5b-1: blue `info` pill for "Transfer pending" if Ming prefers.

### Blockers from review agents (slice 5b)
- None (no review trigger matched).
