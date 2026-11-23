import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ZOOM_LEVELS, type Placement, type RoomLayout, type SeatView } from "./layout";
import {
  ROTATION_TO_DIR,
  buildDrawList,
  chairFor,
  resolveFrameKey,
  seatOrder,
  type DrawOp,
} from "./placement";
import type { SpriteManifest } from "./types";

const manifest = JSON.parse(
  readFileSync(new URL("../../../public/sprites/office.json", import.meta.url), "utf8"),
) as SpriteManifest;
const clone = () => structuredClone(manifest);

const place = (id: string, sprite: string, x: number, y: number, rotation = 0): Placement => ({
  id,
  sprite,
  x,
  y,
  rotation: rotation as Placement["rotation"],
});
const room = (p: Partial<RoomLayout> = {}): RoomLayout => ({
  w: 12,
  h: 8,
  floors: [],
  seats: [],
  fixtures: [],
  ...p,
});
const frames = (ops: DrawOp[]) =>
  ops.flatMap((o) => (o.type === "frame" ? [o] : [])).map((o) => o.key);
const view = (p: Partial<SeatView> = {}): SeatView => ({
  state: "empty",
  avatarSeed: null,
  name: null,
  ...p,
});

describe("rotation and zoom", () => {
  it("ROTATION_TO_DIR maps 0/90/180/270 to s/e/n/w", () => {
    expect(ROTATION_TO_DIR).toEqual({ 0: "s", 90: "e", 180: "n", 270: "w" });
  });

  it("ZOOM_LEVELS is 2, 3, 4", () => {
    expect([...ZOOM_LEVELS]).toEqual([2, 3, 4]);
  });

  it("resolveFrameKey uses a real directional key", () => {
    expect(resolveFrameKey("desk.single", 0)).toBe("desk.single.s");
    expect(resolveFrameKey("desk.single", 90)).toBe("desk.single.e");
    expect(resolveFrameKey("desk.single", 180)).toBe("desk.single.n");
    expect(resolveFrameKey("desk.single", 270)).toBe("desk.single.w");
    expect(resolveFrameKey("plant.large", 90)).toBe("plant.large");
  });

  it("resolveFrameKey does not treat wall.t.e as direction e", () => {
    expect(resolveFrameKey("wall.t", 90)).toBeNull();
    expect(resolveFrameKey("wall.t.e", 90)).toBe("wall.t.e");
  });

  it("resolveFrameKey returns null for an unknown sprite", () => {
    expect(resolveFrameKey("nope", 0)).toBeNull();
    expect(resolveFrameKey("", 0)).toBeNull();
  });
});

