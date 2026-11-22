Consult for SIM-024.1. This was static reading only: I ran no build, server or DB. The Imersa sheets are not committed, so I did not see the real art.

All paths are under `d:\project\simap-wt\SIM-024.1\`.

## Findings

The slice 2 defaults hold except for defects F1 and F2. F3 is a gap they leave open.

**Defects in settled defaults**
- **F1. A canvas of exactly `W·32 × H·32` clips sprites.** See `work\tickets\SIM-024\plan.md:305`.
  - Real art overhangs up to 32 px at the top: `plant.large` has map anchor y 32 (`assets\art\sprite-map.json:469`), and the manifest anchor is its negative (`scripts\sprites\pack.mjs:29-30`).
  - It also overhangs about 2 px at the sides (`sprite-map.json:241-242`, 68 px wide on a 64 px footprint).
  - The placeholder atlas overhangs at most 16 px (`public\sprites\office.json:776`), so the demo understates the bug.
- **F2. The draw order hides sub-tile props on the upper row of a multi-row host.** The sort uses each item's own footprint bottom row (`plan.md:315`). `desk.single.e` is 1×2 (`sprite-map.json:269`), so a prop on its top tile has a smaller bottom row and is painted before the desk, then covered by it. `table.meeting` has the same problem.

**Gaps**
- **F3. Chair position is undefined.** Avatars and overlays depend on a chair (`plan.md:320-322`), but a seat is one desk record (`docs\spec-v1.md:346`) with one sprite key (`work\tickets\SIM-015.1\ticket.md:52`).
- **F4. A runtime-valid atlas can change footprints.** The validator only checks that `tiles` is a positive pair (`src\lib\validate\sprite-manifest.ts:74`). Only the packer compares it to the registry (`pack.mjs:114-116`), and the renderer takes the footprint from the frame (`plan.md:314`).
- **F5. Direction cannot be parsed from key suffixes.** `wall.t.e`, `wall.side.e` and `wall.front.end.w` look directional but have `dir: null` (`src\lib\sprites\keys.json:642-644, 682-684, 714-716`).
- **F6. Sub-tile status is only in the registry.** Manifest frames for sub-tile props always say `[1,1]` (`pack.mjs:175`), so "full-tile before sub-tile" must read `REGISTRY[key].tiles === null`.
- **F7. `state.mine.tint` covers one tile only.** It is 30×22 (`office.json:934-941`), while a desk covers two tiles.
- **F8. `meta` is optional and its fields are unchecked.** See `src\lib\sprites\types.ts:39` and `sprite-manifest.ts:38`. The loader uses `meta.version` in the PNG URL before validation runs (`plan.md:327`).
- **F9. Copying the `/dev/shell` guard does not keep demo code out of the client build.** That page statically imports a client component and calls `notFound()` at request time (`src\app\dev\shell\page.tsx:4,12`). The route returns 404, but the client chunk is likely still emitted. The planned fixture in `src/lib/sprites/` (`plan.md:330`) also puts demo data in a production layer.
- **F10. Zoom conflict.** The ticket uses 1/2/3 (`work\tickets\SIM-024.1\ticket.md:47`). The spec uses 2/3/4 (`docs\spec-v1.md:329,355`), and the spec wins under `CLAUDE.md`.

**Confirmed fine**
- The CSP allows same-origin images and fetches (`src\lib\security\headers.ts:37-38`).
- Avatars and state overlays have no map source (`sprite-map.json:505-506`), so tinting is unaffected by the Imersa art.

## Recommendations

1. **Module boundaries (R1).**
   - `src/lib/sprites/`: `layout.ts` (types), `placement.ts` (`buildDrawList`, `resolveFrameKey`, `chairFor`), `avatar.ts` (hash and colour selection), `overlay.ts`. No DOM or canvas.
   - `src/ui/roomlayout/`: atlas loader, canvas painter, tint cache, HTML seat overlay, `RoomMap`.
   - Import through `@/ui/roomlayout`. Do not add it to the `src\ui\index.ts` barrel, so canvas code stays out of pages that use the kit.

2. **Provisional type.** Keep persisted layout separate from derived status, because SIM-015.1 must not store status (`SIM-015.1\ticket.md:33`).
   ```ts
   export type Rotation = 0 | 90 | 180 | 270;
   export type Placement = { id: string; sprite: string; x: number; y: number; rotation: Rotation };
   export type FloorZone = { sprite: string; x: number; y: number; w: number; h: number };
   export type RoomLayout = {
     w: number; h: number; floors: FloorZone[];
     seats: (Placement & { code: string })[]; fixtures: Placement[];
   };
   export type SeatView = {
     state: "empty" | "occupied" | "mine" | "pending" | "cannot";
     avatarSeed: string | null; label: string;
   };
   ```
   - Pass `seatViews: ReadonlyMap<seatId, SeatView>` as a separate prop.
   - Draw the avatar when `avatarSeed` is non-null, not when `state === "occupied"`, because a "mine" seat also has a person.
   - `avatarSeed` is `sub` in the demo. The name lets SIM-015.1 decide whether to expose raw `sub` to every viewer.

3. **Atlas independence (AC 2).**
   - `resolveFrameKey(sprite, rotation)`: use `${sprite}.${dir}` if that key exists and its registry `dir` matches; otherwise use `sprite` as an exact key; otherwise report it as unknown.
   - `buildDrawList` returns `{ ops, bounds, unknown }`. An unknown key is skipped and never crashes the page.
   - Add a validator check that `frame.tiles` equals `registry.tiles ?? [1,1]` (F4). Packer output already satisfies it.

4. **Fix F1.** Size the canvas from `bounds` and offset the HTML overlay by the same origin. Test with a fixture frame anchored at y = -32.
   - Alternative: fixed padding of one tile. It is simpler, but it breaks again if art grows taller.

5. **Fix F2.** A sub-tile item takes the sort row of the full-tile item covering its tile. Add a unit test on a 1×2 desk.

6. **Fix F3.** Add one pure table and store no chair:

   | Desk direction | Chair tile | Chair faces |
   |---|---|---|
   | `s` | below the footprint | `n` |
   | `n` | above | `s` |
   | `e` | right | `w` |
   | `w` | left | `e` |

   This is inferred from `desk.single.s` drawers and the monitor's front view facing the viewer (`sprite-map.json:245,305-312`). Confirm it visually in the demo.

7. **Smaller fixes.**
   - Emit one `state.mine.tint` op per desk tile (F7).
   - Add `?v=` only when `meta.version` is a string, and encode it (F8).
   - Set `imageSmoothingEnabled = false` after every canvas resize, because resizing resets context state.

8. **Keep the demo out of the bundle (AC 6).** Put `RoomMapDemo.tsx` and `fixture.ts` in `src/app/dev/roommap/`, and load them only inside a statically foldable branch:
   ```ts
   if (process.env.NODE_ENV === "development") {
     const { RoomMapDemo } = await import("./RoomMapDemo");
     return <RoomMapDemo />;
   }
   notFound();
   ```
   Verify by searching `.next/static` for a unique fixture string after `pnpm build`. If it is still there, fall back to a dev-only `pageExtensions` entry, which costs a `next.config.ts` change.

9. **Cuts to stay at size M.**
   - Device-by-type drawing and primary/secondary placement go to SIM-015.1. The ticket scope does not list them.
   - Pan, `?seat=` and the seat panel go to SIM-015.1.
   - No `z` field, auto zoom, or walking/animated avatars.
   - Keep the demo fixture to one room, using `desk.single` seats.

## Risks

- **Fractional DPR (125%/150%)** can still soften pixels or make them uneven. This is already accepted and needs the manual check.
- **The avatar layer always paints above furniture**, so a tall item in the row below a seated person is overdrawn. Accept for v1, since the layer order is part of the manifest contract.
- **The tint repeated per tile may show a 2 px seam** between tiles, because the frame is 30 px wide. Check it in the demo.
- **Bundler folding of the dynamic import is unverified.** The build search in Recommendation 8 is the proof.
- **SIM-015.1 needs a schema change beyond tile columns.** `layout_fixtures.kind` does not allow `wall`, `plant` or floor values (`db\migrations\20261120150000_init.sql:182-184`). It also remains blocked by D47 (D55).

## Open questions

1. **Zoom:** should the renderer accept any positive integer, with the demo showing 1/2/3 for this ticket and SIM-015.1 using the spec's 2/3/4? I recommend yes. It needs no rework, but the conflict should be flagged to Ming.
2. **`desk.pair`:** it is back-to-back (`docs\art\style-guide.md:129`), but LAY-02 says one desk is one seat. Is it one seat or two? Default: leave it out of seat fixtures here and decide in SIM-015.1.
3. **Chair side:** does Ming accept the table in Recommendation 6? It means a default rotation-0 desk shows the person from behind.
