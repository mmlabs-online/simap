Status: READY

# Plan — SIM-047.1: Pixel character picker in the Profile tab

## Scope summary
This is slice B of SIM-047. Slice A (storage, `/api/me/pixel-look`, room map drawing the stored look) is merged.

- Ticket scope (`work/tickets/SIM-047.1/ticket.md` l.25-28):
  - "Profile tab "Pixel character" section: four preset pickers (swatches for skin / hair colour / shirt, three hair
    styles)."
  - "Live preview front and back at 1× and 2× (reuse `useAtlas` and `tintedFrame` from `src/ui/roomlayout/`)."
  - "Save (PUT `/api/me/pixel-look`), Reset (DELETE; preview returns to `derivedChoice(me.id)`), 422 and error
    notices, copy in `copy/portal.ts`."
  - "Lands after SIM-046.1 if that is still open (shared Profile tab and copy files)."
- Out of scope (l.31): "server, schema and API changes (none needed)".
- `docs/spec-v1.md` POR-06 (l.599-607): "The member customises the 32 px layered avatar used on the room map (LAY-06)
  from preset choices per layer: skin, hair colour, hair style, shirt colour ... No free colour input and no upload." /
  "A live preview shows the character front and back at 1× and 2× before saving. "Reset" goes back to the look derived
  from the member id." / "Open maps show the new look at the next layout load."
- LAY-06 (l.475-476): "the member's chosen pixel character when set (POR-06), else colours derived from the member id".
- Member entity (l.130): "no stored look = look derived from the member id as before (D71)."
- Parent split (`work/tickets/SIM-047/plan.md` l.257-261): slice B "Covers AC3 and the manual test plan. No High path."
  Parent A2 (l.207-208): "slice B's preview uses `MeMemberDto.id`" (the map seeds from `members.id`,
  `src/lib/sprites/seat-view.ts:21` `avatarSeed: s.occupantId`).
