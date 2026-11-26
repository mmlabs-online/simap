import { randomUUID } from "node:crypto";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DeviceHistoryEntryDto, DeviceHistoryPage } from "@/lib/devices/types";
import { validateDeviceCreate } from "@/lib/validate/device";
import { decodeCursor } from "@/lib/audit/cursor";
import {
  addDevice,
  addMember,
  addRoom,
  addSeat,
  assertTestDb,
  newOrg,
  testPool,
} from "@/test/db/fixtures";
import { deactivateMember } from "@/server/members/manage";
import { assignDevice, createDevice, placeDevice, updateDevice, updateHolding } from "./devices";
import { cancelHandoff, confirmHandoff, declineHandoff, takeBack } from "./handoffs";
import { writeAudit } from "@/server/audit/write";
import { listDeviceHistory } from "./history";

const TODAY = "2026-11-25";

let pool: pg.Pool;

const one = async (sql: string, values: unknown[]) => (await pool.query(sql, values)).rows[0];
const subOf = async (memberId: string) =>
  (await one("select sub from members where id = $1", [memberId])).sub as string;

/** Members x (sits at A-01), y, z (acts as Manager/Admin) with distinct names; Vietnamese on x. */
async function world() {
  const o = newOrg();
  const room = await addRoom(pool, o.orgId, "A", { seatCounter: 2 });
  const x = await addMember(pool, o.orgId);
  const y = await addMember(pool, o.orgId);
  const z = await addMember(pool, o.orgId);
  const a1 = await addSeat(pool, o.orgId, room, "A", 1, { occupantId: x });
  for (const [id, name] of [
    [x, "Nguyễn Văn Ánh"],
    [y, "Yen"],
    [z, "Zed"],
  ] as const) {
    await pool.query("update members set display_name = $2 where id = $1", [id, name]);
  }
  return { ...o, x, y, z, a1, sx: await subOf(x), sy: await subOf(y), sz: await subOf(z) };
}
type W = Awaited<ReturnType<typeof world>>;

const dto = () => {
  const r = validateDeviceCreate({ name: "Laptop", type: "laptop", inventoryNumber: "INV" });
  if (!r.ok) throw new Error("bad fixture");
  return r.value;
};
const okv = <T>(r: { ok: boolean } & ({ ok: true; value: T } | object)): T => {
  if (!r.ok) throw new Error(`refused: ${JSON.stringify(r)}`);
  return (r as { value: T }).value;
};
const history = async (w: W, deviceId: string, limit = 100, cursor?: string) => {
  const c = cursor === undefined ? undefined : (decodeCursor(cursor) ?? undefined);
  return listDeviceHistory(pool, w.scope, deviceId, { limit, cursor: c });
};
const page = async (w: W, deviceId: string, limit = 100): Promise<DeviceHistoryPage> =>
  okv(await history(w, deviceId, limit));
const kinds = (items: DeviceHistoryEntryDto[]) => items.map((i) => i.kind);

type Start =
  | { kind: "transfer"; toMemberId: string; note: string | null }
  | { kind: "return"; note: string | null }
  | { kind: "extension"; newExpiresOn: string; note: string | null };

/**
 * Starts a handoff by writing the pending row and the start audit row with the meta of handoffs.ts
 * (startTransfer / startReturn / startExtension). Not the real service: on this branch its insert is refused by
 * the orgQuery guard (org_id = $1 is not in the text), see the impl-log follow-ups. Confirm, cancel, decline and
 * take-back below are the real services.
 */
