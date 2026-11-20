# Review — SIM-003

## Attempt 1 — 2026-11-20
Verdict: REWORK

### Checks (run by reviewer)
Fresh clone of `ticket/SIM-003` @ 27bc5a3 into the scratchpad, `pnpm install --frozen-lockfile --config.engine-strict=false` (Node v24; engine warning only).
- format — `pnpm format:check`: "All matched files use the correct format." exit 0
- lint / typecheck — `pnpm typecheck`: "Types generated successfully", `tsc --noEmit` exit 0; `pnpm check:layers`: "check-layers: 52 files, no violations" exit 0
- test — `pnpm test`: "Test Files 14 passed (14) / Tests 70 passed (70)" exit 0
- build — `pnpm build`: exit 0; routes `/`, `/approvals`, `/devices`, `/members`, `/rooms`, `ƒ /rooms/[roomCode]`, `ƒ /rooms/[roomCode]/edit`, `○ /dev/shell`
- Production server (`node .next/standalone/server.js`, curl): `/`, `/rooms`, `/rooms/A1`, `/rooms/A1/edit`, `/members`, `/devices`, `/approvals` → 200; `/dev/shell`, `/dev/shell?tier=admin` → 404. `/` has `<html lang="vi" …>`, the `simap.theme` init script inside `<head>` (before `</head>`), the icon link with `icon_names=…&display=block`, "Chưa đăng nhập", skip link `href="#main"`, no `<nav`.
- `next dev` (curl `/dev/shell?tier=…`): admin/manager/user render `<nav aria-label="Điều hướng chính">`; `href="/approvals"` only for admin and manager; `none` renders no nav.
- `git ls-files src | grep -Ei "mock|fixture|seed"`: no output. No High path in `git diff --name-only origin/main...HEAD`.

Impl-log claims match my run.

### Acceptance criteria
- [ ] UI kit renders in light and dark with seatMGT's look; Vietnamese copy with correct diacritics. Evidence: kit ported with tokens only. The only literal colour is `src/ui/Avatar.tsx:20` (white text on a group colour, as planned). Dark block is at `src/app/globals.css:83-127`. Copy is in `src/ui/copy/shell.ts`, `src/ui/copy/kit.ts`, and `copy.test.ts` checks NFC, no U+FFFD and no "?". `kit.test.tsx` covers the tier labels, "Hủy" and "Đang lưu…". I computed the dark contrast: on-surface-variant/surface 7.17, on-surface-variant/surface-high 6.23, error/surface-high 5.68, on-primary/primary 15.32. The code is OK. The look itself is a **manual check for Ming**.
- [ ] Nav rail at ≥ 1024 px, bottom bar at 390 px, every nav entry reachable by keyboard. **FAILED, see Issue 1.** The 390 px header still shows the role badge. Rail and bar: `src/ui/AppShellView.tsx:35` (`flex-col-reverse lg:flex-row`) and `:44-87`. Nav entries are `next/link` `<a href>` with `aria-current` (`:63-68`). The skip link comes first (`:36-41`) and `<main id="main" tabIndex={-1}>` is at `:140-143`. The focus ring is at `globals.css` `:where(button, a, [tabindex], input, select, summary):focus-visible`. Tests: `AppShellView.test.tsx:79-98`. Visual and tab order are a manual check.
- [x] `navItemsFor` per tier (unit test). Evidence: `src/lib/nav.test.ts:7-16` (user = 4 ids without approvals and roomEditor, manager adds approvals, admin has 6 incl. roomEditor) passes. Implementation is at `src/lib/nav.ts:41-43`.
- [x] Theme survives reload, no flash (code level). Evidence: `src/lib/theme.ts:37-39` IIFE with try/catch and a system fallback. It is injected first in `<head>` (`src/app/layout.tsx:20`), with `suppressHydrationWarning` (`:17`). Storage helpers have try/catch (`theme.ts:21-35`). `theme.test.ts:76` runs the script against stubs. `ThemeToggle.tsx:16-21` writes both `dataset.theme` and storage. The real reload and no-flash check is a **manual check for Ming**.
- [x] No `src/ui/` component imports server modules (R1), no mock data file ships. Evidence: `check:layers` is green. The external imports in `src/ui` are only `react`, `next/link` and `next/navigation`. The mock grep is empty. `src/app/(app)/layout.tsx:6` passes `value={null}`. `/dev/shell` is 404 in prod. See nit 1 about the gallery chunk.

