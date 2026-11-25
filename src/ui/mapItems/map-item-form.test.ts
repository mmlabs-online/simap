import { describe, expect, it } from "vitest";
import { formFromItem, patchFrom, resizeEffects } from "./map-item-form";
import { dto } from "./test-items";

const art = (over: Record<string, unknown>) => {
  const none = { sprite: null, hasImage: false, imageVersion: 0 };
  return { n: none, e: none, s: none, w: none, ...over } as ReturnType<typeof dto>["art"];
};

describe("formFromItem", () => {
  it("copies name, group, shown = !hidden, size; confirmResize false", () => {
    const f = formFromItem(dto("table.meeting", { name: "Bàn", hidden: true }));
    expect(f).toEqual({
      name: "Bàn",
      group: "table",
      shown: false,
      w: 3,
      h: 2,
      confirmResize: false,
    });
  });
});

describe("patchFrom", () => {
  const item = dto("table.meeting", { name: "Cây lớn" });
  const form = formFromItem(item);

  it("no change, or only whitespace and NFC differences, is unchanged", () => {
    expect(patchFrom(item, form)).toEqual({ kind: "unchanged" });
    expect(patchFrom(item, { ...form, name: "  Cây \t lớn " })).toEqual({ kind: "unchanged" });
    expect(patchFrom(item, { ...form, name: "Cây lớn".normalize("NFD") })).toEqual({
      kind: "unchanged",
    });
  });

  it("sends only changed fields", () => {
    expect(patchFrom(item, { ...form, name: "Bàn" })).toEqual({
      kind: "patch",
      value: { name: "Bàn" },
    });
    expect(patchFrom(item, { ...form, group: "Nội thất" })).toEqual({
      kind: "patch",
      value: { group: "Nội thất" },
    });
    expect(patchFrom(item, { ...form, shown: false })).toEqual({
      kind: "patch",
      value: { hidden: true },
    });
  });

  it("blank or too long name and group are invalid", () => {
    expect(patchFrom(item, { ...form, name: "   " })).toEqual({ kind: "invalid", field: "name" });
    expect(patchFrom(item, { ...form, name: "ệ".repeat(61) })).toEqual({
      kind: "invalid",
      field: "name",
    });
    expect(patchFrom(item, { ...form, name: "ệ".repeat(60) }).kind).toBe("patch");
    expect(patchFrom(item, { ...form, group: "" })).toEqual({ kind: "invalid", field: "group" });
    expect(patchFrom(item, { ...form, group: "g".repeat(41) })).toEqual({
      kind: "invalid",
      field: "group",
    });
  });

  it("a fixed-size item never sends w/h; the chair never sends hidden", () => {
    const desk = dto("desk.single");
    expect(patchFrom(desk, { ...formFromItem(desk), w: 4, h: 4 })).toEqual({ kind: "unchanged" });
    const chair = dto("chair.office");
    expect(patchFrom(chair, { ...formFromItem(chair), shown: false })).toEqual({
      kind: "unchanged",
    });
  });

  it("a resize without effects needs no confirm", () => {
    expect(patchFrom(item, { ...form, w: 4 })).toEqual({ kind: "patch", value: { w: 4 } });
  });

  it("a resize with effects needs the confirm", () => {
    const withImage = dto("table.meeting", {
      art: art({ s: { sprite: null, hasImage: true, imageVersion: 1 } }),
    });
    const f = { ...formFromItem(withImage), w: 2 };
    expect(patchFrom(withImage, f)).toEqual({ kind: "needsConfirm" });
    expect(patchFrom(withImage, { ...f, confirmResize: true })).toEqual({
      kind: "patch",
      value: { w: 2 },
    });
  });
});

describe("resizeEffects", () => {
  it("counts images and sprites that no longer fit (e/w swap); none when the size is unchanged", () => {
    const item = dto("table.meeting", {
      art: art({
        n: { sprite: "table.meeting.n", hasImage: true, imageVersion: 1 },
        e: { sprite: "table.meeting.e", hasImage: false, imageVersion: 0 },
      }),
    });
    expect(resizeEffects(item, 3, 2)).toEqual({ images: 0, sprites: 0 });
    // 3x2 -> 3x3: n frame (3x2) fits, e frame (2x3 swapped) fits 3x3 swapped = 3x3
    expect(resizeEffects(item, 3, 3)).toEqual({ images: 1, sprites: 0 });
    // 3x2 -> 2x2: n frame 3 wide no longer fits; e dir sees 2x2 and the frame is 2x3: no fit
    expect(resizeEffects(item, 2, 2)).toEqual({ images: 1, sprites: 2 });
  });
});
