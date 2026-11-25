import { describe, expect, it } from "vitest";
import type { LayoutResponse } from "./layout";
import { toMapView } from "./map-view";

const body = (over: Record<string, unknown> = {}) => ({
  room: { id: "r1", code: "C302", name: "Room" },
  version: 1,
  saved: true,
  layout: {
    w: 12,
    h: 8,
    floors: [{ sprite: "floor.wood", x: 0, y: 0, w: 12, h: 8 }],
    seats: [
      { id: "s1", code: "C302-01", sprite: "desk.single", x: 2, y: 1, rotation: 0 },
      { id: "s2", code: "C302-02", sprite: "desk.single", x: 6, y: 1, rotation: 90 },
    ],
    fixtures: [{ id: "f1", sprite: "plant.large", x: 1, y: 0, rotation: 0 }],
  },
  seatViews: {
    s1: { state: "occupied", avatarSeed: "u1", name: "Nguyễn Thị Ánh" },
  },
  unplaced: [],
  truncated: false,
  ...over,
});
const layoutWith = (over: Record<string, unknown>) => ({ ...body().layout, ...over });
const NONE = { seats: [], fixtures: [], floors: [] };

describe("toMapView", () => {
  it("toMapView keeps version; a missing or negative version gives null", () => {
    expect(toMapView(body({ version: 5 }))?.version).toBe(5);
    expect(toMapView(body({ version: undefined }))).toBeNull();
    expect(toMapView(body({ version: -1 }))).toBeNull();
    expect(toMapView(body({ version: 1.5 }))).toBeNull();
  });

  it("keeps every placed seat and fixture with its tile", () => {
    const b = body() as unknown as LayoutResponse;
    const view = toMapView(b);
    expect(view?.layout.seats).toEqual(b.layout.seats);
    expect(view?.layout.fixtures).toEqual(b.layout.fixtures);
    expect(view?.layout.floors).toEqual(b.layout.floors);
    expect([view?.layout.w, view?.layout.h]).toEqual([12, 8]);
  });

  it("seat state comes from seatViews, missing entry defaults to empty", () => {
    const view = toMapView(body());
    expect(view?.seatViews.s1.state).toBe("occupied");
    expect(view?.seatViews.s2).toEqual({ state: "empty", avatarSeed: null, name: null });
    expect(Object.keys(view?.seatViews ?? {})).toEqual(["s1", "s2"]);
  });

  it("maps empty, occupied, mine, cannot (and passes pending through)", () => {
    const seatViews = {
      s1: { state: "mine", avatarSeed: "a", name: "A" },
      s2: { state: "cannot", avatarSeed: null, name: null },
      s3: { state: "pending", avatarSeed: "p", name: "P" },
      s4: { state: "empty", avatarSeed: null, name: null },
    };
    const seats = ["s1", "s2", "s3", "s4"].map((id, i) => ({
      id,
      code: id,
      sprite: "desk.single",
      x: i * 3,
      y: 0,
      rotation: 0,
    }));
    const view = toMapView(body({ seatViews, layout: layoutWith({ seats }) }));
    expect(Object.values(view?.seatViews ?? {}).map((v) => v.state)).toEqual([
      "mine",
      "cannot",
      "pending",
      "empty",
    ]);
  });

  it("unknown state string becomes empty; null name and null avatarSeed allowed", () => {
    const view = toMapView(
      body({
        seatViews: {
          s1: { state: "weird", avatarSeed: "x", name: "N" },
          s2: { state: "occupied", avatarSeed: null, name: null },
        },
      }),
    );
    expect(view?.seatViews.s1).toEqual({ state: "empty", avatarSeed: null, name: null });
    expect(view?.seatViews.s2).toEqual({ state: "occupied", avatarSeed: null, name: null });
  });

  it("keeps Vietnamese names unchanged", () => {
    expect(toMapView(body())?.seatViews.s1.name).toBe("Nguyễn Thị Ánh");
  });

  it("unplaced seats are listed in server order and are not in layout.seats", () => {
    const view = toMapView(
      body({
        unplaced: [
          { id: "s9", code: "C302-09" },
          { id: "s8", code: "C302-08" },
        ],
      }),
    );
    expect(view?.unplaced.map((u) => u.code)).toEqual(["C302-09", "C302-08"]);
    expect(view?.layout.seats.map((s) => s.id)).not.toContain("s9");
  });

  it("truncated and saved:false are carried through", () => {
    const view = toMapView(body({ truncated: true, saved: false }));
    expect(view?.truncated).toBe(true);
    expect(view?.saved).toBe(false);
    expect(view?.empty).toBe(false);
  });

  it("empty is true only when seats, fixtures and floors are all empty", () => {
    expect(toMapView(body({ layout: layoutWith(NONE) }))?.empty).toBe(true);
    const floors = body().layout.floors;
    expect(toMapView(body({ layout: layoutWith({ ...NONE, floors }) }))?.empty).toBe(false);
    const fixtures = body().layout.fixtures;
    expect(toMapView(body({ layout: layoutWith({ ...NONE, fixtures }) }))?.empty).toBe(false);
  });

  it("returns null for a bad shape", () => {
    const seat = body().layout.seats[0];
    const bad: unknown[] = [
      null,
      "x",
      [],
      body({ layout: undefined }),
      body({ layout: layoutWith({ seats: {} }) }),
      body({ layout: layoutWith({ fixtures: "x" }) }),
      body({ layout: layoutWith({ floors: null }) }),
      body({ unplaced: {} }),
      body({ truncated: "no" }),
      body({ layout: layoutWith({ seats: [{ ...seat, id: 1 }] }) }),
      body({ layout: layoutWith({ seats: [{ ...seat, code: undefined }] }) }),
      body({ layout: layoutWith({ seats: [{ ...seat, x: 1.5 }] }) }),
      body({ layout: layoutWith({ seats: [{ ...seat, y: "2" }] }) }),
      body({ layout: layoutWith({ seats: [{ ...seat, rotation: 45 }] }) }),
    ];
    for (const b of bad) expect(toMapView(b)).toBeNull();
  });
});