- `work/decisions.md` D71 (pixel character stored on the member) and D36 (UI copy in `src/ui/copy/<feature>.ts`).

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | The picker offers only the presets; the preview updates live front and back at 1× and 2×. | `pixel-look-state.test.ts` › "pickerOptions: exactly SKIN_RAMP, HAIR_RAMP, SHIRT_RAMP entries and styles 1..3" and "choose ignores an index outside its ramp". `PixelLookPicker.test.tsx` › "one radio per preset per layer, the draft is checked" and "atlas ready: four preview canvases (front/back x 1x/2x), each role=img with a label, canvas size = box x scale". `pixel-look-preview.test.ts` › "ops are body, shirt, hair with the ramp tints, placed by manifest anchors". Live update is code-read: `LookPreview` redraws in a `useEffect` keyed on the draft. Local run: `pnpm dev`, My Portal → Profile, click swatches; all four previews change at once. |
| 2 | Save stores the look; the room map shows it on the next layout load. | `pixel-look-api.test.ts` › "save sends PUT /api/me/pixel-look with exactly the draft as JSON" and "save 200 returns the parsed look". `pixel-look-state.test.ts` › "afterSave ok: saved = draft, status notice". Map side is slice A, already tested: `src/server/layout/layout.db.test.ts` › "stored pixel look is returned for every viewer", `src/lib/sprites/placement.test.ts` stored-look case. Local run: Save, then open a room map where that member sits and reload; the new look shows. |
| 3 | Reset returns to the derived look (seeded from `members.id`) and the preview matches the map. | `pixel-look-state.test.ts` › "afterReset ok: saved null, draft = derivedChoice(memberId), and lookFromChoice(draft) equals resolveLook(null, memberId) (what the map draws)" with a fixed UUID member id. `pixel-look-api.test.ts` › "reset sends DELETE with no body". `flow.test.ts` › "readMeResult keeps member.id" (the seed reaches `ProfileTab`). Code read of `ProfileTab.tsx`: the seed is `me.member.id`, never `sub`. |
| 4 | All Checks pass. | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`. `src/ui/copy/no-literals.test.ts` and SIM-046.1's `src/ui/no-photo-on-map.test.ts` stay green. |

## Ming verification after merge
- On the hosted app, My Portal → Profile: pick a character, check the four previews, Save. From another account, open
  a room map where you sit and reload: the new look is drawn.
- Reset: the previews go back to the automatic look, and the map shows the old (derived) look after a reload.
- Narrow phone screen (about 320 px wide): the section stacks with no horizontal scroll.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/identity/flow.ts` | `MeResult` (l.50): member type becomes `{ id?: string; displayName: string; needsProfile: boolean }`. `readMeResult` (l.114-121): read `id` too and include `id` only when it is a string (`...(typeof m.id === "string" ? { id: m.id } : {})`). The member is still kept or dropped on `displayName`/`needsProfile` only. No other change. | AC3 (seed = `members.id`; `MeMemberDto.id` already sent by `GET /api/me`, `src/lib/members/types.ts:4`) | No (only `src/server/identity/**` is High; `src/lib/identity/**` is not listed in `.claude/loop.config.md` l.44-45) |
| `src/lib/identity/flow.test.ts` | Update the expectation at l.194 to include `id: "m"`; add one case (see Tests). | AC3, R5 | No |
| `src/ui/portal/pixel-look-api.ts` | New. `createPixelLookApi(fetcher: ApiFetch)` returns `{ get, save, reset }`, each resolving to `PixelLookResult<T> = { ok: true; value: T } \| { ok: false; code: string }` and never throwing. Private `call` / `errorCode` / `ApiAccessError` mapping copied from `src/ui/deviceTypes/device-types-api.ts` l.10-43 (`signed_out` → `unauthenticated`, other throw → `unavailable`). `get(): Result<PixelLook \| null>`: GET, body `{look}`; `look === null` → null, else `parsePixelLook(look)` or `internal`. `save(look: PixelLook): Result<PixelLook>`: PUT, `content-type: application/json`, `body: JSON.stringify({ skin, hair, style, shirt })` (exactly the four keys, built field by field), response `{look}` parsed the same way. `reset(): Result<null>`: DELETE with no body and no content-type; 200 → `{ ok: true, value: null }`. | AC2, AC3 | No |
| `src/ui/portal/pixel-look-state.ts` | New, pure (no React). See Approach step 2 for the exact API. | AC1, AC2, AC3 | No |
| `src/ui/portal/pixel-look-preview.ts` | New, pure. `previewOps(manifest: SpriteManifest, look: PixelLook, view: AvatarView): { width: number; height: number; ops: { key: string; tint: string; x: number; y: number; w: number; h: number }[] } \| null`. Uses `avatarFrames(lookFromChoice(look), view)` (same order and tints as the map, `src/lib/sprites/placement.ts` l.447-453) and `manifest.frames[key]` (`w`, `h`, `anchor`). The box is min(anchor) to max(anchor + size) over the three frames; `x`/`y` are anchors minus the box origin. Any missing frame → null. | AC1, AC3 (preview = map) | No |
| `src/ui/portal/LookPreview.tsx` | New, `"use client"`. Props `{ atlas: Atlas \| null; failed: boolean; look: PixelLook; view: AvatarView; scale: 1 \| 2; label: string }`. With an atlas and non-null `previewOps`: `<canvas role="img" aria-label={label} width={box.width*scale} height={box.height*scale} style={{ width: box.width*scale, height: box.height*scale, imageRendering: "pixelated" }}>`; a `useEffect` on `[atlas, look, view, scale]` clears, sets `imageSmoothingEnabled = false`, and for each op draws `tintedFrame(atlas, op.key, op.tint)` at `(x*scale, y*scale, w*scale, h*scale)`; a null tinted frame is skipped. Without an atlas: a fixed 32 x scale placeholder `<span>`; `failed` adds no text here (the picker shows one notice). | AC1 | No |
| `src/ui/portal/PixelLookPicker.tsx` | New, pure view (props only, no hooks). Layout under Approach step 4. Props: `{ draft: PixelLook; isDerived: boolean; status: "loading" \| "ready" \| "failed"; busy: "save" \| "reset" \| null; canSave: boolean; canReset: boolean; notice: PickerNotice \| null; atlas: Atlas \| null; atlasFailed: boolean; onChoose(key: PixelLookKey, value: number): void; onSave(): void; onReset(): void }`. | AC1, AC2, AC3 | No |
| `src/ui/portal/PixelLookSection.tsx` | New, `"use client"` container. Props `{ memberId: string }`. Holds `PickerState` (`useState(() => initialPicker(memberId))`), a mounted ref, `createPixelLookApi(useApiFetch())` (memoised), `useAtlas()`. On mount: `api.get()` then `loaded(...)`. `onChoose` → `choose`; `onSave`: return if `!canSave`, set busy, `api.save(state.draft)`, apply `afterSave` if mounted; `onReset`: same with `api.reset()` and `afterReset`. Renders `PixelLookPicker`. | AC1-AC3 | No |
| `src/ui/portal/ProfileTab.tsx` | `Load` ready variant gains `memberId: string \| null` (l.14); `read()` takes `read.me?.member?.id ?? null` next to the name (l.37). In the `sections` fragment that SIM-046.1 adds, mount the picker after the photo: `sections={<><ProfilePhoto name={load.name} />{load.memberId !== null && <PixelLookSection memberId={load.memberId} />}</>}`. One import. | AC1-AC3 | No |
| `src/ui/copy/portal.ts` | Add `profile.character` right after SIM-046.1's `profile.photo` sub-object. Text under Approach step 5. | D36 | No |
| `src/ui/portal/pixel-look-api.test.ts` | New. | AC2, AC3, R5 | No |
| `src/ui/portal/pixel-look-state.test.ts` | New. | AC1-AC3, R5 | No |
| `src/ui/portal/pixel-look-preview.test.ts` | New. | AC1, AC3, R5 | No |
| `src/ui/portal/PixelLookPicker.test.tsx` | New, static render (`renderToStaticMarkup`, as `ProfileTabView.test.tsx`). | AC1-AC3 | No |

