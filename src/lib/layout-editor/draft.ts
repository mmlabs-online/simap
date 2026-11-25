import type { FloorZone, RoomLayout, Rotation } from "@/lib/sprites/layout";
import {
  LAYOUT_LIMITS,
  SEAT_SPRITES,
  checkLayoutRules,
  fixturesOnDesks,
  registryFootprints,
  spriteInfo,
  type FootprintLookup,
  type LayoutRulesInput,
} from "@/lib/validate/layout";
import type { Draft, EditorItem, OpResult } from "./types";

const NEXT_ROTATION: Record<Rotation, Rotation> = { 0: 90, 90: 180, 180: 270, 270: 0 };

export function draftFromLayout(
  layout: RoomLayout,
  unplaced: readonly { id: string; code: string }[],
): Draft {
  const items: EditorItem[] = layout.seats.map((s) => ({
    key: `s:${s.id}`,
    kind: "seat",
    sprite: s.sprite,
    x: s.x,
    y: s.y,
    rotation: s.rotation,
    seatId: s.id,
    code: s.code,
  }));
  layout.fixtures.forEach((f, k) =>
    items.push({
      key: `f:${k}`,
      kind: "fixture",
      sprite: f.sprite,
      x: f.x,
      y: f.y,
      rotation: f.rotation,
      seatId: null,
      code: null,
    }),
  );
  return {
    w: layout.w,
    h: layout.h,
    floors: layout.floors.map((z) => ({ ...z })),
    items,
    tray: unplaced.map((u) => ({ id: u.id, code: u.code })),
    removed: [],
    nextKey: layout.fixtures.length,
  };
}

/** A paintable layout: a new desk gets its local key as id and an empty code. */
export function draftToRoomLayout(draft: Draft): RoomLayout {
  const place = (i: EditorItem) => ({
    id: i.seatId ?? i.key,
    sprite: i.sprite,
    x: i.x,
    y: i.y,
    rotation: i.rotation,
  });
  return {
    w: draft.w,
    h: draft.h,
    floors: draft.floors,
    seats: draft.items
      .filter((i) => i.kind === "seat")
      .map((i) => ({ ...place(i), code: i.code ?? "" })),
    fixtures: draft.items.filter((i) => i.kind === "fixture").map(place),
  };
}

export function rulesInput(draft: Draft): LayoutRulesInput {
  return {
    w: draft.w,
    h: draft.h,
    floors: draft.floors,
    seats: draft.items.filter((i) => i.kind === "seat"),
    fixtures: draft.items.filter((i) => i.kind === "fixture"),
  };
}

/** Drops fixtures that sit on a desk (older layouts, D61). Other items and keys are kept. */
export function withoutDeskFixtures(
  draft: Draft,
  lookup: FootprintLookup = registryFootprints,
): { draft: Draft; dropped: number } {
  const hits = new Set(fixturesOnDesks(rulesInput(draft), lookup));
  if (hits.size === 0) return { draft, dropped: 0 };
  let n = -1;
  const items = draft.items.filter((i) => i.kind !== "fixture" || !hits.has(++n));
  return { draft: { ...draft, items }, dropped: hits.size };
}

/** Run the shared layout rules on a candidate; a refusal leaves the caller's draft untouched. */
function checked(next: Draft, lookup: FootprintLookup): OpResult {
  const r = checkLayoutRules(rulesInput(next), lookup);
  if (r.ok) return { ok: true, draft: next };
  // `invalid_request` is a shape error a draft cannot produce.
  return { ok: false, code: r.code === "invalid_request" ? "layout_out_of_bounds" : r.code };
}

