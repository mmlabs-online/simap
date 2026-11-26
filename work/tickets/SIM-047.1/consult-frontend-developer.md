# Consult — frontend-developer — SIM-047.1

## Consult: SIM-047.1, pixel character picker (UI)

### Findings
1. **Server slice is complete.** PUT, DELETE and GET `/api/me/pixel-look` are in `src/app/api/me/pixel-look/route.ts`.
   - PUT takes exactly `{skin, hair, style, shirt}` and answers `{look}`.
   - A bad value gives 422 `invalid_look`. A non-object or malformed body gives 400 `invalid_request`.
   - DELETE answers `{look:null}`. GET answers `{look: PixelLook|null}`.
   - Both write routes answer 403 `member_deactivated` and 404 `not_found` (no member row).
2. **Pure helpers are in `src/lib/sprites/pixel-look.ts`.**
   - `PIXEL_LOOK_KEYS`, `isPixelLook` and `parsePixelLook`.
   - `lookFromChoice(choice)` returns the colours.
   - `derivedChoice(seed)` returns the indices that Reset and preselection need.
   - `avatarFrames(look, "front"|"back")` in `src/lib/sprites/avatar.ts` returns three `{key, tint}` frames, drawn in order: body, shirt, hair.
   - Presets come from `SKIN_RAMP` (4), `HAIR_RAMP` (6), `SHIRT_RAMP` (7) and style 1..3. The picker should iterate these ramps and never hard-code counts, because the ramps are append-only.
3. **Preview drawing.**
   - `useAtlas()` in `src/ui/roomlayout/useAtlas.ts` returns `{atlas, failed}`.
   - `tintedFrame(atlas, key, hex)` in `src/ui/roomlayout/paint.ts` returns a cached canvas or null.
   - Draw each preview onto a small `<canvas>` with `imageSmoothingEnabled=false`, using integer scale 1 and 2. Canvas CSS size should equal the pixel size.
   - Use `ctx.drawImage` for each of the three frames, in order. The map draws them in that same order.
4. **The seed is the main gap.** The map seeds the derived look from `members.id` (`seat-view.ts`: `avatarSeed: s.occupantId`). The server DTO `MeMemberDto` has `id`, and `GET /api/me` returns it. But `readMeResult` in `src/lib/identity/flow.ts` (lines 114-121) keeps only `displayName` and `needsProfile`. It drops `id`. `ProfileTab.tsx` only reads `displayName`, and the session has `email` and `tier`, not the member id.
   - The ticket says "preview returns to `derivedChoice(me.id)`". `/api/me`'s top-level `sub` is NOT the seed. Using `sub` would make the preview disagree with the map.
5. **Current Profile tab.**
   - `ProfileTab.tsx` is a container with its own `load` state. `ProfileTabView.tsx` is a pure form, tested in `ProfileTabView.test.tsx`.
   - Copy is in `portalCopy.profile` in `src/ui/copy/portal.ts`.
   - Notices use `role=status|alert`. Errors map through `profileOutcome` in `portal-state.ts`.
   - The existing `apiFetch` retry-on-401/403 applies, so PUT and DELETE are idempotent and safe to repeat.

### Recommendations
- **Seed (AC3).** Widen `readMeResult` and the `MeResult` member type with an optional `id: string`. This is a small additive lib change with tests in `flow.test.ts`. It can instead be handled by a UI-local parse of `/api/me` in the new picker's load. Prefer the lib change, so `ProfileTab` reads `{name, memberId}` in its existing `read()`. This stays inside "ui" scope and needs no server change. Mention it in the plan, since it touches `src/lib/identity/flow.ts`. Check whether that file is a High path in `.claude/loop.config.md`.
- **Load.** On mount, GET `/api/me/pixel-look`, in parallel with the existing `/api/me` read. Initial selection is `look ?? derivedChoice(memberId)`. Show a loading state or the "derived" state, and show an error notice on a failed GET. A failed pixel-look GET must not block the name form.
- **Structure.**
  - New `src/ui/portal/PixelLookPicker.tsx` (pure view). Props: `value`, `memberId`, `saved: PixelLook|null`, `saving`, `notice`, `onChange`, `onSave`, `onReset`. It embeds a `LookPreview` canvas component (front and back, 1x and 2x).
  - New `src/ui/portal/PixelLookSection.tsx` (container with fetch). It owns the API calls and the `useAtlas` call.
  - New `src/ui/portal/pixel-look-api.ts` for the fetch helpers, in the same style as `profilePatchInit`. Add a pure outcome mapper to `portal-state.ts` or a new `pixel-look-state.ts`: 200 gives saved, 422 `invalid_look` gives a readable error, 403 `member_deactivated` gives the access message, 404 gives a "profile not found" message, and a network error gives retry.
  - Copy goes under a new `portalCopy.pixelLook` key.
- **Accessibility.**
  - Use a `fieldset` and `legend` per layer, with a radio group (`role=radio` or native `input type=radio`) and a visible focus ring.
  - Swatches need `aria-label`s such as "Skin 2 of 4". Colour must not be the only cue, so mark the selected swatch with a ring or check.
  - The hair style options need a text label or a small canvas thumbnail.
  - Each preview canvas needs `role="img"` and an `aria-label`.
  - Announce save and reset results with `role=status` or `role=alert`.
