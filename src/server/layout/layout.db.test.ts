import { randomUUID } from "node:crypto";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addDevice,
  addMember,
  addRoom,
  addSeat,
  assertTestDb,
  newOrg,
  testPool,
  waitForLockWait,
} from "@/test/db/fixtures";
import { LIBRARY_ITEMS } from "@/lib/map-items/library";
import type { LayoutSaveValue } from "@/lib/sprites/layout";
import { resolveLayout } from "@/lib/sprites/resolve-layout";
import type { TxClient, TxPool } from "@/server/db/tx";
import type { Tier } from "@/lib/auth/tier";
import { getRoomLayout } from "./layout";
import { saveRoomLayout } from "./save";

let pool: pg.Pool;

const one = async (sql: string, values: unknown[] = []) => (await pool.query(sql, values)).rows[0];
const run = (sql: string, values: unknown[] = []) => pool.query(sql, values);
const subOf = async (memberId: string) =>
  (await one("select sub from members where id = $1", [memberId])).sub as string;

/** A room with an optional saved grid. */
async function room(code = "C302", grid?: { w: number; h: number; version?: number }) {
  const o = newOrg();
  const roomId = await addRoom(pool, o.orgId, code, { seatCounter: 0 });
  // placements reference the org's catalog (SIM-039.1), and a room without a member has none yet
  await run("select map_items_seed($1)", [o.orgId]);
  if (grid) {
    await run("update rooms set grid_w = $2, grid_h = $3, layout_version = $4 where id = $1", [
      roomId,
      grid.w,
      grid.h,
      grid.version ?? 1,
    ]);
  }
  return { ...o, roomId, code };
}

const place = (seatId: string, key: string, x: number, y: number, rot = 0) =>
  run(
    "update seats set tile_x = $2, tile_y = $3, tile_rotation = $4, sprite_key = $5 where id = $1",
    [seatId, x, y, rot, key],
  );
const addFixture = (orgId: string, roomId: string, key: string, x: number, y: number) =>
  run(
    `insert into layout_fixtures (org_id, room_id, kind, tile_x, tile_y, tile_rotation, sprite_key)
     values ($1, $2, null, $3, $4, 0, $5)`,
    [orgId, roomId, x, y, key],
  );
const bulkSeats = (orgId: string, roomId: string, n: number) =>
  run(
    `insert into seats (org_id, room_id, seq, code)
     select $1, $2, g, 'B-' || g from generate_series(1, $3::int) g`,
    [orgId, roomId, n],
  );

type Recorded = { text: string; rows: any[] };
/** Wraps pool.connect(): records each statement and its rows; `after` runs once a matching statement resolves. */
function recording(after?: (text: string) => Promise<void>) {
  const log: Recorded[] = [];
  const wrapped: TxPool = {
    async connect(): Promise<TxClient> {
      const c = await pool.connect();
      return {
        async query(text, values) {
          const res = await c.query(text, values);
          log.push({ text, rows: res.rows });
          await after?.(text);
          return res;
        },
        release: () => c.release(),
      };
    },
  };
  return { pool: wrapped, log };
}

const get = (
  o: { scope: any; roomId: string },
  sub: string = randomUUID(),
  p: TxPool = pool as never,
  tier: Tier = "admin",
) => getRoomLayout(p, o.scope, sub, o.roomId, tier);
const value = async (...a: Parameters<typeof get>) => {
  const r = await get(...a);
  if (!r.ok) throw new Error("expected ok");
  return r.value;
};

async function snapshotOf(orgId: string) {
  const q = async (t: string) =>
    (await run(`select * from ${t} where org_id = $1 order by 1`, [orgId])).rows;
  return JSON.stringify([
    await q("rooms"),
    await q("seats"),
    await q("layout_fixtures"),
    await q("audit_log"),
  ]);
}

beforeAll(async () => {
  pool = testPool();
  await assertTestDb(pool);
});
afterAll(async () => {
  await pool.end();
});