async function beginHandoff(w: W, actorSub: string, deviceId: string, v: Start) {
  const dev = await one("select owner_id, inventory_number from devices where id = $1", [deviceId]);
  const me = (await one("select id from members where sub = $1", [actorSub])).id as string;
  const to = v.kind === "transfer" ? v.toMemberId : null;
  const exp = v.kind === "extension" ? v.newExpiresOn : null;
  const ins = await one(
    `insert into device_handoffs (org_id, device_id, kind, from_member_id, to_member_id, requested_by_id, note,
       new_expires_on)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
    [w.orgId, deviceId, v.kind, dev.owner_id, to, me, v.note, exp],
  );
  const meta: Record<string, unknown> = {
    handoffId: ins.id,
    fromMemberId: dev.owner_id,
    inventoryNumber: dev.inventory_number,
    note: v.note,
  };
  if (v.kind === "transfer") meta.toMemberId = v.toMemberId;
  if (v.kind === "extension") meta.newExpiresOn = v.newExpiresOn;
  await writeAudit(pool, w.scope, {
    actorSub,
    action: `device.${v.kind}_start`,
    entity: "device",
    entityId: deviceId,
    meta,
  });
  return { ok: true as const, value: { id: ins.id as string } };
}

beforeAll(async () => {
  pool = testPool();
  await assertTestDb(pool);
});
afterAll(async () => {
  await pool.end();
});

describe("device history (db)", () => {
  it("create -> assign -> holding edit -> transfer start -> confirm -> return start -> confirm -> assign -> take-back: kinds newest first with actor, from/to, note, expiry, confirmedBy", async () => {
    const w = await world();
    const d = okv(await createDevice(pool, w.scope, w.sz, "admin", dto())).id;
    okv(
      await assignDevice(pool, w.scope, w.sz, "manager", d, {
        memberId: w.x,
        note: "first loan",
        expiresOn: "2026-12-31",
      }),
    );
    okv(
      await updateHolding(pool, w.scope, w.sz, "manager", d, {
        note: "edited",
        expiresOn: "2027-01-31",
      }),
    );
    const t = okv(
      await beginHandoff(w, w.sx, d, {
        kind: "transfer",
        toMemberId: w.y,
        note: "to Yen",
      }),
    );
    okv(await confirmHandoff(pool, w.scope, w.sy, "user", t.id, TODAY));
    const r = okv(await beginHandoff(w, w.sy, d, { kind: "return", note: "done" }));
    okv(await confirmHandoff(pool, w.scope, w.sz, "admin", r.id, TODAY));
    okv(
      await assignDevice(pool, w.scope, w.sz, "manager", d, {
        memberId: w.x,
        note: null,
        expiresOn: null,
      }),
    );
    okv(await takeBack(pool, w.scope, w.sz, "admin", d));

    const p = await page(w, d);
    expect(kinds(p.items)).toEqual([
      "return_take_back",
      "assign",
      "return_confirm",
      "return_start",
      "transfer_confirm",
      "transfer_start",
      "holding_update",
      "assign",
      "create",
    ]);
    const byKind = (k: string, n = 0) => p.items.filter((i) => i.kind === k)[n]!;
    const name = (m: { displayName: string } | null) => m?.displayName ?? null;
    expect(name(byKind("create").actor)).toBe("Zed");
    const firstAssign = byKind("assign", 1);
    expect([
      name(firstAssign.to),
      firstAssign.from,
      firstAssign.note,
      firstAssign.expiresOn,
    ]).toEqual(["Nguyễn Văn Ánh", null, "first loan", "2026-12-31"]);
    expect(byKind("holding_update")).toMatchObject({
      note: "edited",
      expiresOn: "2027-01-31",
      fromExpiresOn: "2026-12-31",
    });
    const ts = byKind("transfer_start");
    expect([name(ts.actor), name(ts.from), name(ts.to), ts.note]).toEqual([
      "Nguyễn Văn Ánh",
      "Nguyễn Văn Ánh",
      "Yen",
      "to Yen",
    ]);
    const tc = byKind("transfer_confirm");
    expect([name(tc.from), name(tc.to), name(tc.confirmedBy), tc.note, tc.expiresOn]).toEqual([
      "Nguyễn Văn Ánh",
      "Yen",
      "Yen",
      "to Yen",
      "2027-01-31",
    ]);
    const rs = byKind("return_start");
    expect([name(rs.from), rs.to, rs.note]).toEqual(["Yen", null, "done"]);
    const rc = byKind("return_confirm");
    expect([name(rc.confirmedBy), rc.note]).toEqual(["Zed", "done"]);
    const tb = byKind("return_take_back");
    expect([name(tb.from), tb.to, name(tb.confirmedBy)]).toEqual(["Nguyễn Văn Ánh", null, "Zed"]);
    expect(p.holderSince).toBeNull();
    expect(p.nextCursor).toBeNull();
    expect(p.items[0]!.at).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/);
  });

  it("transfer decline, transfer cancel by a manager, extension start -> confirm (fromExpiresOn/expiresOn), extension decline", async () => {
    const w = await world();
    const d = okv(await createDevice(pool, w.scope, w.sz, "admin", dto())).id;
    okv(
      await assignDevice(pool, w.scope, w.sz, "manager", d, {
        memberId: w.x,
        note: null,
        expiresOn: "2026-12-01",
      }),
    );
    const start = async () =>
      okv(
        await beginHandoff(w, w.sx, d, {
          kind: "transfer",
          toMemberId: w.y,
          note: null,
        }),
      );
    okv(await declineHandoff(pool, w.scope, w.sy, "user", (await start()).id));
    okv(await cancelHandoff(pool, w.scope, w.sz, "manager", (await start()).id));
    const e1 = okv(
      await beginHandoff(w, w.sx, d, {
        kind: "extension",
        newExpiresOn: "2027-03-03",
        note: "need more",
      }),
    );
    okv(await confirmHandoff(pool, w.scope, w.sz, "manager", e1.id, TODAY));
    const e2 = okv(
      await beginHandoff(w, w.sx, d, {
        kind: "extension",
        newExpiresOn: "2027-09-09",
        note: null,
      }),
    );
    okv(await declineHandoff(pool, w.scope, w.sz, "manager", e2.id));

    const items = (await page(w, d)).items;
    const of = (k: string) => items.find((i) => i.kind === k)!;
    expect(of("transfer_decline")).toMatchObject({ cause: null, actor: { displayName: "Yen" } });
    expect(of("transfer_cancel")).toMatchObject({
      cause: "manager",
      actor: { displayName: "Zed" },
    });
    expect(of("extension_confirm")).toMatchObject({
      fromExpiresOn: "2026-12-01",
      expiresOn: "2027-03-03",
      note: "need more",
      confirmedBy: { displayName: "Zed" },
    });
    expect(of("extension_decline")).toMatchObject({ expiresOn: "2027-09-09" });
    expect(items.filter((i) => i.kind === "extension_start").map((i) => i.note)).toEqual([
      null,
      "need more",
    ]);
  });

  it("a deactivated actor and a deactivated from-member keep their display name", async () => {
    const w = await world();
    const d = okv(await createDevice(pool, w.scope, w.sz, "admin", dto())).id;
    okv(
      await assignDevice(pool, w.scope, w.sz, "manager", d, {
        memberId: w.x,
        note: null,
        expiresOn: null,
      }),
    );
    okv(
      await beginHandoff(w, w.sx, d, {
        kind: "transfer",
        toMemberId: w.y,
        note: null,
      }),
    );
    okv(await deactivateMember(pool, w.scope, w.sz, w.x, true));
    const items = (await page(w, d)).items;
    const start = items.find((i) => i.kind === "transfer_start")!;
    expect(start.actor?.displayName).toBe("Nguyễn Văn Ánh");
    expect(start.from?.displayName).toBe("Nguyễn Văn Ánh");
    expect(items.find((i) => i.kind === "transfer_cancel")).toMatchObject({
      cause: "deactivation",
      from: { displayName: "Nguyễn Văn Ánh" },
    });
  });

  it("a user (lowest tier) reads the history; another org's device id and an unknown id are 404 not_found", async () => {
    const w = await world();
    const other = await world();
    const d = okv(await createDevice(pool, w.scope, w.sz, "admin", dto())).id;
    expect((await history(w, d)).ok).toBe(true);
    const notFound = { ok: false, status: 404, code: "not_found" };
    expect(await history(other, d)).toEqual(notFound);
    expect(await history(w, randomUUID())).toEqual(notFound);
  });

  it("rows of another device and of other entities are not returned; device.update and placement rows are excluded", async () => {
    const w = await world();
    const d = okv(await createDevice(pool, w.scope, w.sz, "admin", dto())).id;
    const d2 = okv(
      await createDevice(pool, w.scope, w.sz, "admin", { ...dto(), inventoryNumber: "INV2" }),
    ).id;
    okv(await updateDevice(pool, w.scope, w.sz, "admin", d, { name: "Renamed" }));
    const a2 = await addSeat(
      pool,
      w.orgId,
      (await one("select room_id from seats where id = $1", [w.a1])).room_id,
      "A",
      2,
    );
    okv(
      await assignDevice(pool, w.scope, w.sz, "manager", d, {
        memberId: w.x,
        note: null,
        expiresOn: null,
      }),
    );
    okv(
      await placeDevice(pool, w.scope, w.sx, "manager", d, {
        seatId: a2,
        role: "secondary",
        expectedSeatId: null,
      } as never),
    ).id;
    await pool.query(
      "insert into audit_log (org_id, actor_sub, action, entity, entity_id, meta) values ($1, $2, 'device.assign', 'seat', $3, '{}')",
      [w.orgId, w.sz, d],
    );
    expect(kinds((await page(w, d)).items)).toEqual(["assign", "create"]);
    expect(kinds((await page(w, d2)).items)).toEqual(["create"]);
  });

  it("keyset paging: limit 2 walks all rows with no duplicate or gap, last page nextCursor null", async () => {
    const w = await world();
    const d = await addDevice(pool, w.orgId, null, null, "secondary");
    // two rows with the same created_at in one transaction: the id tiebreak must keep both
    const c = await pool.connect();
    try {
      await c.query("begin");
      for (let i = 0; i < 4; i++) {
        await c.query(
          "insert into audit_log (org_id, actor_sub, action, entity, entity_id, meta) values ($1, $2, 'device.create', 'device', $3, '{}')",
          [w.orgId, w.sz, d],
        );
      }
      await c.query("commit");
    } finally {
      c.release();
    }
    await pool.query(
      "insert into audit_log (org_id, actor_sub, action, entity, entity_id, meta) values ($1, $2, 'device.create', 'device', $3, '{}')",
      [w.orgId, w.sz, d],
    );
    const all = (await page(w, d)).items.map((i) => i.id);
    expect(new Set(all).size).toBe(5);
    const seen: string[] = [];
    let cursor: string | undefined;
    for (let n = 0; n < 5; n++) {
      const r = okv(await history(w, d, 2, cursor));
      seen.push(...r.items.map((i) => i.id));
      if (r.nextCursor === null) break;
      cursor = r.nextCursor;
    }
    expect(seen).toEqual(all);
    expect(cursor).toBeDefined();
    const last = okv(await history(w, d, 2, cursor));
    expect(last.nextCursor).toBeNull();
  });

  it("holderSince = latest assign/transfer_confirm time; null after take-back", async () => {
    const w = await world();
    const d = okv(await createDevice(pool, w.scope, w.sz, "admin", dto())).id;
    expect((await page(w, d)).holderSince).toBeNull();
    okv(
      await assignDevice(pool, w.scope, w.sz, "manager", d, {
        memberId: w.x,
        note: null,
        expiresOn: null,
      }),
    );
    const assignAt = (await page(w, d)).items.find((i) => i.kind === "assign")!.at;
    expect((await page(w, d)).holderSince).toBe(assignAt);
    const t = okv(
      await beginHandoff(w, w.sx, d, {
        kind: "transfer",
        toMemberId: w.y,
        note: null,
      }),
    );
    okv(await confirmHandoff(pool, w.scope, w.sy, "user", t.id, TODAY));
    const p = await page(w, d);
    expect(p.holderSince).toBe(p.items.find((i) => i.kind === "transfer_confirm")!.at);
    okv(await takeBack(pool, w.scope, w.sz, "admin", d));
    expect((await page(w, d)).holderSince).toBeNull();
  });
});
