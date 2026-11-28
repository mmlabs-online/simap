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

## Slice 5c (attempt 1)
Verdict: PASS

Date: 2026-11-27. Scope: slice 5c (Dashboard, search, rooms and seats chrome), commit 4f3b688 on `claude/modest-allen-yru4g8`, against plan.md "Slice 5c addendum" (S5c-1..10), the slice-5 rules R-a..R-h and CLAUDE.md. Commits after 4f3b688 touch only `work/`.

### Checks (run by reviewer)
- `pnpm format:check`: exit 0 (1091 files).
- `pnpm typecheck`: exit 0. `pnpm check:layers`: exit 0, "1033 files, no violations".
- `pnpm test`: exit 0, "399 passed | 1 skipped (400)" files, "3940 passed | 7 skipped (3947)" tests (matches impl-log).
- `pnpm build`: exit 0. Built CSS contains every new utility (`shadow-dialog`, `min-w-136`, `sm:max-w-110`, `max-w-56`, `max-w-72`, `stroke-divider`, `stroke-text-primary`).
- `node scripts/check-tokens.mjs`: exit 0, "22 files, no violations outside the pending list". `--list` output is identical to the committed pending JSON (22 keys / 142).
- `pnpm test:db`: CI-only, not affected (no server/DB change).

### Acceptance criteria
- [x] S5c-1 Token utilities only. Evidence: `screen-tokens.test.ts` green with the 18 planned files added to `MIGRATED`; the plan's S5c-1 rg over `src/ui/{dashboard,rooms,search,seats}` (non-test `.tsx`): no hits. Every `primary`/`secondary` class in those folders is `text-text-primary`/`text-text-secondary`/`stroke-text-primary` (no bare `text-primary`, `stroke-primary`, `surface-high`, `outline-variant`).
- [x] S5c-2 No off-scale type. Evidence: `rg "text-(xs|sm|base|lg|2xl)\b"`: no hits. h1s `text-display` (DashboardView.tsx:92, RoomsView.tsx:36, SearchView.tsx:141, SeatsView.tsx:62); section/card/panel h2s `text-subtitle`; `<dt>` and `<th>` `text-caption font-semibold uppercase tracking-wide`. Token tests in Dashboard/Rooms/Search/SeatsView/SeatDetailPanel green.
- [x] S5c-3 44 px targets. Evidence: `rg "<button|py-1\.5|py-0\.5"`: no hits. Seat codes are kit `Button variant="text" size="sm"` (base `min-h-control`, Button.tsx:57), back link `inline-flex min-h-control` (SeatsView.tsx:28), picker retry/Load more kit Buttons, radio rows `min-h-control` + `size-5` radios. Tests: SeatsView tokens (codes count = seats.length, each `min-h-control` + `data-variant="text"`; back link pinned to `href="/rooms"`), MemberPickerFields tokens (2 tests), RoomsView tokens (Edit/Delete, length > 0).
- [x] S5c-4 Shared table classes; focus without per-component classes. Evidence: SeatsView imports `TABLE_CELL/HEAD/ROW` (SeatsView.tsx:10), `TH`/`TD` removed; screen-tokens shared-table test loops over DeviceTable and SeatsView; `rg "focus(-within|-visible)?:"`: no hits; region is `overflow-x-auto rounded-xl` inside a Card without `overflow-hidden`, so the global `:where(…, [tabindex]):focus-visible` outline (globals.css:339, 2 px offset) is not clipped. Manual Tab at 390 px is in Ming's list.
- [x] S5c-5 Every status has text. Evidence: Search Deactivated → `<Pill dot tone="neutral" label={copy.deactivated} />` (SearchView.tsx:74), test asserts `bg-canvas` pill with dot span and no `bg-danger-tint`/`error-container`; seat status keeps icon + text (existing SeatsView "status has text" green); ring keeps `role="img"`, `aria-label` and percent text (OccupancyRing.tsx diff only touches classes).
- [x] S5c-6 Pending shrinks by exactly the 8 keys. Evidence: pending diff removes the 8 planned keys (41 violations); the only other line change is `SeatOverlay.tsx: 10` losing its trailing comma as the new last entry (value unchanged; logged in impl-log). 30/183 → 22/142.
- [x] S5c-7 No behaviour/copy/prop/id/data/aria change. Evidence: `git diff origin/main...HEAD --stat -- src/ui/copy src/lib src/app` empty. SeatsView seat button keeps `data-seat-code`, `aria-haspopup`, `aria-label`, `onClick` (kit default `type="button"`); MemberPicker retry/Load more keep `onRetry`/`onMore`, labels and `disabled={!canMore}`; SeatDetailPanel h2 keeps `ref`, `tabIndex={-1}`, `id`; `data-add-seats`/`data-device-count` unchanged. Removed test lines are only the planned replacements (screen-tokens header comment and DeviceTable test → loop; the two 5b nits).
- [x] S5c-8 5b nits. Evidence: DeviceDetailView.test.tsx pins `<a … href="/devices">` and asserts `min-h-control` (that tag is DeviceDetailView.tsx:87–88, so removing `min-h-control` there fails the test); DevicesView.test.tsx adds `edits.length > 0`; `rg '\{" "\}' src/ui/devices/PlaceDeviceDialog.tsx`: no hits.
- [x] S5c-9 Only planned files. Evidence: `git diff --name-only origin/main...HEAD` = 14 screen files, 11 test files, pending JSON, `work/tickets/SIM-071/{plan,impl-log,ticket}.md`; all in the 5c Files tables. No High path (`.github/risk-tiers.yml`) touched.
- [x] S5c-10 Checks green (above); impl-log "Slice 5c (attempt 1)" lists files, pending before/after with per-key counts and the corrected totals, visible differences, checks (counts match my run), out-of-plan "None", defaults Q-S5c-1..5.

