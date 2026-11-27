import { randomUUID } from "node:crypto";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { workDateUtc7 } from "@/lib/presence/work-date";
import { addMember, addRoom, addSeat, assertTestDb, newOrg, testPool } from "@/test/db/fixtures";
import { deactivateMember } from "@/server/members/manage";
import { deleteRoom } from "@/server/rooms/rooms";
import { deleteSeat, releaseSeat, setOccupant } from "@/server/seats/seats";
import { applyProviderCheckIn, checkIn, checkOut, getMyPresence, moveSeat } from "./presence";
import { listRoomPresence } from "./read";

let pool: pg.Pool;
const NOW = new Date("2026-11-26T03:00:00.000Z");

const one = async (sql: string, values: unknown[]) => (await pool.query(sql, values)).rows[0];
const rows = async (sql: string, values: unknown[]) => (await pool.query(sql, values)).rows;
const auditCount = async (orgId: string, action: string) =>
  (
    await one("select count(*)::int as n from audit_log where org_id = $1 and action = $2", [
      orgId,
      action,
    ])
  ).n as number;
const presenceRows = (memberId: string) =>
  rows("select * from presence where member_id = $1 order by work_date", [memberId]);
const subOf = async (memberId: string) =>
  (await one("select sub from members where id = $1", [memberId])).sub as string;

/**
 * Org with rooms R1 and R2. Member x holds R1 seq 100 (created first), R1 seq 99 and R2 seq 1; y holds R1 seq 1;
 * z is a member with no seat.
 */
async function world() {
  const o = newOrg();
  const r1 = await addRoom(pool, o.orgId, "R1", { seatCounter: 100 });
  const r2 = await addRoom(pool, o.orgId, "R2", { seatCounter: 1 });
  const x = await addMember(pool, o.orgId);
  const y = await addMember(pool, o.orgId);
  const z = await addMember(pool, o.orgId);
  const s100 = await addSeat(pool, o.orgId, r1, "R1", 100, { occupantId: x });
  const s99 = await addSeat(pool, o.orgId, r1, "R1", 99, { occupantId: x });
  const sy = await addSeat(pool, o.orgId, r1, "R1", 1, { occupantId: y });
  const s2 = await addSeat(pool, o.orgId, r2, "R2", 1, { occupantId: x });
  return { ...o, r1, r2, x, y, z, s100, s99, sy, s2, xSub: await subOf(x), ySub: await subOf(y) };
}

beforeAll(async () => {
  pool = testPool();
  await assertTestDb(pool);
});
afterAll(async () => {
  await pool.end();
});

