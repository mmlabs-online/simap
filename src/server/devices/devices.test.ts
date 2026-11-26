import { describe, expect, it } from "vitest";
import type { OrgScope } from "@/server/http/org-scope";
import {
  assignDevice,
  createDevice,
  deleteDevice,
  getDevice,
  listDevices,
  listMyDevices,
  placeDevice,
  updateDevice,
  updateHolding,
} from "./devices";

const scope = { orgId: "11111111-1111-4111-8111-111111111111" } as OrgScope;
const ACTOR = "22222222-2222-4222-8222-222222222222";
const DEV = "33333333-3333-4333-8333-333333333333";
const ROOM_A = "44444444-4444-4444-8444-444444444444";
const ROOM_B = "44444444-4444-4444-8444-444444444445";
const SEAT_A = "55555555-5555-4555-8555-555555555555";
const SEAT_B = "66666666-6666-4666-8666-666666666666";
const ME = "77777777-7777-4777-8777-777777777777";
const OTHER = "88888888-8888-4888-8888-888888888888";

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

const dtoRow = {
  id: DEV,
  name: "Laptop",
  type: "laptop",
  inventory_number: "INV-1",
  mac: null,
  serial: null,
  manufacturer: null,
  brand: null,
  holding_note: null,
  holding_expires_on: null,
  owner_id: ME,
  owner_name: "Me",
  mine: true,
  role: "secondary",
  seat_id: null,
  seat_code: null,
  room_id: null,
  room_code: null,
};

/** Device in inventory owned by ME (the actor); seats A (room A, occupant ME) and B (room B). */
const base =
  (
    o: {
      devSeat?: string | null;
      lockedSeat?: string | null;
      occupant?: string | null;
      owner?: string | null;
    } = {},
  ): Script =>
  (sql) => {
    const devSeat = o.devSeat ?? null;
    if (sql.startsWith("select id from members")) return [{ id: ME }];
    if (sql.startsWith("select seat_id from devices")) return [{ seat_id: devSeat }];
    if (sql.startsWith("select id, room_id from seats"))
      return [
        { id: SEAT_A, room_id: ROOM_A },
        { id: SEAT_B, room_id: ROOM_B },
      ];
    if (sql.startsWith("select id, code from rooms")) return [];
    if (sql.startsWith("select id, code, room_id, occupant_id from seats"))
      return [
        { id: SEAT_A, code: "A-01", occupant_id: o.occupant === undefined ? ME : o.occupant },
        { id: SEAT_B, code: "B-01", occupant_id: null },
      ];
    if (sql.startsWith("select id, seat_id, role, owner_id from devices"))
      return [
        {
          seat_id: o.lockedSeat === undefined ? devSeat : o.lockedSeat,
          role: "secondary",
          owner_id: o.owner === undefined ? ME : o.owner,
        },
      ];
    if (sql.startsWith("select id from devices")) return [];
    if (sql.startsWith("select d.id")) return [dtoRow];
    return [];
  };

const put = (v: {
  seatId: string | null;
  role: "primary" | "secondary";
  expectedSeatId: string | null;
}) => v;
const idx = (sqls: string[], prefix: string) => sqls.findIndex((s) => s.startsWith(prefix));

describe("placeDevice lock order", () => {
  it("rooms for share (ascending id) before seats for update (ascending id) before the device for update, then update, then audit", async () => {
    const t = fakeDb(base({ devSeat: SEAT_B }));
    const r = await placeDevice(
      t.db,
      scope,
      ACTOR,
      "user",
      DEV,
      put({ seatId: SEAT_A, role: "primary", expectedSeatId: SEAT_B }),
    );
    expect(r.ok).toBe(true);
    const s = t.sqls();
    const order = [
      idx(s, "select id, code from rooms"),
      idx(s, "select id, code, room_id, occupant_id from seats"),
      idx(s, "select id, seat_id, role, owner_id from devices"),
      idx(s, "update devices"),
      idx(s, "insert into audit_log"),
    ];
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(s[order[0]!]).toMatch(/order by id for share$/);
    expect(s[order[1]!]).toMatch(/order by id for update$/);
    expect(s[order[2]!]).toMatch(/for update$/);
  });
});