### Issues
None.

### Rules (CLAUDE.md)
No violations found. R1: new imports are ui → ui (`../table`, `../Button`, `Pill` from `../Chip`); check:layers clean. R3: none. R4: only the 5c Files tables. R5: tests per the plan's Tests table. R2/R6/R7 not touched.

### Blockers from review agents
None (no review trigger matched).

### Nits (do not block)
- 💭 DashboardView.test.tsx tokens test: `/<h2[^>]*text-subtitle/` is satisfied by the rooms h2 alone, and `/<p[^>]*text-label/` by any paragraph; the plan row also wanted the export `<h2>` and the holders hint pinned. Matching the `<h2>` that precedes `copy.export.heading` (and the `<p>` before `copy.holders.hint`) would make both checks specific. ExportCard is still covered by `MIGRATED`.
- 💭 SearchView pill regex (`bg-canvas…><span…rounded-full…></span>`) depends on the Pill's internal markup order; fine today, brittle if Pill changes.
- 💭 Seat-code buttons sit 16 px right of the header text (kit `px-4`, Q-S5c-5 default accepted); check in the browser.

### Ming verification after merge
- As in plan "Ming verification after merge (slice 5c)": Admin at 390 / 800 / 1280 px, light and dark — Dashboard (tiles, room grid, deactivated-holders warning, CSV export as Manager+), Rooms (cards, ring readable in dark mode, Edit/Delete), Search (seat, device, deactivated member grey pill); open a room: back link, table scrolls sideways at 390, Tab onto the table shows the green ring unclipped, seat code → panel (labels, device links, actions, Assign → 44 px picker rows, Load more / Try again), Block/Unblock and Tags dialogs; open a seat from check-in once.
- Not browser-verified by implementer or reviewer.

### Follow-ups (out of scope)
- Q-S5c-1: toned occupancy arc once Ming sets thresholds (`occupancyTone` in `src/lib/rooms/`).
- Q-S5c-2: toned seat-status pills, aligned with the slice-6 map legend.
- Q-S5c-5: negative margin on the seat-code button if the 16 px indent looks wrong.

### Blockers from review agents (slice 5c)
- None (no review trigger matched).

## Slice 6a (attempt 1)
Verdict: PASS

Date: 2026-11-27. Scope: slice 6a (auth screens, check-in, globals.css `.aw-*`/`.px-*`), commit 99fbcef on `claude/modest-allen-yru4g8`, against plan.md "Slice 6 addendum" sub-slice 6a (S6a-1..12), R-i, the slice-5 rules R-a..R-h / "Rules for every slice-5 file", and CLAUDE.md. Later commits touch only `work/`.

### Checks (run by reviewer)
- `pnpm format:check`: exit 0, "All matched files use the correct format".
- `pnpm typecheck`: exit 0. `pnpm check:layers`: exit 0, "1032 files, no violations".
- `pnpm test`: exit 0, "398 passed | 1 skipped (399)" files, "3952 passed | 7 skipped (3959)" tests (matches impl-log).
- `pnpm build`: exit 0 ("Compiled successfully", 25/25 static pages).
- `node scripts/check-tokens.mjs`: exit 0, "16 files, no violations outside the pending list". `--list` output is identical to the committed pending JSON (16 keys, `globals.css` 32).
- Plan step 4 (build output), checked in `.next/static/chunks/*.css`: `min-h-16.25` → `calc(var(--spacing) * 16.25)`; `.border-3` → `border-width:3px`; `bottom-[calc(--spacing(20)+env(safe-area-inset-bottom))]` → `calc(calc(var(--spacing) * 20) + env(...))`; `w-[min(--spacing(128),…)]` → `min(calc(var(--spacing) * 128), calc(100vw - var(--space-6)))`; `lg:grid-cols-[minmax(0,1fr)_--spacing(75)]` → `minmax(0,1fr) calc(var(--spacing) * 75)`; `max-w-100`/`max-w-204`/`gap-8` compile. No fallback needed (matches impl-log).
- `pnpm test:db`: not affected (no server/DB change).

