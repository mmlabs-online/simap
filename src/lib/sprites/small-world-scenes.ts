import { avatarFrames } from "./avatar";
import type { Placement, RoomLayout, SeatDevice, SeatView } from "./layout";
import { buildDrawList, TILE, type DrawList, type DrawOp } from "./placement";
import { lookFromChoice, type PixelLook } from "./pixel-look";
import type { SpriteManifest } from "./types";

export type WorldRoomId = "focus" | "meeting" | "lounge" | "cafe";

/** The sign-in "small world" (SIM-068.1): four decorative 12x7 rooms composed only from existing atlas frames. */
const wall = [
  { sprite: "wall.top", x: 0, y: 0, w: 12, h: 1 },
  { sprite: "wall.face", x: 0, y: 1, w: 12, h: 1 },
];

const fx = (
  id: string,
  sprite: string,
  x: number,
  y: number,
  rotation: 0 | 180 = 0,
): Placement => ({
  id,
  sprite,
  x,
  y,
  rotation,
});

export const FOCUS: RoomLayout = {
  w: 12,
  h: 7,
  floors: [...wall, { sprite: "floor.carpet", x: 0, y: 2, w: 12, h: 5 }],
  seats: [
    { ...fx("focus-1", "desk.single", 2, 3), code: "F1" },
    { ...fx("focus-2", "desk.single", 6, 3), code: "F2" },
  ],
  fixtures: [
    fx("f-desk", "desk.single", 9, 3),
    fx("f-chair", "chair.office.n", 9, 4),
    fx("f-window", "window.double", 4, 1),
    fx("f-clock", "clock.wall.s", 8, 1),
    fx("f-plant-l", "plant.large", 0, 2),
    fx("f-plant-r", "plant.large", 11, 5),
    fx("f-cabinet", "cabinet.filing.s", 11, 2),
    fx("f-mug", "prop.mug", 3, 3),
  ],
};

export const MEETING: RoomLayout = {
  w: 12,
  h: 7,
  floors: [...wall, { sprite: "floor.lavender", x: 0, y: 2, w: 12, h: 5 }],
  seats: [{ ...fx("meet-1", "table.meeting", 4, 3, 180), code: "M1" }],
  fixtures: [
    fx("f-chair-l", "chair.office.n", 4, 5),
    fx("f-chair-r", "chair.office.n", 6, 5),
    fx("f-board", "whiteboard", 1, 1),
    fx("f-projector", "screen.projector.s", 8, 1),
    fx("f-chart", "chart.flip.s", 10, 3),
    fx("f-plant-l", "plant.large", 11, 5),
    fx("f-plant-s", "plant.small", 1, 5),
  ],
};

export const LOUNGE: RoomLayout = {
  w: 12,
  h: 7,
  floors: [
    ...wall,
    { sprite: "floor.lavender", x: 0, y: 2, w: 6, h: 5 },
    { sprite: "floor.carpet.alt", x: 6, y: 2, w: 6, h: 5 },
  ],
  seats: [],
  fixtures: [
    fx("f-window-l", "window.single", 2, 1),
    fx("f-window-r", "window.single", 9, 1),
    fx("f-sofa", "sofa", 1, 3),
    fx("f-table", "table.coffee", 1, 5),
    fx("f-mug", "prop.mug", 2, 5),
    fx("f-shelf", "shelf.books", 8, 2),
    fx("f-lamp-l", "lamp.floor", 4, 2),
    fx("f-lamp-r", "lamp.floor", 11, 4),
    fx("f-plant-l", "plant.large", 0, 2),
    fx("f-plant-s", "plant.small", 10, 5),
  ],
};

/** No counter or coffee-machine sprite exists (SIM-068 Q6): filing cabinets and the water cooler stand in. */
export const CAFE: RoomLayout = {
  w: 12,
  h: 7,
  floors: [...wall, { sprite: "floor.wood", x: 0, y: 2, w: 12, h: 5 }],
  seats: [
    { ...fx("cafe-1", "table.coffee", 2, 4, 180), code: "C1" },
    { ...fx("cafe-2", "table.coffee", 6, 5, 180), code: "C2" },
  ],
  fixtures: [
    fx("f-counter-1", "cabinet.filing.s", 7, 2),
    fx("f-counter-2", "cabinet.filing.s", 8, 2),
    fx("f-counter-3", "cabinet.filing.s", 9, 2),
    fx("f-machine", "cooler.water.s", 10, 2),
    fx("f-mug", "prop.mug", 8, 2),
    fx("f-window", "window.double", 1, 1),
    fx("f-clock", "clock.wall.s", 4, 1),
    fx("f-plant-l", "plant.large", 0, 5),
    fx("f-plant-s", "plant.small", 10, 5),
  ],
};

