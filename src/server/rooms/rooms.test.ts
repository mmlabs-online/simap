import { describe, expect, it } from "vitest";
import type { OrgScope } from "@/server/http/org-scope";
import {
  allocateSeatSeq,
  createRoom,
  deleteRoom,
  getDeleteImpact,
  listRooms,
  updateRoom,
} from "./rooms";

const scope = { orgId: "11111111-1111-4111-8111-111111111111" } as OrgScope;
const ACTOR = "22222222-2222-4222-8222-222222222222";
const RID = "33333333-3333-4333-8333-333333333333";

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

const roomRow = {
  id: RID,
  code: "C302",
  name: "n",
  description: null,
  floor: null,
  seat_count: 0,
  occupied_count: 0,
};

const impactRow = (o: Partial<Record<string, number>> = {}) => ({
  seats: 0,
  occupied: 0,
  devices: 0,
  pending: 0,
  ...o,
});

const uniq = (constraint: string) => Object.assign(new Error("dup"), { code: "23505", constraint });

describe("org scoping (R6)", () => {
  it("every statement filters org_id = $1 and binds the scope org first", async () => {
    const t = fakeDb((sql) => {
      if (sql.startsWith("select id, code from rooms")) return [{ id: RID, code: "C302" }];
      if (sql.includes("as seat_count")) return [roomRow];
      if (sql.includes("count(*)::int as seats")) return [impactRow()];
      if (sql.startsWith("select id from rooms")) return [{ id: RID }];
      if (sql.startsWith("insert into rooms")) return [{ id: RID }];
      if (sql.startsWith("select id, seq")) return [{ id: "s1", seq: 1 }];
      return [];
    });
    await listRooms(t.db, scope);
    await createRoom(t.db, scope, ACTOR, {
      code: "C302",
      name: "n",
      description: null,
      floor: null,
    });
    await updateRoom(t.db, scope, ACTOR, RID, { code: "C303" });
    await getDeleteImpact(t.db, scope, RID);
    await deleteRoom(t.db, scope, ACTOR, RID, true);
    await allocateSeatSeq(t.db, scope, RID);
    const data = t.calls.filter(([s]) => !/^(begin|commit|rollback)$/.test(s));
    expect(data.length).toBeGreaterThan(10);
    for (const [sql, values] of data) {
      expect(sql).toMatch(/org_id\s*=\s*\$1/);
      expect(values[0]).toBe(scope.orgId);
    }
  });
});

describe("createRoom", () => {
  const v = { code: "C302", name: "Meeting", description: null, floor: null };

  it("insert + audit room.create in one transaction; binds the uppercase code", async () => {
    const t = fakeDb((sql) => {
      if (sql.startsWith("insert into rooms")) return [{ id: RID }];
      if (sql.includes("as seat_count")) return [roomRow];
      return [];
    });
    const r = await createRoom(t.db, scope, ACTOR, v);
    expect(r).toMatchObject({ ok: true, value: { id: RID, code: "C302" } });
    const s = t.sqls();
    expect(s[0]).toBe("begin");
    expect(s[1]).toMatch(/^insert into rooms/);
    expect(s[2]).toMatch(/^insert into audit_log/);
    expect(s.at(-1)).toBe("commit");
    expect(t.calls[1]![1]).toEqual([scope.orgId, "C302", "Meeting", null, null]);
    expect(t.calls[2]![1]).toEqual([
      scope.orgId,
      ACTOR,
      "room.create",
      "room",
      RID,
      JSON.stringify({ code: "C302" }),
    ]);
  });

  it("unique violation -> 409 room_code_taken and ROLLBACK", async () => {
    const t = fakeDb((sql) =>
      sql.startsWith("insert into rooms") ? uniq("rooms_org_code_key") : [],
    );
    const r = await createRoom(t.db, scope, ACTOR, v);
    expect(r).toEqual({ ok: false, status: 409, code: "room_code_taken" });
    expect(t.sqls()).toContain("rollback");
    expect(t.sqls()).not.toContain("commit");
  });

  it("an unexpected error is rethrown (the route answers 500)", async () => {
    const t = fakeDb(() => new Error("connection lost"));
    await expect(createRoom(t.db, scope, ACTOR, v)).rejects.toThrow("connection lost");
  });
});

