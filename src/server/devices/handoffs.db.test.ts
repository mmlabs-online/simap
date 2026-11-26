import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
} from "@/test/db/fixtures";
import { getDevice, listDevices, placeDevice } from "./devices";
import {
  cancelHandoff,
  confirmHandoff,
  countHandoffs,
  declineHandoff,
  listHandoffs,
  startExtension,
  startReturn,
  startTransfer,
  takeBack,
} from "./handoffs";

/** The pinned clock for reads: a UTC+7 calendar day. */
const TODAY = "2026-11-25";

let pool: pg.Pool;

const one = async (sql: string, values: unknown[]) => (await pool.query(sql, values)).rows[0];
const count = async (sql: string, values: unknown[]) => (await one(sql, values)).n as number;
const auditRows = async (orgId: string, action: string) =>
  (
    await pool.query("select meta from audit_log where org_id = $1 and action = $2", [
      orgId,
      action,
    ])
  ).rows;
const subOf = async (memberId: string) =>
  (await one("select sub from members where id = $1", [memberId])).sub as string;
const dev = (id: string) =>
  one(
    "select owner_id, seat_id, role, holding_note, holding_expires_on from devices where id = $1",
    [id],
  );
const handoff = (id: string) => one("select * from device_handoffs where id = $1", [id]);

/** Members x (owner, sits at A-01), y (recipient), z (acts as Manager); seat A-02 is free. */
async function world() {
  const o = newOrg();
  const room = await addRoom(pool, o.orgId, "A", { seatCounter: 2 });
  const x = await addMember(pool, o.orgId);
  const y = await addMember(pool, o.orgId);
  const z = await addMember(pool, o.orgId);
  const a1 = await addSeat(pool, o.orgId, room, "A", 1, { occupantId: x });
  const a2 = await addSeat(pool, o.orgId, room, "A", 2);
  return { ...o, x, y, z, a1, a2, sx: await subOf(x), sy: await subOf(y), sz: await subOf(z) };
}
type W = Awaited<ReturnType<typeof world>>;
const body = (to: string, note: string | null = null) => ({
  kind: "transfer" as const,
  toMemberId: to,
  note,
});
const start = (w: W, sub: string, tier: "user" | "manager" | "admin", d: string, to: string) =>
  startTransfer(pool, w.scope, sub, tier, d, body(to));
const refusal = (status: number, code: string) => ({ ok: false, status, code });

beforeAll(async () => {
  pool = testPool();
  await assertTestDb(pool);
});
afterAll(async () => {
  await pool.end();
});

describe("handoffs (db): start", () => {
  it("owner (user) starts: pending row, device unchanged, one audit row", async () => {
    const w = await world();
    const d = await addDevice(pool, w.orgId, w.x, w.a1, "primary");
    const before = await dev(d);
    const r = await startTransfer(pool, w.scope, w.sx, "user", d, body(w.y, "for Huong"));
    expect(r.ok && r.value).toMatchObject({
      kind: "transfer",
      status: "pending",
      from: { id: w.x },
      to: { id: w.y },
      requestedBy: { id: w.x },
      note: "for Huong",
      canCancel: true,
      canConfirm: false,
      canDecline: false,
    });
    expect(await dev(d)).toEqual(before);
    const rows = await auditRows(w.orgId, "device.transfer_start");
    expect(rows).toHaveLength(1);
    expect(rows[0].meta).toMatchObject({ fromMemberId: w.x, toMemberId: w.y, note: "for Huong" });
  });

  it("a user on another's device: 422, no row, no audit", async () => {
    const w = await world();
    const d = await addDevice(pool, w.orgId, w.x, null, "secondary");
    expect(await start(w, w.sy, "user", d, w.z)).toEqual(refusal(422, "not_allowed"));
    expect(
      await count("select count(*)::int as n from device_handoffs where org_id = $1", [w.orgId]),
    ).toBe(0);
    expect(await auditRows(w.orgId, "device.transfer_start")).toHaveLength(0);
  });

  it("a manager starts for another's device: requested_by = manager, from = owner", async () => {
    const w = await world();
    const d = await addDevice(pool, w.orgId, w.x, null, "secondary");
    const r = await start(w, w.sz, "manager", d, w.y);
    expect(r.ok && r.value).toMatchObject({ from: { id: w.x }, requestedBy: { id: w.z } });
  });

  it("refuses an unowned device, the owner as recipient, an inactive or foreign recipient", async () => {
    const w = await world();
    const other = newOrg();
    const foreign = await addMember(pool, other.orgId);
    const d = await addDevice(pool, w.orgId, w.x, null, "secondary");
    const unowned = await addDevice(pool, w.orgId, null, null, "secondary");
    expect(await start(w, w.sz, "manager", unowned, w.y)).toEqual(refusal(422, "device_unowned"));
    expect(await start(w, w.sx, "user", d, w.x)).toEqual(refusal(422, "invalid_recipient"));
    expect(await start(w, w.sx, "user", d, foreign)).toEqual(refusal(422, "member_not_assignable"));
    await pool.query("update members set status = 'deactivated' where id = $1", [w.y]);
    expect(await start(w, w.sx, "user", d, w.y)).toEqual(refusal(422, "member_not_assignable"));
    expect(
      await count("select count(*)::int as n from device_handoffs where org_id = $1", [w.orgId]),
    ).toBe(0);
    expect(await auditRows(w.orgId, "device.transfer_start")).toHaveLength(0);
  });

  it("a second start is 409 handoff_pending; the raw second insert hits the unique index", async () => {
    const w = await world();
    const d = await addDevice(pool, w.orgId, w.x, null, "secondary");
    expect((await start(w, w.sx, "user", d, w.y)).ok).toBe(true);
    expect(await start(w, w.sx, "user", d, w.z)).toEqual(refusal(409, "handoff_pending"));
    await expect(addTransfer(pool, w.orgId, d, w.x, w.z)).rejects.toMatchObject({
      code: "23505",
      constraint: "device_handoffs_one_pending_idx",
    });
  });

  it("two concurrent starts: one 201, one 409", async () => {
    const w = await world();
    const d = await addDevice(pool, w.orgId, w.x, null, "secondary");
    const rs = await Promise.all([start(w, w.sx, "user", d, w.y), start(w, w.sx, "user", d, w.z)]);
    expect(rs.filter((r) => r.ok)).toHaveLength(1);
    expect(rs.find((r) => !r.ok)).toEqual(refusal(409, "handoff_pending"));
  });

  it("start leaves owner, seat, role and holding unchanged; placement while pending is allowed", async () => {
    const w = await world();
    const d = await addDevice(pool, w.orgId, w.x, w.a1, "primary");
    await pool.query(
      "update devices set holding_note = 'n', holding_expires_on = '2027-01-31' where id = $1",
      [d],
    );
    const before = await dev(d);
    await start(w, w.sx, "user", d, w.y);
    expect(await dev(d)).toEqual(before);
    const moved = await placeDevice(pool, w.scope, w.sx, "manager", d, {
      seatId: w.a2,
      role: "secondary",
      expectedSeatId: w.a1,
    });
    expect(moved.ok).toBe(true);
  });
});