Not touched: `ProfileTabView.tsx` and its test (SIM-046.1 owns the `sections` slot), `portal-state.ts` (SIM-053 edits
it), `AppShell*.tsx`, `Avatar.tsx`, anything under `src/server/**`, `src/app/**`, `db/**`, `src/ui/roomlayout/**`,
`src/lib/sprites/**`. No High path is touched.

## Data model / migration
None.

## API contract
None changed. The UI calls the merged slice A endpoints (`src/app/api/me/pixel-look/route.ts`):

| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| GET | `/api/me/pixel-look` | bearer | 200 `{ look: PixelLook \| null }` | 404 `not_found`, 403 `member_deactivated`, 503 `unavailable` | user |
| PUT | `/api/me/pixel-look` | JSON `{ skin, hair, style, shirt }` | 200 `{ look }` | 400 `invalid_request`, 422 `invalid_look`, 404, 403 `member_deactivated`, 503 | user |
| DELETE | `/api/me/pixel-look` | bearer, no body | 200 `{ look: null }` | 404, 403 `member_deactivated`, 503 | user |

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `flow.test.ts` › "readMeResult keeps a well-formed member and drops a malformed one" (expectation now has `id: "m"`) | AC3 |
| `flow.test.ts` › "readMeResult keeps member.id only when it is a string; a member without id is still kept" (`id: 7` and missing id → member without `id`) | AC3 |
| `pixel-look-api.test.ts` › "get 200 {look} returns the parsed look; {look:null} returns null; a non-preset look returns internal" | AC1, AC3 |
| `pixel-look-api.test.ts` › "save sends PUT /api/me/pixel-look with content-type application/json and exactly the draft as JSON (extra keys on the input are not sent)" | AC2 |
| `pixel-look-api.test.ts` › "save 200 returns the parsed look; 422 invalid_look and 404 not_found return their codes" | AC2 |
| `pixel-look-api.test.ts` › "reset sends DELETE with no body; 200 returns ok null" | AC3 |
| `pixel-look-api.test.ts` › "ApiAccessError member_deactivated returns that code; signed_out returns unauthenticated; a throwing fetcher returns unavailable" | AC2 |
| `pixel-look-state.test.ts` › "pickerOptions: exactly SKIN_RAMP, HAIR_RAMP, SHIRT_RAMP entries (index + hex) and styles 1..3" | AC1 |
| `pixel-look-state.test.ts` › "initialPicker: loading, draft = derivedChoice(memberId), saved null" | AC3 |
| `pixel-look-state.test.ts` › "loaded ok with a look: ready, saved and draft = look; ok null: draft = derived, isDerived true; failure: status failed, draft derived, loadFailed notice" | AC1, AC3 |
| `pixel-look-state.test.ts` › "choose sets one layer and clears the notice; choose ignores an index outside its ramp, a style outside 1..3, and calls while busy" | AC1 |
| `pixel-look-state.test.ts` › "canSave: false while loading or busy, false when draft equals saved, false when nothing saved and draft equals derived, true after a change" | AC2 |
| `pixel-look-state.test.ts` › "canReset: false while loading or busy, false when nothing saved and draft equals derived, true when a look is saved or the draft changed" | AC3 |
| `pixel-look-state.test.ts` › "afterSave ok: saved = draft = server look, status notice saved; failure: draft kept, error notice" | AC2 |
| `pixel-look-state.test.ts` › "afterReset ok: saved null, draft = derivedChoice(memberId), lookFromChoice(draft) equals resolveLook(null, memberId) and avatarFor(memberId), notice resetDone" (fixed UUID id, e.g. `"3f2a9c1e-5b7d-4e8a-9c0f-1a2b3c4d5e6f"`) | AC3 |
| `pixel-look-state.test.ts` › "afterReset failure: saved and draft unchanged, error notice" | AC3 |
| `pixel-look-state.test.ts` › "pickerErrorMessage: invalid_look and invalid_request use character.errors.invalidLook; unavailable uses character.errors.retry; member_deactivated, not_found and unknown codes use apiErrorMessage" | AC2 |
| `pixel-look-preview.test.ts` › "ops are body, shirt, hair with the ramp tints of the look, keys for front and back and the chosen style" | AC1, AC3 |
| `pixel-look-preview.test.ts` › "box spans all three frames; negative anchors shift every op so the minimum is 0" (fake manifest) | AC1 |
| `pixel-look-preview.test.ts` › "a missing frame returns null" | AC1 |
| `PixelLookPicker.test.tsx` › "one radio per preset per layer (SKIN_RAMP.length, HAIR_RAMP.length, 3, SHIRT_RAMP.length) inside four fieldsets with legends; the draft's options are checked" | AC1 |
| `PixelLookPicker.test.tsx` › "swatch aria-labels say 'Skin 2 of 4'; hair styles have text labels" | AC1 |
| `PixelLookPicker.test.tsx` › "atlas ready (fake manifest, stub image): four canvases with role=img and the four preview labels; width = box x scale" | AC1 |
| `PixelLookPicker.test.tsx` › "atlas missing: no canvas; atlasFailed shows previewUnavailable; the radios and Save are still there" | AC1 |
| `PixelLookPicker.test.tsx` › "isDerived shows the automatic line; a saved look does not" | AC3 |
| `PixelLookPicker.test.tsx` › "canSave false disables Save; canReset false disables Reset; busy save/reset shows the busy labels and disables both" | AC2, AC3 |
| `PixelLookPicker.test.tsx` › "status notice renders role=status, error notice renders role=alert; status loading shows aria-busy and disabled radios" | AC2 |

