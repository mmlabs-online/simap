import { describe, expect, it } from "vitest";
import type { OrgScope } from "@/server/http/org-scope";
import {
  addSeats,
  deleteSeat,
  getSeat,
  listRoomSeats,
  releaseSeat,
  setCannotSeat,
  setOccupant,
  setSeatTags,
} from "./seats";

const scope = { orgId: "11111111-1111-4111-8111-111111111111" } as OrgScope;
const ACTOR = "22222222-2222-4222-8222-222222222222";
const SEAT = "33333333-3333-4333-8333-333333333333";
const ROOM = "44444444-4444-4444-8444-444444444444";
const X = "55555555-5555-4555-8555-555555555555";
const Y = "66666666-6666-4666-8666-666666666666";

type Call = [string, unknown[]];
type Script = (sql: string, values: unknown[]) => unknown[] | Error;

function fakeDb(script: Script) {
  const calls: Call[] = [];
  const query = async (text: string, values: unknown[] = []) => {
    const sql = text.replace(/\s+/g, " ").trim();
    calls.push([sql, values]);
    if (/^(begin|commit|rollback)$/.test(sql)) return { rows: [] };
    const out = script(sql, values);
    if (out instanceof Error) throw out;
    return { rows: out };
  };
  const db = { query, connect: async () => ({ query, release: () => {} }) };
  const sqls = () => calls.map(([s]) => s);
  return { db, calls, sqls };
}

const seatLock = (o: Record<string, unknown> = {}) => ({
  id: SEAT,
  code: "C302-01",
  occupant_id: null,
  group_id: null,
  cannot_seat: false,
  cannot_seat_reason: null,
  ...o,
});
const dtoRow = {
  id: SEAT,
  code: "C302-01",
  seq: 1,
  room_id: ROOM,
  room_code: "C302",
  cannot_seat: false,
  cannot_seat_reason: null,
  occupant_id: null,
  occupant_name: null,
  occupant_has_photo: null,
  occupant_photo_version: null,
  mine: false,
  group_id: null,
  group_name: null,
  group_color: null,
  project_id: null,
  project_code: null,
  project_name: null,
  device_count: 0,
  devices: [],
};

const base =
  (seat: Record<string, unknown> = {}): Script =>
  (sql) => {
    if (sql.startsWith("select room_id from seats")) return [{ room_id: ROOM }];
    if (sql.startsWith("select id, status, group_id from members"))
      return [{ id: Y, status: "active", group_id: null }];
    if (sql.startsWith("select id from members")) return [{ id: X }];
    if (sql.startsWith("select id, code from rooms")) return [{ id: ROOM, code: "C302" }];
    if (sql.startsWith("select id, code, occupant_id")) return [seatLock(seat)];
    if (sql.startsWith("update rooms set seat_counter")) return [{ seat_counter: 4, code: "C302" }];
    if (sql.startsWith("insert into seats"))
      return [
        { id: "a", code: "C302-04" },
        { id: "b", code: "C302-05" },
      ];
    if (sql.startsWith("select count(*)")) return [{ n: 0 }];
    if (sql.startsWith("update devices")) return [];
    if (sql.includes("json_agg")) return [dtoRow];
    return [];
  };

const lockIdx = (sqls: string[], prefix: string) => sqls.findIndex((s) => s.startsWith(prefix));

describe("org scoping (R6)", () => {
  it("every statement filters org_id = $1 and binds the scope org first", async () => {
    const t = fakeDb(base({ occupant_id: X }));
    await setOccupant(t.db, scope, ACTOR, SEAT, { memberId: Y, expectedOccupantId: X });
    await releaseSeat(t.db, scope, ACTOR, "user", SEAT);
    await setCannotSeat(t.db, scope, ACTOR, SEAT, { cannotSeat: true, reason: "r" });
    await addSeats(t.db, scope, ACTOR, ROOM, 2);
    await deleteSeat(t.db, scope, ACTOR, SEAT);
    const data = t.calls.filter(([s]) => !/^(begin|commit|rollback)$/.test(s));
    expect(data.length).toBeGreaterThan(15);
    for (const [sql, values] of data) {
      expect(sql).toMatch(/org_id\s*=\s*\$1/);
      expect(values[0]).toBe(scope.orgId);
    }
  });
});

