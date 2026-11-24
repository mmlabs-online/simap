import { randomUUID } from "node:crypto";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addDevice,
  addMember,
  addPendingRequest,
  addRoom,
  addSeat,
  assertTestDb,
  newOrg,
  testPool,
} from "@/test/db/fixtures";
import { approveRequest, cancelRequest, createRequest, rejectRequest } from "./requests";

let pool: pg.Pool;

const one = async (sql: string, values: unknown[]) => (await pool.query(sql, values)).rows[0];
const count = async (sql: string, values: unknown[]) => (await one(sql, values)).n as number;
const auditCount = (orgId: string, action: string) =>
  count("select count(*)::int as n from audit_log where org_id = $1 and action = $2", [
    orgId,
    action,
  ]);
const totalAudit = (orgId: string) =>
  count("select count(*)::int as n from audit_log where org_id = $1", [orgId]);
const reqRow = (id: string) =>
  one("select status, decided_by_id, decided_at from seat_requests where id = $1", [id]);
const seatRow = (id: string) => one("select occupant_id, group_id from seats where id = $1", [id]);
const subOf = async (memberId: string) =>
  (await one("select sub from members where id = $1", [memberId])).sub as string;
const addGroup = async (orgId: string) =>
  (await one("insert into groups (org_id, name) values ($1, 'G') returning id", [orgId]))
    .id as string;

/** An org with room C302, seats 01 and 02, members a, b (users) and boss (manager). */
async function world() {
  const o = newOrg();
  const roomId = await addRoom(pool, o.orgId, "C302", { seatCounter: 2 });
  const seat1 = await addSeat(pool, o.orgId, roomId, "C302", 1);
  const seat2 = await addSeat(pool, o.orgId, roomId, "C302", 2);
  const a = await addMember(pool, o.orgId);
  const b = await addMember(pool, o.orgId);
  const boss = await addMember(pool, o.orgId);
  return {
    ...o,
    roomId,
    seat1,
    seat2,
    a,
    b,
    boss,
    aSub: await subOf(a),
    bSub: await subOf(b),
    bossSub: await subOf(boss),
  };
}

const failed = (r: { ok: boolean }, status: number, code: string) =>
  expect(r).toEqual({ ok: false, status, code });

beforeAll(async () => {
  pool = testPool();
  await assertTestDb(pool);
});
afterAll(async () => {
  await pool.end();
});

describe("requests (db): create", () => {
  it("empty seat -> pending row for the caller, one request.create audit row", async () => {
    const w = await world();
    const r = await createRequest(pool, w.scope, w.aSub, w.seat1);
    expect(r.ok && r.value.created).toBe(true);
    const req = r.ok ? r.value.request : null;
    expect(req).toMatchObject({
      status: "pending",
      seat: { id: w.seat1, code: "C302-01", roomCode: "C302" },
      subject: { id: w.a },
      decidedAt: null,
      decidedBy: null,
    });
    const row = await one("select subject_id, created_by_id from seat_requests where id = $1", [
      req!.id,
    ]);
    expect(row).toEqual({ subject_id: w.a, created_by_id: w.a });
    expect(await auditCount(w.orgId, "request.create")).toBe(1);
  });

  it("duplicate create returns the existing pending request, one row, one audit row", async () => {
    const w = await world();
    const first = await createRequest(pool, w.scope, w.aSub, w.seat1);
    const second = await createRequest(pool, w.scope, w.aSub, w.seat1);
    expect(second.ok && second.value.created).toBe(false);
    expect(second.ok && second.value.request.id).toBe(first.ok && first.value.request.id);
    expect(
      await count("select count(*)::int as n from seat_requests where org_id = $1", [w.orgId]),
    ).toBe(1);
    expect(await auditCount(w.orgId, "request.create")).toBe(1);
  });

  it("two concurrent creates (same seat, same member) leave one pending row", async () => {
    const w = await world();
    const rs = await Promise.all([
      createRequest(pool, w.scope, w.aSub, w.seat1),
      createRequest(pool, w.scope, w.aSub, w.seat1),
    ]);
    expect(rs.every((r) => r.ok)).toBe(true);
    expect(rs.filter((r) => r.ok && r.value.created)).toHaveLength(1);
    expect(
      await count("select count(*)::int as n from seat_requests where org_id = $1", [w.orgId]),
    ).toBe(1);
  });

  it("a second member can request the same seat (rival)", async () => {
    const w = await world();
    await createRequest(pool, w.scope, w.aSub, w.seat1);
    const r = await createRequest(pool, w.scope, w.bSub, w.seat1);
    expect(r.ok && r.value.created).toBe(true);
    expect(
      await count("select count(*)::int as n from seat_requests where org_id = $1", [w.orgId]),
    ).toBe(2);
  });

  it("occupied (also by the caller) -> 409 seat_taken; cannot-seat -> 409 seat_cannot_seat; nothing inserted", async () => {
    const w = await world();
    await pool.query("update seats set occupant_id = $2 where id = $1", [w.seat1, w.b]);
    failed(await createRequest(pool, w.scope, w.aSub, w.seat1), 409, "seat_taken");
    failed(await createRequest(pool, w.scope, w.bSub, w.seat1), 409, "seat_taken");
    await pool.query(
      "update seats set cannot_seat = true, cannot_seat_reason = 'x' where id = $1",
      [w.seat2],
    );
    failed(await createRequest(pool, w.scope, w.aSub, w.seat2), 409, "seat_cannot_seat");
    expect(
      await count("select count(*)::int as n from seat_requests where org_id = $1", [w.orgId]),
    ).toBe(0);
    expect(await totalAudit(w.orgId)).toBe(0);
  });

  it("no member row -> 422 no_linked_member; unknown or other-org seat -> 404", async () => {
    const w = await world();
    failed(await createRequest(pool, w.scope, randomUUID(), w.seat1), 422, "no_linked_member");
    failed(await createRequest(pool, w.scope, w.aSub, randomUUID()), 404, "not_found");
    const other = newOrg();
    const otherMember = await addMember(pool, other.orgId);
    failed(
      await createRequest(pool, other.scope, await subOf(otherMember), w.seat1),
      404,
      "not_found",
    );
  });
});