describe("handoffs (db): cancel and decline", () => {
  it("sender cancels, a manager cancels another's; decided_by_id and decided_at are set", async () => {
    const w = await world();
    const d1 = await addDevice(pool, w.orgId, w.x, null, "secondary");
    const d2 = await addDevice(pool, w.orgId, w.x, null, "secondary");
    const h1 = await addTransfer(pool, w.orgId, d1, w.x, w.y);
    const h2 = await addTransfer(pool, w.orgId, d2, w.x, w.y);
    const r1 = await cancelHandoff(pool, w.scope, w.sx, "user", h1);
    expect(r1.ok && r1.value).toMatchObject({ status: "cancelled", decidedBy: { id: w.x } });
    const r2 = await cancelHandoff(pool, w.scope, w.sz, "manager", h2);
    expect(r2.ok && r2.value.decidedBy?.id).toBe(w.z);
    expect((await handoff(h2)).decided_at).not.toBeNull();
    const rows = await auditRows(w.orgId, "device.transfer_cancel");
    expect(rows.map((r) => r.meta.byManager).sort()).toEqual([false, true]);
  });

  it("the recipient (a user) cannot cancel; a stranger cannot decline; the sender cannot decline", async () => {
    const w = await world();
    const d = await addDevice(pool, w.orgId, w.x, null, "secondary");
    const h = await addTransfer(pool, w.orgId, d, w.x, w.y);
    expect(await cancelHandoff(pool, w.scope, w.sy, "user", h)).toEqual(
      refusal(422, "not_allowed"),
    );
    expect(await declineHandoff(pool, w.scope, w.sz, "manager", h)).toEqual(
      refusal(422, "not_allowed"),
    );
    expect(await declineHandoff(pool, w.scope, w.sx, "user", h)).toEqual(
      refusal(422, "not_allowed"),
    );
    expect((await handoff(h)).status).toBe("pending");
    expect(await auditRows(w.orgId, "device.transfer_cancel")).toHaveLength(0);
  });

  it("the recipient declines: declined, device unchanged, second call 409", async () => {
    const w = await world();
    const d = await addDevice(pool, w.orgId, w.x, w.a1, "primary");
    const before = await dev(d);
    const h = await addTransfer(pool, w.orgId, d, w.x, w.y);
    const r = await declineHandoff(pool, w.scope, w.sy, "user", h);
    expect(r.ok && r.value).toMatchObject({ status: "declined", decidedBy: { id: w.y } });
    expect(await dev(d)).toEqual(before);
    expect(await cancelHandoff(pool, w.scope, w.sx, "user", h)).toEqual(
      refusal(409, "handoff_not_pending"),
    );
    expect(await auditRows(w.orgId, "device.transfer_decline")).toHaveLength(1);
  });

  it("an unknown id and an id of another org are 404", async () => {
    const w = await world();
    const o = await world();
    const d = await addDevice(pool, o.orgId, o.x, null, "secondary");
    const h = await addTransfer(pool, o.orgId, d, o.x, o.y);
    expect(await cancelHandoff(pool, w.scope, w.sx, "admin", h)).toEqual(refusal(404, "not_found"));
  });
});

