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
import { exportRows } from "./export";

let pool: pg.Pool;

beforeAll(async () => {
  pool = testPool();
  await assertTestDb(pool);
});
afterAll(async () => {
  await pool.end();
});

async function seed(label: string) {
  const o = newOrg();
  const owner = await addMember(pool, o.orgId);
  await pool.query("update members set display_name = $2, employee_code = 'E1' where id = $1", [
    owner,
    `Nguyễn ${label}`,
  ]);
  const room = await addRoom(pool, o.orgId, `R-${label}`);
  const seat = await addSeat(pool, o.orgId, room, `R-${label}`, 1, { occupantId: owner });
  await addSeat(pool, o.orgId, room, `R-${label}`, 2);
  await addDevice(pool, o.orgId, owner, seat, "primary");
  return { ...o, owner, seat };
}

describe("exportRows (db)", () => {
  it("two orgs: each export lists only its own rows", async () => {
    const a = await seed("a");
    const b = await seed("b");

    const seatsA = await exportRows(pool, a.scope, "seats");
    expect(seatsA.rows.map((r) => r[3])).toEqual(["R-a-01", "R-a-02"]);
    expect(seatsA.rows.map((r) => r[4])).toEqual(["occupied", "free"]);
    expect(seatsA.rows[0]![5]).toBe("Nguyễn a");
    expect(seatsA.truncated).toBe(false);

    const devA = await exportRows(pool, a.scope, "devices");
    expect(devA.rows).toHaveLength(1);
    expect(devA.rows[0]![5]).toBe("Nguyễn a");
    expect(devA.rows[0]![7]).toBe("placed");
    expect(devA.rows[0]![9]).toBe("R-a-01");

    const memA = await exportRows(pool, a.scope, "members");
    expect(memA.rows.map((r) => r[0])).toEqual(["Nguyễn a"]);
    const memB = await exportRows(pool, b.scope, "members");
    expect(memB.rows.map((r) => r[0])).toEqual(["Nguyễn b"]);
    expect((await exportRows(pool, b.scope, "seats")).rows.map((r) => r[3])).toEqual([
      "R-b-01",
      "R-b-02",
    ]);
  });

  it("cap: more rows than the cap are cut and flagged", async () => {
    const a = await seed("c");
    const r = await exportRows(pool, a.scope, "seats", 1);
    expect(r.rows).toHaveLength(1);
    expect(r.truncated).toBe(true);
  });
});
