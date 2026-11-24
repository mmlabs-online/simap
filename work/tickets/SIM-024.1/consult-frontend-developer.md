## Findings
- The settled defaults hold. I found no concrete defect, so none is reopened.
- CSP (`src/lib/security/headers.ts:34-38`): `img-src 'self' data: blob:` and `connect-src 'self' <identity>` cover `fetch("/sprites/office.json")` and `new Image()` from `/sprites/…`. A canvas needs no CSP entry. The loader must not use `createImageBitmap(blob)` or `URL.createObjectURL` for the atlas. Both would work (`blob:` is allowed) but add nothing, and `data:` is never needed. In dev, `unsafe-eval` is on, so dev does not prove a production-clean CSP. Nothing in the renderer needs inline script or style. Use classes for overlay positioning. Dynamic `style={{left, top}}` is fine because `style-src` has `'unsafe-inline'`.
- Validator (`src/lib/validate/sprite-manifest.ts:46-53`): every registry key must be present. A partial atlas always fails, so AC 3 (error state) is easy to trigger in tests. `meta` is optional (`types.ts:39`), so the default `?v=<meta.version>` can become `?v=undefined`. The validator takes `{w,h}` from the loaded image, so the load order is JSON, then image, then validate.
- Layer rules (R1): `src/lib/sprites/*` and `src/lib/validate/*` are lib and are pure. `src/ui/roomlayout/*` may import only lib. `src/app/dev/roommap/page.tsx` may import ui and lib. The dev page must be a server component with the `notFound()` guard (as in `src/app/dev/shell/page.tsx:12`). It renders a separate `"use client"` component. Fixtures stay in lib (`src/lib/sprites/fixtures.ts`), which is allowed.
- The `shell/page.tsx` pattern imports `@/ui` (the index). The new component needs an export in the `ui` index, or a direct `@/ui/roomlayout/...` import. Check `check:layers` accepts the direct path.

## Recommendations
1. **Structure (AC 1-5, R1).** Use four pieces:
   - Pure `src/lib/sprites/placement.ts` (`buildDrawList`, `ROTATION_TO_DIR`, `overlayFor`, `tileToPx`, `seatOrder`) and `src/lib/sprites/avatar.ts` (FNV-1a, ramps, view choice). Neither touches DOM types.
   - `src/ui/roomlayout/loadAtlas.ts`: `loadAtlas(fetchImpl, imageFactory) → Promise<{ok, manifest, image} | {ok:false, errors}>`. It takes an `AbortSignal` and has injectable deps, so Vitest runs it without jsdom.
   - `RoomCanvas.tsx` (`"use client"`): a canvas plus an overlay `div`.
   - `RoomMap.tsx` (`"use client"`): owns the loading, error and ready state, and renders `RoomCanvas`.
   - The demo page stays a server component, with a thin client wrapper holding the zoom state. Props must be serialisable (plain layout data, no functions).
2. **Load and redraw lifecycle.**
   - Load in `useEffect` with an `AbortController` and a `cancelled` flag. Set the `<img>` `onload`/`onerror` handlers before assigning `src`. Clear them in the cleanup.
   - StrictMode runs the effect twice. The abort makes the first run a no-op, and the browser cache makes the second cheap. Do not use a module-level singleton promise. A rejected promise would be cached and the error state could never retry. If one is used, evict it on failure. Provide a Retry button in the error state.
   - Draw in a separate `useEffect` keyed on `[atlas, drawList, zoom]`. The drawList comes from `useMemo`. Resizing the canvas (`canvas.width = …`) resets context state, so set `imageSmoothingEnabled=false` and the scale after every resize, inside the draw effect.
   - Do the draw synchronously in the effect. There is no rAF loop because the scene is static.
   - After the manifest validates, guard against a null `getContext("2d")` (show the error state).
3. **Tint cache.**
   - Put it in a per-atlas `WeakMap<HTMLImageElement, Map<string, HTMLCanvasElement>>`, keyed `frameKey|#hex`. This avoids a global leak and avoids stale tints when the atlas is swapped (AC 2).
   - The multiply, then `destination-in` sequence must use an offscreen canvas of exactly the frame size. Reset `globalCompositeOperation` to `source-over` afterwards.
   - Keep the key set small: 4 skin, 6 hair, 7 shirt colours.
   - The compositor should skip a layer whose frame is absent, instead of throwing.
