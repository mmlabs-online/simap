Status: READY

# Plan — SIM-003: App shell and UI kit ported from seatMGT

**High paths:** none. No file in this plan matches `high:` in `.github/risk-tiers.yml`. `next.config.ts`,
`vitest.config.ts`, `scripts/check-layers.mjs` and `.env.example` are **not** touched. If the implementer finds it must
change one of them, it must stop and record why in impl-log. Gate `none` stands.

## Scope summary
- `docs/spec-v1.md` §6 SHL-01: "Nav rail on desktop and bottom bar on mobile, org name and switcher (AUT-06), room
  switcher, avatar and role badge, "refresh permissions", sign-out." / "Pages: Dashboard, Rooms, Room detail, Room
  editor (Admin), Members, Devices, Approvals (Manager+)."
- SHL-02: "The user switches between light and dark, and the choice is kept on the device."
- Visual style: "follow seatMGT's look: its UI kit (Card, Button, Chip, Avatar, RoleBadge, FilledInput,
  EntityFormDialog), seat tiles, room cards, fonts and icons. Copy changes to Vietnamese." (Seat tiles and room cards are
  out of scope per the ticket; they belong to their feature tickets.)
- SYS-01: "The UI hides or disables actions the role cannot use. Nav entries such as Approvals are hidden below
  Manager." §8 Security: "The UI only hides what the server already refuses."
- §8: "**Language:** all UI copy and user-facing errors are in Vietnamese with correct diacritics … Text is stored as
  Unicode NFC." "**Accessibility:** forms and actions work by keyboard. Status is never shown by colour alone."
  "**Browsers:** current desktop Chrome, Edge, Safari and Firefox. The room view and seat detail must work on mobile."
- §7 Not carried over: "Mock data (`src/lib/mock/data.ts`, the client `AppStore` fed from it) … Dev and test seeds may
  exist but contain no production data."