describe("placeDevice refusals", () => {
  it("refusal writes nothing: no update and no audit insert for not_allowed / owner_not_occupant", async () => {
    const stranger = fakeDb((sql, v) =>
      sql.startsWith("select id from members") ? [{ id: OTHER }] : base()(sql, v),
    );
    const r1 = await placeDevice(
      stranger.db,
      scope,
      ACTOR,
      "user",
      DEV,
      put({ seatId: SEAT_A, role: "secondary", expectedSeatId: null }),
    );
    expect(r1).toEqual({ ok: false, status: 404, code: "not_found" });
    const notOcc = fakeDb(base({ occupant: OTHER }));
    const r2 = await placeDevice(
      notOcc.db,
      scope,
      ACTOR,
      "manager",
      DEV,
      put({ seatId: SEAT_A, role: "primary", expectedSeatId: null }),
    );
    expect(r2).toEqual({ ok: false, status: 409, code: "owner_not_occupant" });
    for (const t of [stranger, notOcc]) {
      const s = t.sqls();
      expect(s.some((q) => q.startsWith("update ") || q.startsWith("insert into"))).toBe(false);
      expect(s).toContain("rollback");
      expect(s).not.toContain("commit");
    }
  });

  it("seat_not_yours writes nothing: no update, no audit insert (D72)", async () => {
    const t = fakeDb(base({ occupant: OTHER }));
    const r = await placeDevice(
      t.db,
      scope,
      ACTOR,
      "user",
      DEV,
      put({ seatId: SEAT_A, role: "secondary", expectedSeatId: null }),
    );
    expect(r).toEqual({ ok: false, status: 422, code: "seat_not_yours" });
    const s = t.sqls();
    expect(s.some((q) => q.startsWith("update ") || q.startsWith("insert into"))).toBe(false);
    expect(s).toContain("rollback");
    expect(s).not.toContain("commit");
  });

  it("the unlocked seat_id differs from the locked one -> 409 placement_changed", async () => {
    const t = fakeDb(base({ devSeat: SEAT_B, lockedSeat: SEAT_A }));
    const r = await placeDevice(
      t.db,
      scope,
      ACTOR,
      "user",
      DEV,
      put({ seatId: SEAT_A, role: "secondary", expectedSeatId: SEAT_B }),
    );
    expect(r).toEqual({ ok: false, status: 409, code: "placement_changed" });
    expect(t.sqls().some((q) => q.startsWith("update "))).toBe(false);
  });
});

const HELD = "coalesce(m.sub = $2::uuid, false)";
const readSql = (t: ReturnType<typeof fakeDb>) =>
  t.calls.find(([s]) => s.startsWith("select d.id"))!;

describe("device visibility per tier (DEV-12)", () => {
  it("listDevices and getDevice: user SQL adds the held predicate; manager and admin do not", async () => {
    for (const tier of ["user", "manager", "admin"] as const) {
      const l = fakeDb(base());
      await listDevices(l.db, scope, ACTOR, tier, "all", "2026-11-25");
      const g = fakeDb(base());
      await getDevice(g.db, scope, ACTOR, tier, DEV, "2026-11-25");
      for (const t of [l, g]) {
        const [sql, values] = readSql(t);
        expect(sql.includes(` and ${HELD} order by`)).toBe(tier === "user");
        expect(values[1]).toBe(ACTOR);
      }
    }
  });

  it("getDevice: no row is a 404", async () => {
    const t = fakeDb(() => []);
    expect(await getDevice(t.db, scope, ACTOR, "user", DEV, "2026-11-25")).toEqual({
      ok: false,
      status: 404,
      code: "not_found",
    });
  });
});

