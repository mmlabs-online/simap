# Implementation log — SIM-003

## Attempt 1 — 2026-11-20

### Files touched
| File | Required because |
|---|---|
| `src/lib/{tier,session,nav,theme,icons,format}.ts` | pure logic: tier ranks, session type, `navItemsFor`, theme helper + no-flash script, icon subset, initials (plan files 1-6) |
| `src/lib/{tier,nav,theme,icons,format}.test.ts` | R5 |
| `src/ui/{Icon,Button,Chip,Avatar,RoleBadge,Card,FilledInput,EntityFormDialog}.tsx` | UI kit port from seatMGT, tokenised, Vietnamese, icons typed |
| `src/ui/{PageSkeleton,ThemeToggle,session,AppShell,AppShellView,index}.ts(x)` | shell, session context, theme toggle, barrel |
| `src/ui/copy/{shell,kit}.ts`, `src/ui/copy/copy.test.ts`, `src/ui/{kit,AppShellView}.test.tsx` | central Vietnamese copy + tests |
| `src/app/globals.css` | seatMGT tokens + real dark block + new tokens (`--focus-ring`, `--field-focus`, `--accent-shadow`, `--on-accent`, `--shadow-strong`), dialog backdrop |
| `src/app/layout.tsx` | Manrope latin+vietnamese, `lang=vi` (already), theme init script, icon font link |
| `src/app/page.tsx` | deleted: `/` is now `(app)/page.tsx` |
| `src/app/(app)/layout.tsx`, `(app)/page.tsx`, `rooms/page.tsx`, `rooms/[roomCode]/page.tsx`, `rooms/[roomCode]/edit/page.tsx`, `members`, `devices`, `approvals` pages | shell + route skeletons |
| `src/app/dev/shell/page.tsx`, `KitGallery.tsx` | dev-only preview (Assumption 6) |

### Tests added / changed
- `src/lib/nav.test.ts` (tiers, order, isActive, roomEditorHref), `tier.test.ts`, `theme.test.ts` (parse, resolve, storage stub, `THEME_INIT_SCRIPT` via `new Function`), `icons.test.ts`, `format.test.ts`
- `src/ui/copy/copy.test.ts` (NFC, no U+FFFD or "?", label coverage), `src/ui/kit.test.tsx`, `src/ui/AppShellView.test.tsx`

### Checks (actual output summary)
- format:check: `All matched files use the correct format.` (exit 0, after `pnpm format`)
- typecheck: `next typegen && tsc --noEmit` exit 0 (needed `rm -rf .next` once: stale generated types referenced the deleted `src/app/page.tsx`)
- check:layers: `check-layers: 52 files, no violations`
- test: `Test Files 14 passed (14)`, `Tests 70 passed (70)`
- build: exit 0; routes `/`, `/approvals`, `/devices`, `/members`, `/rooms`, `/rooms/[roomCode]`, `/rooms/[roomCode]/edit`, `/dev/shell`; Manrope `vietnamese` subset accepted.
- `git ls-files src | grep -Ei "mock|fixture|seed"`: no output.

Manual checks done with curl (no browser available):
- Production build (`node .next/standalone/server.js`): `/dev/shell` and `/dev/shell?tier=admin` -> 404; `/` -> 200; `<html lang="vi">`, inline `simap.theme` script in `<head>`, icon font link with `icon_names` subset and `display=block`.
- `pnpm dev` (port 3112), `/dev/shell?tier=...`: admin/manager/user/none all 200; `<nav aria-label="Điều hướng chính">` present for the first three, absent for `none`; `href="/approvals"` present for admin and manager only; skip link `#main`, `<main id="main"`, `lang="vi"` present on all. `/`, `/rooms`, `/rooms/A1`, `/rooms/A1/edit`, `/members`, `/devices`, `/approvals` all 200; `/` shows `Chưa đăng nhập`.

Still manual (need a real browser; not done): visual look in light/dark, 390 px bottom bar vs 1024 px rail, keyboard tab order and focus ring, dialog open/Esc/focus return/scrim click, theme persistence across reload and no-flash, contrast pairs in DevTools (plan Approach 2 asks to record checked pairs: not recorded), Ming's phone/Safari/Firefox checks.

### Out-of-plan files
None. `vitest.config.ts` was not needed (JSX tests run as is). `next.config.ts`, `scripts/check-layers.mjs`, `.env.example` untouched.

### Follow-ups (noticed, not done)
`gh` unavailable, so these are not yet GitHub `debt` issues (label `debt`, `project:simap`); the orchestrator should file them:
1. Self-host the Material Symbols subset (offline, CSP) before go-live (SIM-021).
2. Room switcher in the shell header (SIM-010), spec SHL-01; the slot is `<div data-slot="room-switcher">`.
3. Strict CSP needs a nonce/hash for the inline theme script (SIM-004 / SIM-021).
4. Image build needs network for `next/font/google` or self-hosted Manrope (SIM-004).
5. Record WCAG contrast pairs for the new dark palette in a browser (plan Approach 2) and the Ming taste check.
6. `/dev/shell` is prerendered as a static 404 at build; fine, but remove the page if Ming prefers.

### Scope self-check
- Could the diff be smaller? No; ported kit and CSS dominate. `Chip`/`Avatar` icon/colour tweaks follow the plan.
- Diff size: about +1,500 / -30 lines (new files plus the CSS replacement).