export const WORLD_LAYOUTS: Record<WorldRoomId, RoomLayout> = {
  focus: FOCUS,
  meeting: MEETING,
  lounge: LOUNGE,
  cafe: CAFE,
};

const look = (skin: number, hair: number, style: 1 | 2 | 3, shirt: number): PixelLook => ({
  skin,
  hair,
  style,
  shirt,
});

const occupied = (seed: string, l: PixelLook): SeatView => ({
  state: "occupied",
  avatarSeed: seed,
  name: null,
  look: l,
});

/** Fixed demo avatars: no visitor data exists while signed out. */
export const WORLD_SEAT_VIEWS: Record<WorldRoomId, Record<string, SeatView>> = {
  focus: {
    "focus-1": occupied("world-focus-1", look(1, 0, 2, 1)),
    "focus-2": occupied("world-focus-2", look(3, 4, 1, 4)),
  },
  meeting: { "meet-1": occupied("world-meet-1", look(0, 2, 3, 2)) },
  lounge: {},
  cafe: {
    "cafe-1": occupied("world-cafe-1", look(2, 1, 2, 5)),
    "cafe-2": occupied("world-cafe-2", look(1, 3, 3, 3)),
  },
};

export const WORLD_SEAT_DEVICES: Record<WorldRoomId, Record<string, SeatDevice[]>> = {
  focus: { "focus-1": [{ type: "monitor" }], "focus-2": [{ type: "laptop" }] },
  meeting: {},
  lounge: {},
  cafe: {},
};

/** One idle figure standing on a free floor tile, per room (the lounge has no seat). */
export const WORLD_STANDING: Record<WorldRoomId, { tx: number; ty: number; look: PixelLook }[]> = {
  focus: [],
  meeting: [{ tx: 9, ty: 5, look: look(2, 5, 1, 0) }],
  lounge: [{ tx: 5, ty: 4, look: look(0, 1, 2, 6) }],
  cafe: [{ tx: 9, ty: 4, look: look(3, 0, 3, 1) }],
};

export const WALKER_LOOKS: [PixelLook, PixelLook] = [look(1, 1, 1, 3), look(2, 2, 3, 5)];
export const CARD_LOOK: PixelLook = look(1, 3, 2, 2);

/** Front-view avatar frame ops at a tile; a frame missing from the manifest is skipped and listed in `missing`. */
export function standingAvatarOps(
  l: PixelLook,
  tx: number,
  ty: number,
  manifest: SpriteManifest,
): { ops: DrawOp[]; missing: string[] } {
  const ops: DrawOp[] = [];
  const missing: string[] = [];
  for (const f of avatarFrames(lookFromChoice(l), "front")) {
    const fr = manifest.frames[f.key];
    if (!fr) {
      missing.push(f.key);
      continue;
    }
    ops.push({
      type: "frame",
      layer: "avatar",
      key: f.key,
      tint: f.tint,
      x: tx * TILE + fr.anchor[0],
      y: ty * TILE + fr.anchor[1],
      w: fr.w,
      h: fr.h,
    });
  }
  return { ops, missing };
}

/** One 32x32 avatar on its own canvas (path walkers, card avatar). */
export function avatarDrawList(l: PixelLook, manifest: SpriteManifest): DrawList {
  const { ops, missing } = standingAvatarOps(l, 0, 0, manifest);
  return { ops, bounds: { x: 0, y: 0, w: TILE, h: TILE }, seats: [], unknown: missing };
}

export function worldRoomDrawList(id: WorldRoomId, manifest: SpriteManifest): DrawList {
  const list = buildDrawList(
    WORLD_LAYOUTS[id],
    WORLD_SEAT_VIEWS[id],
    manifest,
    WORLD_SEAT_DEVICES[id],
  );
  for (const s of WORLD_STANDING[id]) {
    const { ops, missing } = standingAvatarOps(s.look, s.tx, s.ty, manifest);
    list.ops.push(...ops);
    list.unknown.push(...missing);
  }
  return list;
}

export const WORLD_ROOMS: {
  id: WorldRoomId;
  drawList: (manifest: SpriteManifest) => DrawList;
}[] = (["focus", "meeting", "lounge", "cafe"] as const).map((id) => ({
  id,
  drawList: (manifest: SpriteManifest) => worldRoomDrawList(id, manifest),
}));
