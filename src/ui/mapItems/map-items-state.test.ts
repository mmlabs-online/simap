import { describe, expect, it } from "vitest";
import { apiErrorMessage } from "../copy/api";
import { mapItemsCopy } from "../copy/mapItems";
import {
  activeGroup,
  artSourceOf,
  canManageMapItems,
  catalogGroups,
  filterItems,
  isLibraryDefault,
  mapItemErrorMessage,
  mapItemStats,
  settleMapItem,
} from "./map-items-state";
import { isCustomised } from "./map-item-art";
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

type Dir = "n" | "e" | "s" | "w";
const withArt = (key: string, dir: Dir, art: { sprite?: string; hasImage?: boolean }) => {
  const base = dto(key);
  return {
    ...base,
    art: {
      ...base.art,
      [dir]: { sprite: art.sprite ?? null, hasImage: art.hasImage ?? false, imageVersion: 1 },
    },
  };
};

const fixture = () => [
  dto("desk.single"),
  dto("chair.office"),
  dto("door", { hidden: true }),
  withArt("plant.large", "s", { sprite: "plant.large" }),
  withArt("clock.wall", "e", { hasImage: true }),
];

describe("mapItemStats", () => {
  it("empty list is all zeros", () => {
    expect(mapItemStats([])).toEqual({ total: 0, inPalette: 0, customised: 0 });
  });

  it("hidden items leave the palette; art in a disallowed direction is not customised", () => {
    expect(mapItemStats(fixture())).toEqual({ total: 5, inPalette: 4, customised: 1 });
  });
});

describe("filterItems", () => {
  const items = [
    dto("table.meeting", { group: "Zeta", name: "Bàn họp" }),
    dto("desk.single", { group: "Alpha" }),
    dto("door", { group: "Alpha" }),
  ];
  const keys = (list: { builtinKey: string }[]) => list.map((i) => i.builtinKey);

  it("no group and a blank query return the catalog order", () => {
    const flat = catalogGroups(items).flatMap((g) => g.items);
    expect(filterItems(items, null, "")).toEqual(flat);
    expect(filterItems(items, null, "   ")).toEqual(flat);
  });

  it("a group narrows; an unknown group gives nothing", () => {
    expect(keys(filterItems(items, "Zeta", ""))).toEqual(["table.meeting"]);
    expect(filterItems(items, "Nope", "")).toEqual([]);
  });

  it("the query matches name or key, trimmed and case-insensitive", () => {
    expect(keys(filterItems(items, null, "  DOOR "))).toEqual(["door"]);
    expect(keys(filterItems(items, null, "desk.sin"))).toEqual(["desk.single"]);
  });

  it("ignores Vietnamese diacritics in the query and the name", () => {
    expect(filterItems(items, null, "ban hop")).toHaveLength(1);
    expect(filterItems(items, null, "Bàn họp".normalize("NFD"))).toHaveLength(1);
  });

  it("group and query combine", () => {
    expect(keys(filterItems(items, "Alpha", "door"))).toEqual(["door"]);
    expect(filterItems(items, "Zeta", "door")).toEqual([]);
  });
});

describe("activeGroup", () => {
  it("keeps a present group, null stays null, a vanished group falls back to All", () => {
    expect(activeGroup(["A", "B"], "B")).toBe("B");
    expect(activeGroup(["A", "B"], null)).toBeNull();
    expect(activeGroup(["A", "B"], "Gone")).toBeNull();
  });
});

describe("artSourceOf", () => {
  it("library by default; sprite alone; image wins over a sprite in another direction", () => {
    expect(artSourceOf(dto("door"))).toBe("library");
    expect(artSourceOf(withArt("desk.single", "s", { sprite: "desk.single" }))).toBe("sprite");
    const mixed = withArt("desk.single", "n", { hasImage: true });
    mixed.art.s = { sprite: "desk.single", hasImage: false, imageVersion: 1 };
    expect(artSourceOf(mixed)).toBe("image");
  });

  it("only allowed directions count", () => {
    expect(artSourceOf(withArt("plant.large", "n", { hasImage: true }))).toBe("library");
    expect(artSourceOf(withArt("clock.wall", "e", { sprite: "x" }))).toBe("library");
    expect(artSourceOf(withArt("clock.wall", "n", { sprite: "x" }))).toBe("sprite");
  });

  it("agrees with isCustomised for every fixture item", () => {
    for (const i of fixture()) expect(artSourceOf(i) !== "library").toBe(isCustomised(i));
  });
});