- **Reset.** Disable Reset when nothing is stored and the draft equals the derived look. After Reset, call DELETE, then set the draft to `derivedChoice(memberId)`.
- **Atlas fallback.** If the atlas fails or is still loading, show a text or skeleton placeholder. Do not block the pickers. Use `useAtlas().failed`.
- **Tests.**
  - Pure outcome mapper and picker view tests (jsdom, same style as `ProfileTabView.test.tsx`).
  - A test that the picker offers exactly `SKIN_RAMP.length`, `HAIR_RAMP.length`, 3 styles and `SHIRT_RAMP.length` options.
  - A test that the PUT body equals the draft and a DELETE sends no body.
  - A test that the Reset draft equals `derivedChoice(id)`.
  - For canvas preview tests, stub `createCanvas` as `paint.ts` already allows.

### Avoiding conflicts with SIM-046.1
SIM-046.1 will edit `ProfileTab.tsx`, `ProfileTabView.tsx`, `copy/portal.ts` and probably `portal-state.ts` and the tab tests. Recommendations:
1. **Order.** SIM-047.1 should branch from `main` only after SIM-046.1 has merged. Rebase if it was already started. Declare "Depends on: SIM-046.1" in the plan and the board.
2. **Keep the shared edit surface to the minimum.**
   - Put all of the picker's logic and UI into new files (`PixelLookPicker.tsx`, `PixelLookSection.tsx`, `pixel-look-api.ts`, its own tests).
   - Put copy under a separate top-level key (`portalCopy.pixelLook`), not inside `profile`. Add it at the end of the object, or in a new `src/ui/copy/pixel-look.ts` that `portal.ts` re-exports. A new file avoids merge conflicts in `portal.ts` entirely, but the ticket says copy goes in `copy/portal.ts`. A separate key appended at the end of the file is an acceptable compromise.
   - The only edit to existing files is mounting `<PixelLookSection />` in `ProfileTab.tsx`, as a sibling of `<ProfileTabView>` (wrap both in a fragment or flex column). Do not add props to `ProfileTabView`.
   - Do not touch the `ProfileTabView` props, so SIM-046.1's photo section does not collide.
3. **After SIM-046.1 merges**, place the picker section below the photo section and the name form (or between them). Settle the order in the plan and check the layout. The `max-w-md` container in `ProfileTabView` may need to be shared. The picker with two scales of previews fits in 28rem if it stacks.
4. **Do not touch `AppShell.tsx` or `Avatar.tsx`.** Those belong to SIM-046.1. Note in the plan that the shell avatar (photo) and the pixel character are separate.
5. SIM-046.1's guard test says `src/lib/sprites/**` and `src/ui/roomlayout/**` never reference a photo path. SIM-047.1 does not add to either, but it imports from them. Keep any new shared code out of those dirs, to avoid tripping the guard.

### Risks
- The seed mismatch (finding 4) would silently make "Reset and preview match the map" false. AC3 needs a test that uses a known id.
- `tintedFrame` caches per atlas image. This is fine, but the frame count per draw is 3 x 4 previews, so redraw only when the draft changes (`useEffect` on the look).
- The two PRs touch the same tab, so a conflict is possible in `ProfileTab.tsx` if the order is not followed. A rebase is trivial if the section is a sibling.
- If the user changes the draft and navigates away, the changes are lost. That is acceptable, but a "Save" button disabled state when the draft equals the saved look avoids pointless writes. (The server already ignores unchanged writes: `is distinct from`.)
- 422 `invalid_look` should be impossible from the UI. Still show a generic message.
- Atlas load failure or tiny-screen layout: previews must not overflow. Check at 320px width.
- If `flow.ts` is in a High path, the `member.id` change could raise the tier of the PR. Check `.github/risk-tiers.yml`.

### Open questions
1. Is it acceptable to widen `readMeResult` (a `src/lib/identity/flow.ts` change) to carry `member.id`, or should the picker parse `/api/me` itself? Recommendation: widen it.
2. Do we want the preview of the "derived look" labelled (for example "Automatic look")? That helps users understand what Reset does. Recommendation: yes, one line of copy.
3. Should Save and Reset update anything else on the page (for example the shell avatar)? Recommendation: no. The shell avatar is a photo or initials (SIM-046.1), and the map picks up the look on the next layout load.
4. Should the picker be shown when the atlas fails to load? Recommendation: yes, without previews, since the choice is still saveable.

Files read: `work/tickets/SIM-047.1/ticket.md`, `work/tickets/SIM-046.1/ticket.md`, `src/ui/portal/ProfileTab.tsx`, `src/ui/portal/ProfileTabView.tsx`, `src/lib/sprites/pixel-look.ts`, `src/lib/sprites/avatar.ts`, `src/lib/validate/pixel-look.ts`, `src/app/api/me/pixel-look/route.ts`, `src/server/members/pixel-look.ts`, `src/lib/identity/flow.ts`, `src/ui/roomlayout/useAtlas.ts`, `src/ui/roomlayout/paint.ts`.