describe("requests (db): approve", () => {
  it("two rivals: occupant set, primary demoted, request approved, both rivals rejected, audit rows", async () => {
    const w = await world();
    const c = await addMember(pool, w.orgId);
    const dev = await addDevice(pool, w.orgId, w.b, w.seat1, "primary");
    const req = await addPendingRequest(pool, w.orgId, w.seat1, w.a);
    const rival1 = await addPendingRequest(pool, w.orgId, w.seat1, w.b);
    const rival2 = await addPendingRequest(pool, w.orgId, w.seat1, c);
    const other = await addPendingRequest(pool, w.orgId, w.seat2, w.b);

    const r = await approveRequest(pool, w.scope, w.bossSub, req);
    expect(r.ok && r.value).toMatchObject({
      status: "approved",
      decidedBy: { id: w.boss },
    });
    expect((await seatRow(w.seat1)).occupant_id).toBe(w.a);
    expect((await one("select role from devices where id = $1", [dev])).role).toBe("secondary");
    const row = await reqRow(req);
    expect(row.status).toBe("approved");
    expect(row.decided_by_id).toBe(w.boss);
    expect(row.decided_at).not.toBeNull();
    for (const id of [rival1, rival2]) {
      const rv = await reqRow(id);
      expect(rv.status).toBe("rejected");
      expect(rv.decided_at).not.toBeNull();
    }
    expect((await reqRow(other)).status).toBe("pending");
    expect(await auditCount(w.orgId, "seat.assign")).toBe(1);
    expect(await auditCount(w.orgId, "request.approve")).toBe(1);
    expect(await auditCount(w.orgId, "request.reject")).toBe(2);
  });

  it("inherits the subject's group on a seat without a group (D32)", async () => {
    const w = await world();
    const g = await addGroup(w.orgId);
    await pool.query("update members set group_id = $2 where id = $1", [w.a, g]);
    const req = await addPendingRequest(pool, w.orgId, w.seat1, w.a);
    expect((await approveRequest(pool, w.scope, w.bossSub, req)).ok).toBe(true);
    expect((await seatRow(w.seat1)).group_id).toBe(g);
  });

  it("seat taken directly or flagged cannot-seat after the request: 409, request and rivals stay pending, no audit", async () => {
    const w = await world();
    const req = await addPendingRequest(pool, w.orgId, w.seat1, w.a);
    const rival = await addPendingRequest(pool, w.orgId, w.seat1, w.b);
    await pool.query("update seats set occupant_id = $2 where id = $1", [w.seat1, w.boss]);
    failed(await approveRequest(pool, w.scope, w.bossSub, req), 409, "seat_taken");
    await pool.query(
      "update seats set occupant_id = null, cannot_seat = true, cannot_seat_reason = 'x' where id = $1",
      [w.seat1],
    );
    failed(await approveRequest(pool, w.scope, w.bossSub, req), 409, "seat_cannot_seat");
    expect((await reqRow(req)).status).toBe("pending");
    expect((await reqRow(rival)).status).toBe("pending");
    expect(await totalAudit(w.orgId)).toBe(0);
  });

  it("deactivated subject -> 422 member_not_assignable, nothing changed", async () => {
    const w = await world();
    const req = await addPendingRequest(pool, w.orgId, w.seat1, w.a);
    await pool.query("update members set status = 'deactivated' where id = $1", [w.a]);
    failed(await approveRequest(pool, w.scope, w.bossSub, req), 422, "member_not_assignable");
    expect((await reqRow(req)).status).toBe("pending");
    expect((await seatRow(w.seat1)).occupant_id).toBeNull();
  });

  it("missing or other-org request -> 404", async () => {
    const w = await world();
    const req = await addPendingRequest(pool, w.orgId, w.seat1, w.a);
    failed(await approveRequest(pool, w.scope, w.bossSub, randomUUID()), 404, "not_found");
    failed(await approveRequest(pool, newOrg().scope, w.bossSub, req), 404, "not_found");
  });

  it("approve and reject of a decided request: ok, row and audit count unchanged", async () => {
    const w = await world();
    for (const status of ["approved", "rejected", "cancelled"]) {
      const m = await addMember(pool, w.orgId);
      const id = await addPendingRequest(pool, w.orgId, w.seat1, m);
      await pool.query("update seat_requests set status = $2, decided_at = now() where id = $1", [
        id,
        status,
      ]);
      const before = await reqRow(id);
      const a = await approveRequest(pool, w.scope, w.bossSub, id);
      const r = await rejectRequest(pool, w.scope, w.bossSub, id);
      expect(a.ok && a.value.status).toBe(status);
      expect(r.ok && r.value.status).toBe(status);
      expect(await reqRow(id)).toEqual(before);
    }
    expect(await totalAudit(w.orgId)).toBe(0);
    expect((await seatRow(w.seat1)).occupant_id).toBeNull();
  });

  it("concurrent approve of two rivals: one approved, the other ends rejected, no error", async () => {
    const w = await world();
    const r1 = await addPendingRequest(pool, w.orgId, w.seat1, w.a);
    const r2 = await addPendingRequest(pool, w.orgId, w.seat1, w.b);
    const rs = await Promise.all([
      approveRequest(pool, w.scope, w.bossSub, r1),
      approveRequest(pool, w.scope, w.bossSub, r2),
    ]);
    expect(rs.every((r) => r.ok)).toBe(true);
    const statuses = [(await reqRow(r1)).status, (await reqRow(r2)).status].sort();
    expect(statuses).toEqual(["approved", "rejected"]);
    expect(await auditCount(w.orgId, "seat.assign")).toBe(1);
  });

  it("concurrent approve and owner cancel: approved or cancelled, never both, no error", async () => {
    const w = await world();
    const req = await addPendingRequest(pool, w.orgId, w.seat1, w.a);
    const rs = await Promise.all([
      approveRequest(pool, w.scope, w.bossSub, req),
      cancelRequest(pool, w.scope, w.aSub, req),
    ]);
    expect(rs.every((r) => r.ok)).toBe(true);
    const status = (await reqRow(req)).status;
    const occupant = (await seatRow(w.seat1)).occupant_id;
    if (status === "approved") expect(occupant).toBe(w.a);
    else {
      expect(status).toBe("cancelled");
      expect(occupant).toBeNull();
    }
  });
});

