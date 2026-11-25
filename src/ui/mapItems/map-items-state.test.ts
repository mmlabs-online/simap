import { describe, expect, it } from "vitest";
import { apiErrorMessage } from "../copy/api";
import { mapItemsCopy } from "../copy/mapItems";
import {
  canManageMapItems,
  catalogGroups,
  isLibraryDefault,
  mapItemErrorMessage,
  settleMapItem,
} from "./map-items-state";
import { dto } from "./test-items";

describe("canManageMapItems", () => {
  it("admin true; manager, user, null, undefined false", () => {
    expect(canManageMapItems("admin")).toBe(true);
    for (const t of ["manager", "user", null, undefined] as const) {
      expect(canManageMapItems(t)).toBe(false);
    }
  });
});

describe("catalogGroups", () => {
  it("[] gives []", () => expect(catalogGroups([])).toEqual([]));

  it("groups by name (diacritics, base sensitivity), items by name then key; hidden and all kinds", () => {
    const items = [
      dto("door", { group: "Cây", name: "b" }),
      dto("table.meeting", { group: "bàn", name: "z", hidden: true }),
      dto("floor.carpet", { group: "bàn", name: "a" }),
      dto("chair.office", { group: "Đèn", name: "m" }),
      dto("elevator", { group: "Cây", name: "b" }),
    ];
    const g = catalogGroups(items);
    expect(g.map((x) => x.group)).toEqual(["bàn", "Cây", "Đèn"]);
    expect(g[0].items.map((i) => i.builtinKey)).toEqual(["floor.carpet", "table.meeting"]);
    expect(g[1].items.map((i) => i.builtinKey)).toEqual(["door", "elevator"]);
    expect(g[2].items[0].kind).toBe("chair");
  });
});

describe("isLibraryDefault", () => {
  it("an untouched item is the default; each single difference is not", () => {
    const base = dto("table.meeting");
    expect(isLibraryDefault(base)).toBe(true);
    const art = (a: Partial<typeof base.art.n>) => ({ ...base.art, n: { ...base.art.n, ...a } });
    for (const over of [
      { name: "x" },
      { group: "x" },
      { w: 2 },
      { h: 1 },
      { hidden: true },
      { art: art({ sprite: "table.meeting.n" }) },
      { art: art({ hasImage: true }) },
    ]) {
      expect(isLibraryDefault({ ...base, ...over })).toBe(false);
    }
  });
  it("an unknown key is the default", () => {
    expect(isLibraryDefault({ ...dto("door"), builtinKey: "nope", name: "x" })).toBe(true);
  });
});

describe("mapItemErrorMessage", () => {
  it("item_in_use names the room count", () => {
    expect(mapItemErrorMessage("item_in_use", 1)).toBe(mapItemsCopy.errors.inUse(1));
    expect(mapItemErrorMessage("item_in_use", 1)).toContain("1 room.");
    expect(mapItemErrorMessage("item_in_use", 3)).toContain("3 rooms");
    expect(mapItemErrorMessage("item_in_use")).toBe(apiErrorMessage("item_in_use"));
  });
  it("other codes use the shared copy; unknown reads as internal", () => {
    for (const c of ["item_name_taken", "item_fixed_size", "sprite_not_allowed"]) {
      expect(mapItemErrorMessage(c)).toBe(apiErrorMessage(c));
    }
    expect(mapItemErrorMessage("zzz")).toBe(apiErrorMessage("internal"));
  });
});

describe("settleMapItem", () => {
  it("ok and not_found are done; item_in_use is an error with the room count", () => {
    expect(settleMapItem({ ok: true, value: 1 })).toEqual({ kind: "done" });
    expect(settleMapItem({ ok: false, code: "not_found" })).toEqual({ kind: "done" });
    expect(settleMapItem({ ok: false, code: "item_in_use", rooms: 3 })).toEqual({
      kind: "error",
      message: mapItemsCopy.errors.inUse(3),
    });
  });
});
