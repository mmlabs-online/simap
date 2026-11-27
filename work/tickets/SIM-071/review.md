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