describe("requests (db): reject and cancel", () => {
  it("reject pending -> rejected, seat untouched, one request.reject audit row", async () => {
    const w = await world();
    const req = await addPendingRequest(pool, w.orgId, w.seat1, w.a);
    const r = await rejectRequest(pool, w.scope, w.bossSub, req);
    expect(r.ok && r.value).toMatchObject({ status: "rejected", decidedBy: { id: w.boss } });
    expect((await reqRow(req)).decided_at).not.toBeNull();
    expect((await seatRow(w.seat1)).occupant_id).toBeNull();
    expect(await auditCount(w.orgId, "request.reject")).toBe(1);
  });

  it("owner cancels pending -> cancelled, decided_at set, request.cancel audit row", async () => {
    const w = await world();
    const req = await addPendingRequest(pool, w.orgId, w.seat1, w.a);
    const r = await cancelRequest(pool, w.scope, w.aSub, req);
    expect(r.ok && r.value.status).toBe("cancelled");
    const row = await reqRow(req);
    expect(row.status).toBe("cancelled");
    expect(row.decided_at).not.toBeNull();
    expect(await auditCount(w.orgId, "request.cancel")).toBe(1);
  });

  it("another member, a caller without a member row, or another org -> 404, row unchanged", async () => {
    const w = await world();
    const req = await addPendingRequest(pool, w.orgId, w.seat1, w.a);
    failed(await cancelRequest(pool, w.scope, w.bSub, req), 404, "not_found");
    failed(await cancelRequest(pool, w.scope, randomUUID(), req), 404, "not_found");
    const other = newOrg();
    const m = await addMember(pool, other.orgId);
    failed(await cancelRequest(pool, other.scope, await subOf(m), req), 404, "not_found");
    expect((await reqRow(req)).status).toBe("pending");
  });

  it("cancel of a non-pending request -> ok, unchanged, no audit", async () => {
    const w = await world();
    const req = await addPendingRequest(pool, w.orgId, w.seat1, w.a);
    await pool.query(
      "update seat_requests set status = 'rejected', decided_at = now() where id = $1",
      [req],
    );
    const before = await reqRow(req);
    const r = await cancelRequest(pool, w.scope, w.aSub, req);
    expect(r.ok && r.value.status).toBe("rejected");
    expect(await reqRow(req)).toEqual(before);
    expect(await totalAudit(w.orgId)).toBe(0);
  });
});
