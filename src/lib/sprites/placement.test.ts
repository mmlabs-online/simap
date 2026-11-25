import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ZOOM_LEVELS,
  type Placement,
  type RoomLayout,
  type SeatDevice,
  type SeatView,
} from "./layout";
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

  it("ZOOM_LEVELS is 1, 2, 3, 4", () => {
    expect([...ZOOM_LEVELS]).toEqual([1, 2, 3, 4]);
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

describe("seat devices on desks (D61)", () => {
  const desk = (rotation = 0) => ({ ...place("s1", "desk.single", 2, 2, rotation), code: "A1" });
  const draw = (types: string[], rotation = 0) =>
    buildDrawList(room({ seats: [desk(rotation)] }), {}, manifest, {
      s1: types.map((type) => ({ type })),
    });
  const without = () => buildDrawList(room({ seats: [desk()] }), {}, manifest);

  it("a seat without devices draws exactly as before", () => {
    expect(draw([])).toEqual(without());
    expect(buildDrawList(room({ seats: [desk()] }), {}, manifest, {})).toEqual(without());
  });

  it("two PC devices draw two device.pc frames", () => {
    expect(frames(draw(["PC", "PC"]).ops).filter((k) => k === "device.pc")).toHaveLength(2);
  });

  it("each type maps to its sprite (directional laptop/monitor follow the desk)", () => {
    const rot: [number, string][] = [
      [0, "s"],
      [90, "e"],
      [180, "n"],
      [270, "w"],
    ];
    for (const [rotation, dir] of rot) {
      const keys = frames(draw(["Laptop", "Monitor", "PC", "IP phone", "Printer"], rotation).ops);
      for (const k of [
        `device.laptop.${dir}`,
        `device.monitor.${dir}`,
        "device.pc",
        "device.phone",
        "device.other",
      ]) {
        expect(keys, `${rotation} ${k}`).toContain(k);
      }
    }
  });

  it("a PC op comes before its desk op; phone, other and monitor ops come after it", () => {
    const keys = frames(draw(["PC", "Monitor", "IP phone", "Printer"]).ops);
    const at = (k: string) => keys.indexOf(k);
    expect(at("device.pc")).toBeLessThan(at("desk.single.s"));
    for (const k of ["device.monitor.s", "device.phone", "device.other"]) {
      expect(at(k), k).toBeGreaterThan(at("desk.single.s"));
    }
  });

  it("slots follow rotation 0/90/180/270 (tiles inside the desk footprint)", () => {
    for (const rotation of [0, 90, 180, 270]) {
      const list = draw(["Monitor", "Monitor", "Laptop", "IP phone", "Printer"], rotation);
      expect(list.unknown).toEqual([]);
      const deskFrame = list.ops.find((o) => o.type === "frame" && o.key.startsWith("desk.single"));
      const devices = list.ops.filter((o) => o.type === "frame" && o.key.startsWith("device."));
      expect(devices).toHaveLength(5);
      for (const f of devices) {
        // a device's top-left stays within one tile of the desk's pixel box
        expect(f.x).toBeGreaterThan((deskFrame?.x ?? 0) - 40);
        expect(f.y).toBeGreaterThan((deskFrame?.y ?? 0) - 40);
      }
    }
  });

  it("device ops add no seat box and no selectable id; devices of a seat not in the layout are ignored", () => {
    const withDev = draw(["PC", "Monitor"]);
    expect(withDev.seats).toEqual(without().seats);
    const ghost = buildDrawList(room({ seats: [desk()] }), {}, manifest, {
      nobody: [{ type: "PC" }],
    });
    expect(ghost).toEqual(without());
  });
});

describe("catalog device images (SIM-036.4)", () => {
  const desk = (rotation = 0) => ({ ...place("s1", "desk.single", 2, 2, rotation), code: "A1" });
  const type = (over = {}) => ({
    id: "t1",
    slot: "phone" as const,
    hasImage: true,
    imageVersion: 2,
    ...over,
  });
  const draw = (devices: SeatDevice[], ready = true, rotation = 0) =>
    buildDrawList(room({ seats: [desk(rotation)] }), {}, manifest, { s1: devices }, () => ready);
  const imgs = (ops: DrawOp[]) => ops.flatMap((o) => (o.type === "image" ? [o] : []));

  it("catalog image op at the slot position, centred on the slot frame", () => {
    for (const rotation of [0, 90, 180, 270]) {
      const withImage = draw([{ type: "Headset", deviceType: type() }], true, rotation);
      const builtin = draw([{ type: "IP phone" }], true, rotation);
      const [img] = imgs(withImage.ops);
      const f = builtin.ops.find((o) => o.type === "frame" && o.key === "device.phone");
      expect(img, String(rotation)).toMatchObject({ typeId: "t1", version: 2, w: 24, h: 24 });
      expect(img.x).toBe((f?.x ?? 0) + Math.floor(((f?.w ?? 0) - 24) / 2));
      expect(img.y).toBe((f?.y ?? 0) + Math.floor(((f?.h ?? 0) - 24) / 2));
      expect(frames(withImage.ops)).not.toContain("device.phone");
    }
  });

  it("seeded type without image keeps the built-in sprite", () => {
    const list = draw([{ type: "PC", deviceType: type({ slot: "pc", hasImage: false }) }]);
    expect(frames(list.ops)).toContain("device.pc");
    expect(imgs(list.ops)).toHaveLength(0);
  });

  it("deviceType null draws the device.other placeholder", () => {
    const list = draw([{ type: "PC", deviceType: null }]);
    expect(frames(list.ops)).toContain("device.other");
    expect(frames(list.ops)).not.toContain("device.pc");
  });

  it("image not ready draws the placeholder at the type's slot; other ops unchanged", () => {
    const base = draw([]);
    const list = draw([{ type: "Headset", deviceType: type() }], false);
    expect(imgs(list.ops)).toHaveLength(0);
    expect(frames(list.ops).filter((k) => k === "device.other")).toHaveLength(1);
    expect(list.ops.filter((o) => o.type === "frame" && o.key !== "device.other")).toEqual(
      base.ops.filter((o) => o.type === "frame"),
    );
  });

  it("an under slot (pc) paints the image before the desk", () => {
    const list = draw([{ type: "Tower", deviceType: type({ slot: "pc" }) }]);
    const at = list.ops.findIndex((o) => o.type === "image");
    const desk = list.ops.findIndex((o) => o.type === "frame" && o.key === "desk.single.s");
    expect(at).toBeGreaterThanOrEqual(0);
    expect(at).toBeLessThan(desk);
  });

  it("images after the second slot stack and the cap is 4 per kind", () => {
    const list = draw(Array.from({ length: 6 }, () => ({ type: "H", deviceType: type() })));
    const xs = imgs(list.ops).map((o) => o.x);
    expect(xs).toHaveLength(4);
    expect(xs[3] - xs[2]).toBe(3);
  });
});
