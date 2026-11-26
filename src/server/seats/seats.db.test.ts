import { randomUUID } from "node:crypto";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SEAT_LIMITS } from "@/lib/seats/types";
import {
  addDevice,
  addMember,
  addPendingRequest,
  addRoom,
  addSeat,
  assertTestDb,
  newOrg,
  testPool,
  waitForLockWait,
} from "@/test/db/fixtures";
import {
  addSeats,
  deleteSeat,
  getSeat,
  listRoomSeats,
  releaseSeat,
  setCannotSeat,
  setOccupant,
} from "./seats";

let pool: pg.Pool;
const actor = () => randomUUID();

const one = async (sql: string, values: unknown[]) => (await pool.query(sql, values)).rows[0];
const count = async (sql: string, values: unknown[]) => (await one(sql, values)).n as number;
const auditCount = (orgId: string, action: string) =>
  count("select count(*)::int as n from audit_log where org_id = $1 and action = $2", [
    orgId,
    action,
  ]);
const seatRow = (id: string) =>
  one("select occupant_id, group_id, cannot_seat, cannot_seat_reason from seats where id = $1", [
    id,
  ]);
const deviceRole = async (id: string) =>
  await one("select role, seat_id from devices where id = $1", [id]);
const addGroup = async (orgId: string, name: string) =>
  (await one("insert into groups (org_id, name) values ($1, $2) returning id", [orgId, name]))
    .id as string;

/** An org with room C302, one seat, and members X (occupant) and Y. */
async function world(opts: { occupied?: boolean } = {}) {
  const o = newOrg();
  const roomId = await addRoom(pool, o.orgId, "C302", { seatCounter: 1 });
  const x = await addMember(pool, o.orgId);
  const y = await addMember(pool, o.orgId);
  const seatId = await addSeat(pool, o.orgId, roomId, "C302", 1, {
    occupantId: opts.occupied ? x : null,
  });
  return { ...o, roomId, x, y, seatId };
}

const subOf = async (memberId: string) =>
  (await one("select sub from members where id = $1", [memberId])).sub as string;

beforeAll(async () => {
  pool = testPool();
  await assertTestDb(pool);
});
afterAll(async () => {
  await pool.end();
});

describe("seats (db): add", () => {
  it("add after delete: 01..03, delete 03, add 2 -> C302-04, C302-05", async () => {
    const o = newOrg();
    const roomId = await addRoom(pool, o.orgId, "C302");
    const first = await addSeats(pool, o.scope, actor(), roomId, 3);
    expect(first.ok && first.value.map((s) => s.code)).toEqual(["C302-01", "C302-02", "C302-03"]);
    const third = first.ok ? first.value[2]!.id : "";
    expect((await deleteSeat(pool, o.scope, actor(), third)).ok).toBe(true);
    const next = await addSeats(pool, o.scope, actor(), roomId, 2);
    expect(next.ok && next.value.map((s) => s.code)).toEqual(["C302-04", "C302-05"]);
    expect(await auditCount(o.orgId, "seat.create")).toBe(5);
  });

  it("default geometry; seq 100 -> C302-100; another org's room -> 404", async () => {
    const o = newOrg();
    const roomId = await addRoom(pool, o.orgId, "C302", { seatCounter: 99 });
    const r = await addSeats(pool, o.scope, actor(), roomId, 1);
    expect(r.ok && r.value[0]!.code).toBe("C302-100");
    const g = await one("select x, y, rotation, w, h from seats where id = $1", [
      r.ok ? r.value[0]!.id : "",
    ]);
    expect(g).toEqual({ x: 0, y: 0, rotation: 0, w: null, h: null });
    const other = newOrg();
    expect(await addSeats(pool, other.scope, actor(), roomId, 1)).toEqual({
      ok: false,
      status: 404,
      code: "not_found",
    });
  });

  it("concurrent adds to one room: no duplicate seq, counter equals the total", async () => {
    const o = newOrg();
    const roomId = await addRoom(pool, o.orgId, "C302");
    const rs = await Promise.all(
      [1, 2, 3, 4, 5].map(() => addSeats(pool, o.scope, actor(), roomId, 3)),
    );
    expect(rs.every((r) => r.ok)).toBe(true);
    expect(
      await count("select count(distinct seq)::int as n from seats where room_id = $1", [roomId]),
    ).toBe(15);
    expect((await one("select seat_counter from rooms where id = $1", [roomId])).seat_counter).toBe(
      15,
    );
  });
});

