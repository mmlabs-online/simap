import { randomUUID } from "node:crypto";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addMember, addRoom, addSeat, assertTestDb, newOrg, testPool } from "@/test/db/fixtures";
import type { TxClient, TxPool } from "@/server/db/tx";
import { getRoomLayout } from "./layout";

let pool: pg.Pool;

const one = async (sql: string, values: unknown[] = []) => (await pool.query(sql, values)).rows[0];
const run = (sql: string, values: unknown[] = []) => pool.query(sql, values);
const subOf = async (memberId: string) =>
  (await one("select sub from members where id = $1", [memberId])).sub as string;

/** A room with an optional saved grid. */
async function room(code = "C302", grid?: { w: number; h: number; version?: number }) {
  const o = newOrg();
  const roomId = await addRoom(pool, o.orgId, code, { seatCounter: 0 });
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
) => getRoomLayout(p, o.scope, sub, o.roomId);
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
    });
    expect(res.seatViews[cannot]).toEqual({
      state: "cannot",
      avatarSeed: third,
      name: "Third Person",
    });
    expect(res.seatViews[empty]).toEqual({ state: "empty", avatarSeed: null, name: null });
    const json = JSON.stringify(res);
    for (const m of [me, other, third]) expect(json).not.toContain(await subOf(m));
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

  it("long or unknown sprite keys never break the read", async () => {
    const o = await room("C302", { w: 12, h: 8 });
    const s = await addSeat(pool, o.orgId, o.roomId, "C302", 1);
    await place(s, "x".repeat(10_000), 0, 0);
    await addFixture(o.orgId, o.roomId, "y".repeat(10_000), 8, 5);
    await addFixture(o.orgId, o.roomId, "__proto__", 9, 5);
    const rec = recording();
    const res = await value(o, randomUUID(), rec.pool);
    expect(res.layout.seats).toMatchObject([{ id: s, sprite: "desk.single", x: 0, y: 0 }]);
    expect(res.layout.fixtures).toEqual([]);
    const seatSelect = rec.log.find((l) => l.text.includes("from seats"))!;
    expect(seatSelect.rows[0].sprite_key).toHaveLength(129);
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
    expect(texts).toHaveLength(6);
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