describe("handoffs (db): confirm", () => {
  it("a primary device: owner = recipient, seat null, role secondary, holding unchanged, audit meta", async () => {
    const w = await world();
    const d = await addDevice(pool, w.orgId, w.x, w.a1, "primary");
    await pool.query(
      "update devices set holding_note = 'n', holding_expires_on = '2027-01-31' where id = $1",
      [d],
    );
    const h = await addTransfer(pool, w.orgId, d, w.x, w.y);
    const before = await dev(d);
    const r = await confirmHandoff(pool, w.scope, w.sy, "user", h, TODAY);
    expect(r.ok && r.value).toMatchObject({ status: "confirmed", decidedBy: { id: w.y } });
    const after = await dev(d);
    expect(after).toMatchObject({ owner_id: w.y, seat_id: null, role: "secondary" });
    expect(after.holding_note).toBe(before.holding_note);
    expect(after.holding_expires_on).toEqual(before.holding_expires_on);
    expect(
      await count(
        "select count(*)::int as n from devices where seat_id = $1 and role = 'primary'",
        [w.a1],
      ),
    ).toBe(0);
    const rows = await auditRows(w.orgId, "device.transfer_confirm");
    expect(rows).toHaveLength(1);
    expect(rows[0].meta).toMatchObject({
      fromSeatId: w.a1,
      fromCode: "A-01",
      demoted: true,
      expiresOn: "2027-01-31",
    });
  });

  it("an unplaced device moves to the recipient's inventory", async () => {
    const w = await world();
    const d = await addDevice(pool, w.orgId, w.x, null, "secondary");
    const h = await addTransfer(pool, w.orgId, d, w.x, w.y);
    expect((await confirmHandoff(pool, w.scope, w.sy, "user", h, TODAY)).ok).toBe(true);
    expect(await dev(d)).toMatchObject({ owner_id: w.y, seat_id: null });
    expect((await auditRows(w.orgId, "device.transfer_confirm"))[0].meta).toMatchObject({
      fromSeatId: null,
      demoted: false,
    });
  });

  it("a manager who is not the recipient cannot confirm (422)", async () => {
    const w = await world();
    const d = await addDevice(pool, w.orgId, w.x, null, "secondary");
    const h = await addTransfer(pool, w.orgId, d, w.x, w.y);
    expect(await confirmHandoff(pool, w.scope, w.sz, "admin", h, TODAY)).toEqual(
      refusal(422, "not_allowed"),
    );
    expect(await dev(d)).toMatchObject({ owner_id: w.x });
    expect(await auditRows(w.orgId, "device.transfer_confirm")).toHaveLength(0);
  });

  it("after cancel and on repeat: 409 handoff_not_pending", async () => {
    const w = await world();
    const d = await addDevice(pool, w.orgId, w.x, null, "secondary");
    const h = await addTransfer(pool, w.orgId, d, w.x, w.y);
    await cancelHandoff(pool, w.scope, w.sx, "user", h);
    expect(await confirmHandoff(pool, w.scope, w.sy, "user", h, TODAY)).toEqual(
      refusal(409, "handoff_not_pending"),
    );
    const d2 = await addDevice(pool, w.orgId, w.x, null, "secondary");
    const h2 = await addTransfer(pool, w.orgId, d2, w.x, w.y);
    expect((await confirmHandoff(pool, w.scope, w.sy, "user", h2, TODAY)).ok).toBe(true);
    expect(await confirmHandoff(pool, w.scope, w.sy, "user", h2, TODAY)).toEqual(
      refusal(409, "handoff_not_pending"),
    );
  });

  it("the owner changed behind the handoff: 409 handoff_stale", async () => {
    const w = await world();
    const d = await addDevice(pool, w.orgId, w.x, null, "secondary");
    const h = await addTransfer(pool, w.orgId, d, w.x, w.y);
    await pool.query("update devices set owner_id = $2 where id = $1", [d, w.z]);
    expect(await confirmHandoff(pool, w.scope, w.sy, "user", h, TODAY)).toEqual(
      refusal(409, "handoff_stale"),
    );
    expect((await handoff(h)).status).toBe("pending");
  });

  it("a recipient deactivated before confirm: 422 member_not_assignable", async () => {
    const w = await world();
    const d = await addDevice(pool, w.orgId, w.x, null, "secondary");
    const h = await addTransfer(pool, w.orgId, d, w.x, w.y);
    await pool.query("update members set status = 'deactivated' where id = $1", [w.y]);
    expect(await confirmHandoff(pool, w.scope, w.sy, "user", h, TODAY)).toEqual(
      refusal(422, "member_not_assignable"),
    );
  });

  it("confirm vs concurrent cancel: exactly one wins, the loser is 409", async () => {
    const w = await world();
    const d = await addDevice(pool, w.orgId, w.x, w.a1, "primary");
    const h = await addTransfer(pool, w.orgId, d, w.x, w.y);
    const rs = await Promise.all([
      confirmHandoff(pool, w.scope, w.sy, "user", h, TODAY),
      cancelHandoff(pool, w.scope, w.sx, "user", h),
    ]);
    expect(rs.filter((r) => r.ok)).toHaveLength(1);
    expect(rs.find((r) => !r.ok)).toMatchObject({ status: 409, code: "handoff_not_pending" });
  });

  it("confirm vs concurrent placement: no deadlock, final state consistent", async () => {
    const w = await world();
    const d = await addDevice(pool, w.orgId, w.x, w.a1, "primary");
    const h = await addTransfer(pool, w.orgId, d, w.x, w.y);
    const [c, p] = await Promise.all([
      confirmHandoff(pool, w.scope, w.sy, "user", h, TODAY),
      placeDevice(pool, w.scope, w.sx, "manager", d, {
        seatId: w.a2,
        role: "secondary",
        expectedSeatId: w.a1,
      }),
    ]);
    expect(c.ok).toBe(true);
    expect(await dev(d)).toMatchObject({ owner_id: w.y, seat_id: null, role: "secondary" });
    if (!p.ok) expect([409, 422]).toContain(p.status);
  });
});

