import { randomUUID } from "node:crypto";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEVICE_LIMITS } from "@/lib/devices/types";
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
import { validateDeviceCreate } from "@/lib/validate/device";
import {
  createDevice,
  deleteDevice,
  getDevice,
  listDevices,
  placeDevice,
  updateDevice,
} from "./devices";

let pool: pg.Pool;

const one = async (sql: string, values: unknown[]) => (await pool.query(sql, values)).rows[0];
const count = async (sql: string, values: unknown[]) => (await one(sql, values)).n as number;
const auditCount = (orgId: string, action: string) =>
  count("select count(*)::int as n from audit_log where org_id = $1 and action = $2", [
    orgId,
    action,
  ]);
const subOf = async (memberId: string) =>
  (await one("select sub from members where id = $1", [memberId])).sub as string;
const devRow = (id: string) => one("select seat_id, role from devices where id = $1", [id]);

/**
 * Org with rooms A and B; seats A-01 (occupant x), A-02 (empty), B-01 (occupant y); members x, y and z.
 * Devices are created by the tests.
 */
async function world() {
  const o = newOrg();
  const roomA = await addRoom(pool, o.orgId, "A", { seatCounter: 2 });
  const roomB = await addRoom(pool, o.orgId, "B", { seatCounter: 1 });
  const x = await addMember(pool, o.orgId);
  const y = await addMember(pool, o.orgId);
  const z = await addMember(pool, o.orgId);
  const a1 = await addSeat(pool, o.orgId, roomA, "A", 1, { occupantId: x });
  const a2 = await addSeat(pool, o.orgId, roomA, "A", 2);
  const b1 = await addSeat(pool, o.orgId, roomB, "B", 1, { occupantId: y });
  return { ...o, roomA, roomB, x, y, z, a1, a2, b1 };
}

const put = (
  seatId: string | null,
  role: "primary" | "secondary",
  expectedSeatId: string | null,
) => ({ seatId, role, expectedSeatId });

beforeAll(async () => {
  pool = testPool();
  await assertTestDb(pool);
});
afterAll(async () => {
  await pool.end();
});

describe("devices (db): reads", () => {
  it("list: every item has placement (seat code + room code + role, or null); filters all/placed/inventory; ordered by name", async () => {
    const w = await world();
    const inv = await addDevice(pool, w.orgId, w.x, null, "secondary");
    const placed = await addDevice(pool, w.orgId, w.x, w.a1, "primary");
    await pool.query("update devices set name = 'b' where id = $1", [inv]);
    await pool.query("update devices set name = 'a' where id = $1", [placed]);
    const sub = await subOf(w.x);
    const all = await listDevices(pool, w.scope, sub, "user", "all");
    expect(all.ok && all.value.items.map((d) => d.id)).toEqual([placed, inv]);
    expect(all.ok && all.value.items[0]!.placement).toEqual({
      seatId: w.a1,
      seatCode: "A-01",
      roomId: w.roomA,
      roomCode: "A",
      role: "primary",
    });
    expect(all.ok && all.value.items[1]!.placement).toBeNull();
    expect(all.ok && all.value.truncated).toBe(false);
    const p = await listDevices(pool, w.scope, sub, "user", "placed");
    expect(p.ok && p.value.items.map((d) => d.id)).toEqual([placed]);
    const i = await listDevices(pool, w.scope, sub, "user", "inventory");
    expect(i.ok && i.value.items.map((d) => d.id)).toEqual([inv]);
    expect(all.ok && all.value.items.every((d) => d.mine && d.canEdit && d.canPlace)).toBe(true);
    const other = await listDevices(pool, w.scope, await subOf(w.y), "user", "all");
    expect(other.ok && other.value.items.every((d) => !d.mine && !d.canEdit && !d.canPlace)).toBe(
      true,
    );
  });

  it("list is truncated when over the cap", async () => {
    const w = await world();
    await pool.query(
      `insert into devices (org_id, name, type, inventory_number, owner_id)
       select $1, 'n' || g, 't', 'inv' || g, $2 from generate_series(1, $3::int) g`,
      [w.orgId, w.x, DEVICE_LIMITS.list + 1],
    );
    const r = await listDevices(pool, w.scope, await subOf(w.x), "user", "all");
    expect(r.ok && r.value.items.length).toBe(DEVICE_LIMITS.list);
    expect(r.ok && r.value.truncated).toBe(true);
  });

  it("list and get are org-scoped: another org's device is absent / 404", async () => {
    const w = await world();
    const other = await world();
    const dev = await addDevice(pool, other.orgId, other.x, null, "secondary");
    const list = await listDevices(pool, w.scope, randomUUID(), "admin", "all");
    expect(list.ok && list.value.items).toEqual([]);
    expect(await getDevice(pool, w.scope, randomUUID(), "admin", dev)).toEqual({
      ok: false,
      status: 404,
      code: "not_found",
    });
  });
});