describe("buildDrawList placement", () => {
  it("places a sprite at tile*32 + anchor, including negative anchors", () => {
    const m = clone();
    m.frames["plant.large"].anchor = [-4, -32];
    const { ops } = buildDrawList(room({ fixtures: [place("p", "plant.large", 3, 2)] }), {}, m);
    const op = ops.find((o) => o.type === "frame" && o.key === "plant.large");
    expect(op).toMatchObject({ x: 3 * 32 - 4, y: 2 * 32 - 32 });
  });

  it("footprint follows the rotated frame (desk.single 2x1 -> 1x2)", () => {
    const seat = (rotation: number) => ({
      ...place("s", "desk.single", 2, 2, rotation),
      code: "A1",
    });
    const a = buildDrawList(room({ seats: [seat(0)] }), {}, manifest).seats[0];
    const b = buildDrawList(room({ seats: [seat(90)] }), {}, manifest).seats[0];
    expect([a.w, a.h]).toEqual([64, 32]);
    expect([b.w, b.h]).toEqual([32, 64]);
  });

  it("bounds include a frame anchored at y = -32 and a 2 px side overhang", () => {
    const m = clone();
    m.frames["plant.large"].anchor = [0, -32];
    m.frames["plant.large"].h = 64;
    m.frames["desk.single.s"].anchor = [-2, 0];
    m.frames["desk.single.s"].w = 68;
    const tall = buildDrawList(room({ fixtures: [place("p", "plant.large", 1, 0)] }), {}, m);
    expect(tall.bounds.y).toBe(-32);
    expect(tall.bounds.h).toBe(8 * 32 + 32);
    const desk = buildDrawList(
      room({ seats: [{ ...place("s", "desk.single", 0, 3), code: "A1" }] }),
      {},
      m,
    ).bounds;
    expect(desk.x).toBe(-2);
    expect(desk.w).toBe(12 * 32 + 2);
  });

  it("bounds equal the room rect when nothing overhangs", () => {
    const layout = room({ floors: [{ sprite: "floor.wood", x: 0, y: 0, w: 12, h: 8 }] });
    expect(buildDrawList(layout, {}, manifest).bounds).toEqual({ x: 0, y: 0, w: 384, h: 256 });
  });

  it("a different valid manifest changes ops without code changes", () => {
    const layout = room({ fixtures: [place("p", "plant.large", 3, 2)] });
    const m = clone();
    m.frames["plant.large"].anchor = [5, 7];
    const a = buildDrawList(layout, {}, manifest).ops.find((o) => o.type === "frame");
    const b = buildDrawList(layout, {}, m).ops.find((o) => o.type === "frame");
    expect(a).not.toEqual(b);
    expect(b).toMatchObject({ x: 3 * 32 + 5, y: 2 * 32 + 7 });
  });

  it("unknown sprite is reported and skipped, not thrown", () => {
    const layout = room({ fixtures: [place("x", "nope", 1, 1), place("p", "plant.large", 2, 2)] });
    const r = buildDrawList(layout, {}, manifest);
    expect(r.unknown).toEqual(["nope"]);
    expect(frames(r.ops)).toEqual(["plant.large"]);
  });
});