describe("getRoomLayout (db)", () => {
  it("unsaved room returns the default and writes nothing", async () => {
    const o = await room();
    const a = await addSeat(pool, o.orgId, o.roomId, "C302", 1);
    const b = await addSeat(pool, o.orgId, o.roomId, "C302", 2);
    const before = await snapshotOf(o.orgId);
    const res = await value(o);
    expect(res.saved).toBe(false);
    expect(res.version).toBe(0);
    expect(res.unplaced).toEqual([]);
    expect(res.layout.seats.map((s) => s.id).sort()).toEqual([a, b].sort());
    expect(Object.keys(res.seatViews).sort()).toEqual([a, b].sort());
    expect(await snapshotOf(o.orgId)).toBe(before);
  });

  it("saved room round trip", async () => {
    const o = await room("C302", { w: 12, h: 8, version: 7 });
    await run("update rooms set floor_zones = $2::jsonb where id = $1", [
      o.roomId,
      JSON.stringify([{ sprite: "floor.wood", x: 0, y: 0, w: 6, h: 4 }]),
    ]);
    const s = await addSeat(pool, o.orgId, o.roomId, "C302", 1);
    await place(s, "desk.single", 4, 2, 0);
    await addFixture(o.orgId, o.roomId, "plant.large", 10, 5);
    const res = await value(o);
    expect(res.saved).toBe(true);
    expect(res.version).toBe(7);
    expect(res.room).toEqual({ id: o.roomId, code: "C302", name: "Room C302" });
    expect(res.layout.w).toBe(12);
    expect(res.layout.h).toBe(8);
    expect(res.layout.floors).toEqual([{ sprite: "floor.wood", x: 0, y: 0, w: 6, h: 4 }]);
    expect(res.layout.seats).toEqual([
      { id: s, code: "C302-01", sprite: "desk.single", x: 4, y: 2, rotation: 0 },
    ]);
    expect(res.layout.fixtures).toMatchObject([
      { sprite: "plant.large", x: 10, y: 5, rotation: 0 },
    ]);
    expect(res.truncated).toBe(false);
  });

  it("saved room: a seat with null placement takes a free slot", async () => {
    const o = await room("C302", { w: 12, h: 8 });
    const s = await addSeat(pool, o.orgId, o.roomId, "C302", 1);
    const res = await value(o);
    expect(res.saved).toBe(true);
    expect(res.unplaced).toEqual([]);
    expect(res.layout.seats.map((x) => x.id)).toEqual([s]);
    expect(res.seatViews[s]).toBeDefined();
  });

  it("seat status from real rows", async () => {
    const o = await room();
    const me = await addMember(pool, o.orgId);
    const other = await addMember(pool, o.orgId);
    const third = await addMember(pool, o.orgId);
    await run("update members set display_name = 'Other Person' where id = $1", [other]);
    await run("update members set display_name = 'Third Person' where id = $1", [third]);
    const mine = await addSeat(pool, o.orgId, o.roomId, "C302", 1, { occupantId: me });
    const occ = await addSeat(pool, o.orgId, o.roomId, "C302", 2, { occupantId: other });
    const cannot = await addSeat(pool, o.orgId, o.roomId, "C302", 3, { occupantId: third });
    await run("update seats set cannot_seat = true where id = $1", [cannot]);
    const empty = await addSeat(pool, o.orgId, o.roomId, "C302", 4);
    const mySub = await subOf(me);
    const res = await value(o, mySub);
    expect(res.seatViews[mine]).toMatchObject({ state: "mine", avatarSeed: me });
    expect(res.seatViews[occ]).toEqual({
      state: "occupied",
      avatarSeed: other,
      name: "Other Person",
      look: null,
    });
    expect(res.seatViews[cannot]).toEqual({
      state: "cannot",
      avatarSeed: third,
      name: "Third Person",
      look: null,
    });
    expect(res.seatViews[empty]).toEqual({
      state: "empty",
      avatarSeed: null,
      name: null,
      look: null,
    });
    const json = JSON.stringify(res);
    for (const m of [me, other, third]) expect(json).not.toContain(await subOf(m));
  });

  it("stored pixel look is returned for every viewer", async () => {
    const o = await room();
    const viewer = await addMember(pool, o.orgId);
    const dressed = await addMember(pool, o.orgId);
    const plain = await addMember(pool, o.orgId);
    const look = { skin: 3, hair: 4, style: 2, shirt: 5 };
    await run("update members set pixel_look = $2::jsonb where id = $1", [
      dressed,
      JSON.stringify(look),
    ]);
    const sd = await addSeat(pool, o.orgId, o.roomId, "C302", 1, { occupantId: dressed });
    const sp = await addSeat(pool, o.orgId, o.roomId, "C302", 2, { occupantId: plain });
    const se = await addSeat(pool, o.orgId, o.roomId, "C302", 3);
    for (const who of [await subOf(viewer), await subOf(plain), await subOf(dressed)]) {
      const res = await value(o, who);
      expect(res.seatViews[sd]!.look).toEqual(look);
      expect(res.seatViews[sp]!.look).toBeNull();
      expect(res.seatViews[se]!.look).toBeNull();
    }
  });

  it("foreign org room is 404; random uuid is 404", async () => {
    const a = await room();
    const b = newOrg();
    expect(await get({ scope: b.scope, roomId: a.roomId })).toEqual({
      ok: false,
      status: 404,
      code: "not_found",
    });
    expect(await get({ scope: a.scope, roomId: randomUUID() })).toMatchObject({
      ok: false,
      status: 404,
    });
  });

  it("legacy fixture rows are hidden", async () => {
    const o = await room("C302", { w: 12, h: 8 });
    await run("insert into layout_fixtures (org_id, room_id, kind) values ($1, $2, 'door')", [
      o.orgId,
      o.roomId,
    ]);
    await addFixture(o.orgId, o.roomId, "plant.large", 10, 5);
    const res = await value(o);
    expect(res.layout.fixtures).toHaveLength(1);
    expect(res.layout.fixtures[0]!.sprite).toBe("plant.large");
  });

  it("corrupt grid (65 x 65) gives the default with saved false and the stored version", async () => {
    const o = await room("C302", { w: 65, h: 65, version: 4 });
    const s = await addSeat(pool, o.orgId, o.roomId, "C302", 1);
    const res = await value(o);
    expect(res.saved).toBe(false);
    expect(res.version).toBe(4);
    expect(res.layout.seats.map((x) => x.id)).toEqual([s]);
  });

  it("oversized or bad floor_zones fall back to the default floor", async () => {
    const zone = { sprite: "floor.wood", x: 0, y: 0, w: 1, h: 1 };
    const cases: [string, unknown][] = [
      ["65 zones", Array.from({ length: 65 }, () => zone)],
      [
        "over 262,144 bytes",
        Array.from({ length: 64 }, () => ({ ...zone, sprite: "x".repeat(5000) })),
      ],
      ["extra key", [{ ...zone, extra: 1 }]],
    ];
    for (const [name, zones] of cases) {
      const o = await room("C302", { w: 12, h: 8 });
      await run("update rooms set floor_zones = $2::jsonb where id = $1", [
        o.roomId,
        JSON.stringify(zones),
      ]);
      const rec = recording();
      const res = await value(o, randomUUID(), rec.pool);
      expect(res.layout.floors, name).toEqual([{ sprite: "floor.wood", x: 0, y: 0, w: 12, h: 8 }]);
      if (name !== "extra key") {
        const roomSelect = rec.log.find((l) => l.text.includes("from rooms"))!;
        expect(roomSelect.rows[0].floor_zones, name).toBeNull();
      }
    }
  });

  it("sprite keys outside the org catalog are refused by the FK", async () => {
    const o = await room("C302", { w: 12, h: 8 });
    const s = await addSeat(pool, o.orgId, o.roomId, "C302", 1);
    const code = (p: Promise<unknown>) =>
      p.then(
        () => null,
        (e) => [e.code, e.constraint],
      );
    expect(await code(place(s, "x".repeat(100), 0, 0))).toEqual(["23503", "seats_map_item_fkey"]);
    expect(await code(addFixture(o.orgId, o.roomId, "__proto__", 9, 5))).toEqual([
      "23503",
      "layout_fixtures_map_item_fkey",
    ]);
    await run("delete from map_items where org_id = $1 and builtin_key = 'plant.large'", [o.orgId]);
    expect(await code(addFixture(o.orgId, o.roomId, "plant.large", 1, 1))).toEqual([
      "23503",
      "layout_fixtures_map_item_fkey",
    ]);
  });

  it("500 seats not truncated, 501 truncated to the first 500", async () => {
    const o = await room("C302", { w: 64, h: 64 });
    await bulkSeats(o.orgId, o.roomId, 500);
    const r500 = await value(o);
    expect(r500.truncated).toBe(false);
    expect(Object.keys(r500.seatViews)).toHaveLength(500);

    const p = await room("C302", { w: 64, h: 64 });
    await bulkSeats(p.orgId, p.roomId, 501);
    const r501 = await value(p);
    expect(r501.truncated).toBe(true);
    expect(Object.keys(r501.seatViews)).toHaveLength(500);
    expect(r501.layout.seats.length + r501.unplaced.length).toBe(500);
    const last = await one("select id from seats where org_id = $1 and seq = 501", [p.orgId]);
    expect(r501.seatViews[last.id]).toBeUndefined();
  });

  it("runs begin, set transaction repeatable read read only, then reads, then commit", async () => {
    const o = await room();
    const rec = recording();
    await value(o, randomUUID(), rec.pool);
    const texts = rec.log.map((l) => l.text);
    expect(texts[0]).toBe("begin");
    expect(texts[1]).toBe("set transaction isolation level repeatable read, read only");
    expect(texts.at(-1)).toBe("commit");
    expect(texts).toHaveLength(7);
  });

  it("concurrent commit between reads is not seen", async () => {
    const o = await room("C302", { w: 12, h: 8 });
    const m = await addMember(pool, o.orgId);
    const s1 = await addSeat(pool, o.orgId, o.roomId, "C302", 1);
    let done = false;
    const rec = recording(async (text) => {
      if (done || !text.includes("from rooms")) return;
      done = true;
      await run("update seats set occupant_id = $2 where id = $1", [s1, m]);
      await addSeat(pool, o.orgId, o.roomId, "C302", 2);
      await addFixture(o.orgId, o.roomId, "plant.large", 10, 5);
    });
    const res = await value(o, randomUUID(), rec.pool);
    expect(done).toBe(true);
    expect(res.seatViews[s1]!.state).toBe("empty");
    expect(Object.keys(res.seatViews)).toEqual([s1]);
    expect(res.layout.fixtures).toEqual([]);
    expect((await value(o)).seatViews[s1]!.state).toBe("occupied");
  });
});