describe("listMyDevices", () => {
  const ID2 = "99999999-9999-4999-8999-999999999999";
  const rowOf = (id: string, key: string) => ({ ...dtoRow, id, sort_key: key });

  it("held predicate for every tier; no keyset values without a cursor; limit + 1", async () => {
    for (const tier of ["user", "manager", "admin"] as const) {
      const t = fakeDb(() => []);
      const r = await listMyDevices(t.db, scope, ACTOR, tier, { limit: 5 }, "2026-11-25");
      expect(r).toEqual({ items: [], nextCursor: null });
      const [sql, values] = readSql(t);
      expect(sql).toContain(`where d.org_id = $1 and ${HELD} order by lower(d.name), d.id limit 6`);
      expect(values).toEqual([scope.orgId, ACTOR, "2026-11-25"]);
    }
  });

  it("a cursor binds $4 text and $5 uuid; nextCursor comes from the DB sort_key", async () => {
    const t = fakeDb(() => [rowOf(DEV, "đèn"), rowOf(ID2, "ghế")]);
    const r = await listMyDevices(
      t.db,
      scope,
      ACTOR,
      "user",
      { limit: 1, cursor: { k: "a", id: OTHER } },
      "2026-11-25",
    );
    const [sql, values] = readSql(t);
    expect(sql).toContain("(lower(d.name), d.id) > ($4::text, $5::uuid)");
    expect(sql).toMatch(/limit 2$/);
    expect(values).toEqual([scope.orgId, ACTOR, "2026-11-25", "a", OTHER]);
    expect(r.items.map((i) => i.id)).toEqual([DEV]);
    expect(JSON.parse(Buffer.from(r.nextCursor!, "base64url").toString("utf8"))).toEqual({
      k: "đèn",
      id: DEV,
    });
  });

  it("the last page has no cursor", async () => {
    const t = fakeDb(() => [rowOf(DEV, "a")]);
    const r = await listMyDevices(t.db, scope, ACTOR, "user", { limit: 1 }, "2026-11-25");
    expect(r.nextCursor).toBeNull();
    expect(r.items).toHaveLength(1);
  });
});

describe("org scoping (R6)", () => {
  it("every query passes org_id as $1", async () => {
    const t = fakeDb(base({ devSeat: SEAT_B }));
    await placeDevice(
      t.db,
      scope,
      ACTOR,
      "user",
      DEV,
      put({ seatId: SEAT_A, role: "primary", expectedSeatId: SEAT_B }),
    );
    await placeDevice(
      t.db,
      scope,
      ACTOR,
      "user",
      DEV,
      put({ seatId: null, role: "secondary", expectedSeatId: null }),
    );
    await listDevices(t.db, scope, ACTOR, "user", "placed", "2026-11-25");
    await getDevice(t.db, scope, ACTOR, "user", DEV, "2026-11-25");
    await listMyDevices(t.db, scope, ACTOR, "user", { limit: 5 }, "2026-11-25");
    const data = t.calls.filter(([s]) => !/^(begin|commit|rollback)$/.test(s));
    expect(data.length).toBeGreaterThan(11);
    for (const [sql, values] of data) {
      expect(sql).toMatch(/org_id\s*=\s*\$1/);
      expect(values[0]).toBe(scope.orgId);
    }
  });
});

/** Actor is ME; the device row (locked read) is in inventory, owned by `owner`, with the given seat. */
const writes =
  (
    o: { me?: string | null; owner?: string | null; seat?: string | null; pending?: boolean } = {},
  ): Script =>
  (sql) => {
    if (sql.startsWith("select id from members")) return o.me === null ? [] : [{ id: o.me ?? ME }];
    if (sql.startsWith("insert into devices")) return [{ id: DEV }];
    if (sql.startsWith("select id, name, type, inventory_number"))
      return [
        {
          id: DEV,
          name: "Laptop",
          type: "laptop",
          inventory_number: "INV-1",
          mac: null,
          serial: null,
          manufacturer: null,
          brand: null,
          owner_id: o.owner === undefined ? ME : o.owner,
        },
      ];
    if (sql.startsWith("select inventory_number, owner_id, seat_id"))
      return [
        {
          inventory_number: "INV-1",
          owner_id: o.owner === undefined ? ME : o.owner,
          seat_id: o.seat ?? null,
        },
      ];
    if (sql.startsWith("select 1 from device_handoffs"))
      return o.pending ? [{ "?column?": 1 }] : [];
    if (sql.startsWith("select d.id")) return [dtoRow];
    return [];
  };