describe("seats (db): delete", () => {
  it("refused: occupant, or a secondary device on an empty seat; nothing changed", async () => {
    const w = await world({ occupied: true });
    expect(await deleteSeat(pool, w.scope, actor(), w.seatId)).toEqual({
      ok: false,
      status: 409,
      code: "seat_not_empty",
    });
    const w2 = await world();
    await addDevice(pool, w2.orgId, w2.x, w2.seatId, "secondary");
    expect(await deleteSeat(pool, w2.scope, actor(), w2.seatId)).toEqual({
      ok: false,
      status: 409,
      code: "seat_not_empty",
    });
    expect(
      await count("select count(*)::int as n from seats where id = any($1)", [
        [w.seatId, w2.seatId],
      ]),
    ).toBe(2);
    expect(await auditCount(w.orgId, "seat.delete")).toBe(0);
  });

  it("empty seat: row gone, counter unchanged, one seat.delete audit with droppedRequests, requests cascade", async () => {
    const w = await world();
    await addPendingRequest(pool, w.orgId, w.seatId, w.y);
    expect((await deleteSeat(pool, w.scope, actor(), w.seatId)).ok).toBe(true);
    expect(await count("select count(*)::int as n from seats where id = $1", [w.seatId])).toBe(0);
    expect(
      await count("select count(*)::int as n from seat_requests where seat_id = $1", [w.seatId]),
    ).toBe(0);
    expect(
      (await one("select seat_counter from rooms where id = $1", [w.roomId])).seat_counter,
    ).toBe(1);
    const a = await one("select meta from audit_log where org_id = $1 and action = 'seat.delete'", [
      w.orgId,
    ]);
    expect(a.meta).toEqual({ code: "C302-01", room: "C302", droppedRequests: 1 });
  });

  it("delete vs assign race: delete waits on the assign's locks, then gets 409", async () => {
    const w = await world();
    const holder = await pool.connect();
    try {
      await holder.query("begin");
      await holder.query("select id from rooms where id = $1 for share", [w.roomId]);
      await holder.query("select id from seats where id = $1 for update", [w.seatId]);
      await holder.query("update seats set occupant_id = $2 where id = $1", [w.seatId, w.x]);
      const pending = deleteSeat(pool, w.scope, actor(), w.seatId);
      const waited = await waitForLockWait(pool, 3000);
      await holder.query("commit");
      const r = await pending;
      expect(waited).toBe(true);
      expect(r).toEqual({ ok: false, status: 409, code: "seat_not_empty" });
      expect((await seatRow(w.seatId)).occupant_id).toBe(w.x);
    } finally {
      await holder.query("rollback").catch(() => {});
      holder.release();
    }
  });
});

