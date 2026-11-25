import { randomUUID } from "node:crypto";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deviceTypeKey } from "@/lib/device-types/name";
import { DEVICE_TYPE_LIMITS, type DeviceKind } from "@/lib/device-types/types";
import { addMember, assertTestDb, newOrg, testPool, waitForLockWait } from "@/test/db/fixtures";
import { getOrCreateMember } from "@/server/members/members";
import {
  createDeviceType,
  deleteDeviceType,
  listDeviceTypes,
  updateDeviceType,
} from "./device-types";

let pool: pg.Pool;

type Org = ReturnType<typeof newOrg>;

const one = async (sql: string, values: unknown[]) => (await pool.query(sql, values)).rows[0];
const count = async (sql: string, values: unknown[]) => (await one(sql, values)).n as number;
const typeCount = (orgId: string) =>
  count("select count(*)::int as n from device_types where org_id = $1", [orgId]);
const auditCount = (orgId: string, action: string) =>
  count("select count(*)::int as n from audit_log where org_id = $1 and action = $2", [
    orgId,
    action,
  ]);
const SUB = randomUUID();

/** An org that has a member, so the insert trigger has seeded its catalog. */
async function seeded(): Promise<Org> {
  const o = newOrg();
  await addMember(pool, o.orgId);
  return o;
}
const list = async (o: Org) => {
  const r = await listDeviceTypes(pool, o.scope);
  if (!r.ok) throw new Error("list failed");
  return r.value.items;
};
const create = (o: Org, name: string, slot: DeviceKind = "other") =>
  createDeviceType(pool, o.scope, SUB, { name, slot });

beforeAll(async () => {
  pool = testPool();
  await assertTestDb(pool);
});
afterAll(async () => {
  await pool.end();
});