describe("buildDrawList order", () => {
  const seat = { ...place("s1", "desk.single", 2, 2), code: "A1" };

  it("layers are emitted in manifest order", () => {
    const layout = room({
      floors: [{ sprite: "floor.wood", x: 0, y: 0, w: 2, h: 2 }],
      fixtures: [place("w", "wall.top", 0, 0)],
      seats: [seat],
    });
    const { ops } = buildDrawList(
      layout,
      { s1: view({ state: "mine", avatarSeed: "u" }) },
      manifest,
    );
    const ranks = ops.map((o) => manifest.layers.indexOf(o.layer));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(new Set(ops.map((o) => o.layer))).toEqual(new Set(manifest.layers));
  });

  it("furniture sorts by bottom row, full before sub, x, id", () => {
    const layout = room({
      fixtures: [
        place("c", "plant.large", 5, 2),
        place("a", "plant.large", 1, 3),
        place("m", "prop.mug", 1, 3),
        place("b", "plant.large", 3, 2),
      ],
    });
    const xs = buildDrawList(layout, {}, manifest)
      .ops.filter((o) => o.type === "frame")
      .map((o) => `${o.key}@${o.x}`);
    const plant = manifest.frames["plant.large"].anchor[0];
    const mug = manifest.frames["prop.mug"].anchor[0];
    expect(xs).toEqual([
      `plant.large@${3 * 32 + plant}`,
      `plant.large@${5 * 32 + plant}`,
      `plant.large@${32 + plant}`,
      `prop.mug@${32 + mug}`,
    ]);
  });

  it("a prop on the top tile of a 1x2 desk paints after the desk", () => {
    const layout = room({
      fixtures: [
        place("mug", "prop.mug", 2, 2),
        place("desk", "desk.single", 2, 2, 90),
        place("plant", "plant.large", 6, 3),
      ],
    });
    const order = frames(buildDrawList(layout, {}, manifest).ops);
    expect(order.indexOf("prop.mug")).toBeGreaterThan(order.indexOf("desk.single.e"));
  });

  it("a prop on a 3x2 meeting table paints after the table", () => {
    const layout = room({
      fixtures: [place("mug", "prop.mug", 3, 1), place("t", "table.meeting", 1, 1)],
    });
    const order = frames(buildDrawList(layout, {}, manifest).ops);
    expect(order.indexOf("prop.mug")).toBeGreaterThan(order.indexOf("table.meeting.s"));
  });

  it("a chair never acts as a prop host", () => {
    expect(manifest.frames["chair.office.s"].blocks).toBe(false);
    const layout = room({
      fixtures: [place("mug", "prop.mug", 4, 4), place("ch", "chair.office", 4, 4)],
    });
    const order = frames(buildDrawList(layout, {}, manifest).ops);
    expect(order).toEqual(["chair.office.s", "prop.mug"]);
  });

  it("seatOrder is row, column, id", () => {
    const seats = [
      { id: "d", x: 1, y: 2 },
      { id: "c", x: 3, y: 1 },
      { id: "b", x: 1, y: 1 },
      { id: "a", x: 1, y: 1 },
    ];
    expect(seatOrder(seats).map((s) => s.id)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("chairs, shadows and avatars", () => {
  it("chairFor returns the table tile and facing for s, n, e, w", () => {
    const at = { x: 2, y: 2 };
    expect(chairFor(at, [2, 1], "s")).toEqual({ x: 2, y: 3, key: "chair.office.n" });
    expect(chairFor(at, [2, 1], "n")).toEqual({ x: 2, y: 1, key: "chair.office.s" });
    expect(chairFor(at, [1, 2], "e")).toEqual({ x: 3, y: 2, key: "chair.office.w" });
    expect(chairFor(at, [1, 2], "w")).toEqual({ x: 1, y: 2, key: "chair.office.e" });
  });

  it("shadow op is 4 px tall, inset 2 px, 1 px above the bottom edge, only for shadow keys", () => {
    const layout = room({
      fixtures: [place("p", "plant.large", 3, 2), place("l", "label.sign", 6, 2)],
    });
    const shadows = buildDrawList(layout, {}, manifest).ops.filter((o) => o.type === "shadow");
    expect(shadows).toEqual([{ type: "shadow", layer: "shadow", x: 98, y: 95, w: 28, h: 4 }]);
  });

  it("avatar is drawn when avatarSeed is set, including a mine seat", () => {
    const seat = { ...place("s1", "desk.single", 2, 2), code: "A1" };
    const ops = buildDrawList(
      room({ seats: [seat] }),
      { s1: view({ state: "mine", avatarSeed: "sub-1" }) },
      manifest,
    ).ops;
    const keys = frames(ops);
    expect(keys.filter((k) => k.startsWith("avatar."))).toHaveLength(3);
    expect(keys.filter((k) => k === "state.mine.tint")).toHaveLength(2);
    const none = buildDrawList(room({ seats: [seat] }), { s1: view() }, manifest).ops;
    expect(frames(none).some((k) => k.startsWith("avatar."))).toBe(false);
  });

  it("avatar uses back view on a .n chair, otherwise front", () => {
    const at = (rotation: number) =>
      frames(
        buildDrawList(
          room({ seats: [{ ...place("s1", "desk.single", 2, 2, rotation), code: "A1" }] }),
          { s1: view({ state: "occupied", avatarSeed: "u" }) },
          manifest,
        ).ops,
      );
    expect(at(0)).toContain("avatar.body.back");
    expect(at(180)).toContain("avatar.body.front");
  });
});

describe("seat state sprites with the real atlas", () => {
  it("cannot and mine seats emit their state sprites from the real atlas", () => {
    const seat = (id: string, x: number) => ({ ...place(id, "desk.single", x, 2), code: id });
    const list = buildDrawList(
      room({ seats: [seat("a", 1), seat("b", 6)] }),
      { a: view({ state: "cannot" }), b: view({ state: "mine", avatarSeed: "u" }) },
      manifest,
    );
    const keys = frames(list.ops);
    expect(keys).toContain("state.cannot");
    expect(keys).toContain("state.mine.tint");
  });
});
