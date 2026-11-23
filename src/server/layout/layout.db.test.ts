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
import type { LayoutSaveValue } from "@/lib/sprites/layout";
import type { TxClient, TxPool } from "@/server/db/tx";
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
