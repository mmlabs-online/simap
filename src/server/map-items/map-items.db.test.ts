import { randomUUID } from "node:crypto";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LIBRARY_ITEMS } from "@/lib/map-items/library";
import { addMember, assertTestDb, newOrg, testPool } from "@/test/db/fixtures";
import { getOrCreateMember } from "@/server/members/members";
import { listMapItems } from "./map-items";

let pool: pg.Pool;

type Org = ReturnType<typeof newOrg>;

const one = async (sql: string, values: unknown[]) => (await pool.query(sql, values)).rows[0];
const itemCount = async (orgId: string) =>
  (await one("select count(*)::int as n from map_items where org_id = $1", [orgId])).n as number;

/** An org that has a member, so the insert trigger has seeded its catalog. */
async function seeded(): Promise<Org> {
  const o = newOrg();
  await addMember(pool, o.orgId);
  return o;
}
const list = async (o: Org, includeHidden = false) => {
  const r = await listMapItems(pool, o.scope, { includeHidden });
  return r.value.items;
};
const setName = (o: Org, key: string, name: string) =>
  pool.query("update map_items set name = $3 where org_id = $1 and builtin_key = $2", [
    o.orgId,
    key,
    name,
  ]);

beforeAll(async () => {
  pool = testPool();
  await assertTestDb(pool);
});
afterAll(async () => {
  await pool.end();
});