describe("saveRoomLayout (db)", () => {
  type O = { scope: any; orgId: string; roomId: string };
  const save = (o: O, v: LayoutSaveValue, p: TxPool = pool as never, sub: string = randomUUID()) =>
    saveRoomLayout(p, o.scope, sub, o.roomId, v);
  const val = (baseVersion: number, seatIds: string[], over: Partial<LayoutSaveValue> = {}) =>
    ({
      baseVersion,
      w: 12,
      h: 8,
      floors: [{ sprite: "floor.wood", x: 0, y: 0, w: 6, h: 4 }],
      seats: seatIds.map((id, i) => ({
        id,
        sprite: "desk.single",
        x: 2 + i * 3,
        y: 2,
        rotation: 0 as const,
      })),
      fixtures: [{ sprite: "plant.large", x: 10, y: 5, rotation: 0 as const }],
      ...over,
    }) satisfies LayoutSaveValue;
  const seatsOf = async (o: O, n: number) => {
    const ids: string[] = [];
    for (let i = 1; i <= n; i++) ids.push(await addSeat(pool, o.orgId, o.roomId, "C302", i));
    return ids;
  };
  const refusal = (r: { ok: boolean }) => JSON.stringify(r);

  it("valid save survives a fresh GET", async () => {
    const o = await room();
    const ids = await seatsOf(o, 2);
    const v = val(0, ids);
    const r = await save(o, v);
    expect(r.ok).toBe(true);
    const got = await value(o);
    expect(got.saved).toBe(true);
    expect(got.version).toBe(1);
    expect(got.layout.w).toBe(12);
    expect(got.layout.floors).toEqual(v.floors);
    expect(got.layout.seats.map(({ code: _c, ...s }) => s).sort((a, b) => a.x - b.x)).toEqual(
      v.seats,
    );
    expect(got.layout.fixtures.map(({ id: _i, ...f }) => f)).toEqual(v.fixtures);
  });

  it("90° clock.wall is refused 422 layout_bad_rotation and nothing is written", async () => {
    const o = await room();
    const v = val(0, [], {
      fixtures: [{ sprite: "clock.wall", x: 8, y: 4, rotation: 90 as const }],
    });
    const r = await save(o, v);
    expect(r.ok, refusal(r)).toBe(false);
    expect(refusal(r)).toContain("layout_bad_rotation");
    expect(
      (await one("select count(*)::int as n from layout_fixtures where org_id = $1", [o.orgId])).n,
    ).toBe(0);
  });

  it("180° clock.wall and screen.projector save and read back", async () => {
    const o = await room();
    const v = val(0, [], {
      fixtures: [
        { sprite: "screen.projector", x: 2, y: 4, rotation: 180 as const },
        { sprite: "clock.wall", x: 8, y: 4, rotation: 180 as const },
      ],
    });
    expect((await save(o, v)).ok).toBe(true);
    const got = await value(o);
    // the read orders by random uuid id, so compare order-independently
    const strip = (fs: { id?: string; sprite: string }[]) =>
      fs.map(({ id: _i, ...f }) => f).sort((a, b) => a.sprite.localeCompare(b.sprite));
    expect(strip(got.layout.fixtures)).toEqual(strip(v.fixtures));
  });

  it("a save in an org with no member seeds the catalog and stores the fixtures", async () => {
    const o = newOrg();
    const roomId = await addRoom(pool, o.orgId, "C302", { seatCounter: 0 });
    const r = await save({ ...o, roomId }, val(0, []));
    expect(r.ok).toBe(true);
    expect(
      (await one("select count(*)::int as n from map_items where org_id = $1", [o.orgId])).n,
    ).toBe(LIBRARY_ITEMS.length);
    expect(
      (await one("select count(*)::int as n from layout_fixtures where org_id = $1", [o.orgId])).n,
    ).toBe(1);
  });

  it("version increments by exactly 1 and writes one room.layout_save audit row with counts only", async () => {
    const o = await room("C302", { w: 12, h: 8, version: 4 });
    const ids = await seatsOf(o, 1);
    await save(o, val(4, ids));
    const room1 = await one("select layout_version from rooms where id = $1", [o.roomId]);
    expect(room1.layout_version).toBe(5);
    const rows = (await run("select * from audit_log where org_id = $1", [o.orgId])).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe("room.layout_save");
    expect(rows[0].meta).toEqual({ seats: 1, fixtures: 1, floors: 1, baseVersion: 4, version: 5 });
  });

  it("saved default layout from GET passes unchanged", async () => {
    const o = await room();
    await seatsOf(o, 3);
    const d = await value(o);
    const v: LayoutSaveValue = {
      baseVersion: d.version,
      w: d.layout.w,
      h: d.layout.h,
      floors: d.layout.floors,
      seats: d.layout.seats.map(({ code: _c, ...s }) => s),
      fixtures: d.layout.fixtures.map(({ id: _i, ...f }) => f),
    };
    expect((await save(o, v)).ok).toBe(true);
  });

  it("a second save replaces placed fixtures", async () => {
    const o = await room();
    const ids = await seatsOf(o, 1);
    await save(o, val(0, ids));
    await save(o, val(1, ids, { fixtures: [{ sprite: "plant.large", x: 0, y: 6, rotation: 0 }] }));
    const q = "select tile_x, tile_y from layout_fixtures where room_id = $1";
    expect((await run(q, [o.roomId])).rows).toEqual([{ tile_x: 0, tile_y: 6 }]);
  });

  it("rollback: a failure at the audit insert leaves rooms, seats, fixtures and audit unchanged", async () => {
    const o = await room();
    const ids = await seatsOf(o, 1);
    await addFixture(o.orgId, o.roomId, "plant.large", 1, 1);
    const before = await snapshotOf(o.orgId);
    const rec = recording(async (text) => {
      if (text.includes("insert into audit_log")) throw new Error("boom");
    });
    await expect(save(o, val(0, ids), rec.pool)).rejects.toThrow("boom");
    expect(await snapshotOf(o.orgId)).toBe(before);
  });

  it("stale baseVersion gives 409 and changes nothing", async () => {
    const o = await room("C302", { w: 12, h: 8, version: 3 });
    const ids = await seatsOf(o, 1);
    const before = await snapshotOf(o.orgId);
    expect(await save(o, val(2, ids))).toEqual({ ok: false, status: 409, code: "layout_stale" });
    expect(await snapshotOf(o.orgId)).toBe(before);
  });

  it("two concurrent saves: one 200, one layout_stale", async () => {
    const o = await room();
    const ids = await seatsOf(o, 1);
    let locked!: () => void;
    const aLocked = new Promise<void>((r) => (locked = r));
    let release!: () => void;
    const hold = new Promise<void>((r) => (release = r));
    const rec = recording(async (text) => {
      if (text.includes("for update") && text.includes("from rooms")) {
        locked();
        await hold;
      }
    });
    const a = save(o, val(0, ids), rec.pool);
    await aLocked;
    const b = save(o, val(0, ids, { w: 10 }));
    expect(await waitForLockWait(pool, 3000)).toBe(true);
    release();
    const results = await Promise.all([a, b]);
    expect(results[0].ok).toBe(true);
    expect(results[1]).toEqual({ ok: false, status: 409, code: "layout_stale" });
    expect((await one("select grid_w from rooms where id = $1", [o.roomId])).grid_w).toBe(12);
  });

  it("missing, extra and foreign id all give the identical refusal and change nothing", async () => {
    const o = await room();
    const other = await room("D1");
    const ids = await seatsOf(o, 2);
    const foreign = await addSeat(pool, other.orgId, other.roomId, "D1", 1);
    const before = await snapshotOf(o.orgId);
    const missing = await save(o, val(0, ids.slice(0, 1)));
    const extra = await save(o, val(0, [...ids, randomUUID()]));
    const swapped = await save(o, val(0, [ids[0]!, foreign]));
    expect(missing).toEqual({ ok: false, status: 409, code: "layout_seats_changed" });
    expect(refusal(extra)).toBe(refusal(missing));
    expect(refusal(swapped)).toBe(refusal(missing));
    expect(await snapshotOf(o.orgId)).toBe(before);
  });

  it("seat from another room in the same org gives layout_seats_changed", async () => {
    const o = await room();
    const otherRoom = await addRoom(pool, o.orgId, "C303", { seatCounter: 0 });
    const mine = await seatsOf(o, 1);
    const theirs = await addSeat(pool, o.orgId, otherRoom, "C303", 1);
    const before = await snapshotOf(o.orgId);
    const r = await save(o, val(0, [mine[0]!, theirs]));
    expect(r).toMatchObject({ code: "layout_seats_changed" });
    expect(await snapshotOf(o.orgId)).toBe(before);
  });

  it("foreign-org seat id changes neither org", async () => {
    const o = await room();
    const f = await room("F1");
    const mine = await seatsOf(o, 1);
    const foreign = await addSeat(pool, f.orgId, f.roomId, "F1", 1);
    const [bo, bf] = [await snapshotOf(o.orgId), await snapshotOf(f.orgId)];
    expect(await save(o, val(0, [foreign]))).toMatchObject({ code: "layout_seats_changed" });
    const both = await save(o, val(0, [mine[0]!, foreign]));
    expect(both).toMatchObject({ code: "layout_seats_changed" });
    expect([await snapshotOf(o.orgId), await snapshotOf(f.orgId)]).toEqual([bo, bf]);
  });

  it("another org's room id is 404 and changes neither org", async () => {
    const o = await room();
    const f = await room("F2");
    await seatsOf(o, 1);
    const [bo, bf] = [await snapshotOf(o.orgId), await snapshotOf(f.orgId)];
    const r = await saveRoomLayout(pool as never, f.scope, randomUUID(), o.roomId, val(0, []));
    expect(r).toEqual({ ok: false, status: 404, code: "not_found" });
    expect([await snapshotOf(o.orgId), await snapshotOf(f.orgId)]).toEqual([bo, bf]);
  });

  it("501-seat room gives 422 layout_too_many_seats; 500-seat room saves", async () => {
    const big = await room();
    await bulkSeats(big.orgId, big.roomId, 501);
    expect(await save(big, val(0, []))).toEqual({
      ok: false,
      status: 422,
      code: "layout_too_many_seats",
    });
    const ok = await room("C500");
    await bulkSeats(ok.orgId, ok.roomId, 500);
    const found = await run("select id from seats where room_id = $1 order by seq", [ok.roomId]);
    const seats = found.rows.map((r, i) => ({
      id: r.id as string,
      sprite: "desk.single",
      x: (i % 32) * 2,
      y: Math.floor(i / 32) * 3,
      rotation: 0 as const,
    }));
    const v: LayoutSaveValue = { baseVersion: 0, w: 64, h: 64, floors: [], seats, fixtures: [] };
    expect((await save(ok, v)).ok).toBe(true);
  });

  it("leaves occupants, cannot_seat, seat_counter, devices and legacy fixtures unchanged", async () => {
    const o = await room();
    const m = await addMember(pool, o.orgId);
    const s1 = await addSeat(pool, o.orgId, o.roomId, "C302", 1, { occupantId: m });
    const s2 = await addSeat(pool, o.orgId, o.roomId, "C302", 2);
    await run("update seats set cannot_seat = true where id = $1", [s2]);
    await run("update rooms set seat_counter = 9 where id = $1", [o.roomId]);
    await addDevice(pool, o.orgId, m, s1, "primary");
    await run("insert into layout_fixtures (org_id, room_id, kind) values ($1, $2, 'door')", [
      o.orgId,
      o.roomId,
    ]);
    const q = async () => {
      const t = (sql: string, v: unknown[]) => run(sql, v).then((r) => r.rows);
      return JSON.stringify([
        await t("select id, occupant_id, cannot_seat from seats where org_id = $1 order by id", [
          o.orgId,
        ]),
        await t("select seat_counter from rooms where id = $1", [o.roomId]),
        await t("select * from devices where org_id = $1 order by id", [o.orgId]),
        await t("select * from layout_fixtures where org_id = $1 and sprite_key is null", [
          o.orgId,
        ]),
      ]);
    };
    const before = await q();
    expect((await save(o, val(0, [s1, s2]))).ok).toBe(true);
    expect(await q()).toBe(before);
  });
});