Domain focus: empty or null fields (`look: null`, a member with no `id`, a failed GET), and bounds (index -1, ramp
length, style 0 and 4). Names and dates are not involved.

## Approach
0. **Base.** Start from `main` after SIM-046.1 has merged (rebase if already started). The `sections` prop on
   `ProfileTabView`, the `<ProfilePhoto>` mount in `ProfileTab.tsx` and `portalCopy.profile.photo` must exist.
1. **Seed (`flow.ts`).** Additive `id?` on the member, kept only when a string. Callers (`AuthGate.tsx`, `DevGate.tsx`,
   `dev-flow.ts`, `profile-form.ts`) read other fields only, so nothing else changes.
2. **`pixel-look-state.ts`** (pure; imports `@/lib/sprites/pixel-look`, `@/lib/sprites/avatar`, `../copy/portal`,
   `../copy/api`):
   - `type PixelLookKey = (typeof PIXEL_LOOK_KEYS)[number]`; `type PickerNotice = { tone: "status" | "error"; text: string }`.
   - `type PickerState = { memberId: string; status: "loading" | "ready" | "failed"; saved: PixelLook | null; draft: PixelLook; busy: "save" | "reset" | null; notice: PickerNotice | null }`.
   - `pickerOptions()` → `{ skin: {index, hex}[]; hair: {index, hex}[]; style: (1|2|3)[]; shirt: {index, hex}[] }`,
     built from `SKIN_RAMP`, `HAIR_RAMP`, `SHIRT_RAMP` (never hard-coded counts; ramps are append-only, `avatar.ts` l.1-2).
   - `sameLook(a, b)`; `derivedOf(s) = derivedChoice(s.memberId)`; `isDerived(s) = s.saved === null && sameLook(s.draft, derivedOf(s))`.
   - `initialPicker(memberId)`, `loaded(s, r: PixelLookResult<PixelLook | null>)`, `choose(s, key, value)` (applies
     only when the result passes `isPixelLook` and `busy === null`), `startBusy(s, kind)`, `afterSave(s, r)`,
     `afterReset(s, r)`.
   - `canSave(s) = s.busy === null && s.status !== "loading" && !(s.saved !== null && sameLook(s.draft, s.saved)) && !isDerived(s)`.
   - `canReset(s) = s.busy === null && s.status !== "loading" && !isDerived(s)`. Reset always sends DELETE (idempotent
     on the server, `is distinct from`), then sets the draft to `derivedChoice(memberId)`.
   - `pickerErrorMessage(code)`: `invalid_look` / `invalid_request` → `character.errors.invalidLook`; `unavailable` →
     `character.errors.retry`; anything else → `apiErrorMessage(code)` (covers `member_deactivated`, `not_found`,
     `unauthenticated`, `internal`).