describe("map-items (db)", () => {
  it("a new member's first visit seeds the library catalog once; a second member adds none", async () => {
    const o = newOrg();
    const who = (n: string) => ({ sub: randomUUID(), email: `${n}@simap.example` });
    expect((await getOrCreateMember(pool, o.scope, who("a"))).ok).toBe(true);
    expect(await itemCount(o.orgId)).toBe(LIBRARY_ITEMS.length);
    expect(
      (await one("select count(*)::int as n from map_item_catalogs where org_id = $1", [o.orgId]))
        .n,
    ).toBe(1);
    await getOrCreateMember(pool, o.scope, who("b"));
    expect(await itemCount(o.orgId)).toBe(LIBRARY_ITEMS.length);
  });

  it("list: all library items with library defaults, hidden false, empty art", async () => {
    const items = await list(await seeded());
    expect(items).toHaveLength(LIBRARY_ITEMS.length);
    for (const i of items) {
      const lib = LIBRARY_ITEMS.find((l) => l.builtinKey === i.builtinKey)!;
      expect([i.name, i.group, i.w, i.h]).toEqual([lib.name, lib.group, lib.w, lib.h]);
      expect([i.kind, i.directional, i.fixedSize]).toEqual([
        lib.kind,
        lib.directional,
        lib.fixedSize,
      ]);
      expect(i.hidden).toBe(false);
      for (const d of ["n", "e", "s", "w"] as const) {
        expect(i.art[d]).toEqual({ sprite: null, hasImage: false, imageVersion: 0 });
      }
    }
  });

  it("list order does not depend on the database locale", async () => {
    const o = await seeded();
    const [k1, k2, k3] = LIBRARY_ITEMS.map((l) => l.builtinKey).slice(0, 3) as [
      string,
      string,
      string,
    ];
    // Under a locale collation spaces and hyphens are ignored, so "!!ab" would not sort last of these three.
    await setName(o, k1, "!!ab");
    await setName(o, k2, "!!a b");
    await setName(o, k3, "!!a-c");
    const keys = (await list(o)).map((i) => i.builtinKey);
    expect(keys.slice(0, 3)).toEqual([k2, k3, k1]);
  });

  it("list is ordered by lower(name), then builtin_key", async () => {
    const o = await seeded();
    await setName(o, "wall.base", "Aaa wall");
    await setName(o, "door", "ZZZ door");
    const items = await list(o);
    expect(items[0]!.builtinKey).toBe("wall.base");
    expect(items.at(-1)!.builtinKey).toBe("door");
    const names = items.map((i) => i.name.toLowerCase());
    // The "C" code-point rule the SQL enforces.
    expect(names).toEqual([...names].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
  });

  it("hidden rows: left out with includeHidden false, listed with hidden true when includeHidden true", async () => {
    const o = await seeded();
    await pool.query(
      "update map_items set hidden = true where org_id = $1 and builtin_key = 'door'",
      [o.orgId],
    );
    expect((await list(o, false)).map((i) => i.builtinKey)).not.toContain("door");
    expect(await list(o, false)).toHaveLength(LIBRARY_ITEMS.length - 1);
    const all = await list(o, true);
    expect(all).toHaveLength(LIBRARY_ITEMS.length);
    expect(all.find((i) => i.builtinKey === "door")!.hidden).toBe(true);
  });

  it("a second map_items_seed call keeps an edited row and does not restore a deleted one", async () => {
    const o = await seeded();
    await setName(o, "door", "Front door");
    await pool.query("delete from map_items where org_id = $1 and builtin_key = 'sofa'", [o.orgId]);
    await pool.query("select map_items_seed($1)", [o.orgId]);
    const items = await list(o);
    expect(items).toHaveLength(LIBRARY_ITEMS.length - 1);
    expect(items.find((i) => i.builtinKey === "door")!.name).toBe("Front door");
    expect(items.map((i) => i.builtinKey)).not.toContain("sofa");
  });

  it("list returns only the caller's org rows", async () => {
    const a = await seeded();
    const b = await seeded();
    await setName(a, "door", "Only in A");
    expect((await list(a)).find((i) => i.builtinKey === "door")!.name).toBe("Only in A");
    expect((await list(b)).find((i) => i.builtinKey === "door")!.name).toBe("door");
    expect(await itemCount(a.orgId)).toBe(LIBRARY_ITEMS.length);
    expect(await itemCount(b.orgId)).toBe(LIBRARY_ITEMS.length);
    expect((await list(newOrg())).length).toBe(0);
  });

  it("art: a Drive id set by SQL shows as hasImage/imageVersion for that direction; the id is not in the JSON", async () => {
    const o = await seeded();
    await pool.query(
      `update map_items set art_w_drive_file_id = 'DriveFileId_1234', art_w_image_version = 3,
         art_e_sprite = 'door.east' where org_id = $1 and builtin_key = 'door'`,
      [o.orgId],
    );
    const door = (await list(o)).find((i) => i.builtinKey === "door")!;
    expect(door.art.w).toEqual({ sprite: null, hasImage: true, imageVersion: 3 });
    expect(door.art.e).toEqual({ sprite: "door.east", hasImage: false, imageVersion: 0 });
    expect(JSON.stringify(door)).not.toContain("DriveFileId_1234");
  });

  it("a row with a builtin_key not in the library is not listed", async () => {
    const o = await seeded();
    await pool.query(
      "insert into map_items (org_id, builtin_key, name, group_name, w, h) values ($1, 'future.thing', 'Future', 'prop', 1, 1)",
      [o.orgId],
    );
    expect(await itemCount(o.orgId)).toBe(LIBRARY_ITEMS.length + 1);
    const items = await list(o);
    expect(items).toHaveLength(LIBRARY_ITEMS.length);
    expect(items.map((i) => i.builtinKey)).not.toContain("future.thing");
  });

  it("a new org gets the SIM-042 rows with library name, group and size", async () => {
    const items = await list(await seeded());
    const want: Record<string, [string, string, number, number]> = {
      "bin.trash": ["bin trash", "bin", 1, 1],
      "chart.flip": ["chart flip", "chart", 1, 1],
      "clock.wall": ["clock wall", "clock", 1, 1],
      "cooler.water": ["cooler water", "cooler", 1, 1],
      "lamp.desk": ["lamp desk", "lamp", 1, 1],
      "screen.projector": ["screen projector", "screen", 2, 1],
    };
    for (const [key, [name, group, w, h]] of Object.entries(want)) {
      const i = items.find((x) => x.builtinKey === key)!;
      expect([i.name, i.group, i.w, i.h]).toEqual([name, group, w, h]);
    }
  });
});