describe("toMapView seatDevices", () => {
  const body = (seatDevices: unknown) => ({
    room: { id: "r", code: "R", name: "R" },
    version: 1,
    saved: true,
    layout: {
      w: 4,
      h: 3,
      floors: [],
      seats: [{ id: "s1", code: "A1", sprite: "desk.single", x: 1, y: 1, rotation: 0 }],
      fixtures: [],
    },
    seatViews: {},
    seatDevices,
    unplaced: [],
    truncated: false,
  });

  it("seatDevices: parsed per placed seat; a missing or bad value gives {}", () => {
    const ok = toMapView(
      body({
        s1: [{ type: "PC" }, { type: 5 }, null, { type: "Laptop", name: "x" }],
        other: [{ type: "PC" }],
      }),
    );
    expect(ok?.seatDevices).toEqual({ s1: [{ type: "PC" }, { type: "Laptop" }] });
    for (const bad of [undefined, null, "x", 3, [], { s1: "x" }, { s1: [] }]) {
      expect(toMapView(body(bad))?.seatDevices, String(bad)).toEqual({});
    }
    const many = Array.from({ length: 12 }, () => ({ type: "PC" }));
    expect(toMapView(body({ s1: many }))?.seatDevices.s1).toHaveLength(8);
  });

  it("seatDevices: keeps a valid deviceType and null; a bad shape becomes null; missing stays missing", () => {
    const good = { id: "t1", slot: "phone", hasImage: true, imageVersion: 2, sprite: null };
    const view = toMapView(
      body({
        s1: [
          { type: "A", deviceType: good },
          { type: "B", deviceType: null },
          { type: "C", deviceType: { ...good, slot: "fax" } },
          { type: "D", deviceType: { ...good, imageVersion: 1.5 } },
          { type: "E" },
        ],
      }),
    );
    const list = view?.seatDevices.s1 ?? [];
    expect(list[0].deviceType).toEqual(good);
    expect(list[1].deviceType).toBeNull();
    expect(list[2].deviceType).toBeNull();
    expect(list[3].deviceType).toBeNull();
    expect("deviceType" in list[4]).toBe(false);
  });
});

describe("toMapView deviceType.sprite", () => {
  it("keeps a well-formed string; missing, non-string or malformed becomes null", () => {
    const base = { id: "t1", slot: "phone", hasImage: false, imageVersion: 0 };
    const sprites = (...vals: unknown[]) =>
      (
        toMapView(
          body({
            seatDevices: {
              s1: vals.map((v) => ({
                type: "A",
                deviceType: v === undefined ? base : { ...base, sprite: v },
              })),
            },
          }),
        )?.seatDevices.s1 ?? []
      ).map((d) => d.deviceType?.sprite);
    expect(sprites("device.laptop", undefined, 1, " x", "")).toEqual([
      "device.laptop",
      null,
      null,
      null,
      null,
    ]);
  });
});

describe("toMapView items", () => {
  it("maps items; a missing or non-array items gives []; a malformed entry is dropped", () => {
    const art = { sprite: null, hasImage: false, imageVersion: 0 };
    const item = {
      builtinKey: "plant.large",
      name: "Cây",
      group: "Decor",
      w: 2,
      h: 1,
      kind: "fixture",
      directional: false,
      fixedSize: false,
      art: { n: art, e: art, s: art, w: art },
    };
    expect(toMapView(body({ items: [item] }))?.items).toEqual([item]);
    expect(toMapView(body())?.items).toEqual([]);
    expect(toMapView(body({ items: "x" }))?.items).toEqual([]);
    const view = toMapView(
      body({ items: [item, { ...item, w: 1.5 }, null, { ...item, kind: "x" }] }),
    );
    expect(view?.items).toEqual([item]);
    expect(view?.layout.w).toBe(12);
  });
});