describe("updateRoom", () => {
  const script: Script = (sql) => {
    if (sql.startsWith("select id, code from rooms")) return [{ id: RID, code: "C302" }];
    if (sql.startsWith("select id, seq")) {
      return [
        { id: "s1", seq: 1 },
        { id: "s2", seq: 2 },
      ];
    }
    if (sql.includes("as seat_count")) return [{ ...roomRow, code: "C303" }];
    return [];
  };

  it("rename: lock, update room, update seats from renameSeatCodes, audit, COMMIT in one client", async () => {
    const t = fakeDb(script);
    const r = await updateRoom(t.db, scope, ACTOR, RID, { code: "C303" });
    expect(r).toMatchObject({ ok: true, value: { code: "C303" } });
    const s = t.sqls();
    expect(s[0]).toBe("begin");
    expect(s[1]).toMatch(/^select id, code from rooms .* for update$/);
    expect(s[2]).toMatch(/^update rooms set code = \$3, updated_at = now\(\)/);
    expect(s[3]).toMatch(/^select id, seq from seats/);
    expect(s[4]).toMatch(
      /^update seats set code = v.code,.*unnest\(\$2::uuid\[\], \$3::text\[\]\)/,
    );
    expect(t.calls[4]![1]).toEqual([scope.orgId, ["s1", "s2"], ["C303-01", "C303-02"]]);
    expect(s[5]).toMatch(/^insert into audit_log/);
    expect(JSON.parse(t.calls[5]![1][5] as string)).toEqual({
      fields: ["code"],
      from: "C302",
      to: "C303",
      seats: 2,
    });
    expect(t.calls[5]![1][2]).toBe("room.update");
    expect(s.at(-1)).toBe("commit");
  });

  it("without a code change the seats are not touched", async () => {
    const t = fakeDb(script);
    await updateRoom(t.db, scope, ACTOR, RID, { name: "New name", floor: null });
    expect(t.sqls().some((q) => /^(select id, seq|update seats)/.test(q))).toBe(false);
    expect(t.calls[2]![0]).toMatch(/set name = \$3, floor = \$4, updated_at/);
    expect(t.calls[2]![1]).toEqual([scope.orgId, RID, "New name", null]);
  });

  it("same code as the current one does not rename seats", async () => {
    const t = fakeDb(script);
    await updateRoom(t.db, scope, ACTOR, RID, { code: "C302" });
    expect(t.sqls().some((q) => q.startsWith("update seats"))).toBe(false);
  });

  it("rename failure -> ROLLBACK, no COMMIT; unique violation -> 409", async () => {
    const t = fakeDb((sql, v) =>
      sql.startsWith("update seats") ? uniq("seats_org_code_key") : script(sql, v),
    );
    const r = await updateRoom(t.db, scope, ACTOR, RID, { code: "C303" });
    expect(r).toEqual({ ok: false, status: 409, code: "room_code_taken" });
    expect(t.sqls()).toContain("rollback");
    expect(t.sqls()).not.toContain("commit");
  });

  it("missing room -> 404 not_found", async () => {
    const t = fakeDb(() => []);
    expect(await updateRoom(t.db, scope, ACTOR, RID, { name: "x" })).toEqual({
      ok: false,
      status: 404,
      code: "not_found",
    });
  });
});