describe("devices (db): placement", () => {
  it("owner places own device as primary on the seat they occupy; audit device.place", async () => {
    const w = await world();
    const dev = await addDevice(pool, w.orgId, w.x, null, "secondary");
    const r = await placeDevice(
      pool,
      w.scope,
      await subOf(w.x),
      "user",
      dev,
      put(w.a1, "primary", null),
    );
    expect(r.ok && r.value.placement).toMatchObject({ seatId: w.a1, role: "primary" });
    expect(await devRow(dev)).toEqual({ seat_id: w.a1, role: "primary" });
    expect(await auditCount(w.orgId, "device.place")).toBe(1);
  });

  it("primary refusals return 409 with seat_has_no_occupant / owner_not_occupant / seat_has_primary and change nothing", async () => {
    const w = await world();
    const sub = await subOf(w.x);
    const dev = await addDevice(pool, w.orgId, w.x, null, "secondary");
    const empty = await placeDevice(pool, w.scope, sub, "user", dev, put(w.a2, "primary", null));
    expect(empty).toEqual({ ok: false, status: 409, code: "seat_has_no_occupant" });
    const notOcc = await placeDevice(pool, w.scope, sub, "user", dev, put(w.b1, "primary", null));
    expect(notOcc).toEqual({ ok: false, status: 409, code: "owner_not_occupant" });
    await addDevice(pool, w.orgId, w.x, w.a1, "primary");
    const taken = await placeDevice(pool, w.scope, sub, "user", dev, put(w.a1, "primary", null));
    expect(taken).toEqual({ ok: false, status: 409, code: "seat_has_primary" });
    expect(await devRow(dev)).toEqual({ seat_id: null, role: "secondary" });
    expect(await auditCount(w.orgId, "device.place")).toBe(0);
  });

  it("owner lends own device as secondary to another member's seat", async () => {
    const w = await world();
    const dev = await addDevice(pool, w.orgId, w.x, null, "secondary");
    const r = await placeDevice(
      pool,
      w.scope,
      await subOf(w.x),
      "user",
      dev,
      put(w.b1, "secondary", null),
    );
    expect(r.ok && r.value.placement).toMatchObject({
      seatId: w.b1,
      roomCode: "B",
      role: "secondary",
    });
  });

  it("manager moves another member's device seat to seat (across two rooms); user gets 422 not_allowed and the row is unchanged", async () => {
    const w = await world();
    const dev = await addDevice(pool, w.orgId, w.x, w.a1, "primary");
    const asUser = await placeDevice(
      pool,
      w.scope,
      await subOf(w.z),
      "user",
      dev,
      put(w.b1, "secondary", w.a1),
    );
    expect(asUser).toEqual({ ok: false, status: 422, code: "not_allowed" });
    expect(await devRow(dev)).toEqual({ seat_id: w.a1, role: "primary" });
    const asManager = await placeDevice(
      pool,
      w.scope,
      await subOf(w.z),
      "manager",
      dev,
      put(w.b1, "secondary", w.a1),
    );
    expect(asManager.ok && asManager.value.placement).toMatchObject({
      seatId: w.b1,
      roomCode: "B",
    });
    expect(await auditCount(w.orgId, "device.move")).toBe(1);
  });

  it("owner returns own device to inventory (role becomes secondary); audit device.return", async () => {
    const w = await world();
    const dev = await addDevice(pool, w.orgId, w.x, w.a1, "primary");
    const r = await placeDevice(
      pool,
      w.scope,
      await subOf(w.x),
      "user",
      dev,
      put(null, "secondary", w.a1),
    );
    expect(r.ok && r.value.placement).toBeNull();
    expect(await devRow(dev)).toEqual({ seat_id: null, role: "secondary" });
    expect(await auditCount(w.orgId, "device.return")).toBe(1);
  });

  it("moving the primary off seat A frees A's primary slot (A has no primary, nothing auto-promoted)", async () => {
    const w = await world();
    const sec = await addDevice(pool, w.orgId, w.y, w.a1, "secondary");
    const prim = await addDevice(pool, w.orgId, w.x, w.a1, "primary");
    const r = await placeDevice(
      pool,
      w.scope,
      await subOf(w.x),
      "user",
      prim,
      put(w.a2, "secondary", w.a1),
    );
    expect(r.ok).toBe(true);
    expect(
      await count(
        "select count(*)::int as n from devices where seat_id = $1 and role = 'primary'",
        [w.a1],
      ),
    ).toBe(0);
    expect(await devRow(sec)).toEqual({ seat_id: w.a1, role: "secondary" });
  });

  it("a stale expectedSeatId -> 409 placement_changed", async () => {
    const w = await world();
    const dev = await addDevice(pool, w.orgId, w.x, w.a1, "secondary");
    const r = await placeDevice(
      pool,
      w.scope,
      await subOf(w.x),
      "user",
      dev,
      put(w.a2, "secondary", null),
    );
    expect(r).toEqual({ ok: false, status: 409, code: "placement_changed" });
    expect(await devRow(dev)).toEqual({ seat_id: w.a1, role: "secondary" });
  });

  it("unknown target seat or seat of another org -> 404", async () => {
    const w = await world();
    const other = await world();
    const dev = await addDevice(pool, w.orgId, w.x, null, "secondary");
    const sub = await subOf(w.x);
    for (const seat of [randomUUID(), other.a1]) {
      expect(
        await placeDevice(pool, w.scope, sub, "user", dev, put(seat, "secondary", null)),
      ).toEqual({
        ok: false,
        status: 404,
        code: "not_found",
      });
    }
    expect(
      await placeDevice(pool, other.scope, sub, "admin", dev, put(null, "secondary", null)),
    ).toEqual({
      ok: false,
      status: 404,
      code: "not_found",
    });
  });

  it("placement waits for a held seat lock; when the holder changes the occupant and commits, the primary placement is refused owner_not_occupant", async () => {
    const w = await world();
    const dev = await addDevice(pool, w.orgId, w.x, null, "secondary");
    const holder = await pool.connect();
    try {
      await holder.query("begin");
      await holder.query("select id from seats where id = $1 for update", [w.a1]);
      const pending = placeDevice(
        pool,
        w.scope,
        await subOf(w.x),
        "user",
        dev,
        put(w.a1, "primary", null),
      );
      expect(await waitForLockWait(pool, 5000)).toBe(true);
      await holder.query("update seats set occupant_id = $2 where id = $1", [w.a1, w.y]);
      await holder.query("commit");
      expect(await pending).toEqual({ ok: false, status: 409, code: "owner_not_occupant" });
    } finally {
      holder.release();
    }
    expect(await devRow(dev)).toEqual({ seat_id: null, role: "secondary" });
  });
});