const newDevice = {
  name: "Laptop",
  type: "laptop",
  inventoryNumber: "INV-1",
  mac: null,
  serial: null,
  manufacturer: null,
  brand: null,
};
const writeSql = (sqls: string[]) => sqls.filter((q) => /^(update|delete|insert) /.test(q));

describe("createDevice", () => {
  it("Admin: insert has no owner, seat or role column and no member lookup; audit has ownerId null", async () => {
    const t = fakeDb(writes());
    const r = await createDevice(t.db, scope, ACTOR, "admin", newDevice);
    expect(r.ok).toBe(true);
    const s = t.sqls();
    const ins = s.find((q) => q.startsWith("insert into devices"))!;
    expect(ins).not.toMatch(/seat_id|role|owner_id/);
    expect(s.some((q) => q.includes("from members"))).toBe(false);
    const audit = t.calls.find(([q]) => q.startsWith("insert into audit_log"))!;
    expect(audit[1][5]).toBe(JSON.stringify({ inventoryNumber: "INV-1", ownerId: null }));
  });

  it("User and Manager -> 422 not_allowed with no query at all", async () => {
    for (const tier of ["user", "manager"] as const) {
      const t = fakeDb(writes());
      const r = await createDevice(t.db, scope, ACTOR, tier, newDevice);
      expect(r).toEqual({ ok: false, status: 422, code: "not_allowed" });
      expect(t.calls).toEqual([]);
    }
  });
});

describe("updateDevice", () => {
  it("an unowned device with no linked member is hidden from a User: 404 (null is not an owner)", async () => {
    const t = fakeDb(writes({ me: null, owner: null }));
    expect(await updateDevice(t.db, scope, ACTOR, "user", DEV, { name: "x" })).toEqual({
      ok: false,
      status: 404,
      code: "not_found",
    });
    expect(writeSql(t.sqls())).toEqual([]);
  });

  it("SET names only whitelisted columns, values are parameters; no-op patch writes nothing", async () => {
    const t = fakeDb(writes());
    const evil = "New'; drop table devices;--";
    const r = await updateDevice(t.db, scope, ACTOR, "user", DEV, {
      name: evil,
      inventoryNumber: "INV-2",
      mac: "aa:bb:cc:dd:ee:ff",
    });
    expect(r.ok).toBe(true);
    const upd = t.calls.find(([q]) => q.startsWith("update devices"))!;
    expect(upd[0]).toBe(
      "update devices set name = $3, inventory_number = $4, mac = $5, updated_at = now() where org_id = $1 and id = $2",
    );
    expect(upd[1]).toEqual([scope.orgId, DEV, evil, "INV-2", "aa:bb:cc:dd:ee:ff"]);
    const audit = t.calls.find(([q]) => q.startsWith("insert into audit_log"))!;
    expect(audit[1][5]).toBe(
      JSON.stringify({ fields: ["name", "inventoryNumber", "mac"], from: "INV-1", to: "INV-2" }),
    );

    const noop = fakeDb(writes());
    const r2 = await updateDevice(noop.db, scope, ACTOR, "user", DEV, {
      name: "Laptop",
      mac: null,
    });
    expect(r2.ok).toBe(true);
    expect(writeSql(noop.sqls())).toEqual([]);
  });

  it("another member's device as User -> 404 not_found like an unknown id, nothing written; Admin ok; missing -> 404", async () => {
    const t = fakeDb(writes({ owner: OTHER }));
    const gone0 = fakeDb((sql, v) => (sql.startsWith("select id, name") ? [] : writes()(sql, v)));
    const unknown = await updateDevice(gone0.db, scope, ACTOR, "user", DEV, { name: "x" });
    expect(await updateDevice(t.db, scope, ACTOR, "user", DEV, { name: "x" })).toEqual(unknown);
    expect(unknown).toEqual({ ok: false, status: 404, code: "not_found" });
    expect(writeSql(t.sqls())).toEqual([]);
    const admin = fakeDb(writes({ owner: OTHER }));
    expect((await updateDevice(admin.db, scope, ACTOR, "admin", DEV, { name: "x" })).ok).toBe(true);
    const gone = fakeDb((sql, v) => (sql.startsWith("select id, name") ? [] : writes()(sql, v)));
    expect(await updateDevice(gone.db, scope, ACTOR, "admin", DEV, { name: "x" })).toEqual({
      ok: false,
      status: 404,
      code: "not_found",
    });
  });
});