describe("catalog footprints and hidden items (db)", () => {
  type O = Awaited<ReturnType<typeof room>>;
  const save = (o: O, v: LayoutSaveValue, roomId = o.roomId) =>
    saveRoomLayout(pool as never, o.scope, randomUUID(), roomId, v);
  const val = (over: Partial<LayoutSaveValue> = {}): LayoutSaveValue => ({
    baseVersion: 0,
    w: 12,
    h: 8,
    floors: [{ sprite: "floor.wood", x: 0, y: 0, w: 12, h: 8 }],
    seats: [],
    fixtures: [],
    ...over,
  });
  const fx = (sprite: string, x: number, y: number, rotation: 0 | 90 | 180 | 270 = 0) => ({
    sprite,
    x,
    y,
    rotation,
  });
  const resize = (o: O, key: string, w: number, h: number) =>
    run("update map_items set w = $3, h = $4 where org_id = $1 and builtin_key = $2", [
      o.orgId,
      key,
      w,
      h,
    ]);
  const hide = (o: O, key: string) =>
    run("update map_items set hidden = true where org_id = $1 and builtin_key = $2", [
      o.orgId,
      key,
    ]);
  const refused = (code: string) => ({ ok: false, status: 422, code });

  it("catalog sizes: plant.large resized to 2x2 by SQL; plants at (0,0) and (1,1) give 422 layout_overlap and change nothing; at (0,0) and (2,2) save", async () => {
    const o = await room();
    await resize(o, "plant.large", 2, 2);
    const before = await snapshotOf(o.orgId);
    const bad = await save(
      o,
      val({ fixtures: [fx("plant.large", 0, 0), fx("plant.large", 1, 1)] }),
    );
    expect(bad).toEqual(refused("layout_overlap"));
    expect(await snapshotOf(o.orgId)).toBe(before);
    const good = await save(
      o,
      val({ fixtures: [fx("plant.large", 0, 0), fx("plant.large", 2, 2)] }),
    );
    expect(good.ok).toBe(true);
  });

  it("catalog sizes: table.meeting 4x1 at 90 degrees with y = h-3 gives layout_out_of_bounds", async () => {
    const o = await room();
    await resize(o, "table.meeting", 4, 1);
    const r = await save(o, val({ fixtures: [fx("table.meeting", 0, 5, 90)] }));
    expect(r).toEqual(refused("layout_out_of_bounds"));
    expect((await save(o, val({ fixtures: [fx("table.meeting", 0, 4, 90)] }))).ok).toBe(true);
  });

  it("catalog sizes: table.meeting shrunk to 1x1 saves in the last column (the registry size would be out of bounds)", async () => {
    const o = await room();
    await resize(o, "table.meeting", 1, 1);
    expect((await save(o, val({ fixtures: [fx("table.meeting", 11, 0)] }))).ok).toBe(true);
  });

  it("catalog sizes: a fixture that grows onto a desk gives layout_fixture_on_desk", async () => {
    const o = await room();
    const s = await addSeat(pool, o.orgId, o.roomId, "C302", 1);
    await resize(o, "prop.mug", 2, 1);
    const v = val({
      seats: [{ id: s, sprite: "desk.single", x: 4, y: 4, rotation: 0 }],
      fixtures: [fx("prop.mug", 3, 4)],
    });
    expect(await save(o, v)).toEqual(refused("layout_fixture_on_desk"));
  });

  it("catalog sizes: the read drops a stored fixture that overlaps at the catalog size", async () => {
    const o = await room("C302", { w: 12, h: 8 });
    await addFixture(o.orgId, o.roomId, "plant.large", 0, 0);
    await addFixture(o.orgId, o.roomId, "plant.large", 1, 1);
    expect((await value(o)).layout.fixtures).toHaveLength(2);
    await resize(o, "plant.large", 2, 2);
    expect((await value(o)).layout.fixtures).toHaveLength(1);
  });

  it("a library-size catalog resolves a stored room exactly as the registry does", async () => {
    const o = await room("C302", { w: 12, h: 8, version: 1 });
    const a = await addSeat(pool, o.orgId, o.roomId, "C302", 1);
    const b = await addSeat(pool, o.orgId, o.roomId, "C302", 2);
    const c = await addSeat(pool, o.orgId, o.roomId, "C302", 3);
    await place(a, "desk.single", 0, 0, 0);
    await place(b, "desk.single", 6, 0, 90);
    await addFixture(o.orgId, o.roomId, "table.meeting", 4, 4);
    await addFixture(o.orgId, o.roomId, "plant.large", 0, 7);
    await run(
      `insert into layout_fixtures (org_id, room_id, kind, tile_x, tile_y, tile_rotation, sprite_key)
       values ($1, $2, null, 10, 2, 90, 'door')`,
      [o.orgId, o.roomId],
    );
    const seats = (
      await run(
        "select id, code, tile_x, tile_y, tile_rotation, sprite_key from seats where room_id = $1 order by seq",
        [o.roomId],
      )
    ).rows;
    const fixtures = (
      await run(
        "select id, tile_x, tile_y, tile_rotation, sprite_key from layout_fixtures where room_id = $1 order by id",
        [o.roomId],
      )
    ).rows;
    const expected = resolveLayout(
      {
        gridW: 12,
        gridH: 8,
        floorZones: (await one("select floor_zones from rooms where id = $1", [o.roomId]))
          .floor_zones,
      },
      seats.map((r) => ({
        id: r.id,
        code: r.code,
        placement:
          r.sprite_key === null
            ? null
            : { sprite: r.sprite_key, x: r.tile_x, y: r.tile_y, rotation: r.tile_rotation },
      })),
      fixtures.map((r) => ({
        id: r.id,
        sprite: r.sprite_key,
        x: r.tile_x,
        y: r.tile_y,
        rotation: r.tile_rotation,
      })),
    );
    const got = await value(o);
    expect(got.layout).toEqual(expected.layout);
    expect(got.unplaced).toEqual(expected.unplaced);
    expect(got.layout.seats.map((s) => s.id).sort()).toEqual([a, b, c].sort());
  });

  it("read items: placed fixture keys, desk.single, chair.office and floor keys only, sorted, no hidden field; a hidden placed item is included", async () => {
    const o = await room("C302", { w: 12, h: 8 });
    const s = await addSeat(pool, o.orgId, o.roomId, "C302", 1);
    await place(s, "desk.single", 4, 2, 0);
    await addFixture(o.orgId, o.roomId, "plant.large", 10, 5);
    await run("update rooms set floor_zones = $2::jsonb where id = $1", [
      o.roomId,
      JSON.stringify([{ sprite: "floor.wood", x: 0, y: 0, w: 6, h: 4 }]),
    ]);
    await hide(o, "plant.large");
    await hide(o, "sofa");
    const keys = (await value(o)).items.map((i) => i.builtinKey);
    expect(keys).toEqual(["chair.office", "desk.single", "floor.wood", "plant.large"]);
    const items = (await value(o)).items;
    expect(items.every((i) => !("hidden" in i))).toBe(true);
    expect(items.find((i) => i.builtinKey === "plant.large")).toMatchObject({ w: 1, h: 1 });
  });

  it("hidden items: a hidden plant kept and moved saves; one more copy gives 422 layout_item_hidden and changes nothing; deleting it saves; placing it in another room gives 422", async () => {
    const o = await room("C302", { w: 12, h: 8, version: 1 });
    const other = await addRoom(pool, o.orgId, "C303", { seatCounter: 0 });
    await addFixture(o.orgId, o.roomId, "plant.large", 10, 5);
    await hide(o, "plant.large");
    expect((await save(o, val({ baseVersion: 1, fixtures: [fx("plant.large", 3, 3)] }))).ok).toBe(
      true,
    );
    const before = await snapshotOf(o.orgId);
    const more = await save(
      o,
      val({ baseVersion: 2, fixtures: [fx("plant.large", 3, 3), fx("plant.large", 5, 5)] }),
    );
    expect(more).toEqual(refused("layout_item_hidden"));
    expect(await snapshotOf(o.orgId)).toBe(before);
    expect((await save(o, val({ baseVersion: 2, fixtures: [] }))).ok).toBe(true);
    expect(await save(o, val({ fixtures: [fx("plant.large", 1, 1)] }), other)).toEqual(
      refused("layout_item_hidden"),
    );
  });

  it("hidden floors: a hidden floor already in the room re-saves; adding it to another saved room gives 422; an unsaved room with hidden floor.wood saves floor.wood", async () => {
    const o = await room("C302", { w: 12, h: 8, version: 1 });
    const zone = (sprite: string) => ({ sprite, x: 0, y: 0, w: 12, h: 8 });
    await run("update rooms set floor_zones = $2::jsonb where id = $1", [
      o.roomId,
      JSON.stringify([zone("floor.carpet")]),
    ]);
    await hide(o, "floor.carpet");
    expect((await save(o, val({ baseVersion: 1, floors: [zone("floor.carpet")] }))).ok).toBe(true);

    const second = await addRoom(pool, o.orgId, "C303", { seatCounter: 0 });
    await run(
      "update rooms set grid_w = 12, grid_h = 8, layout_version = 1, floor_zones = $2::jsonb where id = $1",
      [second, JSON.stringify([zone("floor.wood")])],
    );
    expect(await save(o, val({ baseVersion: 1, floors: [zone("floor.carpet")] }), second)).toEqual(
      refused("layout_item_hidden"),
    );

    const fresh = await room("C304");
    await hide(fresh, "floor.wood");
    expect((await save(fresh, val({ floors: [zone("floor.wood")] }))).ok).toBe(true);
  });

  it("hidden desk.single: a room with seats saves", async () => {
    const o = await room();
    const s = await addSeat(pool, o.orgId, o.roomId, "C302", 1);
    await hide(o, "desk.single");
    const v = val({ seats: [{ id: s, sprite: "desk.single", x: 2, y: 2, rotation: 0 }] });
    expect((await save(o, v)).ok).toBe(true);
  });

  it("org A's resize and hide do not change org B's save or read", async () => {
    const a = await room("C302", { w: 12, h: 8 });
    const b = await room("C302", { w: 12, h: 8 });
    await resize(a, "plant.large", 2, 2);
    await hide(a, "plant.large");
    await addFixture(b.orgId, b.roomId, "plant.large", 0, 0);
    await addFixture(b.orgId, b.roomId, "plant.large", 1, 1);
    expect((await value(b)).layout.fixtures).toHaveLength(2);
    const r = await save(
      b,
      val({
        baseVersion: 1,
        fixtures: [fx("plant.large", 0, 0), fx("plant.large", 1, 1), fx("plant.large", 5, 5)],
      }),
    );
    expect(r.ok).toBe(true);
  });

  it("a save waits for an uncommitted resize of an item it places, then validates at the new size (422 layout_overlap)", async () => {
    const o = await room();
    const holder = await pool.connect();
    try {
      await holder.query("begin");
      await holder.query(
        "select 1 from map_items where org_id = $1 and builtin_key = 'plant.large' for update",
        [o.orgId],
      );
      await holder.query(
        "update map_items set w = 2, h = 2 where org_id = $1 and builtin_key = 'plant.large'",
        [o.orgId],
      );
      const pending = save(
        o,
        val({ fixtures: [fx("plant.large", 0, 0), fx("plant.large", 1, 1)] }),
      );
      expect(await waitForLockWait(pool, 5000)).toBe(true);
      await holder.query("commit");
      expect(await pending).toEqual(refused("layout_overlap"));
    } finally {
      holder.release();
    }
  });
});