- `work/decisions.md` D1 (rebuild of seatMGT `ming_dev`), D2 ("Tailwind v4 … Vitest. First phase has light unit tests
  only (no e2e …)"), D4 ("Server Components/server actions do not handle org data"), D5/D13 (org in the shell, "org
  switcher in the shell"), D15 ("highest tier wins (Admin > Manager > User)"), D25 ("No Viewer tier in v1").

**Spec/ticket conflict (flagged, spec wins later):** SHL-01 lists a **room switcher**; the ticket does not (it needs room
data, out of scope here). This plan reserves a marked slot in the header and leaves wiring to SIM-010 (follow-up 2).

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | UI kit components render in light and dark theme with seatMGT's look; copy is Vietnamese with correct diacritics. | `pnpm dev`, open `/dev/shell?tier=admin`: the kit gallery shows Card, Button (filled/tonal/outline/text), IconButton, Chip, FilterChips, Avatar, RoleBadge ×3, FilledInput, EntityFormDialog (open via button). Toggle theme: every component changes palette (no white card left on the dark canvas, focus ring visible in both). Side-by-side with seatMGT light theme for look. Tests `src/ui/copy/copy.test.ts` (NFC, no U+FFFD/"?") and `src/ui/kit.test.tsx` (Vietnamese labels: "Hủy", "Đang lưu…", tier labels). |
| 2 | At ≥ 1024 px the shell shows a nav rail; at 390 px a bottom bar; every nav entry is reachable by keyboard. | `/dev/shell?tier=admin` in DevTools at 1024×768 → left rail; at 390×844 → bottom bar, header fits (org name truncates). Tab from page load: skip link "Bỏ qua đến nội dung chính" first, then every nav link in order, each with a visible focus ring; Enter navigates. Test `src/ui/AppShellView.test.tsx` (`<nav aria-label="Điều hướng chính">`, links are `<a href>`, `aria-current="page"` on the active one only). |
| 3 | `navItemsFor("user")` hides Approvals and the editor; `"manager"` shows Approvals; `"admin"` shows all (unit test). | `pnpm test` → `src/lib/nav.test.ts` cases listed below. |
| 4 | The theme choice survives a reload and does not flash the wrong theme on load. | `src/lib/theme.test.ts` executes `THEME_INIT_SCRIPT` against stubs. Manual: choose dark, reload with DevTools "Disable cache" + CPU 6× slowdown: no light frame; `document.documentElement.dataset.theme === "dark"` before hydration (view the inline `<script>` in `<head>` of the page source). Clear `localStorage` + emulate `prefers-color-scheme: dark` → starts dark. |
| 5 | No component under `src/ui/` imports server modules (R1), and no mock data file ships. | `pnpm check:layers` green. `git ls-files src \| grep -Ei "mock\|fixture\|seed"` prints nothing. `(app)/layout.tsx` passes `value={null}` to `SessionProvider`. `pnpm build && pnpm start`: `/dev/shell` answers 404 (dev-only page). |

## Ming verification after merge
- Real phone (iOS Safari and Android Chrome) at the shipped URL in dev or a preview: bottom bar respects the home
  indicator (safe-area inset), touch targets comfortable, Vietnamese diacritics render in Manrope (not a fallback face).
- Desktop Safari and Firefox: shell, theme toggle, icon font load.
- Taste check of the **new dark palette** (no seatMGT source exists for it; see Assumption 1).
- After SIM-006 lands: the real signed-in shell (org name, switcher, refresh permissions, sign-out wired).

## Files to create / modify
Line refs for seatMGT are on branch `ming_dev` under `D:\Projects\SAF\spaceM\projects\seatMGT\`.

| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/tier.ts` | create: `Tier = "user" \| "manager" \| "admin"`, `TIERS`, `TIER_RANK`, `atLeastTier(tier, min)` | nav visibility from the tier; SIM-005 reuses it (D15) | no |
| `src/lib/session.ts` | create: `Session = { tier: Tier; email: string; orgName: string }` (type only) | ticket: typed session interface | no |
| `src/lib/nav.ts` | create: `NavId`, `NavItem`, `navItemsFor(tier)`, `isActive(item, pathname)`, `roomEditorHref(code)` | ticket: pure `navItemsFor(tier)` | no |
| `src/lib/theme.ts` | create: `Theme`, `THEME_STORAGE_KEY`, `parseTheme`, `resolveTheme`, `nextTheme`, `readStoredTheme(storage)`, `writeStoredTheme(storage, t)`, `THEME_INIT_SCRIPT` | SHL-02 + no-flash; ticket test plan "theme preference read/write helper" | no |
| `src/lib/icons.ts` | create: `ICON_NAMES` (sorted const tuple), `IconName`, `iconFontHref()` | one typed list of Material Symbols used; drives the subset URL | no |
| `src/lib/format.ts` | create: `initials(name)` (ported from seatMGT `src/lib/format.ts:4-9`, see Approach 3) | `Avatar` depends on it | no |
| `src/lib/tier.test.ts`, `nav.test.ts`, `theme.test.ts`, `icons.test.ts`, `format.test.ts` | create | R5; pure logic first | no |
| `src/ui/Icon.tsx` | port seatMGT `src/components/ui/Icon.tsx:1-34`; `name: IconName` | kit | no |
| `src/ui/Button.tsx` | port `Button.tsx:1-101` (Button, IconButton); icon props typed `IconName` | kit | no |
| `src/ui/Chip.tsx` | port `Chip.tsx:1-80` (FilterChips, Chip); `border-black/5` → `border-outline-variant` | kit; dark-safe | no |
| `src/ui/Avatar.tsx` | port `Avatar.tsx:1-27`; import `initials` from `@/lib/format`; default bg/fg from tokens | kit; dark-safe | no |
| `src/ui/RoleBadge.tsx` | port `RoleBadge.tsx:1-38`; `role: Role` → `tier: Tier`; labels from copy | kit | no |
| `src/ui/Card.tsx` | port `Card.tsx:1-31` | kit | no |
| `src/ui/FilledInput.tsx` | port `FilledInput.tsx:1-34`; orange rgba → `--focus-ring` token | kit; dark-safe | no |
| `src/ui/EntityFormDialog.tsx` | port `EntityFormDialog.tsx:1-141` with native `<dialog>` (Approach 5); strings from copy | kit; a11y | no |
| `src/ui/PageSkeleton.tsx` | create: page title (`h1`) + empty-state card (icon + text) | route skeletons | no |
| `src/ui/ThemeToggle.tsx` | create (client): IconButton, `aria-pressed`, uses `@/lib/theme` | SHL-02 | no |
| `src/ui/session.tsx` | create (client): `SessionProvider({ value, actions?, children })`, `useSession()`, `useShellActions()` | replaces seatMGT `AppStore` | no |
| `src/ui/AppShellView.tsx` | create: presentational shell (props: `session`, `pathname`, `actions`, `children`), rewrite of seatMGT `src/components/shell/AppShell.tsx:34-157` | shell; testable without a router | no |
| `src/ui/AppShell.tsx` | create (client): reads `useSession`, `useShellActions`, `usePathname` → `AppShellView` | shell | no |
| `src/ui/index.ts` | create: barrel (as seatMGT `src/components/ui/index.ts:1-8` + new components) | imports via `@/ui` | no |
| `src/ui/copy/shell.ts` | create: nav labels (`Record<NavId,string>`), tier labels (`Record<Tier,string>`), shell actions, signed-out, page titles + empty texts | central Vietnamese copy | no |
| `src/ui/copy/kit.ts` | create: dialog strings (Hủy, Lưu, Đang lưu…, Đóng) | no hard-coded English in the kit | no |
| `src/ui/copy/copy.test.ts`, `src/ui/kit.test.tsx`, `src/ui/AppShellView.test.tsx` | create | R5 | no (Low) |
| `src/app/globals.css` | replace: port seatMGT `src/app/globals.css:1-77, 89-217, 247-327` + real dark block + new tokens (Approach 2) | tokens/theme | no |
| `src/app/layout.tsx` | modify: Manrope via `next/font/google` (`latin`,`vietnamese`), `suppressHydrationWarning`, `<head>` with theme init script + icon font `<link>` | fonts, icons, no-flash | no |
| `src/app/page.tsx` | **delete** | `/` becomes the Dashboard in `(app)`; two `page.tsx` for `/` fail the build | no |
| `src/app/(app)/layout.tsx` | create (server): `<SessionProvider value={null}><AppShell>{children}</AppShell></SessionProvider>` | shell; signed-out until SIM-006 | no |
| `src/app/(app)/page.tsx` | create: Dashboard skeleton | SHL-01 pages | no |
| `src/app/(app)/rooms/page.tsx` | create: Rooms skeleton | SHL-01 | no |
| `src/app/(app)/rooms/[roomCode]/page.tsx` | create: Room detail skeleton (ignores params) | SHL-01 | no |
| `src/app/(app)/rooms/[roomCode]/edit/page.tsx` | create: Room editor skeleton | SHL-01 | no |
| `src/app/(app)/members/page.tsx` | create: Members skeleton | SHL-01 | no |
| `src/app/(app)/devices/page.tsx` | create: Devices skeleton | SHL-01 | no |
| `src/app/(app)/approvals/page.tsx` | create: Approvals skeleton | SHL-01 | no |
| `src/app/dev/shell/page.tsx` | create (server, dev-only): `notFound()` unless `process.env.NODE_ENV === "development"`; `?tier=user\|manager\|admin\|none` → `AppShellView` with an inline preview session + `KitGallery` | the only way to verify AC1/AC2 and the ticket's manual test plan before SIM-006 (Assumption 6) | no |
| `src/app/dev/shell/KitGallery.tsx` | create (client): every kit component, dialog open/close state | AC1 manual check | no |

Rough size: ~1,500 changed lines, of which ~900 are ported CSS/components (see Split proposal).

## Data model / migration
None.

## API contract
None.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/nav.test.ts` › `user sees dashboard, rooms, devices, members only` | AC3: ids exactly `["dashboard","rooms","devices","members"]`; no `approvals`, no `roomEditor` |
| `src/lib/nav.test.ts` › `manager adds approvals but not the editor` | AC3 |
| `src/lib/nav.test.ts` › `admin sees all items incl. roomEditor` | AC3: 6 ids |
| `src/lib/nav.test.ts` › `rail items keep seatMGT order` | order dashboard, rooms, devices, members, approvals; `roomEditor` has `placement: "room"` |
| `src/lib/nav.test.ts` › `isActive` | `/` only exact for dashboard; `/rooms`, `/rooms/A1`, `/rooms/A1/edit`, `/rooms/` active for rooms; `/roomsx` not; dashboard not active on `/rooms` |
| `src/lib/nav.test.ts` › `roomEditorHref encodes the code` | `"A 1"` → `/rooms/A%201/edit`; Vietnamese chars encoded |
| `src/lib/tier.test.ts` › `atLeastTier ranks admin > manager > user` | D15 ordering, full 3×3 table |
| `src/lib/theme.test.ts` › `parseTheme` | `"light"`,`"dark"` ok; `null`, `""`, `"Dark"`, `"system"`, `"x"` → `null` |
| `src/lib/theme.test.ts` › `resolveTheme: stored wins, else system` | 4 combinations |
| `src/lib/theme.test.ts` › `readStoredTheme/writeStoredTheme with a storage stub` | round-trip; invalid stored → `null`; throwing `getItem`/`setItem` → `null` / no throw |
| `src/lib/theme.test.ts` › `THEME_INIT_SCRIPT sets data-theme before paint` | run via `new Function("localStorage","matchMedia","document", THEME_INIT_SCRIPT)` with stubs: stored dark → dark; none + prefers dark → dark; invalid + prefers light → light; throwing storage → light |
| `src/lib/icons.test.ts` › `ICON_NAMES sorted, unique, snake_case` | Google `icon_names` requires alphabetical order |
| `src/lib/icons.test.ts` › `every nav icon is in ICON_NAMES` | `navItemsFor("admin")` icons ⊂ list |
| `src/lib/icons.test.ts` › `iconFontHref` | contains `icon_names=<joined list>` and `display=block` |
| `src/lib/format.test.ts` › `initials` | `"Nguyễn Văn An"` → `"NA"`; `"an.nguyen"` → `"AN"`; `"đặng"` → `"Đ"`; NFD input → NFC output; `""`/`"   "` → `"?"`; `"Lê (cũ)"` → `"L"` |
| `src/ui/copy/copy.test.ts` › `every copy string is NFC, non-empty, no U+FFFD or "?"` | §8 Language, domain focus "Vietnamese text and diacritics" (walk both copy objects recursively) |
| `src/ui/copy/copy.test.ts` › `labels cover every NavId and Tier` | no missing label |
| `src/ui/AppShellView.test.tsx` › `signed out shows the sign-in placeholder and no nav` | `session: null` → contains `Chưa đăng nhập`, no `<nav`, no `Đăng xuất` |
| `src/ui/AppShellView.test.tsx` › `admin on /rooms/A1: nav landmark, 5 links, one aria-current` | AC2: `aria-label="Điều hướng chính"`, hrefs in order, `aria-current="page"` once on `/rooms`, `Quản trị` badge, skip link `href="#main"`, `<main id="main"` |
| `src/ui/AppShellView.test.tsx` › `user has no approvals link; manager has it` | AC3 at UI level (SYS-01) |
| `src/ui/kit.test.tsx` › `RoleBadge shows Vietnamese tier label` | 3 tiers |
| `src/ui/kit.test.tsx` › `Icon is decorative unless labelled` | `aria-hidden="true"` vs `role="img" aria-label` |
| `src/ui/kit.test.tsx` › `EntityFormDialog: labelled by its title, Vietnamese buttons` | `aria-labelledby` = title id; `Hủy`; `submitting` → `Đang lưu…`; error has `role="alert"`; `open=false` renders nothing |

All `.tsx` tests use `renderToStaticMarkup` from `react-dom/server` in Vitest's node environment (no jsdom, D2).
Interactive behaviour (toggle click, Esc, focus return) is manual (AC table).

## Approach
1. **lib first (pure, R1 layer `lib` → lib only).** Write `tier.ts`, `session.ts`, `nav.ts`, `theme.ts`, `icons.ts`,
   `format.ts` and their tests. `NavItem = { id: NavId; href: string; icon: IconName; minTier: Tier; placement: "rail" |
   "room" }`. Table (seatMGT `AppShell.tsx:20-32` order): dashboard `/` `space_dashboard` user; rooms `/rooms`
   `grid_view` user; devices `/devices` `lan` user; members `/members` `group` user; approvals `/approvals`
   `fact_check` manager; roomEditor `/rooms/[roomCode]/edit` `edit_square` admin, `placement: "room"` (contextual action
   on Room detail, used by SIM-015.x; not shown in the rail). `navItemsFor` filters with `atLeastTier`. Add a comment:
   hiding is UX only, the API enforces permissions (SYS-01). `THEME_INIT_SCRIPT` is an IIFE string built with
   `JSON.stringify(THEME_STORAGE_KEY)`, wraps everything in try/catch, falls back to `"light"`, sets
   `document.documentElement.dataset.theme`. Storage key `simap.theme`; stored values only `"light" | "dark"`.
2. **globals.css.** Keep `@import "tailwindcss"`. Port `:root` tokens (seatMGT lines 15-77), `@theme inline` (89-143)
   **without** `--font-poppins` (Poppins dropped), base/type/icon/scrollbar rules (145-217), status-dot (247-265),
   keyframes `fadein`/`popin` only, state-layer, focus and reduced-motion (285-327). Leave out `.hud-grid`, `.blob`,
   `.neon-bar`, `slidein`, `sheetup` (seat map / room card tickets port them). Add tokens `--focus-ring`
   (`color-mix(in srgb, var(--accent-orange) 22%, transparent)`), `--field-focus` (15%), `--accent-shadow` (30%),
   `--on-accent: #ffffff` and use them in place of every `rgba(251,87,41,…)`. `:root { color-scheme: light }`.
   Replace the seatMGT warm-light `[data-theme="dark"]` (79-87) with a real dark block, `color-scheme: dark`, starting
   values: background `#0f0f0f`, surface `#161616`, surface-container-lowest/low/–/high/highest `#121212 / #161616 /
   #1b1b1b / #232323 / #2c2c2c`, on-surface/on-background `#ececec`, on-surface-variant `#a3a3a3`, outline `#3a3a3a`,
   outline-variant `#2a2a2a`, primary `#ececec` / on-primary `#161616` (inverted pill), secondary `#a3a3a3`,
   secondary-container `#232323` / on-secondary-container `#ececec`, tertiary `#4fb0e5`, tertiary-container `#10324a` /
   on-tertiary-container `#a8d8f2`, error `#f87171`, error-container `#3b1414` / on-error-container `#fecaca`,
   accent-orange unchanged, accent-orange-soft `#3a1d14`, inverse-surface `#ececec`, inverse-on-surface `#1c1c1c`,
   scrim `rgba(0,0,0,0.6)`, card shadows with higher alpha, grid-line `rgba(255,255,255,0.06)`. Check text ≥ 4.5:1 and
   borders/focus ≥ 3:1 in both themes with DevTools; record the checked pairs in impl-log. Add
   `@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));` for later tickets. Focus rule
   `:where(button, a, [tabindex], input, select, summary):focus-visible` keeps `outline: 2px solid var(--primary)` (it
   inverts in dark) plus `box-shadow: 0 0 0 3px var(--focus-ring)`.
3. **UI kit port.** Copy each seatMGT file, then: `"use client"` only on `EntityFormDialog`, `ThemeToggle`,
   `session.tsx`, `AppShell.tsx`; imports via `./` or `@/lib/*` only; `Icon` `name: IconName`; replace hard-coded
   rgba/hex with tokens; RoleBadge uses `tier` and `copy.tiers[tier]`, status not by colour alone (it is a text label).
   `initials`: NFC-normalise, drop parentheses (seatMGT behaviour), split on whitespace, `.`, `_`, `-`; first letter of
   the first and the **last** part (`Array.from` for code points), `toLocaleUpperCase("vi")`, `"?"` when empty.
   Avatar with no `color` uses `--secondary-container` / `--on-secondary-container`; with a group colour keeps white text.
4. **Copy.** `src/ui/copy/shell.ts` (`as const`, NFC UTF-8): brand `simap`; nav `Tổng quan`, `Phòng`, `Thiết bị`,
   `Thành viên`, `Phê duyệt`, `Chỉnh sơ đồ phòng`; tiers `Người dùng`, `Quản lý`, `Quản trị`; actions `Chuyển tổ chức`,
   `Làm mới quyền`, `Đăng xuất`, `Chuyển giao diện sáng/tối`; `Bỏ qua đến nội dung chính`; nav landmark
   `Điều hướng chính`; signed out `Chưa đăng nhập` / `Đăng nhập bằng tài khoản mmlabs để tiếp tục.` / button
   `Đăng nhập`; page titles `Tổng quan`, `Phòng`, `Chi tiết phòng`, `Chỉnh sơ đồ phòng`, `Thành viên`, `Thiết bị`,
   `Phê duyệt` with empty texts (`Chưa có dữ liệu.`, `Chưa có phòng nào.`, `Chưa có thành viên nào.`,
   `Chưa có thiết bị nào.`, `Không có yêu cầu nào đang chờ.`). `src/ui/copy/kit.ts`: `Hủy`, `Lưu`, `Đang lưu…`, `Đóng`.
5. **EntityFormDialog.** Same props as seatMGT plus optional `cancelLabel`. Render a native `<dialog>`; a `useEffect`
   calls `showModal()` when `open` becomes true and `close()` when false (focus trap, Esc, inert background and focus
   return come from the browser). `cancel` event → `preventDefault()` + `onClose()`. Scrim close only when both
   `pointerdown` and `pointerup` hit the `<dialog>` element itself. `aria-labelledby` (title id from `useId`),
   `aria-describedby` for the subtitle, error line `role="alert"`. Style the scrim with `::backdrop { background:
   var(--scrim) }` in globals.css. `open === false` → return `null`. `DialogField`/`DialogSelect`: keep the wrapping
   `<label>`, drop the redundant `aria-label`.
6. **Shell.** `AppShellView` = seatMGT layout with `md:` → `lg:` (rail at ≥ 1024 px, bottom bar below, incl. tablets),
   `h-screen` → `h-dvh`, bottom bar `pb-[env(safe-area-inset-bottom)]`, bottom items ≥ 44 px tall, labels always shown.
   First focusable: skip link (`sr-only focus:not-sr-only`) to `#main`; `<main id="main" tabIndex={-1}>`.
   `<nav aria-label={copy.navLabel}>` lists `navItemsFor(session.tier).filter(i => i.placement === "rail")` as
   `next/link` with `aria-current`. Header: brand `simap`; with a session: org name (truncate) + org-switcher IconButton
   (`swap_horiz`), an empty `<div data-slot="room-switcher" />` (SIM-010), ThemeToggle, refresh (`sync`) and sign-out
   (`logout`) IconButtons — each `disabled` when its handler is absent — Avatar (name = email local part, `aria-hidden`,
   `title` = email) and RoleBadge (`hidden lg:inline-flex`). Without a session: no nav element, header has brand +
   ThemeToggle only, main shows a Card with `login` icon, the signed-out title/body and a disabled `Đăng nhập` Button
   (SIM-006 wires it, D33); children are not rendered. `AppShell` (client) passes `useSession()`, `useShellActions()`,
   `usePathname() ?? "/"` into the view. `session.tsx`: `createContext<Session | null>(null)` and
   `createContext<ShellActions>({})`; `ShellActions = { switchOrg?, refreshPermissions?, signOut? }` (all
   `() => void`).
7. **Theme toggle.** Client component: state `Theme | null`, set in `useEffect` from
   `document.documentElement.dataset.theme`; click → `nextTheme`, set `dataset.theme`, `writeStoredTheme(localStorage,
   …)`. `aria-pressed={theme === "dark"}`, constant `aria-label`, icon `dark_mode`/`light_mode` (render `dark_mode`
   until mounted to avoid a hydration mismatch).
8. **Root layout.** `Manrope({ subsets: ["latin", "vietnamese"], variable: "--font-manrope", display: "swap" })` (if
   the typed `subsets` rejects `vietnamese`, stop and record it — do not silently fall back to latin).
   `<html lang="vi" className={manrope.variable} suppressHydrationWarning>`; `<head>` holds
   `<script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />` first, then
   `<link rel="preconnect" href="https://fonts.googleapis.com">`, `<link rel="preconnect" href="https://fonts.gstatic.com"
   crossOrigin="">` and `<link rel="stylesheet" href={iconFontHref()}>`. `iconFontHref()` = seatMGT URL
   (`layout.tsx:44`) with `&icon_names=<ICON_NAMES joined by ",">&display=block` (block hides ligature text while
   loading). Metadata title stays `simap`.
9. **Routes.** Delete `src/app/page.tsx`. Create `(app)/layout.tsx` and the 7 skeleton pages as Server Components,
   each `<PageSkeleton title=… emptyText=… icon=… />` from `@/ui` with copy from `@/ui/copy/shell` — no data, no
   params use (D4: org-data pages become client pages in their tickets). Page-level role gating (e.g. editor for Admin)
   is the feature tickets' job; the server enforces permissions.
10. **Dev preview.** `src/app/dev/shell/page.tsx`: `if (process.env.NODE_ENV !== "development") notFound();` as the
    first statement; `await searchParams`; tier from `?tier=` validated against `TIERS` (`none` → `null`); inline
    preview session `{ tier, email: "xem-truoc@example.invalid", orgName: "Tổ chức xem trước" }`; renders
    `<AppShellView session pathname="/rooms" actions={{}}><KitGallery /></AppShellView>`. No separate fixture file.
11. **Checks.** `pnpm format`, then `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`,
    `pnpm build` (needs network for `next/font`). If Vitest cannot compile `.tsx` JSX, record it in impl-log and set the
    automatic JSX runtime in `vitest.config.ts` (not a High path; this is the only allowed extra file).

Rules: R1 — `src/ui` imports only `@/lib` and `./`; pages import `@/ui`, `@/lib`; no `src/server` import anywhere in
this ticket; `pnpm check:layers` proves it. R3 — no env reads except `NODE_ENV` in the dev page; no secrets. R4 — only
the files above. R5 — lib logic and copy have tests; all checks green. R2/R6 — not affected.

## Specialist input used
- frontend-developer 1 (port kit nearly verbatim, rewrite AppShell, tokenise rgba): adopted.
- frontend-developer 2 (Manrope `latin`+`vietnamese`, drop Poppins, no new dependencies): adopted. Self-hosted icon
  font: not adopted now (needs a binary asset and subsetting tooling, outside this ticket); Google `<link>` kept with
  `icon_names` subset + `display=block`, follow-up 1.
- frontend-developer 3 (lib: tier/nav/session/theme; ui: context, toggle, shell; server-component layout): adopted;
  added a presentational `AppShellView` so the shell is testable without a router.
- frontend-developer 4, ux-architect 5 (provider `value` prop; signed-out = placeholder card, no nav, slots hidden):
  adopted.
- frontend-developer 5, ux-architect 2 (inline blocking script, `suppressHydrationWarning`, system default,
  `color-scheme`): adopted; helper lives in `src/lib/theme.ts` (not `src/ui/theme.ts`) so it is pure and testable.
- frontend-developer 6 (`renderToStaticMarkup`, no jsdom): adopted.
- frontend-developer 7, ux-architect 9 (one copy object, NFC test): adopted, split into `shell.ts` and `kit.ts` per the
  ticket's `src/ui/copy/*.ts`. Editor label "Chỉnh sơ đồ phòng" instead of "Trình chỉnh sửa" (clearer).
- frontend-developer 8, ux-architect 7 (landmark, `aria-current`, 44 px targets, skip link, focus ring in dark):
  adopted.
- ux-architect 1 (real dark tokens, inverted primary, contrast targets): adopted with the values in Approach 2.
- ux-architect 4 (one table for rail + bottom bar, editor contextual, seatMGT order): adopted.
- ux-architect 6 (native `<dialog>`, labelledby, `role="alert"`, pointer-down+up scrim): adopted; body scroll lock not
  adopted (the shell scrolls inside `<main>`, the body does not scroll).
- ux-architect 8 (`lg:` breakpoint, `dvh`, safe area): adopted.
- ux-architect 2 third "system" option in the toggle: rejected (default: initial = system, toggle = light/dark).

## Assumptions
1. **Dark palette is real dark** (both consultants' default): seatMGT's `[data-theme="dark"]` is only a warmer light
   variant, so the dark values in Approach 2 are new design work; orange accent kept; Ming reviews the look after merge.
2. **Initial theme = system** (`prefers-color-scheme`) on first visit; after the first toggle the explicit choice is
   stored in `localStorage["simap.theme"]` as `light`/`dark`. No third "system" option in the UI.
3. **Icon font stays on Google Fonts** as in seatMGT, narrowed to a pinned `icon_names` subset with `display=block`.
   Self-hosting (offline/CSP) is follow-up 1. New icons are added to `ICON_NAMES` (typecheck enforces it).
4. **Signed-out state:** no nav, brand + theme toggle, a "Chưa đăng nhập" card with a disabled sign-in button; org
   name/switcher, avatar, role badge, refresh and sign-out render only with a session (disabled until SIM-006/SIM-007
   pass handlers).
5. **Room switcher:** reserved empty header slot only; SIM-010 wires it (spec SHL-01 conflict flagged above).
6. **Dev-only preview `/dev/shell`** is added (not in the ticket's file list) because the ticket's own manual test plan
   (390 px / desktop, keyboard through the nav, kit in both themes) is impossible while the shipped app is signed out.
   It returns 404 outside `next dev`, holds only an inline 3-field placeholder session with an `example.invalid`
   address (no data file, nothing real-looking), and can be removed later if Ming prefers.
7. **Room editor is a contextual nav item** (`placement: "room"`) returned by `navItemsFor("admin")` but not shown in
   the rail; its link on Room detail belongs to SIM-015.x.
8. **Nav labels:** Tổng quan, Phòng, Thiết bị, Thành viên, Phê duyệt, Chỉnh sơ đồ phòng; tier labels Người dùng / Quản
   lý / Quản trị (UX open question 4, consultants' terms; Ming may rename in the copy file).
9. **Initials** use the first and last name part ("Nguyễn Văn An" → "NA"), a deliberate change from seatMGT's first two
   parts, which suits Vietnamese names.
10. **Breakpoint:** rail at `lg` (1024 px) per the AC; 768–1023 px tablets get the bottom bar.
11. **Poppins dropped**; Manrope alone (it covers Vietnamese). `next/font` fetches at build time, so CI and the SIM-004
    image build need network access to Google Fonts (follow-up 4).
12. Unused seatMGT atmosphere CSS (`hud-grid`, `blob`, `neon-bar`, `slidein`, `sheetup`) is left to the seat map /
    room card tickets.
13. **Hotspots:** no other ticket is `IN_PROGRESS`, `REVIEW` or `DONE`. Later: SIM-005 should import `Tier` from
    `src/lib/tier.ts` (not redefine it); SIM-006 edits `src/app/(app)/layout.tsx` and `src/ui/session.tsx`; SIM-007
    passes `switchOrg`; SIM-010 fills the room-switcher slot.

**Follow-ups (debt issues, `project:simap`):**
1. Self-host the Material Symbols subset (offline, CSP) before go-live (SIM-021).
2. Room switcher in the shell header (SIM-010), spec SHL-01.
3. Strict CSP needs a nonce/hash for the inline theme script (SIM-004 / SIM-021).
4. Image build needs network for `next/font/google` or a self-hosted Manrope (SIM-004).

## Blocking questions
None.

## Split proposal
Above the ~400-line guide (~1,500 lines), but **not split**: about 900 lines are ported seatMGT CSS and components
whose review is a diff against the source, and the ACs interlock (the shell is built from the kit, the kit AC needs the
dark theme, and SIM-006/SIM-010 need both). If review asks for a split, cut here: **slice A** = `globals.css`, root
layout, `src/lib/{theme,icons,format}.ts`, the kit, `copy/kit.ts`, `KitGallery` (AC1, AC4); **slice B** =
`src/lib/{tier,session,nav}.ts`, `session.tsx`, `ThemeToggle`, shell, `copy/shell.ts`, route skeletons, dev preview
(AC2, AC3, AC5).