describe("handoffs (db): list and count", () => {
  it("incoming lists only pending to me in my org, newest first; decided and other-org rows are excluded", async () => {
    const w = await world();
    const d1 = await addDevice(pool, w.orgId, w.x, null, "secondary");
    const d2 = await addDevice(pool, w.orgId, w.x, null, "secondary");
    const d3 = await addDevice(pool, w.orgId, w.x, null, "secondary");
    const h1 = await addTransfer(pool, w.orgId, d1, w.x, w.y);
    await pool.query(
      "update device_handoffs set created_at = now() - interval '1 hour' where id = $1",
      [h1],
    );
    const h2 = await addTransfer(pool, w.orgId, d2, w.x, w.y);
    const h3 = await addTransfer(pool, w.orgId, d3, w.x, w.z);
    await cancelHandoff(pool, w.scope, w.sx, "user", h3);
    const o = await world();
    const od = await addDevice(pool, o.orgId, o.x, null, "secondary");
    await addTransfer(pool, o.orgId, od, o.x, o.y);

    const r = await listHandoffs(pool, w.scope, w.sy, "user", "incoming");
    expect(r.ok && r.value.items.map((i) => i.id)).toEqual([h2, h1]);
    expect(r.ok && r.value.items[0]).toMatchObject({
      canConfirm: true,
      canDecline: true,
      canCancel: false,
    });
    expect(r.ok && r.value.truncated).toBe(false);
    expect(await countHandoffs(pool, w.scope, w.sy, "user", TODAY)).toEqual({
      ok: true,
      value: { incoming: 2, returns: 0, extensions: 0, overdue: 0 },
    });
    expect(await countHandoffs(pool, w.scope, w.sz, "user", TODAY)).toEqual({
      ok: true,
      value: { incoming: 0, returns: 0, extensions: 0, overdue: 0 },
    });
    expect(
      await countHandoffs(pool, w.scope, "00000000-0000-4000-8000-000000000000", "user", TODAY),
    ).toEqual({
      ok: true,
      value: { incoming: 0, returns: 0, extensions: 0, overdue: 0 },
    });
  });
});

describe("handoffs (db): every decision sets decided_by_id", () => {
  it("decided_by_id is null only while pending", async () => {
    const w = await world();
    const d = await addDevice(pool, w.orgId, w.x, null, "secondary");
    const h = await addTransfer(pool, w.orgId, d, w.x, w.y);
    expect((await handoff(h)).decided_by_id).toBeNull();
    await declineHandoff(pool, w.scope, w.sy, "user", h);
    expect((await handoff(h)).decided_by_id).toBe(w.y);
  });
});

const ret = (note: string | null = null) => ({ kind: "return" as const, note });

