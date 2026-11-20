# Consult — frontend-developer — SIM-003

**Findings**
- seatMGT `[data-theme="dark"]` is NOT a real dark theme — a slightly warmer light variant (#efefee canvas, all surfaces still light). The ticket says "light and dark" and SHL-02 means light/dark, so a true dark palette must be designed (no seatMGT source).
- Tokens are MD3-named CSS vars in `:root`, mapped through `@theme inline` to utilities. Everything is token-driven except hard-coded orange rgba (focus ring, field focus shadow, `neon-bar`, nav logo shadow), `RoleBadge` inline `var(--…)` styles, and `Avatar`/`Chip` hex/`border-black/5` — those won't adapt to dark.
- UI kit files are small and dependency-free apart from React: only `Avatar` imports `@/lib/format` (`initials`), `RoleBadge` imports `Role` from `@/types`; the rest import only `./Icon`. Already RSC-friendly; only `EntityFormDialog` needs `"use client"` (useEffect). Button/Chip/IconButton take onClick props → used from client parents only.
- `EntityFormDialog`: hard-coded English ("Cancel", "Saving…"); `DialogField`/`DialogSelect` set `aria-label` and are wrapped in `<label>`; scrim click-to-close, no focus trap/restore. `FilledInput` not read but same pattern.
- `Icon` uses Material Symbols via a Google Fonts `<link>` in the root layout head; `next/font/google` Manrope/Poppins with `subsets:["latin"]` — for Vietnamese must be `["latin","vietnamese"]` or diacritics fall back to the system font. Poppins is only a fallback, can be dropped. The Material Symbols `<link>` is an external runtime dependency (CSP/offline risk).
- `AppShell` depends on `useAppStore` (rooms, currentUser, role, rank, theme, groupById), `authClient`, `ROLE_RANK`, `@/types` — all dropped. Nav `match` functions + `minRank` logic → `navItemsFor(tier)`. Room switcher is data-driven and out of scope; keep a slot only.
- simap today: `globals.css` is only `@import "tailwindcss"`; root layout `lang="vi"`, no theme/fonts; Vitest `environment: "node"`, includes `src/**/*.test.{ts,tsx}`.
- `check-layers.mjs`: `ui` may import only `ui` and `lib`; `src/app` pages may import `ui` and `lib`; `next/*` and `react` are packages (allowed in `ui`). Session type and `navItemsFor` must live in `lib` (or the shell in `ui` imports them from `@/lib`).

**Recommendations**
1. Port vs rewrite: port Card, Button/IconButton, Chip/FilterChips, Avatar, Icon, FilledInput, EntityFormDialog nearly verbatim — replace `Role` with `Tier` from `@/lib`, move all strings to `src/ui/copy/*.ts`. Rewrite AppShell. Port `globals.css` tokens, then add a real dark `[data-theme="dark"]` override block; replace hard-coded rgba with `color-mix`/tokens (e.g. `--focus-ring`, `--accent-shadow`).
2. Dependencies: add none beyond Tailwind (present). `next/font/google` (built in) Manrope `subsets:["latin","vietnamese"]`; drop Poppins. Prefer self-hosting the icon font via `next/font/local` woff2 (or a pinned subset) over the Google `<link>`; if the `<link>` stays, flag CSP/offline cost in the PLAN.
3. Layering: `src/lib/` — `tier.ts` (`Tier = "user"|"manager"|"admin"`), `nav.ts` (`navItemsFor(tier)` → `{href, labelKey, icon}[]`, `isActive(path)`), `session.ts` (`Session` type), `theme.ts` (pure parse/validate/storage-key helpers). `src/ui/` — kit components, `SessionContext` + `useSession`, `ThemeToggle`, `AppShell`. Shell = Client Component using `usePathname` + `next/link`. `(app)/layout.tsx` = Server Component mounting `SessionProvider value={null}` + `AppShell`. Page skeletons = Server Components with only title + empty state (D4 org-data pages go client later).
4. Session context replaces `AppStore`: `{tier,email,orgName}|null`, typed `useSession()`; provider takes a `value` prop so the auth ticket can swap in state without touching the shell. Signed out: sign-in placeholder, no nav items beyond what `navItemsFor` allows (decide: empty), slots (org, refresh, sign-out) disabled or hidden.
5. Theme without flash: inline blocking `<script>` in root `<head>` reads `localStorage`, sets `data-theme` on `<html>` before paint; `suppressHydrationWarning` on `<html>`; default `prefers-color-scheme`; `color-scheme` per theme in CSS. Toggle writes via `lib/theme.ts`. Keep the inline script string in `lib`/`ui` so a test can assert it.
6. Testing (no jsdom): Vitest for `navItemsFor` per tier, theme helper parse/serialize with an injected storage stub, `isActive`, copy-key coverage. Component checks via `renderToStaticMarkup` from `react-dom/server` in the node env (role badge label, `aria-current`, nav landmarks). No jsdom / Testing Library (D2). Interactive behaviour (toggle, Esc close) stays manual per the ticket's Test plan.
7. Vietnamese copy: one `copy/shell.ts` const object. Nav: Tổng quan, Phòng, Thành viên, Thiết bị, Phê duyệt, Trình chỉnh sửa. Roles: Người dùng, Quản lý, Quản trị. Actions: Làm mới quyền, Đăng xuất, Đổi giao diện. Dialog: Hủy, Lưu, Đang lưu…. Empty: "Chưa có dữ liệu." … Test for no stray ASCII English fallbacks.
8. A11y: `aria-label` "Điều hướng chính" + `aria-current="page"`; bottom bar at 390 px needs ≥44 px touch targets; `:focus-visible` ring must work in dark; dialog gets `role="dialog"`, focus management, `aria-labelledby` (cheap upgrade); status by label, not colour alone.

**Risks**
- Dark palette is new design work; check WCAG AA contrast manually.
- Icon font on Google CDN → "Material Symbols" ligature flash (`grid_view` text) while loading; mitigate with `display=block` or a self-hosted preloaded font.
- Hard-coded `rgba(251,87,41,…)` breaks in dark if ported verbatim.
- AC "no flash" cannot be proven in Vitest; needs a manual reload check.
- `renderToStaticMarkup` won't run `useEffect`/context updates — keep tests pure.

**Open questions** (with proposed defaults)
1. Dark palette: true dark (default) or ship seatMGT "warm light" as dark? Default: true dark, orange accent kept.
2. Initial theme: `prefers-color-scheme` or fixed light? Default: system on first visit, then stored.
3. Icon font: self-host a subset (default) or Google link?
4. Signed-out state: empty nav or minimal "Đăng nhập" placeholder only? Default: placeholder card, no nav.
5. Room switcher slot required now (SHL-01)? Default: reserved empty slot, wired by the Rooms ticket.