describe("delete impact and deleteRoom", () => {
  it("impact: 404 when the room does not exist", async () => {
    const t = fakeDb(() => []);
    expect(await getDeleteImpact(t.db, scope, RID)).toEqual({
      ok: false,
      status: 404,
      code: "not_found",
    });
  });

  it("impact maps the counts", async () => {
    const t = fakeDb((sql) =>
      sql.startsWith("select id from rooms")
        ? [{ id: RID }]
        : [impactRow({ seats: 4, occupied: 2, devices: 3, pending: 1 })],
    );
    expect(await getDeleteImpact(t.db, scope, RID)).toEqual({
      ok: true,
      value: { seats: 4, occupiedSeats: 2, placedDevices: 3, pendingRequests: 1 },
    });
  });

  it("missing room -> 404 on delete", async () => {
    const t = fakeDb(() => []);
    expect(await deleteRoom(t.db, scope, ACTOR, RID, true)).toEqual({
      ok: false,
      status: 404,
      code: "not_found",
    });
  });

  it("without force on a non-empty room -> 409 room_not_empty, ROLLBACK, nothing deleted", async () => {
    const t = fakeDb((sql) => {
      if (sql.startsWith("select id, code from rooms")) return [{ id: RID, code: "C302" }];
      if (sql.includes("count(*)::int as seats")) return [impactRow({ seats: 2, occupied: 1 })];
      return [];
    });
    const r = await deleteRoom(t.db, scope, ACTOR, RID, false);
    expect(r).toEqual({ ok: false, status: 409, code: "room_not_empty" });
    const s = t.sqls();
    expect(s).toContain("rollback");
    expect(s).not.toContain("commit");
    expect(s.some((q) => /^(update devices|delete from)/.test(q))).toBe(false);
  });

  it("forced delete order: lock, counts, release devices, delete seats, delete room, audit, COMMIT", async () => {
    const t = fakeDb((sql) => {
      if (sql.startsWith("select id, code from rooms")) return [{ id: RID, code: "C302" }];
      if (sql.includes("count(*)::int as seats")) {
        return [impactRow({ seats: 3, occupied: 1, devices: 2 })];
      }
      return [];
    });
    expect(await deleteRoom(t.db, scope, ACTOR, RID, true)).toEqual({ ok: true, value: null });
    const s = t.sqls();
    expect(s[0]).toBe("begin");
    expect(s[1]).toMatch(/for update$/);
    expect(s[2]).toMatch(/count\(\*\)::int as seats/);
    expect(s[3]).toMatch(/^update devices set role = 'secondary', seat_id = null/);
    expect(s[4]).toMatch(/^delete from seats/);
    expect(s[5]).toMatch(/^delete from rooms/);
    expect(s[6]).toMatch(/^insert into audit_log/);
    expect(s[7]).toBe("commit");
    expect(t.calls[6]![1][2]).toBe("room.delete");
    expect(JSON.parse(t.calls[6]![1][5] as string)).toEqual({
      code: "C302",
      seats: 3,
      devices: 2,
      forced: true,
    });
  });

  it("an empty room is deleted without force", async () => {
    const t = fakeDb((sql) => {
      if (sql.startsWith("select id, code from rooms")) return [{ id: RID, code: "C302" }];
      if (sql.includes("count(*)::int as seats")) return [impactRow({ seats: 2, pending: 5 })];
      return [];
    });
    expect(await deleteRoom(t.db, scope, ACTOR, RID, false)).toEqual({ ok: true, value: null });
    expect(t.sqls().at(-1)).toBe("commit");
  });
});

describe("allocateSeatSeq (D30)", () => {
  it("increments seat_counter with UPDATE ... RETURNING and never reads max(seq)", async () => {
    const t = fakeDb(() => [{ seat_counter: 4, code: "C302" }]);
    expect(await allocateSeatSeq(t.db, scope, RID)).toEqual({ seq: 4, roomCode: "C302" });
    expect(t.calls).toHaveLength(1);
    expect(t.calls[0]![0]).toMatch(
      /^update rooms set seat_counter = seat_counter [+] 1,.* returning seat_counter, code$/,
    );
    expect(t.calls[0]![0]).not.toMatch(/max\(/i);
  });

  it("unknown room -> null", async () => {
    const t = fakeDb(() => []);
    expect(await allocateSeatSeq(t.db, scope, RID)).toBeNull();
  });
});

describe("audit meta (SYS-03)", () => {
  it("holds only codes, field names and counts, no name or description text", async () => {
    const t = fakeDb((sql) => {
      if (sql.startsWith("select id, code from rooms")) return [{ id: RID, code: "C302" }];
      if (sql.startsWith("select id, seq")) return [];
      if (sql.includes("as seat_count")) return [roomRow];
      return [];
    });
    await updateRoom(t.db, scope, ACTOR, RID, {
      code: "C303",
      name: "SECRET-NAME",
      description: "SECRET-DESC",
    });
    const audit = t.calls.find(([s]) => s.startsWith("insert into audit_log"))!;
    expect(String(audit[1][5])).not.toMatch(/SECRET/);
  });
});
