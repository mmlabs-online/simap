import type { RoomLayout, SeatDevice, SeatView } from "./layout";
import { buildDrawList, TILE, type DrawList } from "./placement";
import type { PixelLook } from "./pixel-look";
import type { SpriteManifest } from "./types";

/** The sign-in vignette (`scene.signin`, style guide §7): 12x7 tiles composed from existing atlas frames. */
export const SIGNIN_SCENE: RoomLayout = {
  w: 12,
  h: 7,
  floors: [
    { sprite: "wall.top", x: 0, y: 0, w: 12, h: 1 },
    { sprite: "wall.face", x: 0, y: 1, w: 12, h: 1 },
    { sprite: "floor.carpet", x: 0, y: 2, w: 12, h: 5 },
    { sprite: "floor.wood", x: 0, y: 5, w: 3, h: 2 },
  ],
  seats: [
    { id: "signin-1", code: "A1", sprite: "desk.single", x: 3, y: 3, rotation: 0 },
    { id: "signin-2", code: "A2", sprite: "desk.single", x: 7, y: 3, rotation: 0 },
  ],
  fixtures: [
    { id: "f-window", sprite: "window.double", x: 5, y: 1, rotation: 0 },
    { id: "f-clock", sprite: "clock.wall.s", x: 9, y: 1, rotation: 0 },
    { id: "f-plant-l", sprite: "plant.large", x: 0, y: 2, rotation: 0 },
    { id: "f-cabinet", sprite: "cabinet.filing.s", x: 9, y: 2, rotation: 0 },
    { id: "f-plant-s", sprite: "plant.small", x: 10, y: 2, rotation: 0 },
    { id: "f-cooler", sprite: "cooler.water.s", x: 11, y: 5, rotation: 0 },
    { id: "f-mug", sprite: "prop.mug", x: 4, y: 3, rotation: 0 },
    { id: "f-papers", sprite: "prop.papers", x: 8, y: 3, rotation: 0 },
  ],
};

export const SIGNIN_SCENE_PX = { w: SIGNIN_SCENE.w * TILE, h: SIGNIN_SCENE.h * TILE };

const LOOK_1: PixelLook = { skin: 0, hair: 1, style: 2, shirt: 1 };
const LOOK_2: PixelLook = { skin: 2, hair: 4, style: 1, shirt: 5 };

/** Two fixed demo avatars: no visitor data exists while signed out. */
export const SIGNIN_SEAT_VIEWS: Record<string, SeatView> = {
  "signin-1": { state: "occupied", avatarSeed: "signin-demo-1", name: null, look: LOOK_1 },
  "signin-2": { state: "occupied", avatarSeed: "signin-demo-2", name: null, look: LOOK_2 },
};

export const SIGNIN_SEAT_DEVICES: Record<string, SeatDevice[]> = {
  "signin-1": [{ type: "monitor" }],
  "signin-2": [{ type: "laptop" }],
};

export function signinDrawList(manifest: SpriteManifest): DrawList {
  return buildDrawList(SIGNIN_SCENE, SIGNIN_SEAT_VIEWS, manifest, SIGNIN_SEAT_DEVICES);
}