### Issues
#### Issue 1 — 🔴 blocker — layout / AC2 (390 px header)
- **Where**: `src/ui/AppShellView.tsx:134` together with `src/ui/RoleBadge.tsx:27`
- **Expected**: plan Approach 6 says RoleBadge is `hidden lg:inline-flex`, so it is hidden below 1024 px and the 390 px header fits.
- **Actual**: RoleBadge always puts `inline-flex` in its class list and appends `hidden lg:inline-flex`. The built CSS (`.next/static/chunks/*.css`) emits `.hidden{display:none}` at byte 8552 and `.inline-flex{display:inline-flex}` at byte 8596. The later rule wins, so `hidden` never applies and the badge shows at every width. The rendered markup confirms it: `class="inline-flex … flex-none hidden lg:inline-flex"`. The header at 390 px already has about 370 px of fixed items: padding, brand, 4 × 44 px IconButtons, the 40 px avatar and 8 gaps, counting the empty room-switcher slot div. The extra badge (~70 px) overflows the header. The root `overflow-hidden` then clips the avatar and badge, and possibly the sign-out button. This bug came over from seatMGT (`AppShell.tsx:150` has the same pattern).
- **Fix instruction**: do not combine a display utility with a caller-supplied display override. Either:
  - (a) wrap the badge in `<span className="hidden lg:inline-flex"><RoleBadge tier={session.tier} /></span>` in `AppShellView.tsx`, or
  - (b) use `max-lg:hidden` instead of `hidden lg:inline-flex`.

  Add an assertion to `AppShellView.test.tsx` that the badge's wrapper or class carries the chosen hiding class. For (a), check that `RoleBadge`'s own element is not the one with `hidden`. Re-run all checks.

### Rules (CLAUDE.md)
No violations found. R1: `check:layers` is green and no `src/server` import exists. R2: no schema change. R3: the only env read is `NODE_ENV` (`src/app/dev/shell/page.tsx:12`), with no secrets. R4: every changed file is in the plan and `Out-of-plan files` is "None", which is true. R5: lib logic, copy and shell markup have tests, and the checks are green.

### Blockers from review agents
None. No review trigger path was changed.

### Nits (do not block)
1. The dev-only `KitGallery` client chunk still ships in `.next/static/chunks/` (it contains "Bộ giao diện" and "Nguyễn Văn An") even though `/dev/shell` returns 404. It is not data, but a realistic-looking person name in a shipped asset goes against the spirit of spec §7. Consider `Avatar name="Người xem trước"` or similar.
2. On mobile the DOM order is skip link → nav (visually at the bottom) → header → main, so Tab reaches the bottom bar before the header. This is the same as seatMGT and acceptable, but Ming should confirm it in the keyboard check.
3. `:where([tabindex]):focus-visible` also matches `<main tabIndex={-1}>` and inner `<input>`s. `outline-none` removes the outline but the 3 px `--focus-ring` box-shadow still applies (main after the skip link, inputs inside an already-ringed field box). Consider `[tabindex]:not([tabindex="-1"])` and excluding inputs inside `.group`.
4. Light theme: `--error` #dc2626 on the dialog's `surface-high` #f0f0ef is 4.24:1, below 4.5:1 for the 13 px alert text. The colour pair comes from seatMGT; maybe `--on-error-container` or a darker red.
5. Dark hairlines (`--outline` #3a3a3a on #161616 = 1.59:1) are weak for input boundaries (WCAG 1.4.11). Field identity relies on fill contrast. Add this to Ming's taste check.
6. `kitCopy.save` and `kitCopy.close` are unused for now.

### Manual checks for Ming (no browser available to agents)
- `pnpm dev`, `/dev/shell?tier=admin|manager|user|none`:
  - kit gallery in light and dark: no white card on the dark canvas, focus ring visible in both, look side-by-side with seatMGT;
  - taste of the new dark palette.
- DevTools 1024×768 → left rail; 390×844 → bottom bar, header fits (after Issue 1), org name truncates, role badge hidden.
- Keyboard: Tab from load → skip link "Bỏ qua đến nội dung chính" first, then nav links with a visible ring; Enter navigates.
- Dialog ("Mở hộp thoại"): focus moves in, Esc closes, focus returns to the button, a scrim click closes, and a drag from inside to the scrim does not close.
- Theme: choose dark, reload with cache disabled and CPU 6× slowdown → no light frame. Clear localStorage and emulate `prefers-color-scheme: dark` → starts dark.
- After merge (plan): real iOS Safari / Android Chrome (safe-area inset, Manrope diacritics), desktop Safari / Firefox, the signed-in shell after SIM-006.

### Follow-ups (out of scope)
- The impl-log follow-ups 1-6 are not yet filed as `debt` issues (`gh` was unavailable). The orchestrator must file them:
  - self-hosted Material Symbols;
  - room switcher (SIM-010);
  - CSP nonce for the theme script;
  - network for `next/font` in the image build;
  - recording the contrast pairs (the values above can seed it);
  - the `/dev/shell` keep/remove decision.
- seatMGT has the same `hidden md:inline-flex` RoleBadge bug (`src/components/shell/AppShell.tsx:150`). This is informational only, because seatMGT is read-only.
