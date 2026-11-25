import { describe, expect, it } from "vitest";
import { resolveFrameKey } from "@/lib/sprites/placement";
import { footprintAt, footprintOf, registryFootprints } from "@/lib/validate/layout";
import { catalogFootprints } from "./footprints";
import { LIBRARY_ITEMS } from "./library";

const ROTATIONS = [0, 90, 180, 270] as const;
/** Only placeable combinations: a non-directional item at 90/270 is refused as layout_bad_rotation before any size is read. */
const placeable = (item: { builtinKey: string; directional: boolean }, r: number) =>
  resolveFrameKey(item.builtinKey, r as 0) !== null && (r === 0 || item.directional);

describe("catalogFootprints", () => {
  it("catalog lookup built from LIBRARY_ITEMS gives footprintOf for every seat/fixture key x rotation with a frame", () => {
    const lookup = catalogFootprints(LIBRARY_ITEMS);
    let n = 0;
    for (const item of LIBRARY_ITEMS) {
      if (item.kind !== "seat" && item.kind !== "fixture") continue;
      for (const r of ROTATIONS) {
        if (!placeable(item, r)) continue;
        expect(footprintAt(item.builtinKey, r, lookup), `${item.builtinKey} ${r}`).toEqual(
          footprintOf(item.builtinKey, r),
        );
        n++;
      }
    }
    expect(n).toBeGreaterThan(0);
  });

  it("registryFootprints gives the same as footprintOf for the same keys", () => {
    for (const item of LIBRARY_ITEMS) {
      if (item.kind !== "seat" && item.kind !== "fixture") continue;
      for (const r of ROTATIONS) {
        if (!placeable(item, r)) continue;
        expect(footprintAt(item.builtinKey, r, registryFootprints)).toEqual(
          footprintOf(item.builtinKey, r),
        );
      }
    }
  });

  it("catalogFootprints: listed key gives its w/h; unlisted key gives the fallback, or null without one", () => {
    const items = [{ builtinKey: "plant.large", w: 2, h: 3 }];
    expect(catalogFootprints(items)("plant.large")).toEqual([2, 3]);
    expect(catalogFootprints(items)("door")).toBeNull();
    expect(catalogFootprints(items, registryFootprints)("door")).toEqual([1, 2]);
  });
});
