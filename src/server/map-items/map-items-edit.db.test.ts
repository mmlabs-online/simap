import { randomUUID } from "node:crypto";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addMember,
  addRoom,
  assertTestDb,
  newOrg,
  testPool,
  waitForLockWait,
} from "@/test/db/fixtures";
import { resetMapItem, setMapItemArt, updateMapItem } from "./edit";

let pool: pg.Pool;
type Org = ReturnType<typeof newOrg>;

const SUB = randomUUID();
const FILE_A = "file_aaaaaaaaaa";
const FILE_B = "file_bbbbbbbbbb";

const one = async (sql: string, values: unknown[] = []) => (await pool.query(sql, values)).rows[0];
const run = (sql: string, values: unknown[] = []) => pool.query(sql, values);

async function seeded(): Promise<Org> {
  const o = newOrg();
  await addMember(pool, o.orgId);
  return o;
}
const rowOf = (o: Org, key: string) =>
  one("select * from map_items where org_id = $1 and builtin_key = $2", [o.orgId, key]);
const setFile = (o: Org, key: string, d: string, id: string, version = 1) =>
  run(
    `update map_items set art_${d}_drive_file_id = $3, art_${d}_image_version = $4
     where org_id = $1 and builtin_key = $2`,
    [o.orgId, key, id, version],
  );
const addFixture = (o: Org, roomId: string, key: string, x: number, y: number) =>
  run(
    `insert into layout_fixtures (org_id, room_id, kind, tile_x, tile_y, tile_rotation, sprite_key)
     values ($1, $2, null, $3, $4, 0, $5)`,
    [o.orgId, roomId, x, y, key],
  );
const audits = (o: Org) =>
  run(
    "select action, entity, entity_id, meta from audit_log where org_id = $1 order by created_at",
    [o.orgId],
  ).then((r) => r.rows);
const upd = (o: Org, key: string, p: Parameters<typeof updateMapItem>[4]) =>
  updateMapItem(pool, o.scope, SUB, key, p);
const art = (o: Org, key: string, d: "n" | "e" | "s" | "w", s: string | null) =>
  setMapItemArt(pool, o.scope, SUB, key, d, s);
const reset = (o: Org, key: string) => resetMapItem(pool, o.scope, SUB, key);

function ok<T>(r: { ok: true; value: T } | { ok: false }): T {
  if (!r.ok) throw new Error(`refused: ${JSON.stringify(r)}`);
  return r.value;
}

beforeAll(async () => {
  pool = testPool();
  await assertTestDb(pool);
});
afterAll(async () => {
  await pool.end();
});