/** The seeded catalog type of an org as the layout DTO shows it. */
const catalogType = async (orgId: string, name: string) => {
  const t = await one(
    "select id, slot, sprite_key from device_types where org_id = $1 and name = $2",
    [orgId, name],
  );
  return { id: t.id, slot: t.slot, hasImage: false, imageVersion: 0, sprite: t.sprite_key };
};

describe("getRoomLayout seatDevices (db)", () => {
  const setDevice = (id: string, type: string, createdAt: string) =>
    run("update devices set type = $2, created_at = $3::timestamptz where id = $1", [
      id,
      type,
      createdAt,
    ]);

  it("seatDevices: types per seat, primary first then created_at, id", async () => {
    const o = await room();
    const m = await addMember(pool, o.orgId);
    const s = await addSeat(pool, o.orgId, o.roomId, "C302", 1, { occupantId: m });
    const empty = await addSeat(pool, o.orgId, o.roomId, "C302", 2);
    const late = await addDevice(pool, o.orgId, m, s, "secondary");
    const early = await addDevice(pool, o.orgId, m, s, "secondary");
    const primary = await addDevice(pool, o.orgId, m, s, "primary");
    await setDevice(late, "Monitor", "2026-01-02T00:00:00Z");
    await setDevice(early, "Laptop", "2026-01-01T00:00:00Z");
    await setDevice(primary, "PC", "2026-01-03T00:00:00Z");
    const res = await value(o);
    const dt = (name: string) => catalogType(o.orgId, name);
    expect(res.seatDevices[s]).toEqual([
      { type: "PC", deviceType: await dt("PC") },
      { type: "Laptop", deviceType: await dt("Laptop") },
      { type: "Monitor", deviceType: await dt("Monitor") },
    ]);
    expect(res.seatDevices[empty]).toBeUndefined();
    expect(JSON.stringify(res.seatDevices)).not.toMatch(/inventory|mac|owner|name/i);
  });

  it("seatDevices for a User who holds none of them: only type and deviceType, no ids, names, inventory numbers, MAC or owner", async () => {
    const o = await room();
    const x = await addMember(pool, o.orgId);
    const y = await addMember(pool, o.orgId);
    const s = await addSeat(pool, o.orgId, o.roomId, "C302", 1, { occupantId: x });
    const prim = await addDevice(pool, o.orgId, x, s, "primary");
    const sec = await addDevice(pool, o.orgId, x, s, "secondary");
    await setDevice(prim, "PC", "2026-01-01T00:00:00Z");
    await setDevice(sec, "Monitor", "2026-01-02T00:00:00Z");
    await run("update devices set mac = '00:11:22:33:44:55' where id = $1", [prim]);
    await run("update devices set mac = '00:11:22:33:44:66' where id = $1", [sec]);
    const ySub = (await one("select sub from members where id = $1", [y])).sub as string;
    const res = await value(o, ySub, undefined, "user");
    const list = res.seatDevices[s]!;
    expect(list).toHaveLength(2);
    for (const e of list) {
      expect(Object.keys(e).sort()).toEqual(["deviceType", "type"]);
      expect(Object.keys(e.deviceType!).sort()).toEqual([
        "hasImage",
        "id",
        "imageVersion",
        "slot",
        "sprite",
      ]);
    }
    const json = JSON.stringify(res.seatDevices);
    for (const secret of [prim, sec, x, "00:11:22:33:44:55", "00:11:22:33:44:66"])
      expect(json).not.toContain(secret);
    const inv = await one("select inventory_number from devices where id = $1", [prim]);
    expect(json).not.toContain(inv.inventory_number);
  });

  describe("free-text type by tier (SIM-052)", () => {
    const fixture = async () => {
      const o = await room();
      const x = await addMember(pool, o.orgId);
      const y = await addMember(pool, o.orgId);
      const s = await addSeat(pool, o.orgId, o.roomId, "C302", 1, { occupantId: x });
      const other = await addDevice(pool, o.orgId, x, s, "primary");
      const held = await addDevice(pool, o.orgId, y, s, "secondary");
      await setDevice(held, "PC", "2026-01-01T00:00:00Z");
      await setDevice(other, "Lan's MacBook", "2026-01-02T00:00:00Z");
      return { o, s, ySub: await subOf(y), xSub: await subOf(x) };
    };

    it("User: non-held device type null, held device keeps type, free text absent from JSON", async () => {
      const { o, s, ySub } = await fixture();
      const res = await value(o, ySub, undefined, "user");
      expect(res.seatDevices[s]).toEqual([
        { type: null, deviceType: null },
        { type: "PC", deviceType: await catalogType(o.orgId, "PC") },
      ]);
      expect(JSON.stringify(res.seatDevices)).not.toContain("MacBook");
    });

    it("User: non-held device with a catalog match keeps deviceType", async () => {
      const { o, s, xSub } = await fixture();
      const res = await value(o, xSub, undefined, "user");
      expect(res.seatDevices[s]).toEqual([
        { type: "Lan's MacBook", deviceType: null },
        { type: null, deviceType: await catalogType(o.orgId, "PC") },
      ]);
    });

    it("manager and admin: every device keeps type", async () => {
      const { o, s, ySub } = await fixture();
      for (const tier of ["manager", "admin"] as const) {
        const res = await value(o, ySub, undefined, tier);
        expect(res.seatDevices[s], tier).toEqual([
          { type: "Lan's MacBook", deviceType: null },
          { type: "PC", deviceType: await catalogType(o.orgId, "PC") },
        ]);
      }
    });

    it("User without a member row: every type null, no error", async () => {
      const { o, s } = await fixture();
      const res = await value(o, randomUUID(), undefined, "user");
      expect(res.seatDevices[s]).toEqual([
        { type: null, deviceType: null },
        { type: null, deviceType: await catalogType(o.orgId, "PC") },
      ]);
    });
  });

  it("seatDevices: another org's devices, inventory devices and other rooms' devices are never returned", async () => {
    const a = await room();
    const ma = await addMember(pool, a.orgId);
    const sa = await addSeat(pool, a.orgId, a.roomId, "C302", 1, { occupantId: ma });
    const mine = await addDevice(pool, a.orgId, ma, sa, "secondary");
    await setDevice(mine, "Monitor", "2026-01-01T00:00:00Z");
    const inventory = await addDevice(pool, a.orgId, ma, null, "secondary");
    await setDevice(inventory, "Printer", "2026-01-01T00:00:00Z");
    const other = await addRoom(pool, a.orgId, "C303", { seatCounter: 0 });
    const so = await addSeat(pool, a.orgId, other, "C303", 1);
    await setDevice(
      await addDevice(pool, a.orgId, ma, so, "secondary"),
      "Headset",
      "2026-01-01T00:00:00Z",
    );

    const b = await room("C302");
    const mb = await addMember(pool, b.orgId);
    const sb = await addSeat(pool, b.orgId, b.roomId, "C302", 1, { occupantId: mb });
    await setDevice(
      await addDevice(pool, b.orgId, mb, sb, "secondary"),
      "Tablet",
      "2026-01-01T00:00:00Z",
    );

    const res = await value(a);
    expect(res.seatDevices).toEqual({
      [sa]: [{ type: "Monitor", deviceType: await catalogType(a.orgId, "Monitor") }],
    });
    expect(await get({ scope: b.scope, roomId: a.roomId })).toMatchObject({
      ok: false,
      status: 404,
    });
    expect((await value(b)).seatDevices).toEqual({ [sb]: [{ type: "Tablet", deviceType: null }] });
  });

  it("seatDevices: at most 8 per seat, truncated stays false", async () => {
    const o = await room();
    const m = await addMember(pool, o.orgId);
    const s = await addSeat(pool, o.orgId, o.roomId, "C302", 1, { occupantId: m });
    for (let n = 0; n < 10; n++) {
      const d = await addDevice(pool, o.orgId, m, s, "secondary");
      await setDevice(d, `T${n}`, `2026-01-01T00:00:${String(n).padStart(2, "0")}Z`);
    }
    const res = await value(o);
    expect(res.seatDevices[s].map((d) => d.type)).toEqual(
      Array.from({ length: 8 }, (_, n) => `T${n}`),
    );
    expect(res.truncated).toBe(false);
  });

  /** One seat with one secondary device per given type, oldest first. */
  async function seatWith(types: string[]) {
    const o = await room();
    const m = await addMember(pool, o.orgId);
    const s = await addSeat(pool, o.orgId, o.roomId, "C302", 1, { occupantId: m });
    for (const [n, type] of types.entries()) {
      const d = await addDevice(pool, o.orgId, m, s, "secondary");
      await setDevice(d, type, `2026-01-01T00:00:${String(n).padStart(2, "0")}Z`);
    }
    return { o, s };
  }

  it("seatDevices: unknown type resolves to null; ' pc ' and 'PC' both resolve to PC", async () => {
    const { o, s } = await seatWith(["Printer", "Tablet", " pc ", "PC"]);
    const pc = await catalogType(o.orgId, "PC");
    expect((await value(o)).seatDevices[s]).toEqual([
      { type: "Printer", deviceType: null },
      { type: "Tablet", deviceType: null },
      { type: " pc ", deviceType: pc },
      { type: "PC", deviceType: pc },
    ]);
  });

  it("seat devices carry the type's sprite (null when none)", async () => {
    const { o, s } = await seatWith(["Monitor", "PC"]);
    await run(
      "update device_types set sprite_key = 'device.laptop' where org_id = $1 and name = 'Monitor'",
      [o.orgId],
    );
    const list = (await value(o)).seatDevices[s]!;
    expect(list.map((d) => [d.type, d.deviceType?.sprite])).toEqual([
      ["Monitor", "device.laptop"],
      ["PC", null],
    ]);
  });

  it("seatDevices: another org's catalog type with the same name is never used", async () => {
    const { o, s } = await seatWith(["Scanner"]);
    const other = await room();
    await addMember(pool, other.orgId);
    await run("insert into device_types (org_id, name, slot) values ($1, 'Scanner', 'pc')", [
      other.orgId,
    ]);
    expect((await value(o)).seatDevices[s]).toEqual([{ type: "Scanner", deviceType: null }]);
  });

  it("seatDevices: after deleting the Monitor type, Monitor devices resolve to null", async () => {
    const { o, s } = await seatWith(["Monitor"]);
    expect((await value(o)).seatDevices[s]![0]!.deviceType).not.toBeNull();
    await run("delete from device_types where org_id = $1 and name = 'Monitor'", [o.orgId]);
    expect((await value(o)).seatDevices[s]).toEqual([{ type: "Monitor", deviceType: null }]);
  });
});
