import { randomUUID } from "node:crypto";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addMember,
  addPendingRequest,
  addRoom,
  addSeat,
  assertTestDb,
  newOrg,
  testPool,
} from "@/test/db/fixtures";
import { decodeCursor } from "@/lib/audit/cursor";
import { listMyRequests, listRequests, markRequestsSeen } from "./read";
import { approveRequest } from "./requests";

let pool: pg.Pool;

const one = async (sql: string, values: unknown[]) => (await pool.query(sql, values)).rows[0];
const subOf = async (memberId: string) =>
  (await one("select sub from members where id = $1", [memberId])).sub as string;

/** Org with room C302, `n` empty seats, members a, b and boss. Seats are distinct so rows never collide on the pending index. */
async function world(n = 8) {
  const o = newOrg();
  const roomId = await addRoom(pool, o.orgId, "C302", { seatCounter: n });
  const seats: string[] = [];
  for (let i = 1; i <= n; i++) seats.push(await addSeat(pool, o.orgId, roomId, "C302", i));
  const a = await addMember(pool, o.orgId);
  const b = await addMember(pool, o.orgId);
  const boss = await addMember(pool, o.orgId);
  return {
    ...o,
    roomId,
    seats,
    a,
    b,
    boss,
    aSub: await subOf(a),
    bossSub: await subOf(boss),
  };
}

/** A decided row needs a non-null decided_at (seat_requests_decided_check). */
const decide = (id: string, status: string, decidedAt: string) =>
  pool.query("update seat_requests set status = $2, decided_at = $3::timestamptz where id = $1", [
    id,
    status,
    decidedAt,
  ]);

const T1 = "2026-01-01T00:00:00.000000Z";
const T2 = "2026-01-02T00:00:00.000000Z";

beforeAll(async () => {
  pool = testPool();
  await assertTestDb(pool);
});
afterAll(async () => {
  await pool.end();
});

describe("listRequests (db)", () => {
  it("filters by each status and never shows another org's rows", async () => {
    const w = await world();
    const ids = {
      pending: await addPendingRequest(pool, w.orgId, w.seats[0]!, w.a),
      approved: await addPendingRequest(pool, w.orgId, w.seats[1]!, w.a),
      rejected: await addPendingRequest(pool, w.orgId, w.seats[2]!, w.a),
      cancelled: await addPendingRequest(pool, w.orgId, w.seats[3]!, w.a),
    };
    await decide(ids.approved, "approved", T1);
    await decide(ids.rejected, "rejected", T1);
    await decide(ids.cancelled, "cancelled", T1);
    const o = await world(1);
    await addPendingRequest(pool, o.orgId, o.seats[0]!, o.a);

    for (const status of ["pending", "approved", "rejected", "cancelled"] as const) {
      const page = await listRequests(pool, w.scope, { status, limit: 50 });
      expect(page.items.map((i) => i.id)).toEqual([ids[status]]);
      expect(page.items[0]).toMatchObject({ status, subject: { id: w.a } });
      expect(page.nextCursor).toBeNull();
    }
  });

  it("cursor pages across rows with the same created_at: no duplicates, no gaps", async () => {
    const w = await world();
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      ids.push(await addPendingRequest(pool, w.orgId, w.seats[i]!, w.a));
    }
    await pool.query("update seat_requests set created_at = $2::timestamptz where id = any($1)", [
      ids,
      T1,
    ]);
    const expected = [...ids].sort().reverse();
    const seen: string[] = [];
    const sizes: number[] = [];
    let cursor: Parameters<typeof listRequests>[2]["cursor"];
    for (let page = 0; page < 5; page++) {
      const p = await listRequests(pool, w.scope, { status: "pending", limit: 2, cursor });
      seen.push(...p.items.map((i) => i.id));
      sizes.push(p.items.length);
      if (p.nextCursor === null) break;
      cursor = decodeCursor(p.nextCursor)!;
    }
    expect(sizes).toEqual([2, 2, 1]);
    expect(seen).toEqual(expected);
  });

  it("joins the current occupant, null for an empty seat", async () => {
    const w = await world();
    const taken = await addSeat(pool, w.orgId, w.roomId, "C302", 20, { occupantId: w.boss });
    const r1 = await addPendingRequest(pool, w.orgId, taken, w.a);
    const r2 = await addPendingRequest(pool, w.orgId, w.seats[1]!, w.a);
    const page = await listRequests(pool, w.scope, { status: "pending", limit: 50 });
    const by = Object.fromEntries(page.items.map((i) => [i.id, i.currentOccupant]));
    expect(by[r1]).toMatchObject({ id: w.boss });
    expect(by[r2]).toBeNull();
  });
});