describe("map item edits (db)", () => {
  it("rename, regroup, hide/show, resize, art, reset each change the row and return the DTO", async () => {
    const o = await seeded();
    expect(ok(await upd(o, "plant.large", { name: "Cây lớn" })).item.name).toBe("Cây lớn");
    expect(ok(await upd(o, "plant.large", { group: "Green" })).item.group).toBe("Green");
    expect(ok(await upd(o, "plant.large", { hidden: true })).item.hidden).toBe(true);
    expect(ok(await upd(o, "plant.large", { hidden: false })).item.hidden).toBe(false);
    const sized = ok(await upd(o, "plant.large", { w: 2, h: 3 })).item;
    expect([sized.w, sized.h]).toEqual([2, 3]);
    expect(ok(await art(o, "plant.large", "s", "plant.small")).art.s.sprite).toBe("plant.small");
    const r = ok(await reset(o, "plant.large")).item;
    expect([r.name, r.group, r.w, r.h, r.hidden, r.art.s.sprite]).toEqual([
      "plant large",
      "plant",
      1,
      1,
      false,
      null,
    ]);
  });

  it('rename to another item\'s name differing only in case/spaces/diacritic capitals ("  DOOR ", "BÀN LÀM VIỆC" vs "Bàn làm việc") -> 409 item_name_taken; row unchanged', async () => {
    const o = await seeded();
    expect(ok(await upd(o, "sofa", { name: "Bàn làm việc" })).item.name).toBe("Bàn làm việc");
    for (const name of ["  DOOR ", "BÀN LÀM VIỆC"]) {
      const r = await upd(o, "plant.large", { name });
      expect(r).toEqual({ ok: false, status: 409, code: "item_name_taken" });
    }
    expect((await rowOf(o, "plant.large")).name).toBe("plant large");
  });

  it("resize of an unplaced item: w/h stored; the DTO shows the new size", async () => {
    const o = await seeded();
    const dto = ok(await upd(o, "shelf.books", { w: 3 })).item;
    expect([dto.w, dto.h]).toEqual([3, 1]);
    const row = await rowOf(o, "shelf.books");
    expect([row.w, row.h]).toEqual([3, 1]);
  });

  it("resize of a placed item -> 409 item_in_use with rooms = distinct room count (2 fixtures in room A + 1 in room B -> 2); row unchanged; no audit", async () => {
    const o = await seeded();
    const a = await addRoom(pool, o.orgId, "A1");
    const b = await addRoom(pool, o.orgId, "B1");
    await addFixture(o, a, "plant.large", 0, 0);
    await addFixture(o, a, "plant.large", 1, 0);
    await addFixture(o, b, "plant.large", 0, 0);
    expect(await upd(o, "plant.large", { w: 2 })).toEqual({
      ok: false,
      status: 409,
      code: "item_in_use",
      rooms: 2,
    });
    const row = await rowOf(o, "plant.large");
    expect([row.w, row.h]).toEqual([1, 1]);
    expect(await audits(o)).toEqual([]);
  });

  it("fixed-size items (desk.single, chair.office, floor.wood) -> 422 item_fixed_size; same size accepted as no-op; rename of desk.single works", async () => {
    const o = await seeded();
    for (const key of ["desk.single", "chair.office", "floor.wood"]) {
      expect(await upd(o, key, { w: 3 })).toMatchObject({ status: 422, code: "item_fixed_size" });
    }
    const desk = await rowOf(o, "desk.single");
    expect(ok(await upd(o, "desk.single", { w: desk.w, h: desk.h })).item.w).toBe(desk.w);
    expect(await audits(o)).toEqual([]);
    expect(ok(await upd(o, "desk.single", { name: "Desk" })).item.name).toBe("Desk");
  });

  it("resize nulls all four drive ids, bumps the version only where a file was set, returns those ids; sprites that still fit stay, a sprite that no longer fits is cleared", async () => {
    const o = await seeded();
    // door is 1x2: door.s (1x2) fits 1x2 at s; door.e (2x1) fits at e
    await art(o, "door", "s", "door.s");
    await art(o, "door", "e", "door.e");
    await setFile(o, "door", "n", FILE_A, 2);
    await setFile(o, "door", "w", FILE_B, 0);
    // 2x2: door.s (1x2) and door.e (2x1) both still fit
    const first = ok(await upd(o, "door", { w: 2, h: 2 }));
    expect([...first.discardFileIds].sort()).toEqual([FILE_A, FILE_B]);
    let row = await rowOf(o, "door");
    for (const d of ["n", "e", "s", "w"]) expect(row[`art_${d}_drive_file_id`]).toBeNull();
    expect([row.art_n_image_version, row.art_w_image_version]).toEqual([3, 1]);
    expect([row.art_e_image_version, row.art_s_image_version]).toEqual([0, 0]);
    expect([row.art_s_sprite, row.art_e_sprite]).toEqual(["door.s", "door.e"]);
    expect(first.item.art.n.hasImage).toBe(false);
    // 1x1: neither door frame fits any more
    const second = ok(await upd(o, "door", { w: 1, h: 1 }));
    expect(second.discardFileIds).toEqual([]);
    row = await rowOf(o, "door");
    expect([row.art_s_sprite, row.art_e_sprite]).toEqual([null, null]);
  });

  it("art: set s on plant.large, set e/w on door, null clears; n on a non-directional item -> 422 not_allowed; too-large frame -> 422 sprite_not_allowed; art works while the item is placed", async () => {
    const o = await seeded();
    expect(ok(await art(o, "plant.large", "s", "plant.small")).art.s.sprite).toBe("plant.small");
    expect(ok(await art(o, "plant.large", "s", null)).art.s.sprite).toBeNull();
    expect(ok(await art(o, "door", "e", "door.e")).art.e.sprite).toBe("door.e");
    expect(ok(await art(o, "door", "w", "door.w")).art.w.sprite).toBe("door.w");
    expect(await art(o, "plant.large", "n", "plant.small")).toMatchObject({
      status: 422,
      code: "not_allowed",
    });
    expect(await art(o, "plant.large", "s", "table.meeting.n")).toMatchObject({
      status: 422,
      code: "sprite_not_allowed",
    });
    const room = await addRoom(pool, o.orgId, "P1");
    await addFixture(o, room, "plant.large", 0, 0);
    expect(ok(await art(o, "plant.large", "s", "plant.small")).art.s.sprite).toBe("plant.small");
  });

  it("hide works while placed; hidden: true on chair.office -> 422 not_allowed", async () => {
    const o = await seeded();
    const room = await addRoom(pool, o.orgId, "H1");
    await addFixture(o, room, "plant.large", 0, 0);
    expect(ok(await upd(o, "plant.large", { hidden: true })).item.hidden).toBe(true);
    expect(await upd(o, "chair.office", { hidden: true })).toMatchObject({
      status: 422,
      code: "not_allowed",
    });
    expect((await rowOf(o, "chair.office")).hidden).toBe(false);
  });

  it("reset restores library name/group/size, hidden false, sprites null, images deleted (ids returned); reset of a placed resized item -> 409 item_in_use; reset when another item holds the default name -> 409 item_name_taken; reset of a default row is a no-op", async () => {
    const o = await seeded();
    expect(ok(await reset(o, "plant.large")).discardFileIds).toEqual([]);
    expect(await audits(o)).toEqual([]);
    await upd(o, "plant.large", { name: "Zed", group: "G", hidden: true, w: 2 });
    await art(o, "plant.large", "s", "plant.small");
    await setFile(o, "plant.large", "s", FILE_A);
    const done = ok(await reset(o, "plant.large"));
    expect(done.discardFileIds).toEqual([FILE_A]);
    expect(done.item).toMatchObject({
      name: "plant large",
      group: "plant",
      w: 1,
      h: 1,
      hidden: false,
    });
    expect((await rowOf(o, "plant.large")).art_s_drive_file_id).toBeNull();

    // placed and resized
    await upd(o, "plant.small", { w: 2 });
    const room = await addRoom(pool, o.orgId, "R1");
    await run("update map_items set w = 3 where org_id = $1 and builtin_key = 'plant.small'", [
      o.orgId,
    ]);
    await addFixture(o, room, "plant.small", 0, 0);
    expect(await reset(o, "plant.small")).toEqual({
      ok: false,
      status: 409,
      code: "item_in_use",
      rooms: 1,
    });

    // another item holds the default name
    await upd(o, "plant.large", { name: "Other" });
    await upd(o, "sofa", { name: "plant large" });
    expect(await reset(o, "plant.large")).toEqual({
      ok: false,
      status: 409,
      code: "item_name_taken",
    });
  });

  it("no-op patch and no-op art add no audit and do not touch updated_at", async () => {
    const o = await seeded();
    const before = (await rowOf(o, "plant.large")).updated_at;
    expect(
      ok(await upd(o, "plant.large", { name: "plant large", hidden: false, w: 1 })).discardFileIds,
    ).toEqual([]);
    expect(ok(await art(o, "plant.large", "s", null)).art.s.sprite).toBeNull();
    expect((await rowOf(o, "plant.large")).updated_at).toEqual(before);
    expect(await audits(o)).toEqual([]);
  });

  it("every write adds exactly one audit row (map_item.update / map_item.art_set / map_item.reset) with entity map_item, entity_id null, meta.key; refusals add none; meta holds no Drive id", async () => {
    const o = await seeded();
    await setFile(o, "plant.large", "s", FILE_A);
    await upd(o, "plant.large", { name: "Cây", w: 2 });
    await art(o, "plant.large", "s", "plant.small");
    await reset(o, "plant.large");
    await upd(o, "desk.single", { w: 4 });
    await art(o, "plant.large", "s", "floor.wood");
    const rows = await audits(o);
    expect(rows.map((r) => r.action)).toEqual([
      "map_item.update",
      "map_item.art_set",
      "map_item.reset",
    ]);
    for (const r of rows) {
      expect(r.entity).toBe("map_item");
      expect(r.entity_id).toBeNull();
      expect(r.meta.key).toBe("plant.large");
    }
    expect(rows[0].meta).toMatchObject({
      fields: ["name", "size"],
      size: { from: [1, 1], to: [2, 1] },
      imagesDeleted: 1,
    });
    expect(JSON.stringify(rows)).not.toContain(FILE_A);
  });

  it("an edit in org A leaves org B's row unchanged; B's placements do not count for A's in_use", async () => {
    const a = await seeded();
    const b = await seeded();
    const roomB = await addRoom(pool, b.orgId, "B1");
    await addFixture(b, roomB, "plant.large", 0, 0);
    expect(ok(await upd(a, "plant.large", { name: "Mine", w: 2 })).item.w).toBe(2);
    const rowB = await rowOf(b, "plant.large");
    expect([rowB.name, rowB.w]).toEqual(["plant large", 1]);
    expect(await audits(b)).toEqual([]);
  });

  it("a resize waits for an uncommitted placement insert of the item and then refuses item_in_use", async () => {
    const o = await seeded();
    const room = await addRoom(pool, o.orgId, "L1");
    const holder = await pool.connect();
    try {
      await holder.query("begin");
      await holder.query(
        `insert into layout_fixtures (org_id, room_id, kind, tile_x, tile_y, tile_rotation, sprite_key)
         values ($1, $2, null, 0, 0, 0, 'plant.large')`,
        [o.orgId, room],
      );
      const resize = upd(o, "plant.large", { w: 2 });
      expect(await waitForLockWait(pool, 5000)).toBe(true);
      await holder.query("commit");
      expect(await resize).toEqual({ ok: false, status: 409, code: "item_in_use", rooms: 1 });
    } finally {
      holder.release();
    }
  });

  it("a rename does not wait for an uncommitted placement insert of the item", async () => {
    const o = await seeded();
    const room = await addRoom(pool, o.orgId, "L2");
    const holder = await pool.connect();
    try {
      await holder.query("begin");
      await holder.query(
        `insert into layout_fixtures (org_id, room_id, kind, tile_x, tile_y, tile_rotation, sprite_key)
         values ($1, $2, null, 0, 0, 0, 'plant.large')`,
        [o.orgId, room],
      );
      const timeout = new Promise<"timeout">((r) => setTimeout(() => r("timeout"), 2000));
      const res = await Promise.race([upd(o, "plant.large", { name: "Quick" }), timeout]);
      expect(res).not.toBe("timeout");
      await holder.query("commit");
    } finally {
      holder.release();
    }
  });

  it("unknown key with a row (inserted by SQL, not in the library) -> 404", async () => {
    const o = await seeded();
    await run(
      "insert into map_items (org_id, builtin_key, name, group_name, w, h) values ($1, 'gone.item', 'Gone', 'g', 1, 1)",
      [o.orgId],
    );
    expect(await upd(o, "gone.item", { name: "x" })).toEqual({
      ok: false,
      status: 404,
      code: "not_found",
    });
    expect(await reset(o, "gone.item")).toEqual({ ok: false, status: 404, code: "not_found" });
    expect(await art(o, "gone.item", "s", null)).toEqual({
      ok: false,
      status: 404,
      code: "not_found",
    });
  });
});