describe("deleteDevice", () => {
  it("an Admin is refused device_owned, device_placed, handoff_pending in that order; device_placed, handoff_pending; refusals write nothing", async () => {
    const cases: [Script, "user" | "manager" | "admin", number, string][] = [
      [writes({ owner: ME, seat: SEAT_A, pending: true }), "admin", 409, "device_owned"],
      [writes({ owner: null, seat: SEAT_A, pending: true }), "admin", 409, "device_placed"],
      [writes({ owner: null, pending: true }), "admin", 409, "handoff_pending"],
    ];
    for (const [script, tier, status, code] of cases) {
      const t = fakeDb(script);
      expect(await deleteDevice(t.db, scope, ACTOR, tier, DEV)).toEqual({
        ok: false,
        status,
        code,
      });
      expect(writeSql(t.sqls())).toEqual([]);
      expect(t.sqls()).toContain("rollback");
    }
  });

  it("a non-Admin is refused 422 not_allowed before any query or transaction", async () => {
    for (const tier of ["user", "manager"] as const) {
      const t = fakeDb(writes({ owner: null }));
      expect(await deleteDevice(t.db, scope, ACTOR, tier, DEV)).toEqual({
        ok: false,
        status: 422,
        code: "not_allowed",
      });
      expect(t.sqls()).toEqual([]);
    }
  });

  it("Admin deletes an unowned unplaced device: locked read, pending check, delete, audit", async () => {
    const t = fakeDb(writes({ owner: null }));
    expect(await deleteDevice(t.db, scope, ACTOR, "admin", DEV)).toEqual({ ok: true, value: null });
    const s = t.sqls();
    const order = [
      s.findIndex((q) => q.startsWith("select inventory_number, owner_id, seat_id")),
      s.findIndex((q) => q.startsWith("select 1 from device_handoffs")),
      s.findIndex((q) => q.startsWith("delete from devices")),
      s.findIndex((q) => q.startsWith("insert into audit_log")),
    ];
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(s[order[0]!]).toMatch(/for update$/);
  });
});

describe("create / update / delete org scoping (R6)", () => {
  it("every query passes org_id as $1", async () => {
    const t = fakeDb(writes());
    await createDevice(t.db, scope, ACTOR, "admin", newDevice);
    await updateDevice(t.db, scope, ACTOR, "user", DEV, { name: "x" });
    await deleteDevice(t.db, scope, ACTOR, "admin", DEV);
    const data = t.calls.filter(([s]) => !/^(begin|commit|rollback)$/.test(s));
    expect(data.length).toBeGreaterThan(8);
    for (const [sql, values] of data) {
      expect(sql).toMatch(/org_id\s*=\s*\$1/);
      expect(values[0]).toBe(scope.orgId);
    }
  });
});

