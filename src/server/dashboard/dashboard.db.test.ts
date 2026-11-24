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
} from "@/test/db/fixtures";
import type { TxClient, TxPool } from "@/server/db/tx";
import { getDashboard } from "./dashboard";

let pool: pg.Pool;

const run = (sql: string, values: unknown[] = []) => pool.query(sql, values);
const get = (o: { scope: any }, includeHolders = true, p: any = pool) =>
  getDashboard(p, o.scope, { includeHolders });

/** A deactivated member with a given display name. */
async function deactivated(orgId: string, name: string) {
  const id = await addMember(pool, orgId);
  await run("update members set status = 'deactivated', display_name = $2 where id = $1", [
    id,
    name,
  ]);
  return id;
}

beforeAll(async () => {
  pool = testPool();
  await assertTestDb(pool);
});
afterAll(async () => {
  await pool.end();
});

describe("getDashboard (db)", () => {
  it("empty org: all zeros, no rooms, holders total 0", async () => {
    const o = newOrg();
    const d = await get(o);
    expect(d.totals).toEqual({
      rooms: 0,
      seats: 0,
      occupied: 0,
      devicesPlaced: 0,
      devicesInventory: 0,
    });
    expect(d.rooms).toEqual([]);
    expect(d.roomsTruncated).toBe(false);
    expect(d.deactivatedHolders).toEqual({ total: 0, items: [] });
  });

  it("counts rooms, seats, occupied, devices placed and inventory", async () => {
    const o = newOrg();
    const m1 = await addMember(pool, o.orgId);
    const m2 = await addMember(pool, o.orgId);
    const a = await addRoom(pool, o.orgId, "A");
    const b = await addRoom(pool, o.orgId, "B");
    const a1 = await addSeat(pool, o.orgId, a, "A", 1, { occupantId: m1 });
    await addSeat(pool, o.orgId, a, "A", 2);
    await addSeat(pool, o.orgId, a, "A", 3, { occupantId: m2 });
    const b1 = await addSeat(pool, o.orgId, b, "B", 1);
    const cannot = await addSeat(pool, o.orgId, b, "B", 2);
    await run("update seats set cannot_seat = true where id = $1", [cannot]);
    await addDevice(pool, o.orgId, m1, a1, "primary");
    await addDevice(pool, o.orgId, m1, a1, "secondary");
    await addDevice(pool, o.orgId, m2, b1, "secondary");
    await addDevice(pool, o.orgId, m2, null, "secondary");
    const d = await get(o);
    expect(d.totals).toEqual({
      rooms: 2,
      seats: 5,
      occupied: 2,
      devicesPlaced: 3,
      devicesInventory: 1,
    });
  });

  it("per-room counts include empty rooms; roomsTruncated false", async () => {
    const o = newOrg();
    const m = await addMember(pool, o.orgId);
    const a = await addRoom(pool, o.orgId, "A");
    await addRoom(pool, o.orgId, "B");
    await addSeat(pool, o.orgId, a, "A", 1, { occupantId: m });
    await addSeat(pool, o.orgId, a, "A", 2);
    const d = await get(o);
    expect(d.rooms.map((r) => [r.code, r.seatCount, r.occupiedCount])).toEqual([
      ["A", 2, 1],
      ["B", 0, 0],
    ]);
    expect(d.roomsTruncated).toBe(false);
  });

  it("numbers follow the database after assign, release, device place/return and deactivate", async () => {
    const o = newOrg();
    const m = await addMember(pool, o.orgId);
    const r = await addRoom(pool, o.orgId, "A");
    const s = await addSeat(pool, o.orgId, r, "A", 1);
    const dev = await addDevice(pool, o.orgId, m, null, "secondary");
    const t = async () => (await get(o)).totals;
    expect(await t()).toMatchObject({
      seats: 1,
      occupied: 0,
      devicesPlaced: 0,
      devicesInventory: 1,
    });

    await run("update seats set occupant_id = $2 where id = $1", [s, m]);
    await run("update devices set seat_id = $2 where id = $1", [dev, s]);
    expect(await t()).toMatchObject({ occupied: 1, devicesPlaced: 1, devicesInventory: 0 });
    expect((await get(o)).rooms[0]).toMatchObject({ seatCount: 1, occupiedCount: 1 });

    await run("update members set status = 'deactivated' where id = $1", [m]);
    expect((await get(o)).deactivatedHolders?.total).toBe(1);

    await run("update seats set occupant_id = null where id = $1", [s]);
    await run("update devices set seat_id = null where id = $1", [dev]);
    expect(await t()).toMatchObject({ occupied: 0, devicesPlaced: 0, devicesInventory: 1 });
    expect((await get(o)).deactivatedHolders?.total).toBe(0);
  });

  it("lists deactivated members who still hold seats, capped, with true total", async () => {
    const o = newOrg();
    const r = await addRoom(pool, o.orgId, "A");
    const an = await deactivated(o.orgId, "Nguyễn Văn An");
    const bao = await deactivated(o.orgId, "Bảo Trần");
    await deactivated(o.orgId, "No Seat");
    const active = await addMember(pool, o.orgId);
    for (let i = 1; i <= 12; i++) await addSeat(pool, o.orgId, r, "A", i, { occupantId: an });
    await addSeat(pool, o.orgId, r, "A", 13, { occupantId: bao });
    await addSeat(pool, o.orgId, r, "A", 14, { occupantId: active });

    const h = (await get(o)).deactivatedHolders!;
    expect(h.total).toBe(2);
    expect(h.items.map((i) => i.member.displayName)).toEqual(["Bảo Trần", "Nguyễn Văn An"]);
    const nguyen = h.items[1]!;
    expect(nguyen.seatCount).toBe(12);
    expect(nguyen.seats).toHaveLength(10);
    expect(nguyen.seats[0]).toMatchObject({ code: "A-01", roomCode: "A", roomId: r });
    expect(h.items[0]!.seatCount).toBe(1);
  });

  it("holders cap: 51 deactivated holders -> 50 items, total 51", async () => {
    const o = newOrg();
    const r = await addRoom(pool, o.orgId, "A");
    for (let i = 1; i <= 51; i++) {
      const m = await deactivated(o.orgId, `Holder ${String(i).padStart(2, "0")}`);
      await addSeat(pool, o.orgId, r, "A", i, { occupantId: m });
    }
    const h = (await get(o)).deactivatedHolders!;
    expect(h.total).toBe(51);
    expect(h.items).toHaveLength(50);
  });

  it("holders are null when includeHolders is false", async () => {
    const o = newOrg();
    const r = await addRoom(pool, o.orgId, "A");
    const m = await deactivated(o.orgId, "X");
    await addSeat(pool, o.orgId, r, "A", 1, { occupantId: m });
    expect((await get(o, false)).deactivatedHolders).toBeNull();
  });

  it("never counts another org's rows", async () => {
    const a = newOrg();
    const b = newOrg();
    for (const o of [a, b]) {
      const m = await deactivated(o.orgId, "Holder");
      const r = await addRoom(pool, o.orgId, "A");
      const s = await addSeat(pool, o.orgId, r, "A", 1, { occupantId: m });
      await addDevice(pool, o.orgId, m, s, "primary");
      await addDevice(pool, o.orgId, m, null, "secondary");
    }
    const d = await get(a);
    expect(d.totals).toEqual({
      rooms: 1,
      seats: 1,
      occupied: 1,
      devicesPlaced: 1,
      devicesInventory: 1,
    });
    expect(d.rooms).toHaveLength(1);
    expect(d.deactivatedHolders?.total).toBe(1);
  });

  it("runs begin, set transaction repeatable read read only, reads, commit", async () => {
    const o = newOrg();
    const texts: string[] = [];
    const rec: TxPool = {
      async connect(): Promise<TxClient> {
        const c = await pool.connect();
        return {
          query(text, values) {
            texts.push(text);
            return c.query(text, values);
          },
          release: () => c.release(),
        };
      },
    };
    await get(o, true, rec);
    expect(texts[0]).toBe("begin");
    expect(texts[1]).toBe("set transaction isolation level repeatable read, read only");
    expect(texts.at(-1)).toBe("commit");
    expect(texts).toHaveLength(6);
  });
});