describe("lock order", () => {
  it("setOccupant: member for share, room for share, seat for update, then devices, seat, audit", async () => {
    const t = fakeDb(base());
    const r = await setOccupant(t.db, scope, ACTOR, SEAT, {
      memberId: Y,
      expectedOccupantId: null,
    });
    expect(r.ok).toBe(true);
    const s = t.sqls();
    const order = [
      lockIdx(s, "select id, status, group_id from members"),
      lockIdx(s, "select id, code from rooms"),
      lockIdx(s, "select id, code, occupant_id"),
      lockIdx(s, "update devices"),
      lockIdx(s, "update seats"),
      lockIdx(s, "insert into audit_log"),
    ];
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(s[order[0]!]).toMatch(/for share$/);
    expect(s[order[1]!]).toMatch(/for share$/);
    expect(s[order[2]!]).toMatch(/for update$/);
  });

  it("clear and release take no member lock; add and delete take the room for update before any seat", async () => {
    const t = fakeDb(base({ occupant_id: X }));
    await setOccupant(t.db, scope, ACTOR, SEAT, { memberId: null, expectedOccupantId: X });
    await releaseSeat(t.db, scope, ACTOR, "user", SEAT);
    expect(t.sqls().some((s) => s.includes("from members") && /for (share|update)/.test(s))).toBe(
      false,
    );
    const a = fakeDb(base());
    await addSeats(a.db, scope, ACTOR, ROOM, 1);
    expect(a.sqls().find((s) => s.startsWith("select id, code from rooms"))).toMatch(/for update$/);
    const d = fakeDb(base());
    await deleteSeat(d.db, scope, ACTOR, SEAT);
    const s = d.sqls();
    expect(s[lockIdx(s, "select id, code from rooms")]).toMatch(/for update$/);
    expect(lockIdx(s, "select id, code from rooms")).toBeLessThan(
      lockIdx(s, "select id, code, occupant_id"),
    );
  });
});

describe("transaction behaviour", () => {
  it("a no-op writes nothing and no audit", async () => {
    const t = fakeDb(base({ occupant_id: X }));
    const r = await setOccupant(t.db, scope, ACTOR, SEAT, { memberId: X, expectedOccupantId: X });
    expect(r.ok).toBe(true);
    const s = t.sqls();
    expect(s.some((q) => q.startsWith("update ") || q.startsWith("insert into"))).toBe(false);
    expect(s).toContain("commit");
    const e = fakeDb(base());
    await releaseSeat(e.db, scope, ACTOR, "user", SEAT);
    expect(e.sqls().some((q) => q.startsWith("update ") || q.startsWith("insert into"))).toBe(
      false,
    );
  });

  it("a refusal issues ROLLBACK", async () => {
    const t = fakeDb(base({ occupant_id: X }));
    const r = await setOccupant(t.db, scope, ACTOR, SEAT, {
      memberId: Y,
      expectedOccupantId: null,
    });
    expect(r).toEqual({ ok: false, status: 409, code: "occupant_changed" });
    expect(t.sqls()).toContain("rollback");
    expect(t.sqls()).not.toContain("commit");
    const d = fakeDb((sql, v) => (sql.startsWith("select count(*)") ? [{ n: 1 }] : base()(sql, v)));
    expect(await deleteSeat(d.db, scope, ACTOR, SEAT)).toEqual({
      ok: false,
      status: 409,
      code: "seat_not_empty",
    });
    expect(d.sqls()).toContain("rollback");
  });

  it("an unassignable member is 422 and rolls back before any room lock", async () => {
    const t = fakeDb((sql, v) =>
      sql.startsWith("select id, status, group_id from members") ? [] : base()(sql, v),
    );
    const r = await setOccupant(t.db, scope, ACTOR, SEAT, {
      memberId: Y,
      expectedOccupantId: null,
    });
    expect(r).toEqual({ ok: false, status: 422, code: "member_not_assignable" });
    expect(t.sqls().some((s) => s.startsWith("select id, code from rooms"))).toBe(false);
  });

  it("an error after the seat update issues ROLLBACK, no COMMIT", async () => {
    const t = fakeDb((sql, v) =>
      sql.startsWith("insert into audit_log") ? new Error("boom") : base()(sql, v),
    );
    await expect(
      setOccupant(t.db, scope, ACTOR, SEAT, { memberId: Y, expectedOccupantId: null }),
    ).rejects.toThrow("boom");
    const s = t.sqls();
    expect(s.some((q) => q.startsWith("update seats"))).toBe(true);
    expect(s).toContain("rollback");
    expect(s).not.toContain("commit");
  });

  it("the devices FK backstop on delete answers 409 seat_not_empty", async () => {
    const t = fakeDb((sql, v) =>
      sql.startsWith("delete from seats")
        ? Object.assign(new Error("fk"), { code: "23503", constraint: "devices_seat_fkey" })
        : base()(sql, v),
    );
    expect(await deleteSeat(t.db, scope, ACTOR, SEAT)).toEqual({
      ok: false,
      status: 409,
      code: "seat_not_empty",
    });
  });
});

