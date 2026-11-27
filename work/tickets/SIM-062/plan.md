Status: READY

# Plan — SIM-062: Multi-direction walking avatar frames

## Scope summary
- `docs/spec-v1.md` PRE-07 (line 787): "Phase 1 walks with the existing avatar frames; multi-direction walking frames
  for each POR-06 layer are new art (D45 asset rules, atlas + manifest, no code change to swap art)."
- `docs/spec-v1.md` Phasing (line 796): "P2: multi-direction walking sprites, …"
- `docs/spec-v1.md` POR-06 (line 611): "the 32 px layered avatar … from preset choices per layer: skin, hair colour,
  hair style, shirt colour (the existing avatar ramps and frames; more parts only with new art)." The layers are
  therefore body (skin tint), shirt (shirt tint) and hair styles 1-3 (hair tint), as in `src/lib/sprites/avatar.ts:57-63`.
- `work/decisions.md` D45: "Ming customises in Pixelorama; Claude builds placeholder art, manifest and renderer.
  Sources and `CREDITS.md` in `assets/art/`, exported atlas in `public/sprites/`."
- Style guide §8 export convention (`docs/art/style-guide.md:152`): "one PNG per frame in `assets/art/export/`, named
  exactly by its key". The packer already prefers `assets/art/export/<key>.png` over the sprite map and placeholders
  (`scripts/sprites/pack.mjs:1`). That is the "swap art with no code change" path.

**How the art question is resolved (consult open question 1):** D45 splits the work. Claude builds placeholder art,
the manifest and the renderer, and Ming swaps in real art through `assets/art/export/`. Every seated avatar frame
in the committed atlas is still an in-house grey placeholder (`assets/art/sprite-map.json:770` lists `avatar.*` as
missing). So this ticket ships in-house, tintable grey placeholder walk frames for every layer, direction and step,
plus the keys, manifest entries and renderer. Ming's real art is a later drop-in with no code change (see "Ming
verification after merge"). Nothing is cut from `office_worker.png` (it is not layered, consult finding 10), so no new
licence or credit row is needed.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Each POR-06 layer has walking frames for every direction the walk uses, packed into the atlas with manifest entries (D45 asset rules). | `src/lib/sprites/avatar-walk.test.ts` › "committed manifest and registry have every walk frame for every layer, direction and step" (5 layers x 4 dirs x 2 steps = 40 keys). The existing `scripts/sprites/committed-atlas.test.ts` stays green: validator, keys equal registry, sha version, sprite-map keys are still `map`. The `pnpm sprites:pack` summary in impl-log shows the same map count as before (55 map) and 40 more placeholders. |
| 2 | The walk picks the frame set by direction of travel; swapping the art needs no code change (atlas + manifest only). | `walk.test.ts` › "walk pose: dir from the segment (n/e/s/w), step alternates, seated pose at start/end and in fades"; `walk.test.ts` › "walkerOps draws the walk keys for the pose and falls back per layer to the seated key when the manifest lacks one"; `scripts/sprites/pack.test.ts` › "an export PNG for an avatar walk key replaces its placeholder" (the swap path is data only). Code review: no key strings outside `avatar.ts`. |
| 3 | Unit tests check the manifest has every direction for every layer. | Same test as AC1, derived from the exported `WALK_DIRS`, `WALK_STEPS` and `HAIR_STYLES` constants that `walkFrame`/`walkFrameKeys` use. Also checks that the registry has no stray `.walk.` avatar keys outside that set. |
| 4 | All Checks pass. | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`. |

## Ming verification after merge
- Visual (the reviewer cannot watch a canvas). Check in and out in a room with a door on a local or hosted run. The
  character faces its walking direction on every leg (up = back, down = front, left/right = side profile), the legs
  alternate, the walk ends in the seated pose with no jump, and the colours (skin/shirt/hair) match the seated look.
- Real art (non-blocking, D45). To replace the placeholders, draw the 40 frames in Pixelorama in the three avatar
  greys, on a 32x32 canvas each, and export them to `assets/art/export/<key>.png` (key list in style guide §5/§7 as
  updated by this ticket). Then run `pnpm sprites:pack` and commit `public/sprites/office.png/json`. No code change.
  The orchestrator should add this as a Ming-todo item, not as `Needs Ming` blocking this ticket.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/sprites/avatar.ts` | Add `WALK_DIRS = ["n","e","s","w"] as const`, `type WalkDir`, `WALK_STEPS = 2`, `HAIR_STYLES = [1,2,3] as const`, `type WalkPose = { dir: WalkDir; step: number }`, `walkDir(a, b)` (segment → dir), `avatarWalkFrames(look, pose)` (same order and tints as `avatarFrames`, keys `avatar.body.walk.<dir>.<step>`, `avatar.shirt.walk.<dir>.<step>`, `avatar.hair.<style>.walk.<dir>.<step>`), `walkFrameKeys()` (all 40, sorted). `AvatarView`, `avatarView`, `avatarFrames` unchanged (lines 49-63). | Single source of the key scheme (AC2, AC3) | No |