describe("presence (db): check-in", () => {
  it("records self, server time and today's work date on the lowest seat by seq", async () => {
    const w = await world();
    const r = await checkIn(pool, w.scope, w.xSub, w.r1, NOW);
    expect(r).toMatchObject({
      ok: true,
      value: { roomCode: "R1", seatCode: "R1-99", source: "self", checkedInAt: expect.any(String) },
    });
    const [p] = await presenceRows(w.x);
    expect(p.seat_id).toBe(w.s99);
    expect(p.source).toBe("self");
    expect(p.checked_in_at.toISOString()).toBe(NOW.toISOString());
    expect(String(p.work_date).slice(0, 10)).toBe(workDateUtc7(NOW));
    expect(await auditCount(w.orgId, "presence.check_in")).toBe(1);
  });

  it("no seat in the room -> 422 no_seat_in_room, no row, no audit; unknown room -> 404", async () => {
    const w = await world();
    const zSub = await subOf(w.z);
    expect(await checkIn(pool, w.scope, zSub, w.r1, NOW)).toMatchObject({
      ok: false,
      status: 422,
      code: "no_seat_in_room",
    });
    expect(await presenceRows(w.z)).toHaveLength(0);
    expect(await auditCount(w.orgId, "presence.check_in")).toBe(0);
    expect(await checkIn(pool, w.scope, w.xSub, randomUUID(), NOW)).toMatchObject({
      ok: false,
      status: 404,
    });
  });

  it("a caller with no member row -> 422 no_linked_member", async () => {
    const w = await world();
    expect(await checkIn(pool, w.scope, randomUUID(), w.r1, NOW)).toMatchObject({
      ok: false,
      status: 422,
      code: "no_linked_member",
    });
  });

  it("same room twice -> same row, one audit; other room -> 409 with the room code", async () => {
    const w = await world();
    const a = await checkIn(pool, w.scope, w.xSub, w.r1, NOW);
    const b = await checkIn(pool, w.scope, w.xSub, w.r1, new Date(NOW.getTime() + 60_000));
    expect(b).toEqual(a);
    expect(await presenceRows(w.x)).toHaveLength(1);
    expect(await auditCount(w.orgId, "presence.check_in")).toBe(1);
    expect(await checkIn(pool, w.scope, w.xSub, w.r2, NOW)).toMatchObject({
      ok: false,
      status: 409,
      code: "already_checked_in",
      room: "R1",
    });
    expect(await auditCount(w.orgId, "presence.check_in")).toBe(1);
  });

  it("check-out of nothing -> 200 with no audit; check-out ends the row by self", async () => {
    const w = await world();
    expect(await checkOut(pool, w.scope, w.xSub, NOW)).toEqual({ ok: true, value: null });
    expect(await auditCount(w.orgId, "presence.check_out")).toBe(0);
    await checkIn(pool, w.scope, w.xSub, w.r1, NOW);
    await checkOut(pool, w.scope, w.xSub, new Date(NOW.getTime() + 1000));
    const [p] = await presenceRows(w.x);
    expect(p.checked_out_by).toBe("self");
    expect(p.checked_out_at).not.toBeNull();
    expect(await auditCount(w.orgId, "presence.check_out")).toBe(1);
  });

  it("reopen after check-out the same day keeps one row and two check-in audits", async () => {
    const w = await world();
    await checkIn(pool, w.scope, w.xSub, w.r1, NOW);
    await checkOut(pool, w.scope, w.xSub, new Date(NOW.getTime() + 1000));
    const later = new Date(NOW.getTime() + 3600_000);
    const r = await checkIn(pool, w.scope, w.xSub, w.r2, later);
    expect(r).toMatchObject({ ok: true, value: { roomCode: "R2", seatCode: "R2-01" } });
    const all = await presenceRows(w.x);
    expect(all).toHaveLength(1);
    expect(all[0].seat_id).toBe(w.s2);
    expect(all[0].checked_in_at.toISOString()).toBe(later.toISOString());
    expect(all[0].checked_out_at).toBeNull();
    expect(all[0].checked_out_by).toBeNull();
    expect(await auditCount(w.orgId, "presence.check_in")).toBe(2);
  });

  it("two concurrent check-ins of one member -> one row, one audit, both 200", async () => {
    const w = await world();
    const [a, b] = await Promise.all([
      checkIn(pool, w.scope, w.xSub, w.r1, NOW),
      checkIn(pool, w.scope, w.xSub, w.r1, NOW),
    ]);
    expect(a.ok && b.ok).toBe(true);
    expect(await presenceRows(w.x)).toHaveLength(1);
    expect(await auditCount(w.orgId, "presence.check_in")).toBe(1);
  });
});

describe("presence (db): move seat", () => {
  it("moves to the member's other seat; the same seat writes nothing", async () => {
    const w = await world();
    await checkIn(pool, w.scope, w.xSub, w.r1, NOW);
    const same = await moveSeat(pool, w.scope, w.xSub, w.s99, NOW);
    expect(same).toMatchObject({ ok: true, value: { seatCode: "R1-99" } });
    expect(await auditCount(w.orgId, "presence.move")).toBe(0);
    const moved = await moveSeat(pool, w.scope, w.xSub, w.s100, NOW);
    expect(moved).toMatchObject({ ok: true, value: { seatCode: "R1-100" } });
    expect((await presenceRows(w.x))[0].seat_id).toBe(w.s100);
    const a = await one(
      "select meta from audit_log where org_id = $1 and action = 'presence.move'",
      [w.orgId],
    );
    expect(a.meta).toMatchObject({ room: "R1", from: "R1-99", to: "R1-100" });
  });

  it("another member's seat, a seat in another room and an unknown id -> 422 seat_not_yours", async () => {
    const w = await world();
    await checkIn(pool, w.scope, w.xSub, w.r1, NOW);
    for (const id of [w.sy, w.s2, randomUUID()]) {
      expect(await moveSeat(pool, w.scope, w.xSub, id, NOW)).toMatchObject({
        ok: false,
        status: 422,
        code: "seat_not_yours",
      });
    }
    expect(await auditCount(w.orgId, "presence.move")).toBe(0);
  });

  it("no active check-in -> 409 not_checked_in, even with a bad seat", async () => {
    const w = await world();
    expect(await moveSeat(pool, w.scope, w.xSub, randomUUID(), NOW)).toMatchObject({
      ok: false,
      status: 409,
      code: "not_checked_in",
    });
  });
});