describe("seats (db): list and detail", () => {
  it("every seat in seq order with derived status, occupant, devices, tags; cap with true count; mine; org isolation", async () => {
    const w = await world({ occupied: true });
    const group = await addGroup(w.orgId, "Ops");
    await pool.query("update seats set group_id = $2 where id = $1", [w.seatId, group]);
    const s2 = await addSeat(pool, w.orgId, w.roomId, "C302", 2);
    const prim = await addDevice(pool, w.orgId, w.x, w.seatId, "primary");
    for (let i = 0; i < SEAT_LIMITS.listDevices + 2; i++) {
      await addDevice(pool, w.orgId, w.y, w.seatId, "secondary");
    }
    const other = await world({ occupied: true });
    const xSub = await subOf(w.x);
    const r = await listRoomSeats(pool, w.scope, xSub, "manager", w.roomId);
    if (!r.ok) throw new Error("list failed");
    expect(r.value.room).toEqual({ id: w.roomId, code: "C302", name: "Room C302" });
    expect(r.value.truncated).toBe(false);
    expect(r.value.items.map((s) => s.code)).toEqual(["C302-01", "C302-02"]);
    const [a, b] = r.value.items;
    expect(a!.status).toBe("occupied");
    expect(a!.occupant).toEqual({
      id: w.x,
      displayName: "Test Member",
      hasPhoto: false,
      photoVersion: 0,
    });
    expect(a!.mine).toBe(true);
    expect(a!.group).toMatchObject({ id: group, name: "Ops" });
    expect(a!.deviceCount).toBe(SEAT_LIMITS.listDevices + 3);
    expect(a!.devices).toHaveLength(SEAT_LIMITS.listDevices);
    expect(a!.devices[0]).toMatchObject({ id: prim, role: "primary", owner: { id: w.x } });
    expect(b).toMatchObject({
      id: s2,
      status: "empty",
      occupant: null,
      mine: false,
      deviceCount: 0,
    });
    const detail = await getSeat(pool, w.scope, await subOf(w.y), "manager", w.seatId);
    expect(detail.ok && detail.value.devices).toHaveLength(SEAT_LIMITS.listDevices + 3);
    expect(detail.ok && detail.value.mine).toBe(false);
    expect(JSON.stringify(r.value)).not.toContain("sub");
    // other org
    expect(await getSeat(pool, w.scope, xSub, "manager", other.seatId)).toMatchObject({
      ok: false,
      status: 404,
    });
    expect(await listRoomSeats(pool, w.scope, xSub, "manager", other.roomId)).toMatchObject({
      ok: false,
      status: 404,
    });
  });
});

