import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LIBRARY_ITEMS } from "@/lib/map-items/library";
import { MAP_ITEM_LIMITS } from "@/lib/map-items/types";
import { DRIVE_ID_RE } from "@/server/drive/config";

const sql = readFileSync(
  path.resolve(process.cwd(), "db/migrations/20261125200000_map_items.sql"),
  "utf8",
);

describe("map_items migration equals the TS constants", () => {
  it("map_items seed equals LIBRARY_ITEMS; name/group/size limits and Drive id regex equal the TS constants", () => {
    const seed = [...sql.matchAll(/\(p_org, '([^']+)', '([^']+)', '([^']+)', (\d+), (\d+)\)/g)].map(
      (m) => ({
        builtinKey: m[1],
        name: m[2],
        group: m[3],
        w: Number(m[4]),
        h: Number(m[5]),
      }),
    );
    expect(seed).toEqual(
      LIBRARY_ITEMS.map((i) => ({
        builtinKey: i.builtinKey,
        name: i.name,
        group: i.group,
        w: i.w,
        h: i.h,
      })),
    );
    expect(sql).toContain(`char_length(name) <= ${MAP_ITEM_LIMITS.name}`);
    expect(sql).toContain(`char_length(group_name) <= ${MAP_ITEM_LIMITS.group}`);
    expect(sql).toContain(
      `w between ${MAP_ITEM_LIMITS.sizeMin} and ${MAP_ITEM_LIMITS.sizeMax} and h between ${MAP_ITEM_LIMITS.sizeMin} and ${MAP_ITEM_LIMITS.sizeMax}`,
    );
    expect(sql).toContain(`'${DRIVE_ID_RE.source}'`);
  });
});