4. **Fractional DPR.**
   - The default backing size `W·32·zoom` is in CSS px. At 125%/150% the browser resamples, with `pixelated` giving nearest-neighbour but uneven pixel widths.
   - Optional improvement: backing size = `round(cssW·dpr)`, scale = `zoom·dpr`. Use `ResizeObserver` with `devicePixelContentBoxSize` where available, or accept the softness and note it in the PR as the ticket plans. Do not add this unless the manual check shows a problem.
   - Set `width`/`height` as CSS px equal to `W·32·zoom`. Never let a max-width rule scale the canvas non-integrally.
5. **390 px.**
   - Wrap in `overflow-auto` with `overscroll-behavior: contain` and `tabIndex={0}`, with `role="region"` and an `aria-label` from copy. The canvas and overlay sit in one `relative` inner box of the same fixed pixel size, so they scroll together.
   - Avoid `touch-action: none`; native scroll does the panning.
   - Hover tags on touch: tap focuses the button, and `group-focus-visible` does not fire on touch focus. Use `group-focus` in addition for tap (still no tag at rest, D50).
   - Flip the tag horizontally near the left and right edges, not only below when `tileY < 2`, or the tag is clipped at the scroll container.
6. **Accessibility.**
   - Seats are `<button type="button">` in (row, column) DOM order, with the state in the `aria-label`. The state is also in text, so it is not shown by colour alone (§6).
   - The canvas gets `aria-hidden="true"` or `role="img"` with a one-line label. Not both a label and interactive children.
   - Tags `aria-hidden` is fine because the label already carries the content.
   - Focus ring: the white 2 px + teal outline must be visible against the pixel art. Use `focus-visible:outline`.
   - Keep tab stops to one per seat. Do not add `tabIndex` to the tags.
   - Respect `prefers-reduced-motion`. No animation is planned, so none is needed.
7. **Vitest (R5).**
   - Pure tests: FNV hash stability and difference across the 3+ fixture subs, with salts so skin, hair and shirt are not correlated. Also placement (`anchor`/`tiles` to px), draw order and tie-breaks, `ROTATION_TO_DIR` for all four rotations, `overlayFor` for every state, and the flip rule for tags.
   - Loader tests (injected fetch and image, no jsdom): a 404, invalid JSON, a failing validator, and an image error each return `{ok:false}` and never throw (AC 3).
   - A fixture test: every registry key used by the fixture exists in `public/sprites/office.json`. This catches rotation or key drift.
   - Do not test canvas pixels. Use manual checks and keep the draw function dumb.
8. **Demo.** In the page, check `NODE_ENV !== "development"` as in shell. This also hides it in `next start` (AC 6). Add a test or script assertion that no `src/app/dev` file is reachable from production routes, if cheap.

## Risks
- A module-level promise cache combined with StrictMode and the error state can leave a permanent error (see Rec. 2).
- `?v=<meta.version>` is undefined when `meta` is absent, which is allowed. Fall back to the JSON ETag or `Date.now()` in dev, or omit the query. This matters for AC 2 (swapping art without code changes).
- Tag clipping at scroll-container edges and tap-vs-hover on touch (390 px).
- `canvas.width` assignments reset smoothing. Missing that gives blurry art only after a zoom change.
- Dev CSP has `unsafe-eval` and production does not. Verify once in a production build, but the page itself is dev-only, so this only affects later room-view code that copies the renderer (SIM-015.1). Note it in the PR.
- Large canvases at 3x: a 40x30 tile room is 3840x2880 px, which is fine. Safari limits are about 16M px, so cap the fixture size and document the limit for SIM-015.1.

## Open questions
- Should seat `aria-label`s include the seat state text from copy (recommended), and is a tag-flip rule for the left and right edges in scope? I assumed both are in scope.
- Does `check:layers` allow `@/ui/roomlayout/*` direct imports from `src/app/dev/roommap`, or must they go through the `@/ui` index?
- Fractional DPR: stay with the CSS-px canvas and note the result in the PR (ticket default), or implement the dpr-aware backing size now? I recommend the former.