describe("seats (db): occupant", () => {
  it("assign to an empty seat sets the occupant and audits seat.assign", async () => {
    const w = await world();
    const r = await setOccupant(pool, w.scope, actor(), w.seatId, {
      memberId: w.x,
      expectedOccupantId: null,
    });
    expect(r.ok && r.value.occupant?.id).toBe(w.x);
    expect((await seatRow(w.seatId)).occupant_id).toBe(w.x);
    expect(await auditCount(w.orgId, "seat.assign")).toBe(1);
  });

  it("replace: Y sits, X's primary is secondary and still on the seat, one seat.replace audit", async () => {
    const w = await world({ occupied: true });
    const dev = await addDevice(pool, w.orgId, w.x, w.seatId, "primary");
    const r = await setOccupant(pool, w.scope, actor(), w.seatId, {
      memberId: w.y,
      expectedOccupantId: w.x,
    });
    expect(r.ok && r.value.occupant?.id).toBe(w.y);
    expect(await deviceRole(dev)).toEqual({ role: "secondary", seat_id: w.seatId });
    expect(await auditCount(w.orgId, "seat.replace")).toBe(1);
    const a = await one(
      "select meta from audit_log where org_id = $1 and action = 'seat.replace'",
      [w.orgId],
    );
    expect(a.meta).toMatchObject({ memberId: w.y, previousOccupantId: w.x, demoted: 1 });
  });

  it("same member again: nothing changes, primary stays primary, no audit", async () => {
    const w = await world({ occupied: true });
    const dev = await addDevice(pool, w.orgId, w.x, w.seatId, "primary");
    const r = await setOccupant(pool, w.scope, actor(), w.seatId, {
      memberId: w.x,
      expectedOccupantId: w.x,
    });
    expect(r.ok).toBe(true);
    expect((await deviceRole(dev)).role).toBe("primary");
    expect(
      await count("select count(*)::int as n from audit_log where org_id = $1", [w.orgId]),
    ).toBe(0);
  });

  it("stale expectedOccupantId -> 409 occupant_changed, nothing changed", async () => {
    const w = await world({ occupied: true });
    const r = await setOccupant(pool, w.scope, actor(), w.seatId, {
      memberId: w.y,
      expectedOccupantId: null,
    });
    expect(r).toEqual({ ok: false, status: 409, code: "occupant_changed" });
    expect((await seatRow(w.seatId)).occupant_id).toBe(w.x);
    const c = await setOccupant(pool, w.scope, actor(), w.seatId, {
      memberId: null,
      expectedOccupantId: w.y,
    });
    expect(c).toEqual({ ok: false, status: 409, code: "occupant_changed" });
    expect((await seatRow(w.seatId)).occupant_id).toBe(w.x);
  });

  it("clear: occupant null, primary demoted, seat.unassign audit; seat group kept", async () => {
    const w = await world({ occupied: true });
    const group = await addGroup(w.orgId, "Ops");
    await pool.query("update seats set group_id = $2 where id = $1", [w.seatId, group]);
    const dev = await addDevice(pool, w.orgId, w.x, w.seatId, "primary");
    const r = await setOccupant(pool, w.scope, actor(), w.seatId, {
      memberId: null,
      expectedOccupantId: w.x,
    });
    expect(r.ok && r.value.status).toBe("empty");
    const s = await seatRow(w.seatId);
    expect(s.occupant_id).toBeNull();
    expect(s.group_id).toBe(group);
    expect((await deviceRole(dev)).role).toBe("secondary");
    expect(await auditCount(w.orgId, "seat.unassign")).toBe(1);
  });

  it("assign refused: deactivated member, unknown id, another org's member -> 422", async () => {
    const w = await world();
    await pool.query("update members set status = 'deactivated' where id = $1", [w.y]);
    const foreign = await addMember(pool, newOrg().orgId);
    for (const memberId of [w.y, randomUUID(), foreign]) {
      expect(
        await setOccupant(pool, w.scope, actor(), w.seatId, { memberId, expectedOccupantId: null }),
      ).toEqual({
        ok: false,
        status: 422,
        code: "member_not_assignable",
      });
    }
    expect((await seatRow(w.seatId)).occupant_id).toBeNull();
  });

  it("assign vs deactivate race: assign waits for the member lock, then 422; seat stays empty", async () => {
    const w = await world();
    const holder = await pool.connect();
    try {
      await holder.query("begin");
      await holder.query("select id from members where id = $1 for update", [w.y]);
      const pending = setOccupant(pool, w.scope, actor(), w.seatId, {
        memberId: w.y,
        expectedOccupantId: null,
      });
      const waited = await waitForLockWait(pool, 3000);
      await holder.query("update members set status = 'deactivated' where id = $1", [w.y]);
      await holder.query("commit");
      const r = await pending;
      expect(waited).toBe(true);
      expect(r).toEqual({ ok: false, status: 422, code: "member_not_assignable" });
      expect((await seatRow(w.seatId)).occupant_id).toBeNull();
    } finally {
      await holder.query("rollback").catch(() => {});
      holder.release();
    }
  });
});