| `src/lib/sprites/walk.ts` | `WalkFrame` gains `walk: WalkPose \| null` (lines 177-186). `walkFrame` (189-220) sets `walk = { dir: walkDir(a,b), step: Math.floor(pos*2) % WALK_STEPS }` while walking; `null` for fades, at `p<=0` with `startView`, and when done with `endView`. `view` stays as the fallback (n → back, else front, replacing the `b.y < a.y` rule at 209 with the same result). `walkerOps` (223-247) gains a trailing param `walk: WalkPose \| null = null`. When it is set, it draws `avatarWalkFrames`, and for each layer it falls back to the matching seated key (`avatarFrames(look, view)[i]`) if the manifest lacks the walk key. | AC2 | No |
| `src/ui/roomlayout/WalkLayer.tsx` | Line 36: pass `f.walk` as the 7th argument of `walkerOps`. | AC2 | No |
| `src/lib/sprites/keys.json` | Add the 40 walk keys (`group: "avatar"`, `dir: null`, `layer: "avatar"`, `tiles: null`, `blocks: false`, `shadow: false`), kept in the file's sorted order. `dir` stays `null`: these are not rotation frames, and a non-null `dir` would break the `.n/.e/.s/.w` suffix rule in `registry.test.ts:65-84`, `pack`/`placeholders.mjs:405` and `validate/layout`. | AC1 (registry = required manifest keys) | No |
| `scripts/sprites/placeholders.mjs` | `DRAW.avatar` (355-385): parse `.walk.<dir>.<step>`. s = front-like, n = back-like (no eyes, hair covers the head), e = side profile (narrower head/torso, one eye on the facing side, arms front/back swapped per step), w = e mirrored by a small local x-flip helper. The body layer adds two legs (y 25-31) whose lengths alternate with the step. Shirt and hair follow the same silhouette. Greys only (`#e6e6e6`, `#bdbdbd`, `#8f8f8f`), 32x32, anchor [0,0] (unchanged rule at 411). Seated drawing unchanged. | AC1 placeholder art (D45) | No |
| `public/sprites/office.png`, `public/sprites/office.json` | Re-packed with `pnpm sprites:pack` (with the map; the Imersa and 2dpig sheets are present locally under `assets/art/sources/`). The summary must keep the previous map count. Never use `--force`. | AC1 | No |
| `src/lib/sprites/avatar-walk.test.ts` (new) | Manifest + registry coverage and the key-scheme tests (see Tests). | AC3 | No |
| `src/lib/sprites/avatar.test.ts` | Add `walkDir` and `avatarWalkFrames` tests. | New logic has tests (R5) | No |
| `src/lib/sprites/walk.test.ts` | Update test at 245-267 for `walk` pose; add pose/fallback tests; keep the 311-319 regex test for the seated path. | AC2 | No |
| `scripts/sprites/pack.test.ts` | One test: an `assets/art/export/avatar.body.walk.e.0.png` (32x32) in a temp root becomes `source: "export"` with anchor [0,0]. Follow the file's existing temp-root pattern. | AC2 swap path | No |
| `docs/art/style-guide.md` | §5 (92-101): drop "Seated pose only in v1"; add walk frames: 4 directions x 2 steps per layer, side view e/w drawn separately. §7 row at 139: add `avatar.body.walk.{n,e,s,w}.{0,1}`, `avatar.shirt.walk.*`, `avatar.hair.{1..3}.walk.*`, 32x32, no headroom. | Tells Ming exactly which export files to draw | No |

No High path is touched.

## Data model / migration
None. The avatar group is not a catalog group (`src/lib/map-items/art.ts:7-8`, `library.ts:60` uses `FIXTURE_GROUPS`),
so the new registry keys add no library item and need no `map_items` migration.