3. **Preview.** `previewOps` is the pure geometry; `LookPreview` only paints. Tinting goes through `tintedFrame`
   (cached per atlas image, `paint.ts` l.9-45), so a redraw on each draft change is cheap (3 frames x 4 canvases).
   The picker draws exactly what the map draws: same `avatarFrames`, same tint function, same anchors.
4. **`PixelLookPicker` layout** (fits the shared `max-w-md` column; stacks at 320 px):
   - `<section aria-labelledby="pixel-look-heading">` with an `<h3 id="pixel-look-heading">` and the hint.
   - Preview row: `flex flex-wrap items-end gap-3`, four `<figure>`s (front 1x, back 1x, front 2x, back 2x), each a
     `LookPreview` plus a `<figcaption>` from copy. Loading atlas: placeholders with `aria-busy`. `atlasFailed`: one
     `previewUnavailable` line instead of the row.
   - `isDerived` → one small line `character.automatic`.
   - Four `<fieldset>`s with `<legend>`: skin, hair colour, hair style, shirt. Swatches: `<label>` wrapping
     `<input type="radio" className="sr-only" name="pixel-look-<key>" value=… checked=… disabled={busy or loading} onChange=…>`
     and a 28 px `<span>` with `style={{ background: hex }}`; the label has `aria-label` from
     `character.option(layerName, i + 1, total)` on the input, a visible ring when checked (`has-[:checked]:ring-2`)
     and a focus ring (`has-[:focus-visible]:outline`), so colour is not the only cue. Hair styles: same radios with
     visible text `character.styleName(n)`.
   - Buttons: Save (`character.save` / `saving`, disabled by `!canSave`), Reset (tonal, `character.reset` /
     `resetting`, disabled by `!canReset`).
   - Notice: `role="status"` or `role="alert"`, same markup as `ProfileTabView.tsx` l.90-99.
   - No literal text or `aria-label="..."` in JSX (`no-literals.test.ts`); every string comes from copy.
5. **Copy (`portalCopy.profile.character`)**, English (D36):
   - `heading: "Pixel character"`, `hint: "Your character on room maps. Pick one option for each part."`
   - `layers: { skin: "Skin", hair: "Hair colour", style: "Hair style", shirt: "Shirt" }`
   - `option: (layer: string, n: number, total: number) => \`${layer} ${n} of ${total}\``,
     `styleName: (n: number) => \`Style ${n}\``
   - `views: { front: "Front", back: "Back" }`, `previewLabel: (view: string, scale: number) => \`Preview, ${view}, ${scale}x\``
   - `previewUnavailable: "Preview not available. You can still choose and save."`
   - `automatic: "Automatic look, picked for you. Reset returns here."`
   - `save: "Save character"`, `saving: "Saving..."`, `reset: "Reset"`, `resetting: "Resetting..."`
   - `saved: "Character saved. Room maps show it the next time they load."`,
     `resetDone: "Back to the automatic look."`
   - `loadFailed: "Could not load your saved character. You can still choose and save one."`
   - `errors: { invalidLook: "That choice is not available. Pick one of the offered options.", retry: "Could not save your character. Try again." }`
6. **Container and mount.** `PixelLookSection` keeps all fetch logic out of `ProfileTab`; a failed pixel-look GET only
   shows `loadFailed` inside the section and never blocks the name form or the photo. `ProfileTab` renders the section
   only when `memberId` is known (it always is when the tab is ready, because the tab errors without a member).
7. **Checks:** `pnpm format`, then all Checks.

Rules:
- R1: `src/ui/portal/**` imports `@/lib/sprites/*`, `@/lib/identity/flow`, `@/lib/api/fetch`, `../roomlayout/*`
  (same ui layer) and copy; no server import. `flow.ts` stays pure lib.
