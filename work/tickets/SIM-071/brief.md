# Brief from Ming (2026-11-27): restyle simap to the Simap design tokens

Verbatim brief as given by Ming. Placeholders filled from the chat: [APP NAME] = simap; Scope = all screens;
pixel green = see ticket open question 1. Ming's answers in the chat: one ticket (planner slices it); keep dark mode
with derived dark values; DM Sans everywhere, keep Fraunces for the sign-in headline.

---

# Task: Restyle simap to the Simap design tokens

Update the existing app's visual layer to use the design tokens below. Do NOT change features, routes, data models, copy, or business logic. Only styling, theming and accessibility.

## Rules
1. Define every token once as a CSS custom property in a single global file (`src/styles/tokens.css`, imported at the app root). If the project uses Tailwind, map the same tokens in the Tailwind theme (`theme.extend`) so classes like `bg-canvas`, `text-primary`, `rounded-lg`, `p-4` resolve to the variables.
2. Remove hard-coded hex values, px radii, shadows and font stacks from components and replace them with tokens. No new magic numbers.
3. Keep the current layout and information architecture. Only adjust spacing/radius/typography when needed to snap to the scale.
4. Interactive targets are at least 44×44px. Body and control labels are at least 14px. Compact metadata is 12px.
5. Every status uses a text label, never color alone.
6. Honor `prefers-reduced-motion: reduce` (disable animations).
7. Do not add dependencies other than the DM Sans font.

## Tokens

### Colors
```css
:root {
  /* Brand */
  --color-workspace-primary: #ED5B35; /* workspace primary actions */
  --color-workspace-hover:   #D94B26;
  --color-pixel-primary:     #4D6540; /* pixel library primary actions */
  --color-pixel-hover:       #3E5532;
  /* Surfaces */
  --color-canvas:  #F8F9FB; /* page background */
  --color-surface: #FFFFFF; /* cards, inputs, dialogs */
  --color-cream:   #F5F3E9; /* login page background */
  --color-tile:    #F0F2E9; /* sprite preview background */
  /* Content */
  --color-text-primary:   #272931; /* headings and body */
  --color-text-secondary: #475569; /* descriptions */
  --color-text-pixel:     #354235; /* login content */
  /* Borders */
  --color-border:  #E1E4DE; /* input and control border */
  --color-divider: #E8ECE0; /* separators */
  --color-focus:   #7A915C; /* focus ring */
  /* Feedback */
  --color-success: #326646; /* approved */
  --color-warning: #855C15; /* pending */
  --color-danger:  #B44C46; /* destructive */
  --color-info:    #45648F; /* badge text */
  /* Room map */
  --color-room-floor: #E2C8A7;
  --color-room-green: #E9EDDF;
}
```

### Typography
```css
:root {
  --font-family-sans: "DM Sans", sans-serif;
  --font-family-mono: ui-monospace, monospace; /* coordinates, keys, code */
}
```
| Style | Size / line-height · weight | Use |
|---|---|---|
| Caption | 12/20 · 400 | badges, metadata, code |
| Label | 14/20 · 500 | form labels, buttons |
| Body | 16/24 · 400 | default text |
| Subtitle | 18/28 · 600 | dialog and card headings |
| Title | 24/32 · 600 | section titles, metrics |
| Display | 32/40 · 600 | page headings |
| Hero | 46/52 · 500 | desktop login headline |

### Spacing (4px base)
```css
:root {
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
  --space-5: 20px; --space-6: 24px; --space-8: 32px; --space-12: 48px;
}
```
Use 4–8 for icon/compact gaps, 12–20 for control and card padding, 24–48 for section and page spacing.

### Shape and elevation
```css
:root {
  --radius-sm: 4px;   /* compact badges */
  --radius-md: 6px;   /* chips, inner corners */
  --radius-lg: 8px;   /* buttons, inputs */
  --radius-xl: 12px;  /* cards, library items */
  --radius-2xl: 16px; /* modals, feature containers */
  --radius-full: 9999px; /* avatars, pill badges */

  --shadow-card:   0 4px 20px #53613e08;
  --shadow-dialog: 0 24px 100px #16221340;
  --shadow-pixel:  0 4px 0 #35492c; /* game-like primary button */
}
```
Pixel artwork and sprites keep square edges (no radius).

### Layout
```css
:root {
  --breakpoint-md: 800px;  /* sidebar appears */
  --breakpoint-lg: 1024px; /* desktop composition */
  --breakpoint-xl: 1280px; /* wide layouts */
  --size-control-min: 44px;
  --size-sidebar: 216px;
  --width-content: 1320px; /* standard page max */
  --width-library: 1600px; /* library page max */
}
```
CSS variables cannot be used in media queries, so hard-code 800 / 1024 / 1280 there (Tailwind: `md`, `lg`, `xl`).

### Motion
```css
:root {
  --duration-ui: 150ms;       /* default transitions */
  --duration-step: 280ms;     /* pixel character step: steps(2) */
  --duration-arrival: 3800ms; /* entrance-to-desk walk: linear */
}
@media (prefers-reduced-motion: reduce) {
  .animated-character { animation: none; }
}
```

## Component mapping
- **Primary button**: workspace areas use `--color-workspace-primary` (hover `--color-workspace-hover`). Pixel-library areas use `--color-pixel-primary` (hover `--color-pixel-hover`). White text, `--radius-lg`, min-height `--size-control-min`, Label style. Pixel variant may add `--shadow-pixel`.
- **Secondary / Reset**: `--color-surface` background, 1px `--color-border`, `--color-text-primary`.
- **Disabled**: reduced opacity, `not-allowed` cursor, no hover/shadow.
- **Inputs / selects / radios / checkboxes**: `--color-surface` background, 1px `--color-border`, `--radius-lg`, min-height 44px, Label-style labels. Focus ring: 2px `--color-focus` with offset. Selected state must be explicit (filled indicator plus a border or background change).
- **Cards / library items**: `--color-surface`, `--radius-xl`, `--shadow-card`, `--space-4` to `--space-6` padding.
- **Dialogs**: `--color-surface`, `--radius-2xl`, `--shadow-dialog`.
- **Badges / status**: pill (`--radius-full`) or `--radius-sm`, Caption style. Approved → `--color-success`, Pending → `--color-warning`, Error/destructive → `--color-danger`, Info → `--color-info`. Always include a text label.
- **Page background**: `--color-canvas`. Login or marketing screens: `--color-cream`. Sprite previews: `--color-tile`. Dividers: `--color-divider`.
- **Sidebar**: `--size-sidebar` wide, shown from `md` (800px) up.
- **Page container**: max-width `--width-content` (`--width-library` for library or grid-heavy pages), centered, `--space-6` to `--space-8` horizontal padding.
- **Transitions**: `color, background-color, border-color, box-shadow, transform` at `--duration-ui` ease-out.

## Scope
Apply to: all screens.
Brand context: use workspace coral for the main app actions. Use pixel green only for pixel/library features (see ticket open question 1).

## Deliverables
1. `tokens.css` (and the Tailwind theme mapping, if applicable).
2. All components and screens updated to use tokens only. Grep to confirm no leftover hard-coded hex colors or off-scale px values.
3. A short changelog: files changed, plus any places where the token scale forced a visible difference.
4. Self-check: contrast (WCAG AA) for text on every background, focus ring visible, 44px targets, reduced-motion respected, and layout verified at 800 / 1024 / 1280px.
