import { describe, expect, it } from "vitest";
import { mapItemConflict } from "./pg-error";

describe("mapItemConflict", () => {
  it("23505 map_items_org_name_key -> item_name_taken; other 23505 / other codes / non-objects -> null", () => {
    expect(mapItemConflict({ code: "23505", constraint: "map_items_org_name_key" })).toBe(
      "item_name_taken",
    );
    expect(mapItemConflict({ code: "23505", constraint: "other_key" })).toBeNull();
    expect(mapItemConflict({ code: "23503", constraint: "map_items_org_name_key" })).toBeNull();
    expect(mapItemConflict(null)).toBeNull();
    expect(mapItemConflict("23505")).toBeNull();
  });
});