describe("placeDevice: device gone", () => {
  it("deleted between the unlocked and the locked read -> 404 not_found", async () => {
    const t = fakeDb((sql, v) =>
      sql.startsWith("select id, seat_id, role, owner_id from devices") ? [] : base()(sql, v),
    );
    const r = await placeDevice(
      t.db,
      scope,
      ACTOR,
      "user",
      DEV,
      put({ seatId: SEAT_A, role: "secondary", expectedSeatId: null }),
    );
    expect(r).toEqual({ ok: false, status: 404, code: "not_found" });
  });
});

/** Scripts for assign and holding edit; `member` undefined = active, null = missing. */
const holdingScript =
  (
    o: {
      member?: { status: string } | null;
      owner?: string | null;
      noDevice?: boolean;
      pending?: boolean;
      note?: string | null;
      expires?: string | null;
    } = {},
  ): Script =>
  (sql) => {
    if (sql.startsWith("select id, status from members")) {
      const m = o.member === undefined ? { status: "active" } : o.member;
      return m ? [{ id: OTHER, status: m.status }] : [];
    }
    if (sql.startsWith("select owner_id, inventory_number from devices")) {
      return o.noDevice
        ? []
        : [{ owner_id: o.owner === undefined ? null : o.owner, inventory_number: "INV-1" }];
    }
    if (sql.startsWith("select owner_id, holding_note as note")) {
      return o.noDevice
        ? []
        : [
            {
              owner_id: o.owner === undefined ? OTHER : o.owner,
              note: o.note ?? null,
              expires_on: o.expires ?? null,
            },
          ];
    }
    if (sql.startsWith("select 1 from device_handoffs")) return o.pending ? [{ x: 1 }] : [];
    if (sql.startsWith("select d.id")) return [dtoRow];
    return [];
  };

const assignV = { memberId: OTHER, note: "Loan", expiresOn: "2026-12-31" };

describe("assignDevice", () => {
  it("a User is refused 422 not_allowed before any query", async () => {
    const t = fakeDb(holdingScript());
    expect(await assignDevice(t.db, scope, ACTOR, "user", DEV, assignV)).toEqual({
      ok: false,
      status: 422,
      code: "not_allowed",
    });
    expect(t.calls).toEqual([]);
  });

  it("lock order: member for share, device for update, pending check, update, audit", async () => {
    const t = fakeDb(holdingScript());
    expect((await assignDevice(t.db, scope, ACTOR, "manager", DEV, assignV)).ok).toBe(true);
    const s = t.sqls().slice(0, t.sqls().indexOf("commit"));
    const order = [
      s.findIndex((q) => q.startsWith("select id, status from members")),
      s.findIndex((q) => q.startsWith("select owner_id, inventory_number from devices")),
      s.findIndex((q) => q.startsWith("select 1 from device_handoffs")),
      s.findIndex((q) => q.startsWith("update devices set owner_id")),
      s.findIndex((q) => q.startsWith("insert into audit_log")),
    ];
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(s[order[0]!]).toMatch(/for share$/);
    expect(s[order[1]!]).toMatch(/for update$/);
    const upd = t.calls.find(([q]) => q.startsWith("update devices set owner_id"))!;
    expect(upd[1]).toEqual([scope.orgId, DEV, OTHER, "Loan", "2026-12-31"]);
    expect(upd[0]).not.toMatch(/seat_id/);
    const audit = t.calls.find(([q]) => q.startsWith("insert into audit_log"))!;
    expect(audit[1][5]).toBe(
      JSON.stringify({
        memberId: OTHER,
        note: "Loan",
        expiresOn: "2026-12-31",
        inventoryNumber: "INV-1",
      }),
    );
  });

  it("refusals write nothing and roll back", async () => {
    const cases: [Script, number, string][] = [
      [holdingScript({ member: { status: "inactive" } }), 422, "member_not_assignable"],
      [holdingScript({ member: null }), 422, "member_not_assignable"],
      [holdingScript({ owner: ME }), 409, "device_owned"],
      [holdingScript({ pending: true }), 409, "handoff_pending"],
      [holdingScript({ noDevice: true }), 404, "not_found"],
    ];
    for (const [script, status, code] of cases) {
      const t = fakeDb(script);
      expect(await assignDevice(t.db, scope, ACTOR, "admin", DEV, assignV)).toEqual({
        ok: false,
        status,
        code,
      });
      expect(writeSql(t.sqls())).toEqual([]);
      expect(t.sqls()).toContain("rollback");
    }
  });
});