describe("listMyRequests (db)", () => {
  it("returns only the caller's requests, newest first", async () => {
    const w = await world();
    const mine1 = await addPendingRequest(pool, w.orgId, w.seats[0]!, w.a);
    const mine2 = await addPendingRequest(pool, w.orgId, w.seats[1]!, w.a);
    await addPendingRequest(pool, w.orgId, w.seats[2]!, w.b);
    await pool.query("update seat_requests set created_at = $2::timestamptz where id = $1", [
      mine1,
      T1,
    ]);
    await pool.query("update seat_requests set created_at = $2::timestamptz where id = $1", [
      mine2,
      T2,
    ]);
    const o = await world(1);
    await addPendingRequest(pool, o.orgId, o.seats[0]!, o.a);
    const page = await listMyRequests(pool, w.scope, w.aSub, { limit: 50 });
    expect(page.items.map((i) => i.id)).toEqual([mine2, mine1]);
    expect(page.nextCursor).toBeNull();
  });

  it("isNew and unseen: approved, rejected and auto-rejected count; pending and cancelled never", async () => {
    const w = await world();
    const approved = await addPendingRequest(pool, w.orgId, w.seats[0]!, w.a);
    const rejected = await addPendingRequest(pool, w.orgId, w.seats[1]!, w.a);
    const pending = await addPendingRequest(pool, w.orgId, w.seats[2]!, w.a);
    const cancelled = await addPendingRequest(pool, w.orgId, w.seats[3]!, w.a);
    const rival = await addPendingRequest(pool, w.orgId, w.seats[4]!, w.a);
    const winner = await addPendingRequest(pool, w.orgId, w.seats[4]!, w.b);
    await decide(approved, "approved", T1);
    await decide(rejected, "rejected", T1);
    await decide(cancelled, "cancelled", T1);
    expect((await approveRequest(pool, w.scope, w.bossSub, winner)).ok).toBe(true);

    const page = await listMyRequests(pool, w.scope, w.aSub, { limit: 50 });
    const isNew = Object.fromEntries(page.items.map((i) => [i.id, i.isNew]));
    expect(isNew).toEqual({
      [approved]: true,
      [rejected]: true,
      [pending]: false,
      [cancelled]: false,
      [rival]: true,
    });
    expect(page.unseen).toBe(page.items.filter((i) => i.isNew).length);
    expect(page.unseen).toBe(3);
  });

  it("unseen counts all of the caller's rows, not just the page", async () => {
    const w = await world();
    for (let i = 0; i < 3; i++) {
      await decide(await addPendingRequest(pool, w.orgId, w.seats[i]!, w.a), "approved", T1);
    }
    const page = await listMyRequests(pool, w.scope, w.aSub, { limit: 1 });
    expect(page.items).toHaveLength(1);
    expect(page.unseen).toBe(3);
    expect(page.nextCursor).not.toBeNull();
  });

  it("caller without a member row -> empty page, unseen 0", async () => {
    const w = await world();
    expect(await listMyRequests(pool, w.scope, randomUUID(), { limit: 50 })).toEqual({
      items: [],
      unseen: 0,
      nextCursor: null,
    });
  });
});

describe("markRequestsSeen (db)", () => {
  it("with null requests_seen_at and a past seenUpTo sets it; without seenUpTo uses now", async () => {
    const w = await world();
    await decide(await addPendingRequest(pool, w.orgId, w.seats[0]!, w.a), "approved", T1);
    const r1 = await markRequestsSeen(pool, w.scope, w.aSub, "2025-12-31T00:00:00.000000Z");
    expect(r1).toEqual({ unseen: 1, requestsSeenAt: "2025-12-31T00:00:00.000000Z" });
    const r2 = await markRequestsSeen(pool, w.scope, w.aSub, null);
    expect(r2.unseen).toBe(0);
    const ok = await one(
      "select requests_seen_at <= now() and requests_seen_at > now() - interval '1 minute' as ok from members where id = $1",
      [w.a],
    );
    expect(ok.ok).toBe(true);
  });

  it("moves forward only", async () => {
    const w = await world();
    await markRequestsSeen(pool, w.scope, w.aSub, T2);
    const r = await markRequestsSeen(pool, w.scope, w.aSub, T1);
    expect(r.requestsSeenAt).toBe(T2);
  });

  it("caps a future seenUpTo at now", async () => {
    const w = await world();
    const r = await markRequestsSeen(pool, w.scope, w.aSub, "2999-01-01T00:00:00.000000Z");
    expect(r.requestsSeenAt).not.toBeNull();
    const ok = await one("select requests_seen_at <= now() as ok from members where id = $1", [
      w.a,
    ]);
    expect(ok.ok).toBe(true);
  });

  it("seenUpTo equal to a decidedAt clears that row but not one decided 1 microsecond later", async () => {
    const w = await world();
    const r1 = await addPendingRequest(pool, w.orgId, w.seats[0]!, w.a);
    const r2 = await addPendingRequest(pool, w.orgId, w.seats[1]!, w.a);
    await decide(r1, "approved", "2026-01-01T00:00:00.000100Z");
    await decide(r2, "approved", "2026-01-01T00:00:00.000101Z");
    const before = await listMyRequests(pool, w.scope, w.aSub, { limit: 50 });
    const d1 = before.items.find((i) => i.id === r1)!.decidedAt!;
    const res = await markRequestsSeen(pool, w.scope, w.aSub, d1);
    expect(res.unseen).toBe(1);
    const after = await listMyRequests(pool, w.scope, w.aSub, { limit: 50 });
    expect(Object.fromEntries(after.items.map((i) => [i.id, i.isNew]))).toEqual({
      [r1]: false,
      [r2]: true,
    });
  });

  it("caller without a member row is a no-op", async () => {
    const w = await world();
    expect(await markRequestsSeen(pool, w.scope, randomUUID(), null)).toEqual({
      unseen: 0,
      requestsSeenAt: null,
    });
  });
});