describe("seats (db): cannot-seat", () => {
  it("assign and replace -> 409 seat_cannot_seat; remove and release still work", async () => {
    const w = await world();
    expect(
      (await setCannotSeat(pool, w.scope, actor(), w.seatId, { cannotSeat: true, reason: "Hỏng" }))
        .ok,
    ).toBe(true);
    const refusal = { ok: false, status: 409, code: "seat_cannot_seat" };
    expect(
      await setOccupant(pool, w.scope, actor(), w.seatId, {
        memberId: w.x,
        expectedOccupantId: null,
      }),
    ).toEqual(refusal);
    // occupant present on a cannot-seat seat (A3)
    await pool.query("update seats set occupant_id = $2 where id = $1", [w.seatId, w.x]);
    expect(
      await setOccupant(pool, w.scope, actor(), w.seatId, {
        memberId: w.y,
        expectedOccupantId: w.x,
      }),
    ).toEqual(refusal);
    expect(
      (
        await setOccupant(pool, w.scope, actor(), w.seatId, {
          memberId: null,
          expectedOccupantId: w.x,
        })
      ).ok,
    ).toBe(true);
    await pool.query("update seats set occupant_id = $2 where id = $1", [w.seatId, w.x]);
    expect((await releaseSeat(pool, w.scope, await subOf(w.x), "user", w.seatId)).ok).toBe(true);
    expect((await seatRow(w.seatId)).occupant_id).toBeNull();
  });

  it("set on an occupied seat keeps the occupant; clear nulls the reason; audit has hasReason, never the text", async () => {
    const w = await world({ occupied: true });
    const r = await setCannotSeat(pool, w.scope, actor(), w.seatId, {
      cannotSeat: true,
      reason: "secret-reason",
    });
    expect(r.ok && r.value).toMatchObject({
      cannotSeat: true,
      cannotSeatReason: "secret-reason",
      status: "occupied",
    });
    // same state: no extra audit
    await setCannotSeat(pool, w.scope, actor(), w.seatId, {
      cannotSeat: true,
      reason: "secret-reason",
    });
    expect(await auditCount(w.orgId, "seat.cannot_seat")).toBe(1);
    const c = await setCannotSeat(pool, w.scope, actor(), w.seatId, { cannotSeat: false });
    expect(c.ok && c.value.cannotSeatReason).toBeNull();
    const s = await seatRow(w.seatId);
    expect(s).toMatchObject({ occupant_id: w.x, cannot_seat: false, cannot_seat_reason: null });
    const rows = (
      await pool.query(
        "select meta from audit_log where org_id = $1 and action = 'seat.cannot_seat' order by id",
        [w.orgId],
      )
    ).rows;
    expect(rows.map((x) => x.meta.hasReason).sort()).toEqual([false, true]);
    expect(JSON.stringify(rows)).not.toContain("secret-reason");
  });
});

describe("seats (db): release", () => {
  it("occupant clears and demotes; others (including a Manager) -> 409 not_allowed; already empty -> 200, no audit", async () => {
    const w = await world({ occupied: true });
    const dev = await addDevice(pool, w.orgId, w.x, w.seatId, "primary");
    expect(await releaseSeat(pool, w.scope, await subOf(w.y), "user", w.seatId)).toEqual({
      ok: false,
      status: 409,
      code: "not_allowed",
    });
    expect(await releaseSeat(pool, w.scope, actor(), "user", w.seatId)).toMatchObject({
      ok: false,
      code: "not_allowed",
    });
    expect((await seatRow(w.seatId)).occupant_id).toBe(w.x);
    const r = await releaseSeat(pool, w.scope, await subOf(w.x), "user", w.seatId);
    expect(r.ok && r.value.status).toBe("empty");
    expect((await deviceRole(dev)).role).toBe("secondary");
    expect(await auditCount(w.orgId, "seat.release")).toBe(1);
    const again = await releaseSeat(pool, w.scope, await subOf(w.x), "user", w.seatId);
    expect(again.ok).toBe(true);
    expect(await auditCount(w.orgId, "seat.release")).toBe(1);
  });
});

