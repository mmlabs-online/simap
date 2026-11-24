import { describe, expect, it } from "vitest";
import { LAYOUT_LIMITS, checkLayoutRules, validateLayoutSave } from "@/lib/validate/layout";
import { defaultLayout } from "./default-layout";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const seatsOf = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: id(i + 1), code: `S${i + 1}` }));

describe("defaultLayout", () => {
  it.each([
    [0, 12, 8],
    [1, 12, 8],
    [16, 12, 8],
    [17, 15, 8],
    [21, 15, 10],
    [100, 30, 20],
    [441, 63, 42],
    [442, 63, 44],
    [500, 63, 48],
  ])("sizes: %i seats give %i x %i", (n, w, h) => {
    const l = defaultLayout(seatsOf(n));
    expect([l.w, l.h]).toEqual([w, h]);
  });

  it("places seats in input order on the 3x2 pitch", () => {
    const l = defaultLayout(seatsOf(6));
    expect(l.seats.map((s) => [s.id, s.x, s.y])).toEqual([
      [id(1), 0, 0],
      [id(2), 3, 0],
      [id(3), 6, 0],
      [id(4), 9, 0],
      [id(5), 0, 2],
      [id(6), 3, 2],
    ]);
  });

  it("uses desk.single at rotation 0, one floor.wood zone over the room, no fixtures", () => {
    const l = defaultLayout(seatsOf(5));
    expect(l.seats.every((s) => s.sprite === "desk.single" && s.rotation === 0)).toBe(true);
    expect(l.floors).toEqual([{ sprite: "floor.wood", x: 0, y: 0, w: l.w, h: l.h }]);
    expect(l.fixtures).toEqual([]);
  });

  it("keeps id and code, including Vietnamese diacritics in a code", () => {
    const l = defaultLayout([{ id: id(1), code: "Ghế-Đ1" }]);
    expect(l.seats[0]).toMatchObject({ id: id(1), code: "Ghế-Đ1" });
  });

  it("passes checkLayoutRules for every size", () => {
    for (const n of [0, 1, 4, 16, 17, 100, 441, 442, 500]) {
      expect(checkLayoutRules(defaultLayout(seatsOf(n)))).toEqual({ ok: true });
    }
  });

  it("maps to a payload validateLayoutSave accepts", () => {
    const l = defaultLayout(seatsOf(17));
    const body = {
      baseVersion: 0,
      w: l.w,
      h: l.h,
      floors: l.floors,
      seats: l.seats.map(({ code: _code, ...p }) => p),
      fixtures: l.fixtures,
    };
    expect(validateLayoutSave(body).ok).toBe(true);
  });

  it("is deterministic", () => {
    expect(defaultLayout(seatsOf(30))).toEqual(defaultLayout(seatsOf(30)));
  });

  it("lays out at most 500 seats", () => {
    const l = defaultLayout(seatsOf(501));
    expect(l.seats).toHaveLength(LAYOUT_LIMITS.seats);
    expect(l.seats.some((s) => s.id === id(501))).toBe(false);
  });
});