### Acceptance criteria
- [x] S6a-1 Token utilities only. Evidence: `screen-tokens.test.ts` green with the 14 files added to `MIGRATED`; the plan's S6a-1 rg over `src/ui/auth` + `src/ui/checkin` (non-test `.tsx`, minus RoomThumb): no hits. Plan step-3 rg over the six check-in files: no hits.
- [x] S6a-2 No off-scale type. Evidence: `rg "text-(xs|sm|base|lg|xl|2xl)\b"` same paths: no hits. CheckinView h1 `text-display`, h2s `text-subtitle` (CheckinView.tsx:73,78,94); AuthLayout card titles `aw-heading text-subtitle` (AuthLayout.tsx:37,41); `.aw-headline` Display + `@media (width >= 1024px)` Hero (globals.css ~485–498), asserted in tokens.test "headline is Display below 1024 px and Hero from 1024 px".
- [x] S6a-3 44 px targets. Evidence: `rg "min-h-11" src/ui/checkin`: only a test's absence assert. Popup room labels and locked `<li>` `min-h-control`, Request-a-seat / no-seat / Open-in-room links `inline-flex min-h-control`, Who's here rows `min-h-control`; kit Buttons have `min-h-control` base. Tests: CheckinPopup "390 px classes", CheckinView "tokens" (no-seat `/rooms` link), WhosHere "rows are 44 px".
- [x] S6a-4 Pixel green on pixel scope. Evidence: CheckinPopup.tsx and CheckinButton.tsx use `variant="pixel"`, no `variant="filled"` (screen-tokens "check-in pixel chrome"); `.aw-card [data-variant="filled"]` → pixel-primary, `--shadow-pixel`, `:enabled:hover` pixel-hover, `:disabled` no shadow (tokens.test (7)); `.px-frame` 4 px pixel-primary border + `--shadow-pixel` (tokens.test (8)); radios `accent-pixel-primary`, selected row `border-3 border-pixel-primary` (CheckinPopup test "pixel chrome"). `views.test.tsx` 309–313 unchanged and green.
- [x] S6a-5 globals.css. Evidence: tokens.test "auth world and pixel chrome" (9 checks) green; `--aw-*` gone; remaining hex/`rgba(` lines are only the slice-7 compat aliases (74–80, 101–106) and `--px-*` palette (83–95, 109–115); `.aw-serif` keeps `var(--font-serif), Georgia, serif`; both marker comments kept. Diff hunks lie only in 377–441 and 466–779 (old numbering), inside the planned 375–441 / 465–784. Every `.aw-*` font-size/radius/shadow/spacing reads a token; weights 600/500/400 only.
- [x] S6a-6 AA in both themes. Evidence: `TEXT_PAIRS` + `text-primary/text-secondary` on cream, `text-secondary` on tile; `NON_TEXT_PAIRS` + `pixel-primary` on cream/tile/surface; `LARGE_TEXT_PAIRS` `pixel-primary` on cream ≥ 3, all via the existing `describe.each` light/dark, green. `world-palette.test.ts` deleted in the same commit that adds the replacing describe.
- [x] S6a-7 No opacity dimming. Evidence: `rg "opacity-" src/ui/checkin` (non-test `.tsx`): no hits; locked `<li>` lost `opacity-90`, Who's here lost `disabled:opacity-70` and keeps the "not on map" text (WhosHere test asserts both).
- [x] S6a-8 Reduced motion. Evidence: tokens.test "the aw rules read tokens only and have no motion" (slice from `.aw-stage`: no `animation|transition|@keyframes`), green.
- [x] S6a-9 Pending. Evidence: pending diff removes exactly the 6 planned keys and sets `globals.css` 65 → 32; check-tokens exit 0, `--list` identical (16 keys).
- [x] S6a-10 No behaviour/copy/prop/id/data/aria change. Evidence: `git diff origin/main...HEAD --stat -- src/ui/copy src/lib src/app/layout.tsx` shows only `src/lib/color/tokens.test.ts`. Popup keeps ids, `aria-labelledby/-describedby`, `onCancel`, `onSelect`, `onCheckIn`, `onJustLook`, sr-only "selected"; CheckinButton keeps `aria-busy`/`disabled`; `data-slot="checkin-button"` unchanged; `aria-hidden` on PixelHead and strip mark unchanged. Test edits are the listed asserts only.
- [x] S6a-11 Only planned files. Evidence: `git diff --stat origin/main...HEAD` = the 6a Files tables plus `src/ui/auth/DevGate.test.tsx` (out-of-plan, justified in impl-log: one assert `bg-red-600` → `bg-danger-tint`, forced by the planned DevGate notice change; acceptable). No High path touched.
- [x] S6a-12 Checks green (above); impl-log "Slice 6a (attempt 1)" has files, R-i map, globals rule summary, pending before/after (65 → 32, 142 → 93, 22 → 16 keys), step-4 build-output check, checks (counts match my run), out-of-plan note.

### Issues
None.

### Rules (CLAUDE.md)
No violations found. R1: no new imports; check:layers clean. R3: none. R4: plan files plus the justified DevGate test assert. R5: tests per the 6a Tests table. R2/R6/R7 not touched. Slice-5 shared rules: no legacy alias, no 700/800 in TSX or `.aw-*`, WhosHere uses the kit `TRANSITION` string verbatim (Button.tsx:8–9) with `enabled:hover:`, no per-component focus classes (global ring), no Tailwind palette colours (DevGate `red-*` removed), spacing on the R-d scale (guard clean). R-i map applied as tabled.

### Blockers from review agents
None (no review trigger matched).

### Nits (do not block)
- 💭 impl-log "Visible differences" only points to the plan's list instead of restating it; fine since nothing deviated, but the PR body should carry the list.
- 💭 CheckinPopup.test "pixel chrome": the `.replace("max-h-[90dvh]", "")` / `w-[min…` stripping is a no-op for the checked substrings (`text-[`, `tracking-[`, `border-[`, `shadow-[`, `opacity-90`); harmless.
- 💭 `--px-btn`, `--px-btn-ledge`, `--px-btn-text`, `--px-title`, `--px-title-shadow` (globals.css `:root`) now have no consumers after `.px-card`/`.px-title` were deleted; slice 7 can drop them instead of moving them into tokens.css.

