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
import { dbMemberGate } from "./gate";
import {
  deactivateMember,
  getDeactivationImpact,
  getMember,
  listMembers,
  listPendingInvitations,
  reactivateMember,
  updateMember,
} from "./manage";

let pool: pg.Pool;

beforeAll(async () => {
  pool = testPool();
  await assertTestDb(pool);
});
afterAll(async () => {
  await pool.end();
});

const ok = <T>(r: { ok: true; value: T } | { ok: false; code?: string }): T => {
  if (!r.ok) throw new Error("expected ok, got " + JSON.stringify(r));
  return r.value;
};
const one = async (sql: string, values: unknown[]) => (await pool.query(sql, values)).rows[0];
const subOf = async (id: string): Promise<string> =>
  (await one("select sub from members where id = $1", [id])).sub;
const audits = async (orgId: string, action: string) =>
  (
    await pool.query("select meta, actor_sub from audit_log where org_id = $1 and action = $2", [
      orgId,
      action,
    ])
  ).rows;

/** Actor (a Manager with a member row), a target who sits on a seat with a primary device, and extras. */
async function world() {
  const { orgId, scope } = newOrg();
  const actor = await addMember(pool, orgId);
  const target = await addMember(pool, orgId);
  const other = await addMember(pool, orgId);
  const room = await addRoom(pool, orgId, "C1");
  const seat = await addSeat(pool, orgId, room, "C1", 1, { occupantId: target });
  const otherSeat = await addSeat(pool, orgId, room, "C1", 2, { occupantId: other });
  const primary = await addDevice(pool, orgId, target, seat, "primary");
  const borrowed = await addDevice(pool, orgId, target, otherSeat, "secondary");
  const othersSecondary = await addDevice(pool, orgId, other, seat, "secondary");
  const inventory = await addDevice(pool, orgId, target, null, "secondary");
  const freeSeat = await addSeat(pool, orgId, room, "C1", 3);
  const pending = await addPendingRequest(pool, orgId, freeSeat, target);
  const forOthers = await addPendingRequest(pool, orgId, freeSeat, other);
  await pool.query("update seat_requests set created_by_id = $2 where id = $1", [
    forOthers,
    target,
  ]);
  return {
    orgId,
    scope,
    actor,
    target,
    other,
    seat,
    otherSeat,
    primary,
    borrowed,
    othersSecondary,
    inventory,
    pending,
    forOthers,
  };
}