describe("seats (db): D32 group inheritance", () => {
  it("null seat group inherits; existing kept; member without group leaves null; no-op does not inherit", async () => {
    const w = await world();
    const gm = await addGroup(w.orgId, "Member group");
    const gs = await addGroup(w.orgId, "Seat group");
    await pool.query("update members set group_id = $2 where id = $1", [w.x, gm]);
    // member with no group (y) leaves null
    await setOccupant(pool, w.scope, actor(), w.seatId, {
      memberId: w.y,
      expectedOccupantId: null,
    });
    expect((await seatRow(w.seatId)).group_id).toBeNull();
    // replace by x: seat group still null -> inherits
    await setOccupant(pool, w.scope, actor(), w.seatId, { memberId: w.x, expectedOccupantId: w.y });
    expect((await seatRow(w.seatId)).group_id).toBe(gm);
    // existing seat group is kept on replace
    await pool.query("update seats set group_id = $2 where id = $1", [w.seatId, gs]);
    await setOccupant(pool, w.scope, actor(), w.seatId, { memberId: w.y, expectedOccupantId: w.x });
    expect((await seatRow(w.seatId)).group_id).toBe(gs);
    // no-op does not inherit
    await pool.query("update seats set group_id = null where id = $1", [w.seatId]);
    await pool.query("update members set group_id = $2 where id = $1", [w.y, gm]);
    await setOccupant(pool, w.scope, actor(), w.seatId, { memberId: w.y, expectedOccupantId: w.y });
    expect((await seatRow(w.seatId)).group_id).toBeNull();
  });
});

describe("seats (db): cross-org writes", () => {
  it("delete, assign, release and cannot-seat on another org's seat -> 404, nothing changed, no audit", async () => {
    const w = await world();
    const other = await world({ occupied: true });
    const before = await seatRow(other.seatId);
    const auditAll = (orgId: string) =>
      count("select count(*)::int as n from audit_log where org_id = $1", [orgId]);
    const auditBefore = [await auditAll(w.orgId), await auditAll(other.orgId)];
    const notFound = { ok: false, status: 404, code: "not_found" };
    expect(await deleteSeat(pool, w.scope, actor(), other.seatId)).toEqual(notFound);
    expect(
      await setOccupant(pool, w.scope, actor(), other.seatId, {
        memberId: w.y,
        expectedOccupantId: other.x,
      }),
    ).toEqual(notFound);
    expect(await releaseSeat(pool, w.scope, await subOf(other.x), "user", other.seatId)).toEqual(
      notFound,
    );
    expect(
      await setCannotSeat(pool, w.scope, actor(), other.seatId, {
        cannotSeat: true,
        reason: "Hỏng",
      }),
    ).toEqual(notFound);
    expect(await seatRow(other.seatId)).toEqual(before);
    expect([await auditAll(w.orgId), await auditAll(other.orgId)]).toEqual(auditBefore);
  });
});