### Ming verification after merge
- As in plan "Ming verification after merge (slice 6a)": `/sign-in` at 390 / 800 / 1024 / 1280 px light and dark (headline size switch at 1024, small world at 1280, pixel-green Sign in with hover and focus ring, italic headline word readable in dark, Q-S6-4); sign-up / forgot password (no jump when Turnstile loads), accept-invitation link, org picker; check-in with seats in two rooms (popup Tab order, check in/out, Who's here hover, 390 px floating button clears the tab bar, dark popup frame); DevGate production-data notice in dark mode.
- Not browser-verified by implementer or reviewer.

### Follow-ups (out of scope)
- Slice 7: remove the now-unused `--px-btn*`/`--px-title*` variables (see nit).
- Q-S6-12: check-in side column from `xl` if Ming prefers.

### Blockers from review agents (slice 6a)
- None. security-ai-generated-code-auditor (security-review.md, slice 6a): no 🔴, no 🟡. Orchestrator ran `git diff --stat origin/main...HEAD -- src/ui/auth src/lib` for its note 6: only AuthLayout, DevGate(+test), accept-views, account-views(+test), views(+test), world-palette.test.ts (deleted) and src/lib/color/tokens.test.ts changed; tokenStore, runtime, identityClient, AuthGate and TurnstileWidget are untouched.

## Slice 6b (attempt 1)
Verdict: PASS

Date: 2026-11-27. Scope: slice 6b (Portal), commit d424f15 on `claude/modest-allen-yru4g8`, against plan.md "Slice 6b addendum — Portal" (S6b-1..11), the slice-5 rules R-a..R-h / "Rules for every slice-5 file", R-i, and CLAUDE.md. Later commits touch only `work/`.

### Checks (run by reviewer)
- `pnpm format:check`: exit 0.
- `pnpm typecheck`: exit 0. `pnpm check:layers`: exit 0, "1032 files, no violations".
- `pnpm test`: exit 0, "398 passed | 1 skipped (399)" files, "3961 passed | 7 skipped (3968)" tests (matches impl-log).
- `pnpm build`: exit 0 ("Compiled successfully", 25/25 static pages).
- `node scripts/check-tokens.mjs`: exit 0, "11 files, no violations outside the pending list". `--list` output is identical to the committed pending JSON (11 keys, 83 violations).
- `pnpm test:db`: not affected (no server/DB change).

### Acceptance criteria
- [x] S6b-1 Token utilities only. Evidence: `screen-tokens.test.ts` green with the 20 portal files added to `MIGRATED`; the plan's S6b-1 rg (`--pcre2`, `src/ui/portal` non-test `.tsx`): no hits. Extra scan for bare `text-primary` (`(?<![\w-])text-primary\b`): no hits.
- [x] S6b-2 No off-scale type. Evidence: S6b-2 rg: no hits. PortalPage h1 `text-display`, SeatCard h4 `text-body font-semibold`, MyDevicesTiles values `text-title`; SeatCard, MyDevicesTiles, MyDevicesTable "tokens" tests green.
- [x] S6b-3 44 px targets. Evidence: S6b-3 rg (`min-h-11|min-w-11|size-11|h-11|<button|py-1\.5`): no hits. Release/Cancel/Remove are kit Buttons (kit base `min-h-control`; tests assert it on Release, Cancel, Remove); View on map and empty-state links `inline-flex min-h-control`; select `min-h-control`; search drops `h-10!` (kit 44 px); photo label `min-h-control`; picker labels `min-h-control min-w-control` (PixelLookPicker test). Remove keeps `type="button"` via the kit default (Button.tsx:43).
- [x] S6b-4 Pixel green only in the picker. Evidence: `rg "pixel-" src/ui/portal -g '!*.test.tsx'` hits only `PixelLookPicker.tsx` classes (19, 22, 82, 113) plus `pixel-look-*` names/imports; LookStage `bg-tile`; screen-tokens "portal character picker uses pixel tokens" and LookStage/PixelLookPicker tests green.
- [x] S6b-5 Status icons use tints next to the unchanged `Pill` (MyRequestRow.tsx:10–15, Pill at 29 unchanged); MyRequestRow "tokens" test asserts warning/cancelled tones. `rg "opacity-"` over portal non-test `.tsx`: no hits.
- [x] S6b-6 Focus without hard-coded colours. Evidence: `rg "focus(-within|-visible)?:"` over the same paths: no hits; picker uses `has-[:focus-visible]:outline-focus` (Q-S6b-3 default), photo label `field-box` (globals.css:344 `.field-box:focus-within` ring in `--color-focus`), select falls to the global rule. Tests: PixelLookPicker "labels show the focus ring…", ProfilePhotoSection "tokens". Manual Tab check is Ming's.
- [x] S6b-7 MyDevicesTable imports `TABLE_CELL/HEAD/ROW` from `../table`, local `CELL`/`HEAD` deleted, `min-w-240`; screen-tokens shared-table test and MyDevicesTable "table"/"tokens" tests green.
- [x] S6b-8 Pending diff removes exactly the 5 portal keys (5 removed lines, nothing else); 93 → 83, 16 → 11 keys; guard exit 0.
- [x] S6b-9 No behaviour/copy/prop/id/role/data/aria change. Evidence: `git diff --stat origin/main...HEAD -- src/ui/copy src/lib src/app 'src/ui/portal/*.ts' src/styles scripts/check-tokens.mjs` is empty; read every screen hunk: class strings only, plus the planned Remove `<button>` → kit `Button` (same `disabled`, `onClick`, label; type default `button`). Existing asserts changed only where the plan lists them (`min-h-11` → `min-h-control`, `min-w-[960px]` → `min-w-240`, test rename).
- [x] S6b-10 Only planned files. Evidence: `git diff --stat origin/main...HEAD` = the 16 screen files, pending JSON, `screen-tokens.test.ts`, the 8 listed portal tests, `CheckinPopup.test.tsx` (6a nit) and `work/` files. No High path touched.
- [x] S6b-11 Checks green (above); impl-log "Slice 6b (attempt 1)" has files, legacy (93 → 0) and pending before/after (10 → 0, 93 → 83, 16 → 11 keys), visible differences (by reference to the plan list), checks matching my run.

### Issues
None.

### Rules (CLAUDE.md)
No violations found. R1: new imports `../table` (MyDevicesTable) and `../Button` (ProfilePhotoSection) are ui → ui; check:layers clean. R3: none. R4: plan files only. R5: tests per the 6b Tests table. R2/R6/R7 not touched. Slice-5 shared rules: no legacy alias, no 700/800, the file-picker label uses the kit transition string, no Tailwind palette colours, spacing on the R-d scale (`gap-1.5` → `gap-1`), R-a/R-b/R-c/R-g/R-i map applied as tabled (including Q-S6b-1..7 defaults).

### Blockers from review agents
None (no review trigger matched).

### Nits (do not block)
- 💭 impl-log "Visible differences" again only points to the plan's list; the PR body should carry the list.
- 💭 PersonalInfoCard.tsx:68 class order `text-caption text-text-secondary flex-none` (pre-existing order, not sorted; oxfmt does not sort classes).
- 💭 LookStage dot grid now draws `--color-divider` dots on `bg-tile`; worth a glance in dark mode during Ming's check that the dots are still visible.

### Ming verification after merge
- As in plan "Ming verification after merge (slice 6b)": `/portal` at 390 / 1024 / 1280 px light and dark (seat cards, View on map, Release, empty-state link; My requests pending/approved/rejected/cancelled); My devices tiles, search + type filter same height, table scroll at 390 / fit at 1280, Load more; Profile Tab order through name, photo picker (focus ring) and Remove, character picker arrow keys with the focus ring, pick and save; dark-mode selected ring and check marks on every swatch.
- Not browser-verified by implementer or reviewer.

### Follow-ups (out of scope)
- None new.

### Blockers from review agents (slice 6b)
- None (no review trigger matched).

## Slice 6c (attempt 1)
Verdict: REWORK

Date: 2026-11-28. Scope: slice 6c (roomlayout chrome and map items), commit 2fbb828 on `claude/modest-allen-yru4g8`, against plan.md "Slice 6c addendum" (S6c-1..12), the slice-5 rules R-a..R-h / "Rules for every slice-5 file", R-i, and CLAUDE.md. Later commits touch only `work/`.

### Checks (run by reviewer)
- `pnpm format:check`: exit 0.
- `pnpm typecheck`: exit 0. `pnpm check:layers`: exit 0.
- `pnpm test`: exit 0, "398 passed | 1 skipped (399)" files, "3967 passed | 7 skipped (3974)" tests (matches impl-log).
- `pnpm build`: exit 0.
- `node scripts/check-tokens.mjs`: exit 0, "1 files, no violations outside the pending list".
- Build-output check (Approach 5), grep of `.next/static` CSS: `calc(var(--spacing) * 145)`, `minmax(0,1fr) calc(var(--spacing) * 72)`, `aria-checked\:border-pixel-primary`, `before\:h-control`, `bg-text-primary\/20`, `outline-focus`, `has-\[\:focus-visible\]` all present. Matches impl-log; no fallback needed.
- `pnpm test:db`: not affected (no server/DB change).

### Acceptance criteria
- [x] S6c-1 Token utilities only; legacy 131 → 0. Evidence: plan S6c-1 `rg --pcre2` over roomlayout/mapItems non-test `.tsx`: no hits; `screen-tokens.test.ts` green with the 23 files in `MIGRATED`.
- [x] S6c-2 No off-scale type. Evidence: S6c-2 rg: no hits. LayoutEditorPage h1 `text-display`; MapItemEditor h2 `text-subtitle` (MapItemEditor "tokens" test); panel h2 `text-body font-semibold` (LayoutEditorViews gate test).
- [x] S6c-3 44 px targets. Evidence: S6c-3 rg (`min-h-11|size-11|py-1\.5|py-1 text-left`): no hits. Links/rows/inputs/search/checkbox rows/tiles `min-h-control`; Radios and footer buttons kit `Button`; close is `IconButton` (test asserts `size-control`); summary `py-3`; Move-here `before:h-control` hit area (SeatOverlay test).
- [x] S6c-4 Pixel green only where planned. Evidence: `rg "pixel-"` hits only MapItemEditorAppearance.tsx:18,80, SpriteBrowser.tsx:95, Palette.tsx:55, SeatOverlay.tsx:204; `variant="pixel"` in MapItemEditor.tsx:172 (Save) and MapItemEditorDetails.tsx:171 (reset confirm). Previews `bg-tile` (Appearance 164, SpriteBrowser 95). New screen-tokens "map, editor and map items chrome" test green.
- [ ] S6c-5 Focus without per-component colours — the screens meet it (rg hits only the planned `group-focus-visible:flex` at SeatOverlay.tsx:165–166; `outline-focus` only in SpriteBrowser.tsx:95), but the guard change that makes the test pass widens the exemption beyond that one class. See Issue 1.
- [x] S6c-6 Opacity. Evidence: `rg "opacity-"` hits only MapItemCard.tsx:53 (`opacity-50`) and SeatOverlay.tsx:204 (`disabled:opacity-50`); MapItemCard, SeatOverlay, LayoutEditorViews tests.
- [x] S6c-7 AA pairs. Evidence: tokens.test.ts:131–132 adds `["text-primary","tile"]`, `["text-primary","warning-tint"]`; suite green (both themes via the existing `describe.each`).
- [x] S6c-8 Kit dialog. Evidence: MapItemEditor.tsx:329 `m-auto w-[calc(100%-var(--space-6))] max-w-145 overflow-hidden rounded-2xl bg-surface p-0 text-text-primary shadow-dialog`, animation `popin var(--duration-ui) ease-out`.
- [x] S6c-9 Pending: the diff of `scripts/check-tokens.pending.json` removes exactly the 10 keys (83 → 32, 11 → 1 key); guard exit 0.
- [x] S6c-10 No behaviour/copy/prop/aria change. Evidence: `git diff --stat origin/main...HEAD -- src/ui/copy src/lib src/app 'src/ui/roomlayout/*.ts' 'src/ui/mapItems/*.ts' public src/styles scripts/check-tokens.mjs` = only `src/lib/color/tokens.test.ts` (+2). Read every hunk: class strings, plus the planned Radios → kit `Button` (role, aria-checked, roving tabIndex, onKeyDown, disabled pass through `...rest`; type defaults to `button`) and close → `IconButton` (same `onClick`, label = `copy.close`). `fill` classes of 8b27bfa kept byte for byte (RoomMap.tsx:182, RoomMapSection.tsx:79). Sprites, `paint.ts`, `src/lib/**` (except the planned tokens.test.ts), `--px-*` art colours: untouched (no `--px-` line in the diff outside the new guard regex).
- [x] S6c-11 Only planned files. Evidence: `git diff --stat origin/main...HEAD` = the 20 screen files, PersonalInfoCard nit, pending JSON, screen-tokens/tokens tests, the 9 listed screen tests and `work/`. No High path.
- [x] S6c-12 Checks green (above); impl-log "Slice 6c (attempt 1)" has files, legacy 131 → 0, pending 51 → 0 / 83 → 32, the build-output check, the deviation, and checks matching my run. Visible differences by reference to the plan list (as 6b).

### Issues
#### Issue 1 — 🔴 blocker — focus guard weakened beyond the one needed exemption (R5, plan Tests table)
- **Where**: src/ui/screen-tokens.test.ts:138 (`const OTHER = /opacity-60|(?<![\w-])focus-visible:|focus-within:/;`).
- **Expected**: the deviation exempts only the kept, colour-free `group-focus-visible:flex` (SeatOverlay.tsx:165–166) and every other per-component focus class in the 120 `MIGRATED` files still fails, as before.
- **Actual**: the lookbehind `(?<![\w-])` exempts every `<word>-focus-visible:` variant. Checked in node: old regex flags `group-focus-visible:ring-teal-500`, `peer-focus-visible:ring-primary` and `in-focus-visible:ring`; the new one flags none of them. `peer-focus` is still banned, but only for the 23 `MAP_CHROME` files (line 254). The ~97 other migrated files lost that protection, so a `peer-focus-visible:ring-*` span like the one this slice removed from SpriteBrowser would now pass there. It is also inconsistent: `group-focus-within:` is still flagged.
- **Fix instruction**: replace line 138 with
  `const OTHER = /opacity-60|(?<!group-)focus-visible:|group-focus-visible:(?!flex(?![\w-]))|focus-within:/;`
  I checked this in node: it passes `group-focus-visible:flex` and `has-[:focus-visible]:outline-focus`; it flags `focus-visible:ring-2`, `md:focus-visible:…`, `peer-focus-visible:…`, `in-focus-visible:…`, `group-focus-visible:ring-…` and `group-focus-visible:flex-col`; it finds 0 hits across all 120 `MIGRATED` files. Update the impl-log deviation note to match. No other change.

### Rules (CLAUDE.md)
No violations in the screen code. R1: only new cross-file import is `IconButton` from `../Button` (ui → ui); check:layers clean. R3 none. R4 plan files only. R5: see Issue 1 (guard test). R2/R6/R7 not touched. Slice-5 shared rules: R-a/R-b/R-c/R-d/R-e/R-f/R-i applied as tabled, including Q-S6c-1..17 defaults.

### Blockers from review agents
None (no review trigger matched).

### Nits (do not block)
- 💭 Removing `className="min-h-11"` left an empty line inside five JSX attribute lists: MapItemEditor.tsx:158, MapItemEditorAppearance.tsx:231 and 266, MapItemEditorDetails.tsx:177 and 190. oxfmt keeps them; delete them while fixing Issue 1.
- 💭 Palette.tsx:55 appends `border-l-4 border-transparent aria-pressed:border-pixel-primary` after the transition string. That works, but the order differs from the other list rows. Cosmetic.
- 💭 The kit Button adds `whitespace-nowrap` to the Appearance Radios options (the old hand-built ones wrapped). Worth a look at 390 px during Ming's check for long source labels.
- 💭 impl-log "Visible differences" again only points to the plan's list; the PR body should carry the list.

### Ming verification after merge
- As in plan "Ming verification after merge (slice 6c)": room page at 390 / 1024 / 1280 px light and dark (map card, Edit layout, zoom, hover/Tab across seats with the global focus outline on map art); check-in present/away tags in both themes and a "Move here" tap on a phone; layout editor at 1280 px (palette green bar, place, select, drag ghost, resize, shortcuts, no-door warning, save); Map items editor (arrow keys on direction/source, keyboard sprite pick with the green outline, upload, resize warning, reset, discard; dialog fit at 390 px).
- Not browser-verified by implementer or reviewer.

### Follow-ups (out of scope)
- The plan's S6c-5 rg (`focus(-within|-visible)?:`) should exclude `group-focus-visible:flex` in any later addendum that reuses it (impl-log already notes this).

### Blockers from review agents (slice 6c)
- None (no review trigger matched).

## Slice 6c (attempt 2)
Verdict: PASS

Date: 2026-11-28. Scope: rework commit 0374131 on `claude/modest-allen-yru4g8` (on top of attempt-1 commit 2fbb828), against "Slice 6c (attempt 1)" Issue 1 and its nits. Later commit 46aee46 touches only `work/tickets/SIM-071/ticket.md` (State REWORK → REVIEW).

### Checks (run by reviewer)
- `pnpm format:check`: exit 0, "All matched files use the correct format."
- `pnpm typecheck`: exit 0.
- `pnpm check:layers`: exit 0, "check-layers: 1032 files, no violations".
- `pnpm test`: exit 0, "398 passed | 1 skipped (399)" files, "3968 passed | 7 skipped (3975)" tests (attempt 1: 3967; +1 is the new focus-guard test). Matches impl-log.
- `pnpm build`: exit 0.
- `node scripts/check-tokens.mjs`: exit 0, "1 files, no violations outside the pending list".
- `pnpm test:db`: not affected (no server/DB change).

### Issue 1 (blocker) — fixed
- src/ui/screen-tokens.test.ts:138–139 `OTHER` is now exactly the instructed regex `/opacity-60|(?<!group-)focus-visible:|group-focus-visible:(?!flex(?![\w-]))|focus-within:/`.
- New test "the focus guard exempts only group-focus-visible:flex" (screen-tokens.test.ts:156–170) allows `group-focus-visible:flex` and `has-[:focus-visible]:outline-focus` and rejects `focus-visible:ring-2`, `peer-focus-visible:flex`, `group-focus-visible:ring-2`, `in-focus-visible:flex`, `md:focus-visible:flex`, `group-focus-visible:flex-col`; green.
- The migrated-files guard stays green with the narrower regex; the only focus classes left in roomlayout/mapItems chrome are SeatOverlay.tsx:165–166 `group-focus-visible:flex` and SpriteBrowser.tsx:95 `has-[:focus-visible]:outline-*`, both planned. S6c-5 now met.
- impl-log "Slice 6c (attempt 2)" carries the updated deviation note superseding the old one.

### Nits — fixed
- Empty lines inside JSX attribute lists removed at all five places (MapItemEditor.tsx:155, MapItemEditorAppearance.tsx:228/262, MapItemEditorDetails.tsx:174/181); oxfmt collapsed two `Button`s to one line. Props unchanged.
- Palette.tsx:55: same class set, `border-l-4 border-transparent aria-pressed:border-pixel-primary` moved before the transition string. No class added or removed.
- `whitespace-nowrap` on Radios and the PR-body visible-differences list stay for Ming's check / the PR (not code changes).

### Scope
`git diff --stat 2fbb828 0374131 -- . ':!work'` = only the 5 files above (21+/18−). No behaviour, copy, prop or aria change; no High path; no out-of-plan file.

### Rules (CLAUDE.md)
No violations. R5 restored (guard is as strict as before, plus the one planned exemption, and has its own test).

### Blockers from review agents
None (no review trigger matched).

### Nits (do not block)
None new.

### Ming verification after merge
- Unchanged from "Slice 6c (attempt 1)" (room page 390/1024/1280 light and dark, check-in tags, Move here on phone, layout editor, Map items editor incl. Radios wrapping at 390 px). Not browser-verified by implementer or reviewer.

### Follow-ups (out of scope)
- As in attempt 1 (S6c-5 rg in later addenda should exclude `group-focus-visible:flex`).

### Blockers from review agents (slice 6c attempt 2)
- None (no review trigger matched).

## Slice 7 (attempt 1)
Verdict: PASS

Reviewed commit 592f115 (branch `claude/modest-allen-yru4g8`, `git diff origin/main...HEAD`; later commits change only `work/`). 2026-11-28.

### Checks (run by reviewer)
- `pnpm format:check`: exit 0
- `pnpm typecheck`: exit 0
- `pnpm check:layers`: exit 0
- `pnpm test`: exit 0. Test Files 398 passed, 1 skipped (399); Tests 3978 passed, 7 skipped (3985). This matches impl-log.
- `pnpm build`: exit 0
- `node scripts/check-tokens.mjs`: exit 0, `check-tokens: 0 files, no violations outside the pending list`. `--list` prints `{}`. `test ! -e scripts/check-tokens.pending.json` is true.

### After-edit searches (re-run by reviewer)
- A1 (C1): no output.
- A2 (C2 on the whole of `src`, both CSS files included): no output.
- A3: 7 lines, all in `src/styles/tokens.css` (127–130 light, 173–175 dark). C3 with tokens.css excluded: only `RoomThumb.tsx` 4, 5, 6, 7, 19, 27, 28.
- A4 (C4): no output.
- A5 (hex/rgba/hsla in globals.css): no output.
- A6 (`print` in tokens.test.ts): no output.

### Byte-identical spot check
- `--scrim` (light 74 and dark 101 on `origin/main`) matches `--color-scrim` as `rgba(28, 28, 28, 0.32)` / `rgba(0, 0, 0, 0.6)`.
- The `.px-scene` four-offset `box-shadow` matches `--shadow-px-scene`, the same four offsets, re-wrapped by oxfmt only.
- `--px-outline/accent/floor/wall` light and `--px-outline/floor/wall` dark match the old values.
- `.i` `"Material Symbols Outlined"` matches `--font-family-icon`.
- `--secondary-container` expression matches `--color-ink-tint`.
- `--on-secondary-container` (= `var(--color-text-primary)`) matches `var(--color-text-primary)` in Avatar.
- Built CSS: each of the five strings appears in one `.next/static` CSS file. The minifier gives `--color-scrim:#1c1c1c52` / `#0009`, which equal the rgba values. `--shadow-px-scene` survives unchanged.

### Acceptance criteria
- [x] S7-1: compat layer gone. globals.css 7–30: `:root`/dark set only `color-scheme`, and `@theme inline` has the 5 kept keys. tokens.test "compat layer removed" (2) and (3) are green, and A2 is empty.
- [x] S7-2: no removed name is used in `src`. The impl-log "Alias audit" C1–C4 equal Expected. A1, A2 and A4 are empty. The screen-tokens "whole src" test is green and is not vacuous: the `files.length > 100` assertion holds, and impl-log mutation (b) shows it failing.
- [x] S7-3: Avatar defaults are now `var(--color-ink-tint)` / `var(--color-text-primary)` (`src/ui/Avatar.tsx:32-33`). Covered by the Avatar.test new test, tokens.test (6), and the `["text-primary","ink-tint"]` AA pair in both themes (13.20 / 12.52).
- [x] S7-4: `.text-h2`/`.font-heading` deleted. The three `<h1>` lines are one-word changes to `text-display` (AppShellView.tsx:206, PageSkeleton.tsx:17, KitGallery.tsx:36). tokens.test (5) is green.
- [x] S7-5: `--px-*` lives only in tokens.css, in labelled sections (`:root` 125–130, dark 172–175). The 13 dead `--px-*` and 3 dead `--color-px-*` are deleted. tokens.test (7) and A3 confirm this.
- [x] S7-6: 32 → 0 violations. `--list` prints `{}`, A5 is empty, and tokens.test (1) and (5) are green.
- [x] S7-7: the pending file is deleted. Tolerant read at `scripts/check-tokens.test.ts:16-20`. The new test "the pending list is gone and src has zero violations (AC 1b)" is green. CLI exit 0. Mutation checks are recorded in impl-log.
- [x] S7-8: no visible difference. Covered by tokens.test (6), (7), Avatar.test, the built-CSS counts (reviewer re-ran them) and impl-log "Visible differences: None".
- [x] S7-9: impl-log "SIM-071 final changelog" has one row per slice with PRs that match the ticket.md PR field, plus 10 forced-difference bullets.
- [x] S7-10: impl-log "Brief self-check" covers contrast (84 rows = 42 pairs × 2 themes, which equals 28 TEXT + 1 LARGE + 13 NON_TEXT in tokens.test.ts), focus, 44 px (120 MIGRATED files), reduced motion (rg output pasted) and 800/1024/1280 (code-level, marked for Ming). The Deliverable 2 grep is included. A6 is empty.
- [x] S7-11: the changed non-work files are exactly the 14 entries of the slice 7 Files table. No High path is touched.
- [x] S7-12: checks green (above).

Brief self-check (brief.md Deliverables 3–4): the changelog lists the files and forced visible differences. The self-check covers contrast for text on every asserted background, focus ring, 44 px, reduced motion, and layout at 800/1024/1280. The layout row is code-level only and is flagged for Ming, as Q-S7-6 allows.

### Issues
None.

### Rules (CLAUDE.md)
No violations found.
- R1: the only new import is `readdirSync` from `node:fs`, in a test file.
- R2, R6, R7: not touched.
- R3: no config or secrets.
- R4: only planned files.
- R5: checks green, and the new logic has tests (tokens.test 7 tests, check-tokens AC 1b test, whole-src guard, Avatar test).

### Blockers from review agents
None (no review trigger matched: no security paths changed).

### Nits (do not block)
- The plan asked for the contrast table to have threshold and pass columns. The impl-log table has theme/fg/bg/ratio only, and the thresholds are given in a sentence under it. Every ratio clears its threshold and the test asserts this.
- The impl-log build-output check names `.next/static/chunks/*.css` and the plan names `.next/static/css/*.css`. The reviewer found the strings in the built CSS either way.
- The mutation revert (`git checkout -- src/ui/PageSkeleton.tsx`) also dropped the planned `text-display` edit. It was re-applied and the final diff is correct.

### Ming verification after merge
- As in plan "Ming verification after merge (slice 7)":
  - light and dark at 390/800/1024/1280: dialog backdrop dim; Members avatars without a group colour; Material Symbols icons; `/dev/shell` and signed-out shell headings; `/sign-in` pixel vignette notched corners; check-in room thumbnails;
  - tick each "Brief self-check" item, including the 800/1024/1280 layout row, keyboard Tab and OS reduced motion.
- Neither the implementer nor the reviewer checked these in a browser.

### Follow-ups (out of scope)
- `scripts/check-tokens.mjs` CLI output still says "no violations outside the pending list". The pending list no longer exists, so the wording is stale. The plan allowed only the line-3 comment change. A one-line `/solo` could reword it to e.g. `check-tokens: 0 files, no violations`. Update `scripts/check-tokens.test.ts` "cli" too if it asserts the string.

### Blockers from review agents (slice 7)
- None (no review trigger matched).
