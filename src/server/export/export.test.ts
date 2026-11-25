import { describe, expect, it } from "vitest";
import { EXPORT_KINDS } from "@/lib/export/csv";
import type { OrgScope } from "@/server/http/org-scope";
import type { Db } from "@/server/rooms/rooms";
import { exportRows } from "./export";

const scope = { orgId: "org-1" } as never as OrgScope;

function fake(rows: unknown[] = []) {
  const calls: { sql: string; values: unknown[] }[] = [];
  const pool = {
    async connect() {
      return {
        async query(sql: string, values: unknown[] = []) {
          calls.push({ sql, values });
          return { rows: /^\s*select/i.test(sql) ? rows : [] };
        },
        release() {},
      };
    },
    async query() {
      throw new Error("pool.query must not be used");
    },
  } as unknown as Db;
  return { pool, calls };
}

describe("exportRows", () => {
  it("every query goes through orgQuery with scope.orgId as $1", async () => {
    for (const kind of EXPORT_KINDS) {
      const { pool, calls } = fake();
      await exportRows(pool, scope, kind);
      const sel = calls.filter((c) => /^\s*select/i.test(c.sql));
      expect(sel, kind).toHaveLength(1);
      expect(sel[0]!.sql).toMatch(/\borg_id\s*=\s*\$1\b/);
      expect(sel[0]!.values[0]).toBe("org-1");
    }
  });

  it("limit is cap+1 and truncated is true only when more than cap rows return", async () => {
    const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ display_name: `m${i}` }));
    const a = fake(mk(3));
    const r1 = await exportRows(a.pool, scope, "members", 2);
    expect(a.calls.find((c) => /^\s*select/i.test(c.sql))!.values).toEqual(["org-1", 3]);
    expect(r1.truncated).toBe(true);
    expect(r1.rows).toHaveLength(2);
    const b = fake(mk(2));
    const r2 = await exportRows(b.pool, scope, "members", 2);
    expect(r2.truncated).toBe(false);
    expect(r2.rows).toHaveLength(2);
  });

  it("maps rows: status derivation, null occupant, inventory device location", async () => {
    const seat = (o: object) => ({
      room_code: "A1",
      room_name: "Room",
      floor: null,
      seat_code: "A1-01",
      occupant_id: null,
      cannot_seat: false,
      ...o,
    });
    const s = await exportRows(
      fake([
        seat({ occupant_id: "m1", occupant_name: "Nguyễn Thị Ánh" }),
        seat({}),
        seat({ cannot_seat: true, cannot_seat_reason: "broken" }),
      ]).pool,
      scope,
      "seats",
    );
    expect(s.rows.map((r) => r[4])).toEqual(["occupied", "free", "cannot_seat"]);
    expect(s.rows[0]![5]).toBe("Nguyễn Thị Ánh");
    expect(s.rows[1]![5]).toBeUndefined();
    expect(s.rows[0]).toHaveLength(s.columns.length);

    const d = await exportRows(
      fake([
        {
          name: "L",
          mac: "aa:bb:cc:dd:ee:ff",
          serial: "SN-1",
          manufacturer: "Dell",
          brand: null,
          seat_id: null,
          role: "secondary",
        },
        { name: "P", seat_id: "s1", seat_code: "A1-01", room_code: "A1", role: "primary" },
      ]).pool,
      scope,
      "devices",
    );
    expect(d.columns.slice(3, 7)).toEqual(["MAC", "Serial", "Manufacturer", "Brand"]);
    expect(d.rows[0]!.slice(3, 7)).toEqual(["aa:bb:cc:dd:ee:ff", "SN-1", "Dell", null]);
    expect(d.rows.map((r) => r[10])).toEqual(["inventory", "placed"]);
    expect(d.rows[1]).toHaveLength(d.columns.length);
  });

  it("runs in a read-only repeatable-read transaction", async () => {
    const { pool, calls } = fake();
    await exportRows(pool, scope, "seats");
    const sqls = calls.map((c) => c.sql.trim().toLowerCase());
    expect(sqls[0]).toBe("begin");
    expect(sqls[1]).toBe("set transaction isolation level repeatable read, read only");
    expect(sqls.at(-1)).toBe("commit");
  });
});
