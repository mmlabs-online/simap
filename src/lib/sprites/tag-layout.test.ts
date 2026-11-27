import { describe, expect, it } from "vitest";
import type { Rect } from "./placement";
import {
  DOT,
  TAG_H,
  TAG_MAX,
  layoutTags,
  openTagRect,
  tagWidth,
  type PlacedTag,
  type TagSeat,
} from "./tag-layout";

const seat = (id: string, col: number, row: number, text: string, z = 1): TagSeat => ({
  id,
  left: col * 32 * z,
  top: row * 32 * z,
  w: 32 * z,
  h: 32 * z,
  text,
});
const rectOf = (t: PlacedTag): Rect => ({
  x: t.left,
  y: t.top,
  w: t.width,
  h: t.kind === "dot" ? DOT : TAG_H,
});
const hit = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const noOverlap = (tags: PlacedTag[], obstacles: Rect[] = []) => {
  const rects = tags.filter((t) => t.kind === "tag").map(rectOf);
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) expect(hit(rects[i], rects[j])).toBe(false);
    for (const o of obstacles) expect(hit(rects[i], o)).toBe(false);
  }
};
const inside = (t: PlacedTag, area: { w: number; h: number }) => {
  expect(t.left).toBeGreaterThanOrEqual(0);
  expect(t.top).toBeGreaterThanOrEqual(0);
  expect(t.left + t.width).toBeLessThanOrEqual(area.w);
  expect(t.top + TAG_H).toBeLessThanOrEqual(area.h);
};

describe("tagWidth", () => {
  it("counts code points of the NFC name and caps at 160 with truncated", () => {
    // "Nguyễn Thị Ánh" is 14 characters, also when typed as combining marks.
    const nfd = "Nguyễn Thị Ánh".normalize("NFD");
    expect(tagWidth(nfd)).toEqual(tagWidth("Nguyễn Thị Ánh"));
    expect(tagWidth("Nguyễn Thị Ánh").width).toBe(14 * 7 + 34);
    expect(tagWidth("Nguyễn Thị Ánh").truncated).toBe(false);
    const long = tagWidth("x".repeat(60));
    expect(long).toEqual({ width: TAG_MAX, truncated: true });
  });
});

describe("layoutTags", () => {
  it("two adjacent desks in a row, at zoom 1 and zoom 4: both tags placed, no overlap", () => {
    for (const z of [1, 4]) {
      const area = { w: 8 * 32 * z, h: 6 * 32 * z };
      const tags = layoutTags({
        seats: [seat("a", 3, 3, "Nguyễn Thị Ánh", z), seat("b", 4, 3, "Trần Văn Bình", z)],
        area,
      });
      expect(tags.map((t) => t.kind)).toEqual(["tag", "tag"]);
      noOverlap(tags);
      tags.forEach((t) => inside(t, area));
    }
  });

  it("a dense row of 6 desks with long names at zoom 1: no overlap, tags shift or stack before any dot", () => {
    const area = { w: 8 * 32, h: 8 * 32 };
    const seats = [0, 1, 2, 3, 4, 5].map((c) => seat(`s${c}`, c, 3, `Nguyễn Thị Ánh Dương ${c}`));
    const tags = layoutTags({ seats, area });
    noOverlap(tags);
    tags.forEach((t) => inside(t, area));
    expect(tags.filter((t) => t.kind === "dot")).toEqual([]);
  });

  it("near the top edge the tag goes below; near the left and right edges it is clamped inside", () => {
    const area = { w: 6 * 32, h: 6 * 32 };
    const [top] = layoutTags({ seats: [seat("a", 2, 0, "Lee")], area });
    expect(top.top).toBeGreaterThan(32);
    const [left, right] = layoutTags({
      seats: [seat("l", 0, 3, "Nguyễn Thị Ánh Dương"), seat("r", 5, 3, "Nguyễn Thị Ánh Dương")],
      area,
    });
    inside(left, area);
    inside(right, area);
    expect(left.left).toBe(0);
    expect(right.left + right.width).toBe(area.w);
  });

  it("tags never cover an obstacle (open-tag rects)", () => {
    const area = { w: 8 * 32, h: 8 * 32 };
    const s = seat("a", 3, 4, "Lee");
    const [free] = layoutTags({ seats: [s], area });
    const obstacle: Rect = { x: free.left, y: free.top, w: free.width, h: TAG_H };
    const [moved] = layoutTags({ seats: [s], area, obstacles: [obstacle] });
    expect(moved.kind).toBe("tag");
    noOverlap([moved], [obstacle]);
  });

  it("impossible density gives dots inside the seat rect, and dots never intersect", () => {
    // An area exactly as tall as the seat row leaves no room above or below.
    const area = { w: 4 * 32, h: 32 };
    const seats = [0, 1, 2, 3].map((c) => seat(`s${c}`, c, 0, "Nguyễn Thị Ánh Dương"));
    const tags = layoutTags({ seats, area });
    const dots = tags.filter((t) => t.kind === "dot");
    expect(dots.length).toBeGreaterThan(0);
    for (const d of dots) {
      const s = seats.find((x) => x.id === d.id)!;
      expect(d.left).toBeGreaterThanOrEqual(s.left);
      expect(d.left + DOT).toBeLessThanOrEqual(s.left + s.w);
      expect(d.top).toBeGreaterThanOrEqual(s.top);
    }
    const rects = dots.map(rectOf);
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) expect(hit(rects[i], rects[j])).toBe(false);
    }
  });

  it("a dot is never covered by a later tag", () => {
    // Seat a finds no room beside the obstacle and becomes a dot; seat b's first candidate would cover that dot.
    const area = { w: 300, h: 30 };
    const a: TagSeat = {
      id: "a",
      left: 0,
      top: 0,
      w: 64,
      h: 32,
      text: "Nguyễn Thị Ánh Dương Long",
    };
    const b = seat("b", 2, 0, "Nguyen Anh");
    const tags = layoutTags({ seats: [a, b], area, obstacles: [{ x: 0, y: 0, w: 20, h: 30 }] });
    const [ta, tb] = tags;
    expect(ta.kind).toBe("dot");
    expect(tb.kind).toBe("tag");
    expect(hit(rectOf(ta), rectOf(tb))).toBe(false);
  });

  it("is deterministic and follows the input (reading) order", () => {
    const area = { w: 8 * 32, h: 8 * 32 };
    const seats = [seat("a", 2, 3, "Anh"), seat("b", 3, 3, "Binh"), seat("c", 4, 3, "Chi")];
    const one = layoutTags({ seats, area });
    expect(layoutTags({ seats, area })).toEqual(one);
    expect(one.map((t) => t.id)).toEqual(["a", "b", "c"]);
  });
});

describe("openTagRect", () => {
  it("is centred on the desk and clamped inside the area", () => {
    const area = { w: 8 * 32, h: 6 * 32 };
    const mid = openTagRect(seat("a", 3, 3, ""), area, "Move here");
    expect(mid.h).toBe(TAG_H);
    expect(Math.abs(mid.x + mid.w / 2 - (3 * 32 + 16))).toBeLessThanOrEqual(1);
    expect(Math.abs(mid.y + mid.h / 2 - (3 * 32 + 16))).toBeLessThanOrEqual(1);
    const edge = openTagRect(seat("a", 0, 0, ""), area, "Move here");
    expect(edge.x).toBe(0);
    expect(edge.y).toBeGreaterThanOrEqual(0);
  });
});