export function placeItem(
  draft: Draft,
  sprite: string,
  x: number,
  y: number,
  rotation: Rotation = 0,
  lookup: FootprintLookup = registryFootprints,
): OpResult {
  const seat = SEAT_SPRITES.includes(sprite);
  const k = draft.nextKey;
  const item: EditorItem = {
    key: `${seat ? "n" : "f"}:${k}`,
    kind: seat ? "seat" : "fixture",
    sprite,
    x,
    y,
    rotation,
    seatId: null,
    code: null,
  };
  return checked({ ...draft, items: [...draft.items, item], nextKey: k + 1 }, lookup);
}

export function placeFromTray(
  draft: Draft,
  seatId: string,
  x: number,
  y: number,
  rotation: Rotation = 0,
  lookup: FootprintLookup = registryFootprints,
): OpResult {
  const ref = draft.tray.find((t) => t.id === seatId);
  if (!ref) return { ok: false, code: "layout_unknown_sprite" };
  const item: EditorItem = {
    key: `s:${ref.id}`,
    kind: "seat",
    sprite: "desk.single",
    x,
    y,
    rotation,
    seatId: ref.id,
    code: ref.code,
  };
  return checked(
    {
      ...draft,
      items: [...draft.items, item],
      tray: draft.tray.filter((t) => t.id !== seatId),
    },
    lookup,
  );
}

/** Move a group by whole tiles, all or nothing. */
export function moveItems(
  draft: Draft,
  keys: readonly string[],
  dx: number,
  dy: number,
  lookup: FootprintLookup = registryFootprints,
): OpResult {
  const sel = new Set(keys);
  return checked(
    {
      ...draft,
      items: draft.items.map((i) => (sel.has(i.key) ? { ...i, x: i.x + dx, y: i.y + dy } : i)),
    },
    lookup,
  );
}

/** Turn directional items 90 degrees in place; non-directional items stay at 0. */
export function rotateItems(
  draft: Draft,
  keys: readonly string[],
  lookup: FootprintLookup = registryFootprints,
): OpResult {
  const sel = new Set(keys);
  const turnable = (i: EditorItem) => sel.has(i.key) && spriteInfo(i.sprite)?.directional === true;
  if (!draft.items.some(turnable)) return { ok: false, code: "layout_bad_rotation" };
  return checked(
    {
      ...draft,
      items: draft.items.map((i) => {
        if (!sel.has(i.key)) return i;
        return { ...i, rotation: turnable(i) ? NEXT_ROTATION[i.rotation] : 0 };
      }),
    },
    lookup,
  );
}

/** Fixtures and new desks disappear; existing seats are recorded in `removed` for the save. */
export function deleteItems(draft: Draft, keys: readonly string[]): OpResult {
  const sel = new Set(keys);
  const gone = draft.items.filter((i) => sel.has(i.key));
  return {
    ok: true,
    draft: {
      ...draft,
      items: draft.items.filter((i) => !sel.has(i.key)),
      removed: [
        ...draft.removed,
        ...gone.flatMap((i) => (i.seatId !== null ? [{ id: i.seatId, code: i.code ?? "" }] : [])),
      ],
    },
  };
}

function resizeFloor(z: FloorZone, draft: Draft, w: number, h: number): FloorZone | null {
  if (z.x === 0 && z.y === 0 && z.w === draft.w && z.h === draft.h) return { ...z, w, h };
  const cw = Math.min(z.x + z.w, w) - z.x;
  const ch = Math.min(z.y + z.h, h) - z.y;
  return cw > 0 && ch > 0 ? { ...z, w: cw, h: ch } : null;
}

/** Full-room floors stretch, other zones are clipped, empty zones are dropped; items never shift. */
export function resizeRoom(
  draft: Draft,
  w: number,
  h: number,
  lookup: FootprintLookup = registryFootprints,
): OpResult {
  const max = LAYOUT_LIMITS.grid;
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1 || w > max || h > max) {
    return { ok: false, code: "layout_out_of_bounds" };
  }
  const floors = draft.floors.flatMap((z) => resizeFloor(z, draft, w, h) ?? []);
  return checked({ ...draft, w, h, floors }, lookup);
}
