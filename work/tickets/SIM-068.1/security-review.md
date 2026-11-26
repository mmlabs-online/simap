# Security review — SIM-068.1

## Attempt 1

**Summary: PASS on security for SIM-068.1 attempt 1. I found no blockers and nothing that should be fixed. The change is decorative, uses only same-origin assets, and needs no CSP change.**

Scope: I read `src/ui/auth/SmallWorld.tsx`, `src/ui/auth/AuthLayout.tsx`, `src/lib/sprites/small-world-scenes.ts`, the `world` block of `src/ui/copy/auth.ts` and `src/lib/security/headers.ts`. I grepped the appended `aw-*` block in `src/app/globals.css` and the atlas loader in `src/ui/roomlayout/loadAtlas.ts` / `useAtlas.ts`. I had no shell in this run, so I could not run `git diff` or the check commands. The checks being green has to come from the implementer or CI.

### Findings

- 💭 **Network hosts and CSP.** The only fetches are the existing loader's same-origin `/sprites/office.json` (`loadAtlas.ts:14`, `:46`) and `/sprites/office.png?v=…` (`:15`, `:39`). Both are covered by `default-src 'self'` / `img-src 'self'` in `headers.ts:33` and `:37`.
  - The new code adds no script, font, image or connect host.
  - The appended CSS has no `url(...)` or `@import`. The only `@import` in `globals.css` is `tailwindcss` at line 1, which was already there.
  - Painting the canvas from a same-origin image does not taint the canvas, so nothing new is needed there.
  - `headers.ts` is unchanged and is enough.
- 💭 **No inline styles or scripts.** `SmallWorld.tsx` and `AuthLayout.tsx` have no `style=`, no `dangerouslySetInnerHTML` and no `<script>`. All rendered text is static copy from `authCopy.world` and is escaped by React. The nonce and `strict-dynamic` setup is unaffected.
- 💭 **Decoration is inert.**
  - Both side columns and the path are `aria-hidden="true"` (`SmallWorld.tsx:125`, `:130`, `:135`), and so is the card avatar (`:100`).
  - They contain only `<span>`, `<p>` and `<canvas>`: no `<a>`, button, input or tabindex. That means there is nothing focusable inside an aria-hidden subtree and no link or redirect surface.
  - The card (`children`) is in `.aw-world-center` (`:124`), which is not aria-hidden, so the form stays accessible.
- 💭 **The credential, Identity and Turnstile flow is untouched.**
  - `AuthLayout` only changes how the existing `children` are framed. On the landing page it puts them inside `<SmallWorld>`, and the `landing` flag is passed in from `views.tsx:83`, which already existed.
  - No form, submit handler, token handling or Turnstile code is in the changed files.
  - The card keeps a stable position in the tree: the conditional `<AtlasFeed>` takes its own child slot (`:122`), so when it mounts or unmounts the form is not remounted and typed credentials are not lost.
- 💭 **No secrets and no user data.** The scenes use fixed demo looks and seed strings, with `name: null` (`small-world-scenes.ts:124-143`). Nothing from the signed-out visitor is read or rendered.
- 💭 **Exposure is smaller on phones.** The atlas is fetched only when `matchMedia("(min-width: 1280px)")` matches (`SmallWorld.tsx:27`, `:112-122`). The server snapshot is `false`, so SSR never emits a fetch.

### Follow-ups (out of scope)
- If the sign-in page ever loads the atlas from a CDN or another origin, `img-src` / `connect-src` in `src/lib/security/headers.ts` would need that host added. It would also need `crossOrigin` set on the image, because a cross-origin image would taint the canvas. Nothing is needed for now.