describe("members manage (db)", () => {
  it("impact counts seats, placed devices, primaries to demote, pending requests", async () => {
    const w = await world();
    expect(ok(await getDeactivationImpact(pool, w.scope, w.target))).toEqual({
      occupiedSeats: 1,
      placedDevices: 2,
      primaryDevicesToDemote: 1,
      pendingRequests: 1,
    });
    expect(await getDeactivationImpact(pool, w.scope, randomUUID())).toMatchObject({
      ok: false,
      status: 404,
    });
    const foreign = newOrg();
    expect(await getDeactivationImpact(pool, foreign.scope, w.target)).toMatchObject({
      ok: false,
      status: 404,
    });
  });

  it("deactivate with release: seats cleared, primary demoted, owned placed devices returned, others untouched, requests cancelled, one audit row", async () => {
    const w = await world();
    const actorSub = await subOf(w.actor);
    const m = ok(await deactivateMember(pool, w.scope, actorSub, w.target, true));
    expect(m).toMatchObject({ status: "deactivated", seatCount: 0, deviceCount: 3 });

    expect(
      (await one("select occupant_id from seats where id = $1", [w.seat])).occupant_id,
    ).toBeNull();
    expect(
      (await one("select occupant_id from seats where id = $1", [w.otherSeat])).occupant_id,
    ).toBe(w.other);
    const dev = async (id: string) => one("select role, seat_id from devices where id = $1", [id]);
    expect(await dev(w.primary)).toEqual({ role: "secondary", seat_id: null });
    expect(await dev(w.borrowed)).toEqual({ role: "secondary", seat_id: null });
    expect(await dev(w.inventory)).toEqual({ role: "secondary", seat_id: null });
    expect(await dev(w.othersSecondary)).toEqual({ role: "secondary", seat_id: w.seat });

    const req = async (id: string) =>
      one(
        "select status, decided_at is not null as decided, decided_by_id from seat_requests where id = $1",
        [id],
      );
    expect(await req(w.pending)).toEqual({
      status: "cancelled",
      decided: true,
      decided_by_id: w.actor,
    });
    expect(await req(w.forOthers)).toEqual({
      status: "pending",
      decided: false,
      decided_by_id: null,
    });

    const a = await audits(w.orgId, "member.deactivate");
    expect(a).toHaveLength(1);
    expect(a[0].meta).toEqual({
      released: true,
      seats: 1,
      devices: 2,
      demoted: 1,
      cancelledRequests: 1,
    });
  });

  it("deactivate without release on a non-empty member -> 409 member_not_empty, nothing changed; on an empty member -> deactivated and pending requests cancelled", async () => {
    const w = await world();
    const actorSub = await subOf(w.actor);
    expect(await deactivateMember(pool, w.scope, actorSub, w.target, false)).toMatchObject({
      ok: false,
      status: 409,
      code: "member_not_empty",
    });
    expect((await one("select status from members where id = $1", [w.target])).status).toBe(
      "active",
    );
    expect((await one("select occupant_id from seats where id = $1", [w.seat])).occupant_id).toBe(
      w.target,
    );
    expect(await audits(w.orgId, "member.deactivate")).toHaveLength(0);

    const empty = await addMember(pool, w.orgId);
    const free = await one(
      "select id from seats where org_id = $1 and occupant_id is null limit 1",
      [w.orgId],
    );
    await addPendingRequest(pool, w.orgId, free.id, empty);
    const r = ok(await deactivateMember(pool, w.scope, actorSub, empty, false));
    expect(r.status).toBe("deactivated");
    const q = await one("select status from seat_requests where subject_id = $1", [empty]);
    expect(q.status).toBe("cancelled");
  });

  it("deactivate self -> 409; twice -> second is a no-op; reactivate -> active, audit, seats not restored", async () => {
    const w = await world();
    const actorSub = await subOf(w.actor);
    expect(
      await deactivateMember(pool, w.scope, await subOf(w.target), w.target, true),
    ).toMatchObject({
      ok: false,
      status: 409,
      code: "cannot_deactivate_self",
    });
    ok(await deactivateMember(pool, w.scope, actorSub, w.target, true));
    ok(await deactivateMember(pool, w.scope, actorSub, w.target, true));
    expect(await audits(w.orgId, "member.deactivate")).toHaveLength(1);

    expect(ok(await reactivateMember(pool, w.scope, actorSub, w.target)).status).toBe("active");
    ok(await reactivateMember(pool, w.scope, actorSub, w.target));
    expect(await audits(w.orgId, "member.reactivate")).toHaveLength(1);
    expect(ok(await getMember(pool, w.scope, w.target)).seatCount).toBe(0);
  });

  it("gate: deactivate makes dbMemberGate return deactivated; reactivate returns active on the next call", async () => {
    const w = await world();
    const actorSub = await subOf(w.actor);
    const targetSub = await subOf(w.target);
    const { createMemberGate } = await import("./gate");
    const gate = createMemberGate(() => pool);
    expect(await gate(w.scope, targetSub)).toBe("active");
    ok(await deactivateMember(pool, w.scope, actorSub, w.target, true));
    expect(await gate(w.scope, targetSub)).toBe("deactivated");
    ok(await reactivateMember(pool, w.scope, actorSub, w.target));
    expect(await gate(w.scope, targetSub)).toBe("active");
    expect(typeof dbMemberGate).toBe("function");
    expect(await gate(w.scope, randomUUID())).toBe("active");
  });

  it("employee code: duplicate in the same org -> 409; same code in another org OK; clearing frees it", async () => {
    const a = newOrg();
    const b = newOrg();
    const [a1, a2] = [await addMember(pool, a.orgId), await addMember(pool, a.orgId)];
    const b1 = await addMember(pool, b.orgId);
    const actor = randomUUID();
    ok(await updateMember(pool, a.scope, actor, a1, { employeeCode: "E1" }));
    expect(await updateMember(pool, a.scope, actor, a2, { employeeCode: "E1" })).toMatchObject({
      ok: false,
      status: 409,
      code: "employee_code_taken",
    });
    ok(await updateMember(pool, b.scope, actor, b1, { employeeCode: "E1" }));
    ok(await updateMember(pool, a.scope, actor, a1, { employeeCode: null }));
    ok(await updateMember(pool, a.scope, actor, a2, { employeeCode: "E1" }));
  });

  it("updateMember: only given fields, audit names only, deactivated members editable, group of another org -> 400", async () => {
    const a = newOrg();
    const b = newOrg();
    const m = await addMember(pool, a.orgId);
    const actor = randomUUID();
    const g = (
      await one("insert into groups (org_id, name) values ($1, 'Dev') returning id", [a.orgId])
    ).id;
    const foreign = (
      await one("insert into groups (org_id, name) values ($1, 'Dev') returning id", [b.orgId])
    ).id;

    const r = ok(
      await updateMember(pool, a.scope, actor, m, { displayName: "Trần Thị Bé", groupId: g }),
    );
    expect(r).toMatchObject({
      displayName: "Trần Thị Bé",
      employeeCode: null,
      group: { id: g, name: "Dev" },
    });
    const rows = await audits(a.orgId, "member.update");
    expect(rows).toHaveLength(1);
    expect(rows[0].meta).toEqual({ fields: ["displayName", "groupId"] });

    ok(await updateMember(pool, a.scope, actor, m, { displayName: "Trần Thị Bé" }));
    expect(await audits(a.orgId, "member.update")).toHaveLength(1);

    expect(await updateMember(pool, a.scope, actor, m, { groupId: foreign })).toMatchObject({
      ok: false,
      status: 400,
      code: "invalid_request",
    });
    expect(await updateMember(pool, b.scope, actor, m, { displayName: "x" })).toMatchObject({
      ok: false,
      status: 404,
    });

    await pool.query("update members set status = 'deactivated' where id = $1", [m]);
    expect(
      ok(await updateMember(pool, a.scope, actor, m, { employeeCode: "Z9" })).employeeCode,
    ).toBe("Z9");
  });

  it("list: search (diacritics, email, code), literal % and _, status filter, paging with equal names, true counts with capped refs, org isolation", async () => {
    const a = newOrg();
    const other = newOrg();
    await addMember(pool, other.orgId);
    const ids: string[] = [];
    const names = ["Nguyễn Văn A", "Nguyễn Văn A", "Nguyễn Văn A", "Trần 50%_x", "Lê Bình"];
    for (const n of names) {
      const id = await addMember(pool, a.orgId);
      await pool.query("update members set display_name = $2 where id = $1", [id, n]);
      ids.push(id);
    }
    await pool.query(
      "update members set employee_code = 'EMP-77', email = 'binh.le@simap.example', status = 'deactivated' where id = $1",
      [ids[4]],
    );

    const find = async (f: Partial<Parameters<typeof listMembers>[2]>) =>
      (await listMembers(pool, a.scope, { status: "all", limit: 50, ...f })).items.map((i) => i.id);

    expect(await find({})).toHaveLength(5);
    expect((await find({ q: "Nguyễn" })).sort()).toEqual([ids[0], ids[1], ids[2]].sort());
    expect((await find({ q: "nguyen" })).sort()).toEqual([ids[0], ids[1], ids[2]].sort());
    expect((await find({ q: "NGUYEN" })).sort()).toEqual([ids[0], ids[1], ids[2]].sort());
    expect(await find({ q: "le binh" })).toEqual([ids[4]]);
    expect(await find({ q: "binh.le@" })).toEqual([ids[4]]);
    expect(await find({ q: "emp-77" })).toEqual([ids[4]]);
    expect(await find({ q: "50%_" })).toEqual([ids[3]]);
    expect(await find({ q: "%" })).toEqual([ids[3]]);
    expect(await find({ q: "_" })).toEqual([ids[3]]);
    expect(await find({ status: "deactivated" })).toEqual([ids[4]]);
    expect(await find({ status: "active" })).toHaveLength(4);

    const seen: string[] = [];
    let cursor: { k: string; id: string } | undefined;
    const { decodeMemberCursor } = await import("@/lib/members/cursor");
    for (let i = 0; i < 10; i++) {
      const page = await listMembers(pool, a.scope, {
        status: "all",
        limit: 2,
        ...(cursor && { cursor }),
      });
      seen.push(...page.items.map((m) => m.id));
      if (!page.nextCursor) break;
      cursor = decodeMemberCursor(page.nextCursor)!;
    }
    expect([...seen].sort()).toEqual([...ids].sort());
    expect(new Set(seen).size).toBe(5);

    // counts are true while refs are capped at 20
    const room = await addRoom(pool, a.orgId, "BIG");
    for (let i = 1; i <= 22; i++)
      await addSeat(pool, a.orgId, room, "BIG", i, { occupantId: ids[0]! });
    const big = (await listMembers(pool, a.scope, { status: "all", limit: 50 })).items.find(
      (m) => m.id === ids[0],
    )!;
    expect(big.seatCount).toBe(22);
    expect(big.seats).toHaveLength(20);
    const full = ok(await getMember(pool, a.scope, ids[0]!));
    expect(full.seats).toHaveLength(22);
    expect(await getMember(pool, other.scope, ids[0]!)).toMatchObject({ ok: false, status: 404 });
  });

  it("invitations: only pending, unexpired, own org; empty table -> []", async () => {
    const a = newOrg();
    const b = newOrg();
    expect(await listPendingInvitations(pool, a.scope)).toEqual([]);
    const ins = (org: string, email: string, status: string, exp: string | null) =>
      pool.query(
        `insert into invitations (org_id, email, role, invited_by_sub, status, expires_at)
         values ($1, $2, 'simap:user', $3, $4, ${exp ?? "null"})`,
        [org, email, randomUUID(), status],
      );
    await ins(a.orgId, "p1@x.vn", "pending", "now() + interval '1 day'");
    await ins(a.orgId, "p2@x.vn", "pending", null);
    await ins(a.orgId, "old@x.vn", "pending", "now() - interval '1 day'");
    await ins(a.orgId, "acc@x.vn", "accepted", null);
    await ins(b.orgId, "other@x.vn", "pending", null);
    const list = await listPendingInvitations(pool, a.scope);
    expect(list.map((i) => i.email).sort()).toEqual(["p1@x.vn", "p2@x.vn"]);
    expect(Object.keys(list[0]!).sort()).toEqual(["createdAt", "email", "expiresAt", "id", "role"]);
  });
});