const dto = (v: Record<string, unknown>) => {
  const r = validateDeviceCreate({ name: "Laptop", type: "laptop", inventoryNumber: "INV", ...v });
  if (!r.ok) throw new Error(`bad fixture: ${r.field}`);
  return r.value;
};
const devCount = (orgId: string) =>
  count("select count(*)::int as n from devices where org_id = $1", [orgId]);

describe("devices (db): create / edit / delete", () => {
  it("create permission matrix: own device in inventory with audit; Admin for another; User/Manager for another -> 422; deactivated owner -> 422; unknown or other-org owner -> 404", async () => {
    const w = await world();
    const other = await world();
    const subX = await subOf(w.x);
    for (const [i, tier] of (["user", "manager", "admin"] as const).entries()) {
      const r = await createDevice(pool, w.scope, subX, tier, dto({ inventoryNumber: `own-${i}` }));
      expect(r.ok && r.value).toMatchObject({
        placement: null,
        mine: true,
        owner: { id: w.x },
        canEdit: true,
      });
    }
    expect(await auditCount(w.orgId, "device.create")).toBe(3);
    const row = await one("select seat_id, role from devices where org_id = $1 limit 1", [w.orgId]);
    expect(row).toEqual({ seat_id: null, role: "secondary" });

    const forY = await createDevice(
      pool,
      w.scope,
      subX,
      "admin",
      dto({ inventoryNumber: "y", ownerId: w.y }),
    );
    expect(forY.ok && forY.value.owner.id).toBe(w.y);
    for (const tier of ["user", "manager"] as const) {
      expect(
        await createDevice(pool, w.scope, subX, tier, dto({ inventoryNumber: "n", ownerId: w.y })),
      ).toEqual({ ok: false, status: 422, code: "not_allowed" });
    }
    await pool.query("update members set status = 'deactivated' where id = $1", [w.z]);
    expect(
      await createDevice(pool, w.scope, subX, "admin", dto({ inventoryNumber: "z", ownerId: w.z })),
    ).toEqual({ ok: false, status: 422, code: "member_not_assignable" });
    for (const ownerId of [randomUUID(), other.x]) {
      expect(
        await createDevice(pool, w.scope, subX, "admin", dto({ inventoryNumber: "u", ownerId })),
      ).toEqual({ ok: false, status: 404, code: "not_found" });
    }
    expect(await devCount(w.orgId)).toBe(4);
    expect(await auditCount(w.orgId, "device.create")).toBe(4);
  });

  it("create without a member row and no ownerId -> 422 no_linked_member", async () => {
    const w = await world();
    expect(await createDevice(pool, w.scope, randomUUID(), "user", dto({}))).toEqual({
      ok: false,
      status: 422,
      code: "no_linked_member",
    });
  });

  it("edit permission matrix: owner edits own; User/Manager editing another one -> 422 and row unchanged; Admin edits another one; a placed device keeps its placement; audit lists the changed fields only", async () => {
    const w = await world();
    const dev = await addDevice(pool, w.orgId, w.x, w.a1, "primary");
    const subX = await subOf(w.x);
    const subY = await subOf(w.y);
    const r = await updateDevice(pool, w.scope, subX, "user", dev, {
      name: "Renamed",
      mac: "aa:bb:cc:dd:ee:ff",
    });
    expect(r.ok && r.value).toMatchObject({
      name: "Renamed",
      mac: "aa:bb:cc:dd:ee:ff",
      placement: { seatId: w.a1, role: "primary" },
    });
    const audit = await one(
      "select meta from audit_log where org_id = $1 and action = 'device.update'",
      [w.orgId],
    );
    expect(audit.meta).toEqual({ fields: ["name", "mac"] });
    for (const tier of ["user", "manager"] as const) {
      expect(await updateDevice(pool, w.scope, subY, tier, dev, { name: "Nope" })).toEqual({
        ok: false,
        status: 422,
        code: "not_allowed",
      });
    }
    expect((await one("select name from devices where id = $1", [dev])).name).toBe("Renamed");
    const asAdmin = await updateDevice(pool, w.scope, subY, "admin", dev, {
      type: "Desktop",
      mac: null,
    });
    expect(asAdmin.ok && asAdmin.value).toMatchObject({ type: "Desktop", mac: null });
    expect(await devRow(dev)).toEqual({ seat_id: w.a1, role: "primary" });
    // no-op: nothing written
    expect((await updateDevice(pool, w.scope, subX, "user", dev, { name: "Renamed" })).ok).toBe(
      true,
    );
    expect(await auditCount(w.orgId, "device.update")).toBe(2);
    expect(await updateDevice(pool, w.scope, subX, "user", randomUUID(), { name: "x" })).toEqual({
      ok: false,
      status: 404,
      code: "not_found",
    });
  });

  it("delete permission matrix: owner deletes own inventory device; User/Manager deleting another one -> 422; Admin deletes another one", async () => {
    const w = await world();
    const subX = await subOf(w.x);
    const subY = await subOf(w.y);
    const mine = await addDevice(pool, w.orgId, w.x, null, "secondary");
    expect(await deleteDevice(pool, w.scope, subX, "user", mine)).toEqual({
      ok: true,
      value: null,
    });
    const theirs = await addDevice(pool, w.orgId, w.x, null, "secondary");
    for (const tier of ["user", "manager"] as const) {
      expect(await deleteDevice(pool, w.scope, subY, tier, theirs)).toEqual({
        ok: false,
        status: 422,
        code: "not_allowed",
      });
    }
    expect(await devCount(w.orgId)).toBe(1);
    expect(await deleteDevice(pool, w.scope, subY, "admin", theirs)).toEqual({
      ok: true,
      value: null,
    });
    expect(await devCount(w.orgId)).toBe(0);
    expect(await auditCount(w.orgId, "device.delete")).toBe(2);
  });

  it("delete: placed -> 409 device_placed and row kept; after return to inventory the delete succeeds; a deleted device then answers 404 to get and to place", async () => {
    const w = await world();
    const subX = await subOf(w.x);
    const dev = await addDevice(pool, w.orgId, w.x, w.a1, "primary");
    expect(await deleteDevice(pool, w.scope, subX, "user", dev)).toEqual({
      ok: false,
      status: 409,
      code: "device_placed",
    });
    expect(await devCount(w.orgId)).toBe(1);
    expect(await auditCount(w.orgId, "device.delete")).toBe(0);
    expect(
      (await placeDevice(pool, w.scope, subX, "user", dev, put(null, "secondary", w.a1))).ok,
    ).toBe(true);
    expect(await deleteDevice(pool, w.scope, subX, "user", dev)).toEqual({
      ok: true,
      value: null,
    });
    expect(await auditCount(w.orgId, "device.delete")).toBe(1);
    const notFound = { ok: false, status: 404, code: "not_found" };
    expect(await getDevice(pool, w.scope, subX, "user", dev)).toEqual(notFound);
    expect(
      await placeDevice(pool, w.scope, subX, "user", dev, put(null, "secondary", null)),
    ).toEqual(notFound);
  });

  it("uniqueness: duplicate inventory number -> 409 (create and patch); same MAC in another spelling -> 409; null MACs coexist; same values in another org are fine", async () => {
    const w = await world();
    const other = await world();
    const subX = await subOf(w.x);
    const a = await createDevice(
      pool,
      w.scope,
      subX,
      "user",
      dto({ inventoryNumber: "INV-1", mac: "AA-BB-CC-DD-EE-FF" }),
    );
    expect(a.ok).toBe(true);
    expect(
      await createDevice(pool, w.scope, subX, "user", dto({ inventoryNumber: "INV-1" })),
    ).toEqual({ ok: false, status: 409, code: "inventory_number_taken" });
    expect(
      await createDevice(
        pool,
        w.scope,
        subX,
        "user",
        dto({ inventoryNumber: "INV-2", mac: "aabb.ccdd.eeff" }),
      ),
    ).toEqual({ ok: false, status: 409, code: "mac_taken" });
    const b = await createDevice(pool, w.scope, subX, "user", dto({ inventoryNumber: "INV-2" }));
    const c = await createDevice(pool, w.scope, subX, "user", dto({ inventoryNumber: "INV-3" }));
    expect(b.ok && c.ok).toBe(true);
    const bId = b.ok ? b.value.id : "";
    expect(
      await updateDevice(pool, w.scope, subX, "user", bId, { inventoryNumber: "INV-1" }),
    ).toEqual({ ok: false, status: 409, code: "inventory_number_taken" });
    expect(
      await updateDevice(pool, w.scope, subX, "user", bId, { mac: "aa:bb:cc:dd:ee:ff" }),
    ).toEqual({ ok: false, status: 409, code: "mac_taken" });
    const kept = await one("select inventory_number from devices where id = $1", [bId]);
    expect(kept.inventory_number).toBe("INV-2");
    const cross = await createDevice(
      pool,
      other.scope,
      await subOf(other.x),
      "user",
      dto({ inventoryNumber: "INV-1", mac: "aa:bb:cc:dd:ee:ff" }),
    );
    expect(cross.ok).toBe(true);
  });

  it("delete and place race: delete holds the device lock, place waits, delete commits -> place answers 404, no error", async () => {
    const w = await world();
    const dev = await addDevice(pool, w.orgId, w.x, null, "secondary");
    const holder = await pool.connect();
    try {
      await holder.query("begin");
      await holder.query("select id from devices where id = $1 for update", [dev]);
      const pending = placeDevice(
        pool,
        w.scope,
        await subOf(w.x),
        "user",
        dev,
        put(w.a2, "secondary", null),
      );
      expect(await waitForLockWait(pool, 5000)).toBe(true);
      await holder.query("delete from devices where id = $1", [dev]);
      await holder.query("commit");
      expect(await pending).toEqual({ ok: false, status: 404, code: "not_found" });
    } finally {
      holder.release();
    }
  });
});
