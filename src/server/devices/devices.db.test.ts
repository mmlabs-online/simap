import { randomUUID } from "node:crypto";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEVICE_LIMITS } from "@/lib/devices/types";
import {
  addDevice,
  addHandoff,
  addMember,
  addRoom,
  addSeat,
  addTransfer,
  assertTestDb,
  newOrg,
  testPool,
  waitForLockWait,
} from "@/test/db/fixtures";
import { validateDeviceCreate } from "@/lib/validate/device";
import {
  assignDevice,
  createDevice,
  deleteDevice,
  getDevice,
  listDevices,
  placeDevice,
  updateDevice,
  updateHolding,
} from "./devices";

/** The pinned clock for reads: a UTC+7 calendar day. */
const TODAY = "2026-11-25";

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
    const all = await listDevices(pool, w.scope, sub, "user", "all", TODAY);
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
    const p = await listDevices(pool, w.scope, sub, "user", "placed", TODAY);
    expect(p.ok && p.value.items.map((d) => d.id)).toEqual([placed]);
    const i = await listDevices(pool, w.scope, sub, "user", "inventory", TODAY);
    expect(i.ok && i.value.items.map((d) => d.id)).toEqual([inv]);
    expect(all.ok && all.value.items.every((d) => d.mine && d.canEdit && d.canPlace)).toBe(true);
    const other = await listDevices(pool, w.scope, await subOf(w.y), "user", "all", TODAY);
    expect(other.ok && other.value.items.every((d) => !d.mine && !d.canEdit && !d.canPlace)).toBe(
      true,
    );
  });

  it("list/get include an unowned device with owner null, mine false, canPlace false; canEdit/canDelete only for Admin; filter unowned returns only unowned", async () => {
    const w = await world();
    const owned = await addDevice(pool, w.orgId, w.x, null, "secondary");
    const unowned = await addDevice(pool, w.orgId, null, null, "secondary");
    const sub = await subOf(w.x);
    const all = await listDevices(pool, w.scope, sub, "user", "all", TODAY);
    expect(all.ok && all.value.items.map((d) => d.id).sort()).toEqual([owned, unowned].sort());
    const only = await listDevices(pool, w.scope, sub, "user", "unowned", TODAY);
    expect(only.ok && only.value.items.map((d) => d.id)).toEqual([unowned]);
    const inv = await listDevices(pool, w.scope, sub, "user", "inventory", TODAY);
    expect(inv.ok && inv.value.items).toHaveLength(2);
    for (const [tier, admin] of [
      ["user", false],
      ["manager", false],
      ["admin", true],
    ] as const) {
      const g = await getDevice(pool, w.scope, sub, tier, unowned, TODAY);
      expect(g.ok && g.value).toMatchObject({
        owner: null,
        placement: null,
        mine: false,
        canPlace: false,
        canEdit: admin,
        canDelete: admin,
      });
    }
  });

  it("list is truncated when over the cap", async () => {
    const w = await world();
    await pool.query(
      `insert into devices (org_id, name, type, inventory_number, owner_id)
       select $1, 'n' || g, 't', 'inv' || g, $2 from generate_series(1, $3::int) g`,
      [w.orgId, w.x, DEVICE_LIMITS.list + 1],
    );
    const r = await listDevices(pool, w.scope, await subOf(w.x), "user", "all", TODAY);
    expect(r.ok && r.value.items.length).toBe(DEVICE_LIMITS.list);
    expect(r.ok && r.value.truncated).toBe(true);
  });

  it("list and get are org-scoped: another org's device is absent / 404", async () => {
    const w = await world();
    const other = await world();
    const dev = await addDevice(pool, other.orgId, other.x, null, "secondary");
    const list = await listDevices(pool, w.scope, randomUUID(), "admin", "all", TODAY);
    expect(list.ok && list.value.items).toEqual([]);
    expect(await getDevice(pool, w.scope, randomUUID(), "admin", dev, TODAY)).toEqual({
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

  it("placing an unowned device (primary or secondary, empty or occupied seat) -> 422 device_unowned, row unchanged; Admin and Manager alike", async () => {
    const w = await world();
    const dev = await addDevice(pool, w.orgId, null, null, "secondary");
    const sub = await subOf(w.x);
    for (const tier of ["manager", "admin"] as const) {
      for (const seat of [w.a1, w.a2]) {
        for (const role of ["primary", "secondary"] as const) {
          expect(await placeDevice(pool, w.scope, sub, tier, dev, put(seat, role, null))).toEqual({
            ok: false,
            status: 422,
            code: "device_unowned",
          });
        }
      }
    }
    expect(await devRow(dev)).toEqual({ seat_id: null, role: "secondary" });
    expect(await auditCount(w.orgId, "device.place")).toBe(0);
    // the DB check is the backstop
    await expect(
      pool.query("update devices set seat_id = $2 where id = $1", [dev, w.a2]),
    ).rejects.toMatchObject({ code: "23514", constraint: "devices_unowned_not_placed_check" });
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
  it("create: Admin (with or without a member row) creates an unowned device, owner null, audit device.create meta ownerId null; Manager and User -> 422, no row, no audit", async () => {
    const w = await world();
    const subX = await subOf(w.x);
    for (const [i, sub] of [subX, randomUUID()].entries()) {
      const r = await createDevice(pool, w.scope, sub, "admin", dto({ inventoryNumber: `a-${i}` }));
      expect(r.ok && r.value).toMatchObject({
        placement: null,
        mine: false,
        owner: null,
        canPlace: false,
        canEdit: true,
        canDelete: true,
      });
    }
    expect(await auditCount(w.orgId, "device.create")).toBe(2);
    const audit = await one("select meta from audit_log where org_id = $1 limit 1", [w.orgId]);
    expect(audit.meta).toMatchObject({ ownerId: null });
    const row = await one("select seat_id, role, owner_id from devices where org_id = $1 limit 1", [
      w.orgId,
    ]);
    expect(row).toEqual({ seat_id: null, role: "secondary", owner_id: null });
    for (const tier of ["user", "manager"] as const) {
      expect(await createDevice(pool, w.scope, subX, tier, dto({ inventoryNumber: "n" }))).toEqual({
        ok: false,
        status: 422,
        code: "not_allowed",
      });
    }
    expect(await devCount(w.orgId)).toBe(2);
    expect(await auditCount(w.orgId, "device.create")).toBe(2);
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

  it("delete: Admin deletes an unowned device with audit; owned -> 409 device_owned; pending handoff -> 409 handoff_pending and row kept; only a cancelled handoff -> deleted with its handoff; User/Manager -> 422", async () => {
    const w = await world();
    const sub = await subOf(w.x);
    const unowned = await addDevice(pool, w.orgId, null, null, "secondary");
    for (const tier of ["user", "manager"] as const) {
      expect(await deleteDevice(pool, w.scope, sub, tier, unowned)).toEqual({
        ok: false,
        status: 422,
        code: "not_allowed",
      });
    }
    const owned = await addDevice(pool, w.orgId, w.x, null, "secondary");
    expect(await deleteDevice(pool, w.scope, sub, "admin", owned)).toEqual({
      ok: false,
      status: 409,
      code: "device_owned",
    });
    const placed = await addDevice(pool, w.orgId, w.x, w.a1, "primary");
    expect(await deleteDevice(pool, w.scope, sub, "admin", placed)).toEqual({
      ok: false,
      status: 409,
      code: "device_owned",
    });
    const held = await addDevice(pool, w.orgId, null, null, "secondary");
    await addHandoff(pool, w.orgId, held, w.x, "pending");
    expect(await deleteDevice(pool, w.scope, sub, "admin", held)).toEqual({
      ok: false,
      status: 409,
      code: "handoff_pending",
    });
    expect(await devCount(w.orgId)).toBe(4);
    expect(await auditCount(w.orgId, "device.delete")).toBe(0);
    await addHandoff(pool, w.orgId, unowned, w.x, "cancelled");
    expect(await deleteDevice(pool, w.scope, sub, "admin", unowned)).toEqual({
      ok: true,
      value: null,
    });
    expect(await auditCount(w.orgId, "device.delete")).toBe(1);
    expect(
      await count("select count(*)::int as n from device_handoffs where device_id = $1", [unowned]),
    ).toBe(0);
    const notFound = { ok: false, status: 404, code: "not_found" };
    expect(await getDevice(pool, w.scope, sub, "admin", unowned, TODAY)).toEqual(notFound);
    expect(
      await placeDevice(pool, w.scope, sub, "admin", unowned, put(null, "secondary", null)),
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
      "admin",
      dto({ inventoryNumber: "INV-1", mac: "AA-BB-CC-DD-EE-FF" }),
    );
    expect(a.ok).toBe(true);
    expect(
      await createDevice(pool, w.scope, subX, "admin", dto({ inventoryNumber: "INV-1" })),
    ).toEqual({ ok: false, status: 409, code: "inventory_number_taken" });
    expect(
      await createDevice(
        pool,
        w.scope,
        subX,
        "admin",
        dto({ inventoryNumber: "INV-2", mac: "aabb.ccdd.eeff" }),
      ),
    ).toEqual({ ok: false, status: 409, code: "mac_taken" });
    const b = await createDevice(pool, w.scope, subX, "admin", dto({ inventoryNumber: "INV-2" }));
    const c = await createDevice(pool, w.scope, subX, "admin", dto({ inventoryNumber: "INV-3" }));
    expect(b.ok && c.ok).toBe(true);
    const bId = b.ok ? b.value.id : "";
    expect(
      await updateDevice(pool, w.scope, subX, "admin", bId, { inventoryNumber: "INV-1" }),
    ).toEqual({ ok: false, status: 409, code: "inventory_number_taken" });
    expect(
      await updateDevice(pool, w.scope, subX, "admin", bId, { mac: "aa:bb:cc:dd:ee:ff" }),
    ).toEqual({ ok: false, status: 409, code: "mac_taken" });
    const kept = await one("select inventory_number from devices where id = $1", [bId]);
    expect(kept.inventory_number).toBe("INV-2");
    const cross = await createDevice(
      pool,
      other.scope,
      await subOf(other.x),
      "admin",
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

describe("devices (db): assign and holding", () => {
  const holdingOf = (id: string) =>
    one(
      "select owner_id, seat_id, role, holding_note, to_char(holding_expires_on, 'YYYY-MM-DD') as expires_on from devices where id = $1",
      [id],
    );
  const auditRows = async (orgId: string, action: string) =>
    (
      await pool.query(
        "select actor_sub, entity_id, meta from audit_log where org_id = $1 and action = $2",
        [orgId, action],
      )
    ).rows;
  const inventoryDevice = (orgId: string) => addDevice(pool, orgId, null, null, "secondary");

  it("admin and manager assign: owner set, not placed, role unchanged, holding returned, one device.assign row", async () => {
    const w = await world();
    const actor = await subOf(w.z);
    const d1 = await inventoryDevice(w.orgId);
    const d2 = await inventoryDevice(w.orgId);
    const r1 = await assignDevice(pool, w.scope, actor, "admin", d1, {
      memberId: w.x,
      note: "Loan for the project",
      expiresOn: "2026-12-31",
    });
    expect(r1.ok).toBe(true);
    if (r1.ok) {
      expect(r1.value.owner?.id).toBe(w.x);
      expect(r1.value.placement).toBeNull();
      expect(r1.value.holding).toEqual({ note: "Loan for the project", expiresOn: "2026-12-31" });
      expect(r1.value.canAssign).toBe(false);
      expect(r1.value.canEditHolding).toBe(true);
    }
    const row = await holdingOf(d1);
    expect(row).toMatchObject({ owner_id: w.x, seat_id: null, role: "secondary" });
    expect(row.expires_on).toBe("2026-12-31");
    const r2 = await assignDevice(pool, w.scope, actor, "manager", d2, {
      memberId: w.y,
      note: null,
      expiresOn: null,
    });
    expect(r2.ok && r2.value.holding).toEqual({ note: null, expiresOn: null });
    const rows = await auditRows(w.orgId, "device.assign");
    expect(rows).toHaveLength(2);
    const first = rows.find((r) => r.entity_id === d1)!;
    expect(first.actor_sub).toBe(actor);
    expect(first.meta).toMatchObject({
      memberId: w.x,
      note: "Loan for the project",
      expiresOn: "2026-12-31",
    });
  });

  it("a user is refused 422 and nothing changes; an owned device is 409 device_owned with no audit row", async () => {
    const w = await world();
    const actor = await subOf(w.z);
    const free = await inventoryDevice(w.orgId);
    expect(
      await assignDevice(pool, w.scope, actor, "user", free, {
        memberId: w.x,
        note: null,
        expiresOn: null,
      }),
    ).toEqual({ ok: false, status: 422, code: "not_allowed" });
    const owned = await addDevice(pool, w.orgId, w.y, null, "secondary");
    expect(
      await assignDevice(pool, w.scope, actor, "admin", owned, {
        memberId: w.x,
        note: null,
        expiresOn: null,
      }),
    ).toEqual({ ok: false, status: 409, code: "device_owned" });
    expect((await holdingOf(owned)).owner_id).toBe(w.y);
    expect((await holdingOf(free)).owner_id).toBeNull();
    expect(await auditRows(w.orgId, "device.assign")).toHaveLength(0);
  });

  it("expiry round-trips as YYYY-MM-DD", async () => {
    const w = await world();
    const d = await inventoryDevice(w.orgId);
    const r = await assignDevice(pool, w.scope, await subOf(w.z), "admin", d, {
      memberId: w.x,
      note: null,
      expiresOn: "2026-12-31",
    });
    expect(r.ok && r.value.holding?.expiresOn).toBe("2026-12-31");
    const g = await getDevice(pool, w.scope, await subOf(w.z), "admin", d, TODAY);
    expect(g.ok && g.value.holding?.expiresOn).toBe("2026-12-31");
  });

  it("two concurrent assigns: exactly one succeeds, the other is 409 device_owned; one audit row", async () => {
    const w = await world();
    const actor = await subOf(w.z);
    const d = await inventoryDevice(w.orgId);
    const rs = await Promise.all([
      assignDevice(pool, w.scope, actor, "admin", d, {
        memberId: w.x,
        note: null,
        expiresOn: null,
      }),
      assignDevice(pool, w.scope, actor, "manager", d, {
        memberId: w.y,
        note: null,
        expiresOn: null,
      }),
    ]);
    expect(rs.filter((r) => r.ok)).toHaveLength(1);
    expect(rs.filter((r) => !r.ok)).toEqual([{ ok: false, status: 409, code: "device_owned" }]);
    expect(await auditRows(w.orgId, "device.assign")).toHaveLength(1);
  });

  it("assign to a deactivated member, a missing member or another org's member -> 422 member_not_assignable, device unchanged", async () => {
    const w = await world();
    const other = await world();
    const actor = await subOf(w.z);
    const d = await inventoryDevice(w.orgId);
    await pool.query("update members set status = 'deactivated' where id = $1", [w.y]);
    for (const memberId of [w.y, randomUUID(), other.x]) {
      expect(
        await assignDevice(pool, w.scope, actor, "admin", d, {
          memberId,
          note: null,
          expiresOn: null,
        }),
      ).toEqual({ ok: false, status: 422, code: "member_not_assignable" });
    }
    expect((await holdingOf(d)).owner_id).toBeNull();
    expect(await auditRows(w.orgId, "device.assign")).toHaveLength(0);
  });

  it("assign then delete -> 409 device_owned; a missing device -> 404", async () => {
    const w = await world();
    const actor = await subOf(w.z);
    const d = await inventoryDevice(w.orgId);
    await assignDevice(pool, w.scope, actor, "admin", d, {
      memberId: w.x,
      note: null,
      expiresOn: null,
    });
    expect(await deleteDevice(pool, w.scope, actor, "admin", d)).toEqual({
      ok: false,
      status: 409,
      code: "device_owned",
    });
    expect(
      await assignDevice(pool, w.scope, actor, "admin", randomUUID(), {
        memberId: w.x,
        note: null,
        expiresOn: null,
      }),
    ).toEqual({ ok: false, status: 404, code: "not_found" });
  });

  it("a pending handoff -> 409 handoff_pending", async () => {
    const w = await world();
    const d = await inventoryDevice(w.orgId);
    await addHandoff(pool, w.orgId, d, w.x, "pending");
    expect(
      await assignDevice(pool, w.scope, await subOf(w.z), "admin", d, {
        memberId: w.x,
        note: null,
        expiresOn: null,
      }),
    ).toEqual({ ok: false, status: 409, code: "handoff_pending" });
  });

  it("holding edit: note and expiry change with one device.holding_update row (from/to); unchanged writes none; unowned -> 409 not_assigned", async () => {
    const w = await world();
    const actor = await subOf(w.z);
    const d = await inventoryDevice(w.orgId);
    expect(await updateHolding(pool, w.scope, actor, "admin", d, { note: "x" })).toEqual({
      ok: false,
      status: 409,
      code: "not_assigned",
    });
    await assignDevice(pool, w.scope, actor, "admin", d, {
      memberId: w.x,
      note: "Old",
      expiresOn: "2026-12-01",
    });
    const r = await updateHolding(pool, w.scope, actor, "manager", d, {
      note: "New",
      expiresOn: "2027-01-15",
    });
    expect(r.ok && r.value.holding).toEqual({ note: "New", expiresOn: "2027-01-15" });
    const rows = await auditRows(w.orgId, "device.holding_update");
    expect(rows).toHaveLength(1);
    expect(rows[0].meta).toMatchObject({
      ownerId: w.x,
      fields: ["note", "expiresOn"],
      from: { note: "Old", expiresOn: "2026-12-01" },
      to: { note: "New", expiresOn: "2027-01-15" },
    });
    await updateHolding(pool, w.scope, actor, "manager", d, {
      note: "New",
      expiresOn: "2027-01-15",
    });
    expect(await auditRows(w.orgId, "device.holding_update")).toHaveLength(1);
    const cleared = await updateHolding(pool, w.scope, actor, "admin", d, { expiresOn: null });
    expect(cleared.ok && cleared.value.holding).toEqual({ note: "New", expiresOn: null });
    expect(await updateHolding(pool, w.scope, actor, "user", d, { note: "z" })).toEqual({
      ok: false,
      status: 422,
      code: "not_allowed",
    });
  });
});

describe("devices (db): serial, manufacturer and brand", () => {
  it("create and patch store them; the list DTO carries them; duplicate serial in an org -> 409 serial_taken; another org and null serials are fine", async () => {
    const w = await world();
    const other = await world();
    const sub = await subOf(w.x);
    const a = await createDevice(
      pool,
      w.scope,
      sub,
      "admin",
      dto({ inventoryNumber: "S-1", serial: "SN-1", manufacturer: "Dell", brand: "Latitude" }),
    );
    expect(a.ok && a.value).toMatchObject({
      serial: "SN-1",
      manufacturer: "Dell",
      brand: "Latitude",
    });
    expect(
      await createDevice(
        pool,
        w.scope,
        sub,
        "admin",
        dto({ inventoryNumber: "S-2", serial: "SN-1" }),
      ),
    ).toEqual({ ok: false, status: 409, code: "serial_taken" });
    const b = await createDevice(pool, w.scope, sub, "admin", dto({ inventoryNumber: "S-2" }));
    const c = await createDevice(pool, w.scope, sub, "admin", dto({ inventoryNumber: "S-3" }));
    expect(b.ok && c.ok).toBe(true);
    const bId = b.ok ? b.value.id : "";
    expect(await updateDevice(pool, w.scope, sub, "admin", bId, { serial: "SN-1" })).toEqual({
      ok: false,
      status: 409,
      code: "serial_taken",
    });
    const p = await updateDevice(pool, w.scope, sub, "admin", bId, {
      serial: "SN-2",
      manufacturer: "Nguyễn",
    });
    expect(p.ok && p.value).toMatchObject({ serial: "SN-2", manufacturer: "Nguyễn", brand: null });
    const cleared = await updateDevice(pool, w.scope, sub, "admin", bId, { serial: null });
    expect(cleared.ok && cleared.value.serial).toBeNull();
    const list = await listDevices(pool, w.scope, sub, "admin", "all", TODAY);
    expect(list.ok && list.value.items.find((i) => i.inventoryNumber === "S-1")).toMatchObject({
      serial: "SN-1",
      manufacturer: "Dell",
      brand: "Latitude",
    });
    const cross = await createDevice(
      pool,
      other.scope,
      await subOf(other.x),
      "admin",
      dto({ inventoryNumber: "S-1", serial: "SN-1" }),
    );
    expect(cross.ok).toBe(true);
  });
});

describe("devices (db): pending transfer", () => {
  it("the DTO shows the pending transfer to everyone; canTransfer, canAssign and canDelete are off while pending", async () => {
    const w = await world();
    const d = await addDevice(pool, w.orgId, w.x, null, "secondary");
    const before = await getDevice(pool, w.scope, await subOf(w.x), "user", d, TODAY);
    expect(before.ok && before.value).toMatchObject({ canTransfer: true, pendingHandoff: null });
    const h = await addTransfer(pool, w.orgId, d, w.x, w.y);
    const asOwner = await getDevice(pool, w.scope, await subOf(w.x), "user", d, TODAY);
    expect(asOwner.ok && asOwner.value).toMatchObject({
      canTransfer: false,
      canDelete: false,
      canAssign: false,
      canPlace: true,
      pendingHandoff: {
        id: h,
        kind: "transfer",
        to: { id: w.y },
        requestedBy: { id: w.x },
        canCancel: true,
      },
    });
    const asOther = await getDevice(pool, w.scope, await subOf(w.z), "user", d, TODAY);
    expect(asOther.ok && asOther.value.pendingHandoff).toMatchObject({ id: h, canCancel: false });
    const asManager = await getDevice(pool, w.scope, await subOf(w.z), "manager", d, TODAY);
    expect(asManager.ok && asManager.value.pendingHandoff?.canCancel).toBe(true);
    const listed = await listDevices(pool, w.scope, await subOf(w.z), "user", "all", TODAY);
    expect(listed.ok && listed.value.items.find((i) => i.id === d)?.pendingHandoff?.id).toBe(h);
  });

  it("delete refuses a device with a pending transfer", async () => {
    const w = await world();
    const d = await addDevice(pool, w.orgId, w.x, null, "secondary");
    await addTransfer(pool, w.orgId, d, w.x, w.y);
    const r = await deleteDevice(pool, w.scope, await subOf(w.z), "admin", d);
    expect(r.ok).toBe(false);
    expect(await count("select count(*)::int as n from devices where id = $1", [d])).toBe(1);
  });
});

describe("devices (db): return flags", () => {
  it("canReturn for the owner and a Manager, not another user, not while pending; canTakeBack for an Admin, not while a return is pending", async () => {
    const w = await world();
    const d = await addDevice(pool, w.orgId, w.x, null, "secondary");
    const as = async (m: string, tier: "user" | "manager" | "admin") => {
      const r = await getDevice(pool, w.scope, await subOf(m), tier, d, TODAY);
      return r.ok && r.value;
    };
    expect(await as(w.x, "user")).toMatchObject({ canReturn: true, canTakeBack: false });
    expect(await as(w.z, "user")).toMatchObject({ canReturn: false, canTakeBack: false });
    expect(await as(w.z, "manager")).toMatchObject({ canReturn: true, canTakeBack: false });
    expect(await as(w.z, "admin")).toMatchObject({ canReturn: true, canTakeBack: true });
    const h = await addTransfer(pool, w.orgId, d, w.x, w.y);
    expect(await as(w.z, "admin")).toMatchObject({ canReturn: false, canTakeBack: true });
    await pool.query(
      "update device_handoffs set status = 'cancelled', decided_by_id = $2 where id = $1",
      [h, w.z],
    );
    await addHandoff(pool, w.orgId, d, w.x, "pending");
    expect(await as(w.z, "admin")).toMatchObject({ canReturn: false, canTakeBack: false });
    const free = await addDevice(pool, w.orgId, null, null, "secondary");
    const r = await getDevice(pool, w.scope, await subOf(w.z), "admin", free, TODAY);
    expect(r.ok && r.value).toMatchObject({ canReturn: false, canTakeBack: false });
  });
});