- R3: no env or config. R4: only the files listed. R5: logic in pure modules with tests. R6/R7: no route change.
- D36: all strings in `copy/portal.ts`.

## Specialist input used
From `consult-frontend-developer.md`:
- Adopted:
  - Finding 4 / Q1: widen `readMeResult` with `member.id` (lib change, not High) instead of a second parse of `/api/me`.
  - Load in parallel with the name read, initial draft `look ?? derivedChoice(memberId)`, failed GET does not block
    the name form.
  - Structure: pure view `PixelLookPicker`, container `PixelLookSection`, `pixel-look-api.ts`, and a separate pure
    state/outcome module (`pixel-look-state.ts`, not `portal-state.ts`, which SIM-053 edits).
  - Accessibility: fieldset/legend, native radios, "Skin 2 of 4" labels, ring for the selected swatch, text labels
    for hair styles, `role="img"` + label on each canvas, `role=status|alert` notices.
  - Reset disabled when nothing is stored and the draft is the derived look; Save disabled when nothing changed.
  - Q2: one "automatic look" line. Q3: Save/Reset change nothing else on the page. Q4: picker shown without previews
    when the atlas fails.
  - Option counts from the ramps; tests for exact counts, PUT body = draft, DELETE without body, Reset = derivedChoice.
  - No change in `src/ui/roomlayout/**` or `src/lib/sprites/**` (SIM-046.1 guard test); no `AppShell.tsx` /
    `Avatar.tsx` change. The shell avatar (photo or initials) and the pixel character stay separate.
- Adapted:
  - Copy key: `portalCopy.profile.character` next to `profile.photo` (orchestrator's instruction and SIM-046.1 plan
    A2), not a top-level `portalCopy.pixelLook`. Both are disjoint from SIM-053's `seat.*`/`devices.*` keys.
  - Mount: inside SIM-046.1's `sections` fragment, after the photo, instead of a sibling wrapper around
    `ProfileTabView`. No new prop on `ProfileTabView`.
  - Picker view takes flat props plus `onChoose(key, value)` instead of `value`/`onChange`, so the static-render tests
    need no state.
  - Interaction tests are pure state tests plus static render: the repo's Vitest runs with `environment: "node"`
    (`vitest.config.ts` l.16), with no jsdom. The geometry is in `previewOps`, so no canvas stub is needed.

## Assumptions
- **A1 Builds on SIM-046.1's plan** (`work/tickets/SIM-046.1/plan.md`, READY, not yet implemented; it merges first):
  `ProfileTabView` gets `sections?: ReactNode` rendered after the heading, `ProfileTab` passes
  `sections={<ProfilePhoto name={load.name} />}`, and photo copy lives in `portalCopy.profile.photo`. This ticket's
  branch is rebased onto `main` after SIM-046.1 merges, and the implementer starts only then. If SIM-046.1's final
  code differs (for example the slot name), follow what merged and record it in `impl-log.md`.
- **A2 Hotspots.**
  - SIM-046.1: `ProfileTab.tsx` (same `sections` line) and `copy/portal.ts` (adjacent `profile` keys). Avoided by
    merging after it.
  - SIM-053 (PLANNING): `copy/portal.ts` (`seat.*`, `devices.*`) and `portal-state.ts`. Disjoint lines; this plan
    does not touch `portal-state.ts`. Trivial rebase at most.
  - SIM-046.2: `Avatar.tsx` and member lists; no overlap.
  - `src/lib/identity/flow.ts`: no other open ticket edits it.
- **A3 Seed = `members.id`** (parent SIM-047 A2, spec l.130/476/604 now say "member id"). `sub` is never used.
- **A4 Save when nothing is stored and the draft equals the derived look is disabled.** Saving it would freeze the
  current derived look as a chosen one (parent A8 allows that via the API), but from the picker it would be a pointless
  write. The member can still change any part and save.
- **A5 No unsaved-change warning** when leaving the tab (consult risk; acceptable).
- **A6 Size.** About 420 product lines (picker view ~130, state ~90, container ~60, preview component ~50, API ~55,
  geometry ~30, copy ~30, flow/ProfileTab ~12) plus about 350 test lines. Close to the guide, but it is the slice the
  parent already split out and has no further natural seam (the view is useless without state and API). Not split.
- **A7 Dependencies.** SIM-047 and SIM-045.1 are merged (slice A route exists at `src/app/api/me/pixel-look/route.ts`).

## Blocking questions
None.

## Split proposal
None. See A6.