## API contract
None.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/sprites/avatar-walk.test.ts` › committed manifest and registry have every walk frame for every layer, direction and step | AC1, AC3. Loops over `["body","shirt",...HAIR_STYLES]` x `WALK_DIRS` x `0..WALK_STEPS-1`; each key is in `REGISTRY`, in `office.json` `frames` with w=h=32, anchor [0,0], `blocks:false`. |
| `avatar-walk.test.ts` › walkFrameKeys has 40 keys and equals the registry's `.walk.` avatar keys | AC3, no drift or stray keys |
| `avatar-walk.test.ts` › every walk key's layer is `avatar` and its group `avatar` (never offered as catalog art) | Guard for `spriteAllowedFor` |
| `src/lib/sprites/avatar.test.ts` › walkDir maps up/down/left/right to n/s/w/e | Direction rule |
| `avatar.test.ts` › avatarWalkFrames paints body, shirt, hair with the look's tints and the pose's dir/step | Key scheme, tint order equals `avatarFrames` |
| `src/lib/sprites/walk.test.ts` › walk pose: dir from the segment (n/e/s/w), step alternates, seated pose at start/end and in fades | AC2. Replaces/extends 245-267; covers a 4-leg path (up, right, down, left), `walk === null` at `p<=0` with `startView`, at done with `endView`, and for `kind: "fade"`. |
| `walk.test.ts` › walkerOps draws the walk keys for the pose and falls back per layer to the seated key when the manifest lacks one | AC2. Uses the committed manifest, then a copy with `avatar.shirt.walk.e.0` deleted. |
| `walk.test.ts` › existing "at the chair with the seated view equals … buildDrawList" stays unchanged and green | Seated draw unchanged |
| `scripts/sprites/pack.test.ts` › an export PNG for an avatar walk key replaces its placeholder | Swap with no code change |

## Approach
1. `avatar.ts`: add the constants, types, `walkDir`, `avatarWalkFrames` and `walkFrameKeys`. Pure lib code (R1: lib → lib).
2. `keys.json`: add the 40 entries. Generate them once with a throwaway script in the scratchpad or by hand. Do not add a generator to the repo.
3. `placeholders.mjs`: draw the walk placeholders (step/dir aware). Keep the seated branch byte-identical, so the
   seated frames' pixels do not change.
4. Run `pnpm sprites:pack`. Record its summary in impl-log (map / export / placeholder counts, atlas size). If it
   refuses to overwrite, stop and check the sources. Never use `--force`.
5. `walk.ts` + `WalkLayer.tsx`: add the pose to `WalkFrame` and pass it to `walkerOps`. `findPath` uses only 4-way steps
   (`walk-path.ts:25-30`), so `walkDir` never sees a diagonal. If a zero-length segment occurs anyway, fall back to `s`.
6. Tests, then style-guide docs.
7. Run all Checks.
Rules: R1 (lib/ui layers only, `@/` alias), R4 (only the files above), R5 (tests listed). No server, no schema, no env.

## Specialist input used
- Adopted: finding 4 (only front/back today, the `walk.ts:209` rule); rec. 2 key scheme `avatar.<layer>[.<style>]…<dir>.<n>`
  with the seated keys unchanged. I added the `walk` segment so walk keys never collide with the seated `front/back` keys.
- Adopted: rec. 3 per-layer fallback to front/back when a walk key is missing, and separate e and w frames (no DrawOp flip).
- Adopted: rec. 4 with N = 2 steps per direction; the 1 px bob is kept.
- Adopted: rec. 5 tests derived from one exported constant.
- Adopted in part: rec. 6 packing. No sprite-map entries and no credit row, because the art is in-house placeholders (D45).
- Rejected: rec. 1 options (b) colour-key split of `office_worker.png` and (c) a non-layered walker. D45 already
  assigns placeholder art to Claude and real art to Ming via export. (b) is lossy, and (c) breaks POR-06 tinting.
- Rejected: updating the hard-coded list in `scripts/sprites/registry.test.ts:52-61`. It only checks that the §7 keys
  exist, so adding keys does not break it.
- Open question 3 answered: 32x32 cell, anchor [0,0], the same as the seated frames (`placeholders.mjs:40-42, 411`). Question 5 answered: 4-way only.

## Assumptions
- A1 Placeholder art satisfies AC1 for this ticket (D45: "Claude builds placeholder art, manifest and renderer"). Real
  art is Ming's non-blocking drop-in after merge. If Ming wants real art before this ticket closes, the orchestrator
  should hold the ticket at BLOCKED with a Needs Ming item instead of implementing.
- A2 Directions: 4 distinct (n, e, s, w), with no mirroring at draw time, so a hand-drawn west frame can differ from east.
- A3 Steps: 2 per direction (`step = floor(pos*2) % 2`, two steps per tile, in phase with the existing bob). The 1 px bob stays.
- A4 Frames stand at the bottom of the tile cell like the seated ones (32x32, anchor [0,0]). A standing figure may
  be slightly taller than a seated one, but it stays inside 32x32 (no headroom, which matches `exportAnchor` for `tiles: null`).
- A5 The start pose (seated, `startView`) and the end pose (`endView`) stay the seated frames, so the static layer and the
  walker match at the hand-off (`walk.test.ts:283-309` unchanged).
- A6 The atlas grows by 40 32x32 frames (about 2 rows at 1024 px wide). This is acceptable.
- A7 Hotspot: SIM-061.1 (DONE, PR #150, not merged) works on the walk overlay (`WalkLayer.tsx`, possibly `walk.ts` and
  `paint.ts`). Expect a rebase on `WalkLayer.tsx:36` and perhaps `walk.ts`. SIM-061.1 adds no sprite frames, so no binary
  conflict on `office.png/json` is expected. If it does change the atlas, re-run `pnpm sprites:pack` after the rebase.
  SIM-070 (PLANNING) works on the Map items pages, not these files.
- A8 Size: about 150 product lines, 320 lines of `keys.json` data, about 150 test lines and a docs edit. One cycle.

## Blocking questions
None.

## Split proposal
None.