describe("updateHolding", () => {
  it("a User is refused 422 before any query", async () => {
    const t = fakeDb(holdingScript());
    expect(await updateHolding(t.db, scope, ACTOR, "user", DEV, { note: "x" })).toEqual({
      ok: false,
      status: 422,
      code: "not_allowed",
    });
    expect(t.calls).toEqual([]);
  });

  it("unowned -> 409 not_assigned; missing -> 404", async () => {
    const t = fakeDb(holdingScript({ owner: null }));
    expect(await updateHolding(t.db, scope, ACTOR, "manager", DEV, { note: "x" })).toEqual({
      ok: false,
      status: 409,
      code: "not_assigned",
    });
    const gone = fakeDb(holdingScript({ noDevice: true }));
    expect(await updateHolding(gone.db, scope, ACTOR, "manager", DEV, { note: "x" })).toEqual({
      ok: false,
      status: 404,
      code: "not_found",
    });
    expect(writeSql(t.sqls())).toEqual([]);
  });

  it("unchanged -> no update and no audit", async () => {
    const t = fakeDb(holdingScript({ note: "A", expires: "2026-12-01" }));
    const r = await updateHolding(t.db, scope, ACTOR, "manager", DEV, {
      note: "A",
      expiresOn: "2026-12-01",
    });
    expect(r.ok).toBe(true);
    expect(writeSql(t.sqls())).toEqual([]);
  });

  it("a note-only change sets holding_note only, with from/to in the audit", async () => {
    const t = fakeDb(holdingScript({ note: "A", expires: "2026-12-01" }));
    expect((await updateHolding(t.db, scope, ACTOR, "admin", DEV, { note: "B" })).ok).toBe(true);
    const upd = t.calls.find(([q]) => q.startsWith("update devices set"))!;
    expect(upd[0]).toMatch(/^update devices set holding_note = \$3, updated_at = now\(\)/);
    expect(upd[1]).toEqual([scope.orgId, DEV, "B"]);
    const audit = t.calls.find(([q]) => q.startsWith("insert into audit_log"))!;
    expect(audit[1][5]).toBe(
      JSON.stringify({
        ownerId: OTHER,
        fields: ["note"],
        from: { note: "A", expiresOn: "2026-12-01" },
        to: { note: "B", expiresOn: "2026-12-01" },
      }),
    );
  });

  it("an expiry change casts to date and can clear with null", async () => {
    const t = fakeDb(holdingScript({ note: "A", expires: "2026-12-01" }));
    await updateHolding(t.db, scope, ACTOR, "admin", DEV, { expiresOn: null });
    const upd = t.calls.find(([q]) => q.startsWith("update devices set"))!;
    expect(upd[0]).toContain("holding_expires_on = $3::date");
    expect(upd[1]).toEqual([scope.orgId, DEV, null]);
  });
});

describe("updateDevice with serial, manufacturer and brand", () => {
  it("writes the columns and names them in the audit fields", async () => {
    const t = fakeDb(writes());
    const r = await updateDevice(t.db, scope, ACTOR, "admin", DEV, {
      serial: "SN-1",
      manufacturer: "Dell",
      brand: null,
    });
    expect(r.ok).toBe(true);
    const upd = t.calls.find(([q]) => q.startsWith("update devices set"))!;
    expect(upd[0]).toContain("serial = $3, manufacturer = $4");
    const audit = t.calls.find(([q]) => q.startsWith("insert into audit_log"))!;
    expect(audit[1][5]).toBe(JSON.stringify({ fields: ["serial", "manufacturer"] }));
  });
});