describe("presence (db): reads and the work day", () => {
  it("a check-in before 17:00Z ends at 17:00Z: read omits it, me shows null, a new check-in is a second row", async () => {
    const w = await world();
    const before = new Date("2026-11-26T16:59:59.000Z");
    const after = new Date("2026-11-26T17:00:01.000Z");
    await checkIn(pool, w.scope, w.xSub, w.r1, before);
    const inside = await listRoomPresence(pool, w.scope, w.r1, before);
    expect(inside).toMatchObject({ ok: true, value: { members: [{ memberId: w.x }] } });
    const gone = await listRoomPresence(pool, w.scope, w.r1, after);
    expect(gone).toMatchObject({ ok: true, value: { workDate: "2026-11-27", members: [] } });
    expect((await getMyPresence(pool, w.scope, w.xSub, after)).presence).toBeNull();
    expect(await checkIn(pool, w.scope, w.xSub, w.r1, after)).toMatchObject({ ok: true });
    expect(await presenceRows(w.x)).toHaveLength(2);
  });

  it("org scope: another org gets 404 on check-in and read; the read lists only own org rows", async () => {
    const w = await world();
    const b = newOrg();
    const bm = await addMember(pool, b.orgId);
    expect(await checkIn(pool, b.scope, await subOf(bm), w.r1, NOW)).toMatchObject({
      ok: false,
      status: 404,
    });
    expect(await listRoomPresence(pool, b.scope, w.r1, NOW)).toMatchObject({
      ok: false,
      status: 404,
    });
    await checkIn(pool, w.scope, w.xSub, w.r1, NOW);
    await checkIn(pool, w.scope, w.ySub, w.r1, new Date(NOW.getTime() + 1000));
    const r = await listRoomPresence(pool, w.scope, w.r1, NOW);
    expect(r.ok && r.value.members.map((m) => m.memberId)).toEqual([w.x, w.y]);
  });

  it("GET me: recent holds the latest check-in per room, newest first", async () => {
    const w = await world();
    await checkIn(pool, w.scope, w.xSub, w.r1, NOW);
    await checkOut(pool, w.scope, w.xSub, new Date(NOW.getTime() + 1000));
    await checkIn(pool, w.scope, w.xSub, w.r2, new Date(NOW.getTime() + 2000));
    const me = await getMyPresence(pool, w.scope, w.xSub, new Date(NOW.getTime() + 3000));
    expect(me.workDate).toBe("2026-11-26");
    expect(me.presence).toMatchObject({ roomCode: "R2" });
    expect(me.recent.map((r) => r.roomCode)).toEqual(["R2"]);
    const noRow = await getMyPresence(pool, w.scope, randomUUID(), NOW);
    expect(noRow).toEqual({ workDate: "2026-11-26", presence: null, recent: [] });
  });

  it("recent lists one entry per room across work dates, newest first", async () => {
    const w = await world();
    const d1 = new Date("2026-11-24T03:00:00.000Z");
    const d2 = new Date("2026-11-25T03:00:00.000Z");
    await checkIn(pool, w.scope, w.xSub, w.r1, d1);
    await checkIn(pool, w.scope, w.xSub, w.r2, d2);
    await checkIn(pool, w.scope, w.xSub, w.r1, NOW);
    const me = await getMyPresence(pool, w.scope, w.xSub, NOW);
    expect(me.recent.map((r) => r.roomCode)).toEqual(["R1", "R2"]);
  });

  it("read guard: a seat changed by raw SQL hides the row and lets check-in reopen it", async () => {
    const w = await world();
    await checkIn(pool, w.scope, w.xSub, w.r1, NOW);
    await pool.query("update seats set occupant_id = $2 where id = $1", [w.s99, w.y]);
    const r = await listRoomPresence(pool, w.scope, w.r1, NOW);
    expect(r).toMatchObject({ ok: true, value: { members: [] } });
    expect(await checkIn(pool, w.scope, w.xSub, w.r1, NOW)).toMatchObject({
      ok: true,
      value: { seatCode: "R1-100" },
    });
    expect(await presenceRows(w.x)).toHaveLength(1);
  });
});