describe("device-types (db)", () => {
  it("a new member's first visit seeds the org once; a second member adds none", async () => {
    const o = newOrg();
    const who = (n: string) => ({ sub: randomUUID(), email: `${n}@simap.example` });
    const first = await getOrCreateMember(pool, o.scope, who("a"));
    expect(first.ok).toBe(true);
    expect(await typeCount(o.orgId)).toBe(5);
    expect(
      await count("select count(*)::int as n from device_type_catalogs where org_id = $1", [
        o.orgId,
      ]),
    ).toBe(1);
    await getOrCreateMember(pool, o.scope, who("b"));
    expect(await typeCount(o.orgId)).toBe(5);
  });

  it("a deleted seed type stays deleted after another member joins", async () => {
    const o = await seeded();
    const monitor = (await list(o)).find((t) => t.name === "Monitor")!;
    expect(await deleteDeviceType(pool, o.scope, SUB, monitor.id)).toEqual({
      ok: true,
      value: { imageFileId: null },
    });
    await addMember(pool, o.orgId);
    expect((await list(o)).map((t) => t.name)).not.toContain("Monitor");
    expect(await typeCount(o.orgId)).toBe(4);
  });

  it("list: seeded types ordered by name; no drive id; hasImage false, imageVersion 0", async () => {
    const o = await seeded();
    const items = await list(o);
    expect(items.map((t) => t.name)).toEqual(["IP phone", "Laptop", "Monitor", "Other", "PC"]);
    expect(items.find((t) => t.name === "IP phone")!.slot).toBe("phone");
    for (const t of items) {
      expect(Object.keys(t).sort()).toEqual(["hasImage", "id", "imageVersion", "name", "slot"]);
      expect([t.hasImage, t.imageVersion]).toEqual([false, 0]);
    }
  });

  it("create returns the DTO and an audit row; duplicates are refused case- and space-insensitively", async () => {
    const o = await seeded();
    expect(await create(o, "Docking station")).toMatchObject({
      ok: true,
      value: { name: "Docking station", slot: "other" },
    });
    expect(await auditCount(o.orgId, "device_type.create")).toBe(1);
    expect(await create(o, "  ip   PHONE ", "phone")).toEqual({
      ok: false,
      status: 409,
      code: "name_taken",
    });
    expect((await create(o, "Máy in")).ok).toBe(true);
    expect(await create(o, "MÁY IN")).toMatchObject({ ok: false, code: "name_taken" });
    expect((await create(o, "May in")).ok).toBe(true);
  });

  it("the same name in two orgs is allowed", async () => {
    const a = await seeded();
    const b = await seeded();
    expect((await create(a, "Printer")).ok).toBe(true);
    expect((await create(b, "Printer")).ok).toBe(true);
  });

  it("rename to own name with another case ok; onto another key 409; slot change ok; no-op writes no audit row", async () => {
    const o = await seeded();
    const items = await list(o);
    const pc = items.find((t) => t.name === "PC")!;
    const laptop = items.find((t) => t.name === "Laptop")!;
    expect(await updateDeviceType(pool, o.scope, SUB, pc.id, { name: "pc" })).toMatchObject({
      ok: true,
      value: { name: "pc" },
    });
    expect(await updateDeviceType(pool, o.scope, SUB, pc.id, { name: "LAPTOP" })).toMatchObject({
      ok: false,
      status: 409,
      code: "name_taken",
    });
    expect(await updateDeviceType(pool, o.scope, SUB, laptop.id, { slot: "pc" })).toMatchObject({
      ok: true,
      value: { name: "Laptop", slot: "pc" },
    });
    expect(await auditCount(o.orgId, "device_type.update")).toBe(2);
    expect(await updateDeviceType(pool, o.scope, SUB, laptop.id, { slot: "pc" })).toMatchObject({
      ok: true,
    });
    expect(await auditCount(o.orgId, "device_type.update")).toBe(2);
  });

  it("delete removes the type and leaves devices untouched", async () => {
    const o = await seeded();
    const owner = await addMember(pool, o.orgId);
    const pc = (await list(o)).find((t) => t.name === "PC")!;
    await pool.query(
      `insert into devices (org_id, name, type, inventory_number, owner_id)
       values ($1, 'd', 'PC', 'INV-1', $2)`,
      [o.orgId, owner],
    );
    expect(await deleteDeviceType(pool, o.scope, SUB, pc.id)).toEqual({
      ok: true,
      value: { imageFileId: null },
    });
    expect(await auditCount(o.orgId, "device_type.delete")).toBe(1);
    expect(
      await count("select count(*)::int as n from devices where org_id = $1 and type = 'PC'", [
        o.orgId,
      ]),
    ).toBe(1);
    expect(await deleteDeviceType(pool, o.scope, SUB, pc.id)).toEqual({
      ok: false,
      status: 404,
      code: "not_found",
    });
  });

  it("org B cannot list, rename, change the slot of or delete org A's type (404, row unchanged)", async () => {
    const a = await seeded();
    const b = await seeded();
    const pc = (await list(a)).find((t) => t.name === "PC")!;
    expect((await list(b)).map((t) => t.id)).not.toContain(pc.id);
    const nf = { ok: false, status: 404, code: "not_found" };
    expect(await updateDeviceType(pool, b.scope, SUB, pc.id, { name: "Hacked" })).toEqual(nf);
    expect(await updateDeviceType(pool, b.scope, SUB, pc.id, { slot: "other" })).toEqual(nf);
    expect(await deleteDeviceType(pool, b.scope, SUB, pc.id)).toEqual(nf);
    expect(await one("select name, slot, org_id from device_types where id = $1", [pc.id])).toEqual(
      { name: "PC", slot: "pc", org_id: a.orgId },
    );
  });

  it("101st type -> 409 type_limit; two concurrent creates at 99 -> exactly one succeeds", async () => {
    const o = await seeded();
    await pool.query(
      `insert into device_types (org_id, name, slot)
       select $1, 'T' || g, 'other' from generate_series(1, 94) g`,
      [o.orgId],
    );
    expect(await typeCount(o.orgId)).toBe(99);
    const holder = await pool.connect();
    try {
      await holder.query("begin");
      await holder.query("select org_id from device_type_catalogs where org_id = $1 for update", [
        o.orgId,
      ]);
      const both = Promise.all([create(o, "Racer A"), create(o, "Racer B")]);
      expect(await waitForLockWait(pool, 5000)).toBe(true);
      await holder.query("commit");
      const results = await both;
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(results.find((r) => !r.ok)).toEqual({ ok: false, status: 409, code: "type_limit" });
    } finally {
      holder.release();
    }
    expect(await typeCount(o.orgId)).toBe(DEVICE_TYPE_LIMITS.perOrg);
    expect(await create(o, "One more")).toEqual({ ok: false, status: 409, code: "type_limit" });
  });

  it("SQL device_type_key equals deviceTypeKey on an ASCII and Vietnamese sample", async () => {
    const sample = [
      "  IP \t PHONE ",
      "MÁY IN",
      "ĐIỆN THOẠI di động",
      "Ơ Ư Ă Â Ê Ô",
      "ẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼẾỀỂỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪỬỮỰỲỴỶỸ",
      "mixed Case 123",
    ];
    for (const s of sample) {
      expect((await one("select device_type_key($1::text) as k", [s])).k).toBe(deviceTypeKey(s));
    }
  });
});
