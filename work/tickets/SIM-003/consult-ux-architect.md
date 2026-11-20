# Consult — ux-architect — SIM-003

**Findings**
1. seatMGT "dark" is not dark: `[data-theme="dark"]` only swaps to a slightly deeper light grey (#efefee). The toggle there is cosmetic; SHL-02 / AC "renders in light and dark" needs a real dark token set — nothing to port.
2. seatMGT tokens are MD3-named CSS vars on :root, mapped via `@theme inline` (primary #1c1c1c black pill, accent orange #fb5729, Manrope/Poppins, radii 10/12/16/20). Many components hardcode `rgba(251,87,41,…)` shadows and `#fff` (avatar) — will break in dark.
3. AppShell: nav rail 88px (md) / 68px bottom bar via `flex-col-reverse md:flex-row`, header 64px. Coupled to AppStore, hard-coded "SeatMap / Northgate Campus" brand, a room switcher needing rooms data, English labels, `lang="en"`. Theme is `data-theme="light"` hardcoded on `<html>` (no persistence, no flash handling). Icons = Google-hosted Material Symbols via `<link>` (external CDN, FOUC risk, icon-name text read by screen readers unless aria-hidden).
4. EntityFormDialog a11y gaps: has `role="dialog"` + `aria-modal`, but no focus move on open, no focus trap, no focus return to trigger, no scroll lock, window-level Escape listener (also fires for stacked dialogs), scrim click closes on drag-release, `aria-label` instead of `aria-labelledby`/`describedby`, no `role="alert"` on error, English "Cancel"/"Saving…". `DialogField` has both `aria-label` and a wrapping label (redundant); `outline-none` on input relies on a `focus-within` ring only.
5. Spec: SHL-01 lists a room switcher, but the ticket drops it (needs data); org switcher and refresh-permissions are slots only. Tablet (768–1023 px) unspecified; ticket says ≥1024 rail, seatMGT used md=768.

**Recommendations**
1. Tokens once in `globals.css`: `:root` (light) and `[data-theme="dark"]` (real dark: surface ~#161616, canvas ~#0f0f0f, on-surface #ececec, outline-variant ~#2a2a2a). Dark primary must invert (light pill, dark text). Replace hardcoded orange rgba / `#fff` with `--accent-orange`-based tokens (`color-mix`) and `--on-accent`. Verify contrast ≥4.5:1 text, ≥3:1 borders/focus in both themes (`on-surface-variant` #6b6b6b on #f6f6f5 ≈4.9:1 fine; white on orange #fb5729 ≈3.3:1 → large/bold text only, or dark text on orange).
2. Theme: store "light" | "dark" | "system" in localStorage (try/catch); inline blocking script in `<head>` (with `suppressHydrationWarning` on `<html>`) sets `data-theme` before paint, plus `color-scheme`. Read/write helper in pure `src/ui/theme.ts` for the unit test. Toggle = `aria-pressed` button or labelled radio group.
3. Self-host fonts (`next/font` Manrope with `vietnamese` subset; Poppins only if needed) — Manrope covers Vietnamese; verify stacked diacritics. Self-host the icon font or use inline SVG (no CDN, no flash). `Icon` wrapped `aria-hidden`.
4. IA: `navItemsFor(tier)` → `{id, href, labelKey, icon, minTier}[]` from one table serving rail + bottom bar. Order: Tổng quan, Phòng, Thiết bị, Thành viên, Phê duyệt (manager+). Room editor is not a nav item (contextual action on Room detail, admin only). Hiding is UX only; comment that the API enforces permissions (SYS-01). Mobile bottom bar with 5 items at 390 px is fine; always show the label.
5. Signed-out state (`session === null`): hide nav; show brand + theme toggle + a neutral "Chưa đăng nhập" card with a disabled/placeholder sign-in CTA slot. Org name, switcher, avatar, role badge, refresh, sign-out only when a session exists. Route skeletons render empty state, no data. Session context default `null`; the shipped build must never mock one (tests use a provider).
6. Dialog: native `<dialog>` with `showModal()` (free focus trap, Escape, inert background, focus return) or equivalent; `aria-labelledby`/`aria-describedby`, `role="alert"` on error, scrim close only on pointerdown+up, body scroll lock; test focus-in, Esc, focus-return. Labels from props, never hard-coded.
7. Focus: global `:focus-visible` ring (2px, accent or on-surface, offset 2px) for links, buttons, chips; no `outline-none` without replacement. Skip link "Bỏ qua đến nội dung chính". `<nav aria-label="Điều hướng chính">`, `aria-current="page"`, `<main id>`, `lang="vi"`. Status chips need text/icon, not colour alone.
8. Breakpoints: Tailwind `lg:` (1024 px) for the rail; below → bottom bar (incl. tablets; state it). `100dvh` not `h-screen`; `pb-[env(safe-area-inset-bottom)]` on the bottom bar. Header on mobile: truncate org name, avatar into a menu if tight.
9. Copy: `src/ui/copy/vi.ts` typed const object, NFC UTF-8; unit test asserting `s === s.normalize("NFC")` for all strings and no "?" mojibake. "Đăng xuất", "Làm mới quyền", "Chuyển tổ chức", "Giao diện sáng/tối".

**Risks**
- Dark theme is net-new design, not a port — can be underestimated (M size).
- Orange on white / on dark fails text contrast if copied as-is.
- Material Symbols CDN conflicts with self-hosting / CSP plans.
- Inline theme script may conflict with a future strict CSP (needs nonce/hash).
- D4 (client-rendered org pages): shell must be a client component under `(app)/layout`; keep `src/ui` free of server imports (R1).

**Open questions**
1. Real dark palette (recommended) or only seatMGT's warm-light variant? Default: real dark.
2. "System" as a third option, or light/dark with system as initial default? Default: initial = system, toggle = light/dark.
3. Header room switcher deferred to the Rooms ticket? Default: yes.
4. Nav labels "Thiết bị" (Devices), "Phê duyệt" (Approvals)? Confirm terminology (Phòng, Chỗ ngồi vs "Vị trí", Thành viên).
5. Icons: self-hosted Material Symbols subset vs inline SVG? Default: subset.