describe("handoffs (db): return", () => {
  it("owner starts; nothing else changes; manager starts for another's device", async () => {
    const w = await world();
    const d = await addDevice(pool, w.orgId, w.x, w.a1, "primary");
    const before = await dev(d);
    const r = await startReturn(pool, w.scope, w.sx, "user", d, ret("done"));
    expect(r.ok && r.value).toMatchObject({
      kind: "return",
      status: "pending",
      from: { id: w.x },
      to: null,
      note: "done",
      canCancel: true,
      canConfirm: false,
      canDecline: false,
    });
    expect(await dev(d)).toEqual(before);
    expect(await auditRows(w.orgId, "device.return_start")).toHaveLength(1);
    const d2 = await addDevice(pool, w.orgId, w.y, null, "secondary");
    const m = await startReturn(pool, w.scope, w.sz, "manager", d2, ret());
    expect(m.ok && m.value).toMatchObject({ from: { id: w.y }, requestedBy: { id: w.z } });
  });

  it("refusals write no row and no audit", async () => {
    const w = await world();
    const d = await addDevice(pool, w.orgId, w.x, null, "secondary");
    const free = await addDevice(pool, w.orgId, null, null, "secondary");
    expect(await startReturn(pool, w.scope, w.sy, "user", d, ret())).toEqual(
      refusal(422, "not_allowed"),
    );
    expect(await startReturn(pool, w.scope, w.sz, "manager", free, ret())).toEqual(
      refusal(422, "device_unowned"),
    );
    await startReturn(pool, w.scope, w.sx, "user", d, ret());
    expect(await startReturn(pool, w.scope, w.sx, "user", d, ret())).toEqual(
      refusal(409, "handoff_pending"),
    );
    expect(
      await count("select count(*)::int as n from device_handoffs where device_id = $1", [d]),
    ).toBe(1);
    expect(await auditRows(w.orgId, "device.return_start")).toHaveLength(1);
  });

  it("cancel by owner or manager; decline and a stranger are refused", async () => {
    const w = await world();
    const d = await addDevice(pool, w.orgId, w.x, null, "secondary");
    const h = await addHandoff(pool, w.orgId, d, w.x, "pending");
    expect(await declineHandoff(pool, w.scope, w.sx, "user", h)).toEqual(
      refusal(422, "not_allowed"),
    );
    expect(await cancelHandoff(pool, w.scope, w.sy, "user", h)).toEqual(
      refusal(422, "not_allowed"),
    );
    const c = await cancelHandoff(pool, w.scope, w.sz, "manager", h);
    expect(c.ok && c.value).toMatchObject({ status: "cancelled", decidedBy: { id: w.z } });
    const rows = await auditRows(w.orgId, "device.return_cancel");
    expect(rows).toHaveLength(1);
    expect(rows[0].meta).toMatchObject({ byManager: true });
    const h2 = await addHandoff(pool, w.orgId, d, w.x, "pending");
    expect((await cancelHandoff(pool, w.scope, w.sx, "user", h2)).ok).toBe(true);
  });

  it("confirm of a placed primary device clears owner, seat, note and expiry", async () => {
    const w = await world();
    const d = await addDevice(pool, w.orgId, w.x, w.a1, "primary");
    await pool.query(
      "update devices set holding_note = 'n', holding_expires_on = current_date + 5 where id = $1",
      [d],
    );
    const h = await addHandoff(pool, w.orgId, d, w.x, "pending");
    expect(await confirmHandoff(pool, w.scope, w.sz, "manager", h, TODAY)).toEqual(
      refusal(422, "not_allowed"),
    );
    expect(await confirmHandoff(pool, w.scope, w.sx, "user", h, TODAY)).toEqual(
      refusal(422, "not_allowed"),
    );
    const r = await confirmHandoff(pool, w.scope, w.sy, "admin", h, TODAY);
    expect(r.ok && r.value).toMatchObject({ status: "confirmed", decidedBy: { id: w.y } });
    expect(await dev(d)).toMatchObject({
      owner_id: null,
      seat_id: null,
      role: "secondary",
      holding_note: null,
      holding_expires_on: null,
    });
    const rows = await auditRows(w.orgId, "device.return_confirm");
    expect(rows[0].meta).toMatchObject({ fromCode: "A-01", demoted: true, fromMemberId: w.x });
    expect(rows[0].meta.expiresOn).not.toBeNull();
    expect(await confirmHandoff(pool, w.scope, w.sy, "admin", h, TODAY)).toEqual(
      refusal(409, "handoff_not_pending"),
    );
  });

  it("an Admin who owns the device confirms; a stale owner is 409", async () => {
    const w = await world();
    const d = await addDevice(pool, w.orgId, w.y, null, "secondary");
    const h = await addHandoff(pool, w.orgId, d, w.y, "pending");
    expect((await confirmHandoff(pool, w.scope, w.sy, "admin", h, TODAY)).ok).toBe(true);
    expect(await dev(d)).toMatchObject({ owner_id: null });
    const d2 = await addDevice(pool, w.orgId, w.x, null, "secondary");
    const h2 = await addHandoff(pool, w.orgId, d2, w.x, "pending");
    await pool.query("update devices set owner_id = $2 where id = $1", [d2, w.z]);
    expect(await confirmHandoff(pool, w.scope, w.sy, "admin", h2, TODAY)).toEqual(
      refusal(409, "handoff_stale"),
    );
  });

  it("confirm vs concurrent cancel: exactly one wins", async () => {
    const w = await world();
    const d = await addDevice(pool, w.orgId, w.x, w.a1, "primary");
    const h = await addHandoff(pool, w.orgId, d, w.x, "pending");
    const [a, b] = await Promise.all([
      confirmHandoff(pool, w.scope, w.sy, "admin", h, TODAY),
      cancelHandoff(pool, w.scope, w.sx, "user", h),
    ]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    const loser = a.ok ? b : a;
    expect(!loser.ok && loser.code).toBe("handoff_not_pending");
  });
});

describe("handoffs (db): take-back", () => {
  it("clears an owned placed device with no request; one audit row", async () => {
    const w = await world();
    const d = await addDevice(pool, w.orgId, w.x, w.a1, "primary");
    const r = await takeBack(pool, w.scope, w.sy, "admin", d);
    expect(r.ok && r.value).toMatchObject({ owner: null, placement: null });
    expect(await dev(d)).toMatchObject({ owner_id: null, seat_id: null, role: "secondary" });
    const rows = await auditRows(w.orgId, "device.return_take_back");
    expect(rows).toHaveLength(1);
    expect(rows[0].meta).toMatchObject({ byAdmin: true, fromMemberId: w.x });
  });

  it("works on a deactivated member's device", async () => {
    const w = await world();
    const d = await addDevice(pool, w.orgId, w.x, null, "secondary");
    await pool.query("update members set status = 'deactivated' where id = $1", [w.x]);
    expect((await takeBack(pool, w.scope, w.sy, "admin", d)).ok).toBe(true);
  });

  it("cancels a pending transfer; refuses a pending return, unowned, non-Admin, other org", async () => {
    const w = await world();
    const d = await addDevice(pool, w.orgId, w.x, w.a1, "primary");
    const h = await addTransfer(pool, w.orgId, d, w.x, w.y);
    expect((await takeBack(pool, w.scope, w.sz, "admin", d)).ok).toBe(true);
    expect(await handoff(h)).toMatchObject({ status: "cancelled", decided_by_id: w.z });
    const cancel = await auditRows(w.orgId, "device.transfer_cancel");
    expect(cancel[0].meta).toMatchObject({ byTakeBack: true });

    const d2 = await addDevice(pool, w.orgId, w.x, null, "secondary");
    await addHandoff(pool, w.orgId, d2, w.x, "pending");
    expect(await takeBack(pool, w.scope, w.sz, "admin", d2)).toEqual(
      refusal(409, "handoff_pending"),
    );
    expect(await dev(d2)).toMatchObject({ owner_id: w.x });
    expect(await takeBack(pool, w.scope, w.sz, "admin", d)).toEqual(refusal(422, "device_unowned"));
    expect(await takeBack(pool, w.scope, w.sz, "manager", d2)).toEqual(refusal(422, "not_allowed"));
    const o = await world();
    expect(await takeBack(pool, o.scope, o.sz, "admin", d2)).toEqual(refusal(404, "not_found"));
  });

  it("take-back vs transfer confirm: one wins, no deadlock", async () => {
    const w = await world();
    const d = await addDevice(pool, w.orgId, w.x, w.a1, "primary");
    const h = await addTransfer(pool, w.orgId, d, w.x, w.y);
    const [a, b] = await Promise.all([
      takeBack(pool, w.scope, w.sz, "admin", d),
      confirmHandoff(pool, w.scope, w.sy, "user", h, TODAY),
    ]);
    expect(a.ok || b.ok).toBe(true);
    for (const r of [a, b]) if (!r.ok) expect([409, 422]).toContain(r.status);
  });
});

describe("handoffs (db): returns list and count", () => {
  it("lists pending returns of my org for an Admin only; counts follow the tier", async () => {
    const w = await world();
    const mk = () => addDevice(pool, w.orgId, w.x, null, "secondary");
    const h1 = await addHandoff(pool, w.orgId, await mk(), w.x, "pending");
    await pool.query(
      "update device_handoffs set created_at = now() - interval '1 hour' where id = $1",
      [h1],
    );
    const h2 = await addHandoff(pool, w.orgId, await mk(), w.x, "pending");
    await addHandoff(pool, w.orgId, await mk(), w.x, "cancelled");
    await addTransfer(pool, w.orgId, await mk(), w.x, w.y);
    const o = await world();
    const od = await addDevice(pool, o.orgId, o.x, null, "secondary");
    await addHandoff(pool, o.orgId, od, o.x, "pending");

    const r = await listHandoffs(pool, w.scope, w.sz, "admin", "returns");
    expect(r.ok && r.value.items.map((i) => i.id)).toEqual([h2, h1]);
    expect(r.ok && r.value.items[0]).toMatchObject({ canConfirm: true, canDecline: false });
    expect(await listHandoffs(pool, w.scope, w.sz, "manager", "returns")).toEqual(
      refusal(422, "not_allowed"),
    );
    expect(await countHandoffs(pool, w.scope, w.sz, "admin", TODAY)).toEqual({
      ok: true,
      value: { incoming: 0, returns: 2, extensions: 0, overdue: 0 },
    });
    expect(await countHandoffs(pool, w.scope, w.sz, "manager", TODAY)).toEqual({
      ok: true,
      value: { incoming: 0, returns: 0, extensions: 0, overdue: 0 },
    });
    expect(await countHandoffs(pool, w.scope, w.sy, "user", TODAY)).toEqual({
      ok: true,
      value: { incoming: 1, returns: 0, extensions: 0, overdue: 0 },
    });
  });
});

const setExpiry = (d: string, day: string | null) =>
  pool.query("update devices set holding_expires_on = $2 where id = $1", [d, day]);
const ext = (day: string, note: string | null = null) => ({
  kind: "extension" as const,
  newExpiresOn: day,
  note,
});

describe("handoffs (db): extension", () => {
  it("owner starts: pending, device unchanged, audit, DTO and pendingHandoff carry the new date", async () => {
    const w = await world();
    const d = await addDevice(pool, w.orgId, w.x, null, "secondary");
    await setExpiry(d, "2026-11-20");
    const r = await startExtension(pool, w.scope, w.sx, "user", d, ext("2026-12-31", "need it"));
    expect(r.ok && r.value).toMatchObject({
      kind: "extension",
      status: "pending",
      from: { id: w.x },
      to: null,
      newExpiresOn: "2026-12-31",
      note: "need it",
      canCancel: true,
      canConfirm: false,
      canDecline: false,
    });
    const g = await getDevice(pool, w.scope, w.sx, "user", d, TODAY);
    expect(g.ok && g.value.holding?.expiresOn).toBe("2026-11-20");
    expect(g.ok && g.value.pendingHandoff).toMatchObject({
      kind: "extension",
      newExpiresOn: "2026-12-31",
      to: null,
    });
    const rows = await auditRows(w.orgId, "device.extension_start");
    expect(rows).toHaveLength(1);
    expect(rows[0].meta).toMatchObject({ newExpiresOn: "2026-12-31", note: "need it" });
  });

  it("refusals: another user and a Manager 422, unowned 422, second pending 409, transfer pending 409; no rows", async () => {
    const w = await world();
    const d = await addDevice(pool, w.orgId, w.x, null, "secondary");
    expect(await startExtension(pool, w.scope, w.sy, "user", d, ext("2026-12-31"))).toEqual(
      refusal(422, "not_allowed"),
    );
    expect(await startExtension(pool, w.scope, w.sz, "manager", d, ext("2026-12-31"))).toEqual(
      refusal(422, "not_allowed"),
    );
    const free = await addDevice(pool, w.orgId, null, null, "secondary");
    expect(await startExtension(pool, w.scope, w.sx, "user", free, ext("2026-12-31"))).toEqual(
      refusal(422, "device_unowned"),
    );
    expect(
      await count("select count(*)::int as n from device_handoffs where org_id = $1", [w.orgId]),
    ).toBe(0);
    expect((await startExtension(pool, w.scope, w.sx, "user", d, ext("2026-12-31"))).ok).toBe(true);
    expect(await startExtension(pool, w.scope, w.sx, "user", d, ext("2027-01-31"))).toEqual(
      refusal(409, "handoff_pending"),
    );
    const t = await addDevice(pool, w.orgId, w.x, null, "secondary");
    await addTransfer(pool, w.orgId, t, w.x, w.y);
    expect(await startExtension(pool, w.scope, w.sx, "user", t, ext("2026-12-31"))).toEqual(
      refusal(409, "handoff_pending"),
    );
  });

  it("approve (Manager) sets holding_expires_on, records decided_by and audits from/to", async () => {
    const w = await world();
    const d = await addDevice(pool, w.orgId, w.x, null, "secondary");
    await setExpiry(d, "2026-11-20");
    const s = await startExtension(pool, w.scope, w.sx, "user", d, ext("2026-12-31"));
    const h = s.ok ? s.value.id : "";
    const r = await confirmHandoff(pool, w.scope, w.sz, "manager", h, TODAY);
    expect(r.ok && r.value).toMatchObject({ status: "confirmed", decidedBy: { id: w.z } });
    const g = await getDevice(pool, w.scope, w.sx, "user", d, TODAY);
    expect(g.ok && g.value.holding?.expiresOn).toBe("2026-12-31");
    expect(g.ok && g.value.overdue).toBe(false);
    const rows = await auditRows(w.orgId, "device.extension_confirm");
    expect(rows).toHaveLength(1);
    expect(rows[0].meta).toMatchObject({ fromExpiresOn: "2026-11-20", toExpiresOn: "2026-12-31" });
  });

  it("approve or reject by the owner or another user: 422, nothing written", async () => {
    const w = await world();
    const d = await addDevice(pool, w.orgId, w.x, null, "secondary");
    await setExpiry(d, "2026-11-20");
    const s = await startExtension(pool, w.scope, w.sx, "user", d, ext("2026-12-31"));
    const h = s.ok ? s.value.id : "";
    for (const sub of [w.sx, w.sy]) {
      expect(await confirmHandoff(pool, w.scope, sub, "user", h, TODAY)).toEqual(
        refusal(422, "not_allowed"),
      );
      expect(await declineHandoff(pool, w.scope, sub, "user", h)).toEqual(
        refusal(422, "not_allowed"),
      );
    }
    expect((await handoff(h)).status).toBe("pending");
    expect(await auditRows(w.orgId, "device.extension_confirm")).toHaveLength(0);
  });

  it("approve with a date no longer after today -> 409 handoff_stale; the owner changing -> 409 too", async () => {
    const w = await world();
    const d = await addDevice(pool, w.orgId, w.x, null, "secondary");
    const s = await startExtension(pool, w.scope, w.sx, "user", d, ext("2026-12-01"));
    const h = s.ok ? s.value.id : "";
    expect(await confirmHandoff(pool, w.scope, w.sz, "manager", h, "2026-12-01")).toEqual(
      refusal(409, "handoff_stale"),
    );
    await pool.query("update devices set owner_id = $2 where id = $1", [d, w.y]);
    expect(await confirmHandoff(pool, w.scope, w.sz, "manager", h, TODAY)).toEqual(
      refusal(409, "handoff_stale"),
    );
    expect((await handoff(h)).status).toBe("pending");
  });

  it("reject leaves the expiry; a second decision is 409 handoff_not_pending", async () => {
    const w = await world();
    const d = await addDevice(pool, w.orgId, w.x, null, "secondary");
    await setExpiry(d, "2026-11-20");
    const s = await startExtension(pool, w.scope, w.sx, "user", d, ext("2026-12-31"));
    const h = s.ok ? s.value.id : "";
    const r = await declineHandoff(pool, w.scope, w.sz, "manager", h);
    expect(r.ok && r.value.status).toBe("declined");
    const g = await getDevice(pool, w.scope, w.sx, "user", d, TODAY);
    expect(g.ok && g.value.holding?.expiresOn).toBe("2026-11-20");
    expect(await auditRows(w.orgId, "device.extension_decline")).toHaveLength(1);
    expect(await confirmHandoff(pool, w.scope, w.sz, "manager", h, TODAY)).toEqual(
      refusal(409, "handoff_not_pending"),
    );
  });

  it("the owner cancels; take-back cancels a pending extension", async () => {
    const w = await world();
    const d1 = await addDevice(pool, w.orgId, w.x, null, "secondary");
    const d2 = await addDevice(pool, w.orgId, w.x, null, "secondary");
    const a = await startExtension(pool, w.scope, w.sx, "user", d1, ext("2026-12-31"));
    const b = await startExtension(pool, w.scope, w.sx, "user", d2, ext("2026-12-31"));
    const ha = a.ok ? a.value.id : "";
    const hb = b.ok ? b.value.id : "";
    const c = await cancelHandoff(pool, w.scope, w.sx, "user", ha);
    expect(c.ok && c.value.status).toBe("cancelled");
    expect((await takeBack(pool, w.scope, w.sz, "admin", d2)).ok).toBe(true);
    expect((await handoff(hb)).status).toBe("cancelled");
  });

  it("listHandoffs extensions: Manager+ sees org-wide pending extensions, a User gets 422", async () => {
    const w = await world();
    const d = await addDevice(pool, w.orgId, w.x, null, "secondary");
    const t = await addDevice(pool, w.orgId, w.x, null, "secondary");
    await addTransfer(pool, w.orgId, t, w.x, w.y);
    const s = await startExtension(pool, w.scope, w.sx, "user", d, ext("2026-12-31"));
    const h = s.ok ? s.value.id : "";
    const r = await listHandoffs(pool, w.scope, w.sz, "manager", "extensions");
    expect(r.ok && r.value.items.map((i) => i.id)).toEqual([h]);
    expect(r.ok && r.value.items[0]).toMatchObject({ canConfirm: true, canDecline: true });
    expect(await listHandoffs(pool, w.scope, w.sx, "user", "extensions")).toEqual(
      refusal(422, "not_allowed"),
    );
  });

  it("count: overdue counts only my owned devices past expiry, extensions only for Manager+", async () => {
    const w = await world();
    const past = await addDevice(pool, w.orgId, w.x, null, "secondary");
    const todayD = await addDevice(pool, w.orgId, w.x, null, "secondary");
    const theirs = await addDevice(pool, w.orgId, w.y, null, "secondary");
    await setExpiry(past, "2026-11-24");
    await setExpiry(todayD, TODAY);
    await setExpiry(theirs, "2026-01-01");
    await startExtension(pool, w.scope, w.sx, "user", past, ext("2026-12-31"));
    expect(await countHandoffs(pool, w.scope, w.sx, "user", TODAY)).toEqual({
      ok: true,
      value: { incoming: 0, returns: 0, extensions: 0, overdue: 1 },
    });
    expect(await countHandoffs(pool, w.scope, w.sz, "manager", TODAY)).toEqual({
      ok: true,
      value: { incoming: 0, returns: 0, extensions: 1, overdue: 0 },
    });
  });

  it("device DTO overdue: yesterday true; today, no expiry and unowned false; the overdue filter lists only the first", async () => {
    const w = await world();
    const mk = async (owner: string | null, day: string | null) => {
      const d = await addDevice(pool, w.orgId, owner, null, "secondary");
      await setExpiry(d, day);
      return d;
    };
    const yesterday = await mk(w.x, "2026-11-24");
    const today = await mk(w.x, TODAY);
    const none = await mk(w.x, null);
    const free = await mk(null, null);
    const flag = async (d: string) => {
      const g = await getDevice(pool, w.scope, w.sx, "admin", d, TODAY);
      return g.ok && g.value.overdue;
    };
    expect([await flag(yesterday), await flag(today), await flag(none), await flag(free)]).toEqual([
      true,
      false,
      false,
      false,
    ]);
    const l = await listDevices(pool, w.scope, w.sx, "user", "overdue", TODAY);
    expect(l.ok && l.value.items.map((i) => i.id)).toEqual([yesterday]);
  });
});
