import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LIBRARY_ITEMS } from "@/lib/map-items/library";
import { MAP_ITEM_LIMITS } from "@/lib/map-items/types";
import { DRIVE_ID_RE } from "@/server/drive/config";

const dir = path.resolve(process.cwd(), "db/migrations");
const sql = readFileSync(path.join(dir, "20261125200000_map_items.sql"), "utf8");
/** The newest migration that (re)defines map_items_seed is the body new orgs get. */
const latestSeed = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(path.join(dir, f), "utf8"))
  .filter((s) => /function map_items_seed/.test(s))
  .pop()!;
const backfill = readFileSync(path.join(dir, "20261126120000_map_items_new_builtin.sql"), "utf8");

const seedRows = (text: string) =>
  [...text.matchAll(/\(p_org, '([^']+)', '([^']+)', '([^']+)', (\d+), (\d+)\)/g)].map((m) => ({
    builtinKey: m[1],
    name: m[2],
    group: m[3],
    w: Number(m[4]),
    h: Number(m[5]),
  }));
const libraryRows = LIBRARY_ITEMS.map((i) => ({
  builtinKey: i.builtinKey,
  name: i.name,
  group: i.group,
  w: i.w,
  h: i.h,
}));

describe("map_items migration equals the TS constants", () => {
  it("name/group/size limits and Drive id regex equal the TS constants", () => {
    expect(sql).toContain(`char_length(name) <= ${MAP_ITEM_LIMITS.name}`);
    expect(sql).toContain(`char_length(group_name) <= ${MAP_ITEM_LIMITS.group}`);
    expect(sql).toContain(
      `w between ${MAP_ITEM_LIMITS.sizeMin} and ${MAP_ITEM_LIMITS.sizeMax} and h between ${MAP_ITEM_LIMITS.sizeMin} and ${MAP_ITEM_LIMITS.sizeMax}`,
    );
    expect(sql).toContain(`'${DRIVE_ID_RE.source}'`);
  });

  it("the first migration seed lists the original rows and the latest map_items_seed equals LIBRARY_ITEMS", () => {
    expect(seedRows(sql)).toHaveLength(53);
    expect(seedRows(latestSeed)).toEqual(libraryRows);
  });

  it("the SIM-042 backfill rows equal LIBRARY_ITEMS minus the first migration's seed", () => {
    const first = new Set(seedRows(sql).map((r) => r.builtinKey));
    const values = [
      ...backfill.matchAll(/\('([a-z0-9.]+)', '([^']+)', '([^']+)', (\d+), (\d+)\)/g),
    ].map((m) => ({
      builtinKey: m[1],
      name: m[2],
      group: m[3],
      w: Number(m[4]),
      h: Number(m[5]),
    }));
    expect(values).toEqual(libraryRows.filter((r) => !first.has(r.builtinKey)));
  });
});