describe("addSeats", () => {
  it("allocates through the room counter count times and writes one audit per seat", async () => {
    const t = fakeDb(base());
    const r = await addSeats(t.db, scope, ACTOR, ROOM, 2);
    expect(r.ok).toBe(true);
    const s = t.sqls();
    expect(s.filter((q) => q.startsWith("update rooms set seat_counter"))).toHaveLength(2);
    expect(s.filter((q) => q.startsWith("insert into audit_log"))).toHaveLength(2);
    expect(s.filter((q) => q.startsWith("insert into seats"))).toHaveLength(1);
    const ins = t.calls.find(([q]) => q.startsWith("insert into seats"))!;
    expect(ins[1][2]).toEqual([4, 4]);
    expect(ins[1][3]).toEqual(["C302-04", "C302-04"]);
  });
});

const withRoom: Script = (sql, values) =>
  sql.startsWith("select id, code, name from rooms")
    ? [{ id: ROOM, code: "C302", name: "Room" }]
    : base()(sql, values);

const HELD = "and coalesce(m.sub = $2::uuid, false)";
const devicesSql = (sqls: string[]) => sqls.find((q) => q.includes("json_agg"))!;

describe("seat reads per tier (D69)", () => {
  it("getSeat/listRoomSeats: user adds the held clause to the devices subquery only", async () => {
    for (const run of [
      (db: ReturnType<typeof fakeDb>["db"], tier: "user" | "manager" | "admin") =>
        getSeat(db, scope, X, tier, SEAT),
      (db: ReturnType<typeof fakeDb>["db"], tier: "user" | "manager" | "admin") =>
        listRoomSeats(db, scope, X, tier, ROOM),
    ]) {
      const u = fakeDb(withRoom);
      await run(u.db, "user");
      const sql = devicesSql(u.sqls());
      expect(sql).toContain(HELD);
      const countPart = sql.slice(
        sql.indexOf("as device_count") - 120,
        sql.indexOf("as device_count"),
      );
      expect(countPart).not.toContain("m.sub");
      const call = u.calls.find(([q]) => q.includes("json_agg"))!;
      expect(call[1][1]).toBe(X);
      for (const tier of ["manager", "admin"] as const) {
        const t = fakeDb(withRoom);
        await run(t.db, tier);
        expect(devicesSql(t.sqls())).not.toContain("m.sub = $2");
      }
    }
  });
  it("releaseSeat as user reloads with the held filter (noop and release paths)", async () => {
    for (const occupant of [null, X]) {
      const t = fakeDb(base({ occupant_id: occupant }));
      await releaseSeat(t.db, scope, X, "user", SEAT);
      expect(devicesSql(t.sqls())).toContain(HELD);
    }
  });
  it("Manager/Admin writes never add the held clause", async () => {
    const t = fakeDb(base({ occupant_id: X }));
    await setOccupant(t.db, scope, ACTOR, SEAT, { memberId: Y, expectedOccupantId: X });
    await setCannotSeat(t.db, scope, ACTOR, SEAT, { cannotSeat: true, reason: "r" });
    await setSeatTags(t.db, scope, ACTOR, SEAT, {});
    await addSeats(t.db, scope, ACTOR, ROOM, 2);
    const sqls = t.sqls().filter((q) => q.includes("json_agg"));
    expect(sqls.length).toBeGreaterThan(0);
    for (const q of sqls) expect(q).not.toContain("m.sub = $2");
  });
});

describe("occupant photo fields (SIM-046.2)", () => {
  it("seatRows projects occupant photo fields, never the Drive file id column", async () => {
    const occupied = {
      ...dtoRow,
      occupant_id: X,
      occupant_name: "A",
      occupant_has_photo: true,
      occupant_photo_version: 4,
    };
    const t = fakeDb((sql) => (sql.includes("json_agg") ? [occupied, dtoRow] : withRoom(sql, [])));
    const r = await listRoomSeats(t.db, scope, X, "manager", ROOM);
    const sql = t.sqls().find((q) => q.includes("json_agg"))!;
    expect(sql).toContain("o.photo_drive_file_id is not null as occupant_has_photo");
    expect(sql).toContain("o.photo_version as occupant_photo_version");
    expect(
      sql.replace("o.photo_drive_file_id is not null as occupant_has_photo", ""),
    ).not.toContain("photo_drive_file_id");
    expect(r.ok && r.value.items[0]?.occupant).toEqual({
      id: X,
      displayName: "A",
      hasPhoto: true,
      photoVersion: 4,
    });
    expect(r.ok && r.value.items[1]?.occupant).toBeNull();
    expect(JSON.stringify(r).toLowerCase()).not.toContain("drive");
  });
});