describe("presence (db): D82 the check-in ends when the seat is lost", () => {
  const live = () => new Date();
  const ended = async (w: Awaited<ReturnType<typeof world>>, reason: string) => {
    const [p] = await presenceRows(w.x);
    expect(p?.checked_out_by).toBe("system");
    expect(await auditCount(w.orgId, "presence.system_check_out")).toBe(1);
    const a = await one(
      "select meta from audit_log where org_id = $1 and action = 'presence.system_check_out'",
      [w.orgId],
    );
    expect(a.meta).toMatchObject({ reason, memberId: w.x });
  };
  const start = async () => {
    const w = await world();
    await checkIn(pool, w.scope, w.xSub, w.r1, live());
    return w;
  };

  it("releaseSeat", async () => {
    const w = await start();
    const r = await releaseSeat(pool, w.scope, w.xSub, "user", w.s99);
    expect(r.ok).toBe(true);
    await ended(w, "seat_released");
  });

  it("setOccupant replace and unassign", async () => {
    const w = await start();
    const rep = await setOccupant(pool, w.scope, randomUUID(), w.s99, {
      memberId: w.z,
      expectedOccupantId: w.x,
    });
    expect(rep.ok).toBe(true);
    await ended(w, "seat_reassigned");
    const u = await start();
    const un = await setOccupant(pool, u.scope, randomUUID(), u.s99, {
      memberId: null,
      expectedOccupantId: u.x,
    });
    expect(un.ok).toBe(true);
    await ended(u, "seat_unassigned");
  });

  it("deactivateMember with release", async () => {
    const w = await start();
    const r = await deactivateMember(pool, w.scope, randomUUID(), w.x, true);
    expect(r.ok).toBe(true);
    await ended(w, "member_deactivated");
  });

  it("deleteRoom force ends the check-in, then the row is gone by cascade", async () => {
    const w = await start();
    const r = await deleteRoom(pool, w.scope, randomUUID(), w.r1, true);
    expect(r.ok).toBe(true);
    expect(await auditCount(w.orgId, "presence.system_check_out")).toBe(1);
    expect(await presenceRows(w.x)).toHaveLength(0);
  });

  it("releasing another seat of the member leaves the check-in active", async () => {
    const w = await start();
    await releaseSeat(pool, w.scope, w.xSub, "user", w.s100);
    expect((await presenceRows(w.x))[0].checked_out_at).toBeNull();
    expect(await auditCount(w.orgId, "presence.system_check_out")).toBe(0);
  });

  it("deleting an empty seat that has an ended row succeeds", async () => {
    const w = await start();
    await releaseSeat(pool, w.scope, w.xSub, "user", w.s99);
    const r = await deleteSeat(pool, w.scope, randomUUID(), w.s99);
    expect(r.ok).toBe(true);
    expect(await presenceRows(w.x)).toHaveLength(0);
  });
});

