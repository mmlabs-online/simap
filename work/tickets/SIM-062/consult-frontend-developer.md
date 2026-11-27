**SIM-062 consult (frontend, read-only)**

## Findings
- Walk logic today only knows two views. `AvatarView = "front" | "back"` (src/lib/sprites/avatar.ts:49). `walkFrame` picks `b.y < a.y ? "back" : "front"` (src/lib/sprites/walk.ts:209), so horizontal travel shows "front". `ActiveWalk.startView/endView` and `WalkFrame.view` are typed `AvatarView` (walk.ts:40-41, 181). `walkerOps` calls `avatarFrames(look, view)` (walk.ts:232), which builds the keys `avatar.body.<view>`, `avatar.shirt.<view>`, `avatar.hair.<style>.<view>` (avatar.ts:57-63). `WalkLayer.tsx:29,36` just passes `f.view` and `f.bob` through, so it needs no change.
- Walk animation is a position lerp plus a 1 px bob (`bob = floor(pos*2)%2`, walk.ts:217). There are no per-step frames, so "walking frames" do not exist in code yet.
- The atlas has 10 avatar frames. The keys are body.{front,back}, shirt.{front,back} and hair.{1,2,3}.{front,back} (src/lib/sprites/keys.json:2-80; public/sprites/office.json ~lines 1832-1841). They are 32x32 grey placeholders drawn in scripts/sprites/placeholders.mjs:355-385. The sprite map lists "avatar.* layered avatars" under `missing` (assets/art/sprite-map.json:770), so there is no real avatar art yet. keys.json has `dir: null` for avatar keys, unlike the furniture `.n/.e/.s/.w` keys.
- The packer is scripts/sprites/pack.mjs (entry scripts/sprites-pack.mjs). The key list is hand-maintained in keys.json and `registry.ts` (imports it at :1). Keys with no sprite-map entry fall back to placeholders. scripts/sprites/registry.test.ts:52-61 hard-codes the current 10 avatar keys.
- Source art:
  - The only character sheet is assets/art/sources/imersa-office/office_worker.png. It is listed under `extras`, "32x32 walk/idle character, 4 directions (not a seated, layered avatar)" (sprite-map.json:749). The sheet is 128 px wide x 256 px tall, i.e. 4 columns x 8 rows of 32 px. It is pre-coloured (shirt, tie, hair and skin baked in), and I did not confirm the row-to-direction/frame layout. The sheet is git-ignored under the Imersa licence (CREDITS.md:20-26). It is CC-style "recolour OK", and the Imersa credit row already exists (CREDITS.md:8).
  - It is NOT layered: body, shirt and hair are baked together. POR-06 tints per layer with SKIN_RAMP, HAIR_RAMP and SHIRT_RAMP (avatar.ts:3-20). So per-layer walking frames cannot be cut from it as-is.
  - **Conclusion: the layered, tintable walk frames (body, shirt, hair 1-3, per direction and step) are new art that must be drawn or separated, and they are not available as layers in any source sheet.** The ticket line "Art source may need Ming (as M-63 did)" applies. Ming or an artist has to supply the layers, or Ming has to approve a fallback.

## Recommendations
1. **Needs Ming at PLAN (AC1, D45).** Ask who provides the layered walk art, using the same flow as M-63. Options:
   - (a) Ming or an artist draws grey/white tintable layers per direction.
   - (b) Split office_worker.png into body/shirt/hair masks by colour-keying. This is lossy and needs hand-tuning.
   - (c) Ship a non-layered untinted walker. This breaks POR-06 look fidelity, so it is not recommended.
2. **Key scheme (AC2).** Add a direction and step to the avatar keys, e.g. `avatar.<layer>[.<style>].<dir>.<n>`, with dir in {n,e,s,w} or {front,back,side}. Seated keys stay as `front/back` so the seated draw is unchanged. Put it in keys.json and the registry, with placeholders in placeholders.mjs:355. Decide the key scheme and direction set first, because it decides the layout of the art Ming supplies.
3. **Code (AC2).** Widen the view type in avatar.ts:49 to a walk-direction type. In `walkFrame`, derive the direction from the (dx,dy) segment instead of walk.ts:209. If only left-facing art exists, mirror in `walkerOps`, but that needs a `flip` on DrawOp. Prefer separate east and west frames so the swap stays atlas-only. Make `avatarFrames` look the key up in the manifest and fall back to front/back when a walk key is missing. That keeps the walk working before the art lands, and it is the "swap art without code change" property.
4. **Step frames.** Replace the `bob` with a frame index (e.g. 2 steps per tile, `floor(pos*2) % N`), or keep the bob if the art has only 1 frame per direction. State N in the plan.
5. **Tests (AC3).** Add a unit test over `layers x directions (x steps)` that checks `manifest.frames[...]` and keys.json for every POR-06 layer: body, shirt, hair.1-3. The test must be derived from one exported constant (e.g. `WALK_DIRS`) that `walkFrame` also uses, so the two cannot drift. Update the hard-coded list in scripts/sprites/registry.test.ts:52-61, add `walkFrame` direction tests to walk.test.ts, and add to avatar.test.ts.
6. **Packing.** Add the new frames to `assets/art/sprite-map.json` (a source, rect, anchor entry per key), or draw them in-house, which needs no credit row. Add a CREDITS.md row if office_worker.png is used (it is already covered by the Imersa row). Run `pnpm sprites:pack` and commit public/sprites/office.png/json. Check the packed atlas size stays reasonable (+about 3 layers x 4 dirs x N frames).

## Risks
- Art blocker: without layered art the ticket cannot meet AC1 honestly. A placeholder-only pass would satisfy the manifest test but not the intent.
- Imersa licence: the source sheet is git-ignored, so CI or another machine cannot re-pack from it unless copied locally (CREDITS.md:20). Frames cut from it appear in the committed atlas, which is allowed while the repo is private.
- Widening the view type touches `startView/endView` and the seated-chair logic (`avatarView`, avatar.ts:52). Keep seated "front/back" stable, because stored/drawn seated avatars in the static layer (buildDrawList) share these keys.
- Direction for diagonal-free grid paths is fine (4-way), but check whether `findPath` ever emits diagonal steps (walk-path.ts, not read).
- Stale hard-coded key lists in tests (registry.test.ts:52-61).

## Open questions
1. Who supplies the layered walking art (Ming / artist / colour-key split of office_worker.png)? This is the Needs Ming item.
2. Which directions, and how many step frames per direction (3-direction + mirror vs 4 distinct, 1 vs 2+ steps)?
3. Does 32x32 (body only, hair overlay) match the existing seated frame size and anchor [0,0] (placeholders.mjs:411)?
4. Is mirroring acceptable (a DrawOp flip), or must east and west be separate frames?
5. Does `findPath` produce only 4-way moves? (Not verified.)

Files: src/lib/sprites/walk.ts, avatar.ts, keys.json, registry.ts; src/ui/roomlayout/WalkLayer.tsx; scripts/sprites/placeholders.mjs, pack.mjs, registry.test.ts; assets/art/sprite-map.json, CREDITS.md, assets/art/sources/imersa-office/office_worker.png.