describe("seats (db): device visibility", () => {
  /** Seat C302-01 occupied by X: X's primary and two of Y's secondaries (unowned devices cannot be placed). */
  async function visWorld() {
    const w = await world({ occupied: true });
    const xPrim = await addDevice(pool, w.orgId, w.x, w.seatId, "primary");
    const ySec = await addDevice(pool, w.orgId, w.y, w.seatId, "secondary");
    const ySec2 = await addDevice(pool, w.orgId, w.y, w.seatId, "secondary");
    return { ...w, xPrim, ySec, ySec2, xSub: await subOf(w.x), ySub: await subOf(w.y) };
  }
  const ids = (devices: { id: string }[]) => devices.map((d) => d.id);

  it("user occupant X: detail, room list and release show only X's primary; deviceCount is the total", async () => {
    const w = await visWorld();
    const d = await getSeat(pool, w.scope, w.xSub, "user", w.seatId);
    if (!d.ok) throw new Error("detail failed");
    expect(ids(d.value.devices)).toEqual([w.xPrim]);
    expect(d.value.deviceCount).toBe(3);
    const l = await listRoomSeats(pool, w.scope, w.xSub, "user", w.roomId);
    if (!l.ok) throw new Error("list failed");
    expect(ids(l.value.items[0]!.devices)).toEqual([w.xPrim]);
    expect(l.value.items[0]!.deviceCount).toBe(3);
    const rel = await releaseSeat(pool, w.scope, w.xSub, "user", w.seatId);
    if (!rel.ok) throw new Error("release failed");
    expect(ids(rel.value.devices)).toEqual([w.xPrim]); // demoted, still X's
    expect(rel.value.deviceCount).toBe(3);
  });

  it("user Y sees only Y's devices; user Z with none sees []; a sub with no member row sees []", async () => {
    const w = await visWorld();
    const z = await addMember(pool, w.orgId);
    const y = await getSeat(pool, w.scope, w.ySub, "user", w.seatId);
    expect(y.ok && ids(y.value.devices).sort()).toEqual([w.ySec, w.ySec2].sort());
    const zr = await getSeat(pool, w.scope, await subOf(z), "user", w.seatId);
    expect(zr.ok && zr.value.devices).toEqual([]);
    expect(zr.ok && zr.value.deviceCount).toBe(3);
    const nobody = await getSeat(pool, w.scope, randomUUID(), "user", w.seatId);
    expect(nobody.ok && nobody.value.devices).toEqual([]);
    expect(nobody.ok && nobody.value.deviceCount).toBe(3);
  });

  it("X's device placed on Y's seat appears for user X on Y's seat", async () => {
    const w = await visWorld();
    const s2 = await addSeat(pool, w.orgId, w.roomId, "C302", 2, { occupantId: w.y });
    const lent = await addDevice(pool, w.orgId, w.x, s2, "secondary");
    const r = await getSeat(pool, w.scope, w.xSub, "user", s2);
    expect(r.ok && ids(r.value.devices)).toEqual([lent]);
  });

  it("manager and admin see all 3 devices with owners", async () => {
    const w = await visWorld();
    for (const tier of ["manager", "admin"] as const) {
      const r = await getSeat(pool, w.scope, w.xSub, tier, w.seatId);
      if (!r.ok) throw new Error("detail failed");
      expect(ids(r.value.devices).sort()).toEqual([w.xPrim, w.ySec, w.ySec2].sort());
      expect(r.value.devices.find((d) => d.id === w.ySec)!.owner).toMatchObject({ id: w.y });
    }
  });

  it("user list cap: 22 own + 3 others -> 20 shown, deviceCount 25", async () => {
    const w = await world({ occupied: true });
    for (let i = 0; i < 22; i++) await addDevice(pool, w.orgId, w.x, w.seatId, "secondary");
    for (let i = 0; i < 3; i++) await addDevice(pool, w.orgId, w.y, w.seatId, "secondary");
    const l = await listRoomSeats(pool, w.scope, await subOf(w.x), "user", w.roomId);
    if (!l.ok) throw new Error("list failed");
    expect(l.value.items[0]!.devices).toHaveLength(SEAT_LIMITS.listDevices);
    expect(l.value.items[0]!.deviceCount).toBe(25);
  });
});

describe("seats (db): occupant photo (SIM-046.2)", () => {
  it("occupant photo fields; JSON has no Drive id", async () => {
    const w = await world({ occupied: true });
    const vacant = await addSeat(pool, w.orgId, w.roomId, "C302", 2);
    await pool.query(
      "update members set photo_drive_file_id = 'file_abcdefghij', photo_version = 4 where id = $1",
      [w.x],
    );
    const r = await listRoomSeats(pool, w.scope, await subOf(w.y), "user", w.roomId);
    if (!r.ok) throw new Error("list failed");
    expect(r.value.items[0]!.occupant).toEqual({
      id: w.x,
      displayName: "Test Member",
      hasPhoto: true,
      photoVersion: 4,
    });
    expect(r.value.items.find((s) => s.id === vacant)!.occupant).toBeNull();
    const d = await getSeat(pool, w.scope, await subOf(w.y), "user", w.seatId);
    if (!d.ok) throw new Error("detail failed");
    expect(d.value.occupant).toEqual({
      id: w.x,
      displayName: "Test Member",
      hasPhoto: true,
      photoVersion: 4,
    });
    for (const v of [r.value, d.value]) {
      const json = JSON.stringify(v);
      expect(json).not.toContain("file_abcdefghij");
      expect(json.toLowerCase()).not.toContain("drive");
    }
  });
});
