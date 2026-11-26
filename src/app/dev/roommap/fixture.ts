import type { Placement, RoomLayout, SeatDevice, SeatView } from "@/lib/sprites/layout";

/** Rendered by the demo as `data-demo-fixture`; `pnpm check:dev-bundle` fails if it reaches a production bundle. */
export const DEMO_FIXTURE_MARKER = "simap-roommap-fixture-9c41";

const seat = (id: string, code: string, x: number, y: number, rotation: Placement["rotation"]) => ({
  id,
  code,
  sprite: "desk.single",
  x,
  y,
  rotation,
});

/** One 12 x 8 room: desk.single seats in four rotations, a tall plant and a mug beside the desks (no fixture goes on a desk, D61). */
export const DEMO_LAYOUT: RoomLayout = {
  w: 12,
  h: 8,
  floors: [
    { sprite: "floor.wood", x: 0, y: 0, w: 12, h: 8 },
    { sprite: "floor.carpet", x: 0, y: 4, w: 5, h: 4 },
  ],
  seats: [
    seat("seat-a1", "A1", 1, 1, 0),
    seat("seat-a2", "A2", 4, 1, 0),
    seat("seat-a3", "A3", 7, 1, 0),
    seat("seat-b1", "B1", 1, 5, 180),
    seat("seat-b2", "B2", 6, 4, 90),
    seat("seat-b3", "B3", 10, 4, 270),
  ],
  fixtures: [
    { id: "plant-1", sprite: "plant.large", x: 0, y: 0, rotation: 0 },
    { id: "plant-2", sprite: "plant.large", x: 11, y: 7, rotation: 0 },
    { id: "mug-1", sprite: "prop.mug", x: 3, y: 6, rotation: 0 },
  ],
};

/** Devices per seat: two monitors, a PC, a phone and a printer on one desk; one of each on others. */
export const DEMO_DEVICES: Record<string, SeatDevice[]> = {
  "seat-a1": [
    { type: "Monitor" },
    { type: "Monitor" },
    { type: "PC" },
    { type: "IP phone" },
    { type: "Printer" },
  ],
  "seat-b2": [{ type: "Laptop" }],
  "seat-b3": [{ type: "pc" }, { type: "pc" }],
};

/** One seat per state, with three different people (a Vietnamese name among them). */
export const DEMO_VIEWS: Record<string, SeatView> = {
  "seat-a1": { state: "occupied", avatarSeed: "sub-ann", name: "Nguyễn Thị Ánh", look: null },
  "seat-a2": { state: "mine", avatarSeed: "sub-me", name: "You", look: null },
  "seat-a3": { state: "pending", avatarSeed: null, name: null, look: null },
  "seat-b1": { state: "cannot", avatarSeed: null, name: null, look: null },
  "seat-b2": {
    state: "occupied",
    avatarSeed: "sub-bao",
    name: "Trần Bảo",
    look: { skin: 3, hair: 4, style: 2, shirt: 5 },
  },
  "seat-b3": { state: "empty", avatarSeed: null, name: null, look: null },
};
