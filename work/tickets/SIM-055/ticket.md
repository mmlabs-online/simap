# SIM-055: Give the sign-in screens a game-style look

| Field | Value |
|---|---|
| State | DONE |
| Priority | P2 |
| Size | M |
| Areas | ui, ux |
| Gate | none |
| Depends on | — |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-26 |
| Claimed by | claude@2026-11-26T12:10Z |
| PR | — |

## Goal
The sign-in screens should feel like the start screen of a small office game, not a plain form next to an empty grey
box (Ming, 2026-11-26, screenshot of `/` signed out: "thay đổi UI đăng nhập cho nó phong cách game hơn").

## Scope reference
- D52 and `docs/art/style-guide.md` §1: sign-in and the org picker are pixel/game surfaces. Body text and forms never use
  a pixel font; pixel styling goes into art, frames, headings and decoration. The kit's controls stay the base.
- Style guide §4: `scene.signin`, "a small office vignette, about 12×7 tiles, composed from the above" (still the CSS
  placeholder in `src/ui/auth/SignInScene.tsx`).
- D41 / D46 / D48 (32 px tiles, whole-number scaling, `image-rendering: pixelated`, no game engine or new library);
  D45 / D66 (only the licence-checked bundled art).

## Scope
- Replace the `SignInScene` placeholder with a real pixel vignette of an office (desks, chairs, monitors, plants, a
  window, one or two avatars at desks), drawn from the committed sprite atlas with the existing map paint code
  (canvas or DOM), at a whole-number scale. It stays decorative (`aria-hidden`) and hidden below `md`, as today.
- Game-style frame for the sign-in card in `AuthLayout`: a stronger pixel frame (stepped corners, darker outline, a
  drop shadow made of pixels), the brand line as a small pixel "title" (pixel font or pixel lettering allowed for the
  brand and the screen heading only), and a game-like primary button (chunky pixel border, pressed state).
- The page background gets a subtle tiled floor pattern (or similar pixel texture) behind the card and scene.
- Applies to every screen that uses `AuthLayout` (sign in, forgot password, create account, accept invitation, the
  signed-out notice) and the org picker (`OrgPickerView`), so they look like one set.
- All new copy in `src/ui/copy/auth.ts` (D36).

## Out of scope
- Changing the sign-in flow, fields, validation, Turnstile or Identity calls.
- Pixel fonts in inputs, labels, notices, links or body text (style guide §1).
- New third-party art or fonts that are not already licence-checked (D45); new libraries; animation beyond a small
  idle effect (optional, must respect `prefers-reduced-motion`).
- Management screens (D52 keeps them on the clean kit).

## Acceptance criteria
- [ ] On a desktop width, the sign-in screen shows a pixel office vignette next to the card instead of the grey box;
      it is drawn from the bundled atlas at a whole-number scale with no smoothing, and is hidden from assistive tech.
- [ ] The card, brand/heading and primary button have a game-style pixel look; inputs, labels, notices and links keep
      the readable kit font and the kit's controls, and keyboard focus stays clearly visible.
- [ ] Every `AuthLayout` screen and the org picker share the new look; below `md` the card fills the width with no
      horizontal scroll at 320 px.
- [ ] Contrast of text and the focus ring meets WCAG AA; `prefers-reduced-motion` disables any animation.
- [ ] If the atlas fails to load, the scene falls back to the current placeholder and sign-in still works.
- [ ] All Checks pass.

## Technical notes
- Files (likely): `src/ui/auth/SignInScene.tsx`, `src/ui/auth/AuthLayout.tsx`, `src/ui/org/OrgPickerView.tsx`,
  `src/app/globals.css` (`px-frame`, `px-strip`, new pixel button/background utilities), `src/ui/copy/auth.ts`,
  possibly a small scene layout constant next to `src/lib/sprites/` (pure data: which sprite on which tile), reusing
  `useAtlas` / `tintedFrame` from `src/ui/roomlayout/` (check the R1 layer rules: ui → ui and lib only).
- A pixel font for the brand/heading: only if one is already in the repo or its licence is checked (D45); otherwise use
  pixel lettering via CSS (e.g. text-shadow steps) and keep the kit font. Flag in the plan if a font is needed.
- The SIM-046.1 guard test (`src/ui/no-photo-on-map.test.ts`) must stay green.
- Risks: the sign-in page is the first paint for everyone — keep the atlas load off the critical path (render the card
  first, the scene when the atlas is ready); CSP (SIM-027) must still allow the canvas/atlas.

## Test plan
- Unit: the scene layout data uses only keys that exist in `keys.json` and fits the scene size; `AuthLayout` and
  `OrgPickerView` render the new frame classes; no pixel-font class on inputs, labels or body text (like the existing
  `AuditView` check); copy has no literals.
- Manual: `pnpm dev`, signed out at desktop and 320 px; tab through the form; reload with the atlas blocked; check
  forgot password, create account and the org picker.

## Notes / answers from Ming
- Plan approved (2026-11-26, batch 2026-11-26-4): "duyệt hết theo mặc định"; Q1 default: CSS pixel lettering, no new font; Q2: `data-variant` on src/ui/Button.tsx approved.

## Handoff