describe("presence (db): provider check-in", () => {
  const emailOf = async (memberId: string) =>
    (await one("select email from members where id = $1", [memberId])).email as string;
  const apply = (
    w: { scope: Parameters<typeof checkIn>[1] },
    member: { kind: "email" | "sub"; value: string },
    roomCode: string,
    at: Date = NOW,
  ) => applyProviderCheckIn(pool, w.scope, { member, roomCode }, at, NOW, "mock");

  it("provider: inserts source provider on the lowest seat, today's work date, audit with meta.source provider, actor = member sub", async () => {
    const w = await world();
    const at = new Date(NOW.getTime() - 600_000);
    expect(await apply(w, { kind: "email", value: await emailOf(w.x) }, "R1", at)).toBe("applied");
    const [p] = await presenceRows(w.x);
    expect(p.source).toBe("provider");
    expect(p.seat_id).toBe(w.s99);
    expect(p.checked_in_at.toISOString()).toBe(at.toISOString());
    expect(String(p.work_date).slice(0, 10)).toBe(workDateUtc7(NOW));
    const a = await one(
      "select actor_sub, meta from audit_log where org_id = $1 and action = 'presence.check_in'",
      [w.orgId],
    );
    expect(a.actor_sub).toBe(w.xSub);
    expect(a.meta).toMatchObject({
      source: "provider",
      provider: "mock",
      room: "R1",
      seat: "R1-99",
    });
    expect(JSON.stringify(a.meta)).not.toContain("@");
  });

  it("provider: active self check-in is left unchanged (same room and other room); no audit", async () => {
    const w = await world();
    await checkIn(pool, w.scope, w.xSub, w.r1, NOW);
    expect(await apply(w, { kind: "sub", value: w.xSub }, "R1")).toBe("skip_active");
    expect(await apply(w, { kind: "sub", value: w.xSub }, "R2")).toBe("skip_active");
    const rowsNow = await presenceRows(w.x);
    expect(rowsNow).toHaveLength(1);
    expect(rowsNow[0].source).toBe("self");
    expect(await auditCount(w.orgId, "presence.check_in")).toBe(1);
  });

  it("provider: applying twice writes one row and one audit", async () => {
    const w = await world();
    expect(await apply(w, { kind: "sub", value: w.xSub }, "R1")).toBe("applied");
    expect(await apply(w, { kind: "sub", value: w.xSub }, "R1")).toBe("skip_active");
    expect(await presenceRows(w.x)).toHaveLength(1);
    expect(await auditCount(w.orgId, "presence.check_in")).toBe(1);
  });

  it("provider: does not reopen a row checked out today", async () => {
    const w = await world();
    await checkIn(pool, w.scope, w.xSub, w.r1, NOW);
    await checkOut(pool, w.scope, w.xSub, new Date(NOW.getTime() + 1000));
    expect(await apply(w, { kind: "sub", value: w.xSub }, "R1")).toBe("skip_today_row");
    const [p] = await presenceRows(w.x);
    expect(p.checked_out_at).not.toBeNull();
    expect(await auditCount(w.orgId, "presence.check_in")).toBe(1);
  });

  it("provider: a self check-in after a provider check-in to the same room returns the provider row (200, no write); another room -> 409", async () => {
    const w = await world();
    await apply(w, { kind: "sub", value: w.xSub }, "R1");
    const same = await checkIn(pool, w.scope, w.xSub, w.r1, new Date(NOW.getTime() + 1000));
    expect(same).toMatchObject({ ok: true, value: { roomCode: "R1", source: "provider" } });
    expect(await auditCount(w.orgId, "presence.check_in")).toBe(1);
    expect(await checkIn(pool, w.scope, w.xSub, w.r2, NOW)).toMatchObject({
      ok: false,
      status: 409,
      code: "already_checked_in",
      room: "R1",
    });
  });

  it("provider: unknown member, ambiguous email, deactivated member, unknown room code, no seat in room -> skipped, no row", async () => {
    const w = await world();
    expect(await apply(w, { kind: "email", value: "nobody@simap.example" }, "R1")).toBe(
      "unknown_member",
    );
    expect(await apply(w, { kind: "sub", value: randomUUID() }, "R1")).toBe("unknown_member");
    const dupEmail = await emailOf(w.y);
    await pool.query(
      "insert into members (org_id, sub, email, display_name) values ($1, $2, $3, 'Dup')",
      [w.orgId, randomUUID(), dupEmail.toUpperCase()],
    );
    expect(await apply(w, { kind: "email", value: dupEmail }, "R1")).toBe("ambiguous_member");
    await pool.query("update members set status = 'deactivated' where id = $1", [w.x]);
    expect(await apply(w, { kind: "sub", value: w.xSub }, "R1")).toBe("inactive_member");
    expect(await apply(w, { kind: "sub", value: w.ySub }, "NOPE")).toBe("unknown_room");
    expect(await apply(w, { kind: "sub", value: w.ySub }, "R2")).toBe("skip_no_seat");
    for (const id of [w.x, w.y, w.z]) expect(await presenceRows(id)).toHaveLength(0);
    expect(await auditCount(w.orgId, "presence.check_in")).toBe(0);
  });

  it("provider: a member of another org with the same email is not matched", async () => {
    const w = await world();
    const b = newOrg();
    const bm = await addMember(pool, b.orgId);
    const bEmail = await emailOf(bm);
    expect(await apply(w, { kind: "email", value: bEmail }, "R1")).toBe("unknown_member");
    expect(await apply(w, { kind: "sub", value: await subOf(bm) }, "R1")).toBe("unknown_member");
    expect(await presenceRows(bm)).toHaveLength(0);
  });

  it("provider: room presence lists the member with source provider", async () => {
    const w = await world();
    await apply(w, { kind: "sub", value: w.xSub }, "R1");
    const r = await listRoomPresence(pool, w.scope, w.r1, NOW);
    expect(r).toMatchObject({
      ok: true,
      value: { members: [{ memberId: w.x, source: "provider" }] },
    });
    expect((await getMyPresence(pool, w.scope, w.xSub, NOW)).presence).toMatchObject({
      source: "provider",
    });
  });
});
