import { describe, expect, it } from "vitest";
import type { OrgScope } from "@/server/http/org-scope";
import { deactivateMember, listMembers, updateMember } from "./manage";

const scope = { orgId: "11111111-1111-4111-8111-111111111111" } as OrgScope;
const ACTOR = "22222222-2222-4222-8222-222222222222";
const MID = "33333333-3333-4333-8333-333333333333";
const GID = "44444444-4444-4444-8444-444444444444";

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
  return { db, calls, sqls: () => calls.map(([s]) => s) };
}

const memberRow = {
  id: MID,
  display_name: "Nguyễn Văn A",
  email: "a@x.vn",
  employee_code: null,
  status: "active",
  sort_key: "nguyễn văn a",
  group_id: null,
  group_name: null,
  group_color: null,
  seat_count: 0,
  device_count: 0,
  seats: [],
  devices: [],
};
const impactRow = (o: Partial<Record<string, number>> = {}) => ({
  occupied: 0,
  placed: 0,
  demote: 0,
  pending: 0,
  ...o,
});

const deactScript =
  (opts: { sub?: string; status?: string; impact?: Record<string, number>; fail?: RegExp }) =>
  (sql: string): unknown[] | Error => {
    if (opts.fail?.test(sql)) return new Error("boom");
    if (sql.includes("for update") && sql.includes("from members")) {
      return [{ id: MID, sub: opts.sub ?? "other", status: opts.status ?? "active" }];
    }
    if (sql.includes("as occupied")) return [impactRow(opts.impact)];
    if (sql.includes("json_agg")) return [memberRow];
    if (sql.startsWith("select id from members")) return [{ id: "actor-member" }];
    return [];
  };

const idx = (sqls: string[], re: RegExp) => sqls.findIndex((s) => re.test(s));

describe("deactivateMember", () => {
  it("lock order: member, rooms for share, seats for update, then devices / requests / member / audit", async () => {
    const t = fakeDb(deactScript({ impact: { occupied: 1, placed: 1 } }));
    const r = await deactivateMember(t.db, scope, ACTOR, MID, true);
    expect(r.ok).toBe(true);
    const s = t.sqls();
    const order = [
      idx(s, /^select id, sub, status from members .* for update$/),
      idx(s, /^select id from rooms .* order by id for share$/),
      idx(s, /^select s\.id from seats s .* order by s\.id for update$/),
      idx(s, /^update devices set role = 'secondary', updated_at/),
      idx(s, /^update seats set occupant_id = null/),
      idx(s, /^update devices set seat_id = null/),
      idx(s, /^update seat_requests set status = 'cancelled'/),
      idx(s, /^update members set status = 'deactivated'/),
      idx(s, /^insert into audit_log/),
      idx(s, /^commit$/),
    ];
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(s.indexOf("rollback")).toBe(-1);
  });

  it("every data statement is org scoped (R6)", async () => {
    const t = fakeDb(deactScript({ impact: { occupied: 1 } }));
    await deactivateMember(t.db, scope, ACTOR, MID, true);
    for (const [sql, values] of t.calls.filter(([s]) => !/^(begin|commit|rollback)$/.test(s))) {
      expect(sql).toMatch(/org_id\s*=\s*\$1/);
      expect(values[0]).toBe(scope.orgId);
    }
  });

  it("refusals roll back and write nothing", async () => {
    const cases = [
      [deactScript({ sub: ACTOR }), true, "cannot_deactivate_self"],
      [deactScript({ impact: { occupied: 2 } }), false, "member_not_empty"],
    ] as const;
    for (const [script, release, code] of cases) {
      const t = fakeDb(script);
      const r = await deactivateMember(t.db, scope, ACTOR, MID, release);
      expect(r).toMatchObject({ ok: false, status: 409, code });
      const s = t.sqls();
      expect(s).toContain("rollback");
      expect(s).not.toContain("commit");
      expect(s.some((q) => /^(update|insert)/.test(q))).toBe(false);
    }
  });

  it("member not found -> 404 and rollback", async () => {
    const t = fakeDb(() => []);
    expect(await deactivateMember(t.db, scope, ACTOR, MID, true)).toMatchObject({
      ok: false,
      status: 404,
    });
    expect(t.sqls()).toContain("rollback");
  });

  it("already deactivated -> no writes, no audit", async () => {
    const t = fakeDb(deactScript({ status: "deactivated", impact: { occupied: 1 } }));
    const r = await deactivateMember(t.db, scope, ACTOR, MID, false);
    expect(r.ok).toBe(true);
    expect(t.sqls().some((q) => /^(update|insert)/.test(q))).toBe(false);
  });

  it("an error after the seat update rolls back (ROLLBACK issued, no COMMIT)", async () => {
    const t = fakeDb(
      deactScript({ impact: { occupied: 1 }, fail: /^update devices set seat_id = null/ }),
    );
    await expect(deactivateMember(t.db, scope, ACTOR, MID, true)).rejects.toThrow("boom");
    const s = t.sqls();
    expect(idx(s, /^update seats set occupant_id = null/)).toBeGreaterThan(-1);
    expect(s).toContain("rollback");
    expect(s).not.toContain("commit");
  });
});

describe("updateMember", () => {
  const cur = { id: MID, display_name: "Nguyễn Văn A", employee_code: "E1", group_id: null };
  const script =
    (over: Partial<Record<string, unknown>> = {}) =>
    (sql: string): unknown[] | Error => {
      if (sql.includes("for update")) return [{ ...cur, ...over }];
      if (sql.includes("json_agg")) return [memberRow];
      return [];
    };

  it("no-op patch -> no UPDATE, no audit", async () => {
    const t = fakeDb(script());
    const r = await updateMember(t.db, scope, ACTOR, MID, {
      displayName: "Nguyễn Văn A",
      employeeCode: "E1",
    });
    expect(r.ok).toBe(true);
    expect(t.sqls().some((q) => /^(update|insert)/.test(q))).toBe(false);
  });

  it("changed field -> one UPDATE of only that column and one audit row with names only", async () => {
    const t = fakeDb(script());
    await updateMember(t.db, scope, ACTOR, MID, { employeeCode: "E2" });
    const upd = t.calls.find(([s]) => s.startsWith("update members"))!;
    expect(upd[0]).toMatch(/set employee_code = \$3, updated_at/);
    expect(upd[1]).toEqual([scope.orgId, MID, "E2"]);
    const audit = t.calls.find(([s]) => s.startsWith("insert into audit_log"))!;
    expect(audit[1]).toContain(JSON.stringify({ fields: ["employeeCode"] }));
  });

  it("group not in org -> 400 invalid_request, ROLLBACK", async () => {
    const t = fakeDb((sql) => (sql.startsWith("select 1 from groups") ? [] : script()(sql)));
    const r = await updateMember(t.db, scope, ACTOR, MID, { groupId: GID });
    expect(r).toMatchObject({ ok: false, status: 400, code: "invalid_request" });
    expect(t.sqls()).toContain("rollback");
  });

  it("23505 on the employee code -> 409 employee_code_taken", async () => {
    const dup = Object.assign(new Error("dup"), {
      code: "23505",
      constraint: "members_org_employee_code_key",
    });
    const t = fakeDb((sql) => (sql.startsWith("update members") ? dup : script()(sql)));
    const r = await updateMember(t.db, scope, ACTOR, MID, { employeeCode: "E9" });
    expect(r).toMatchObject({ ok: false, status: 409, code: "employee_code_taken" });
    expect(t.sqls()).toContain("rollback");
  });
});

describe("listMembers", () => {
  it("binds q escaped, pages with limit + 1 and returns a cursor", async () => {
    const rows = [memberRow, { ...memberRow, id: GID }];
    const t = fakeDb((sql) => (sql.includes("json_agg") && sql.includes("limit $") ? rows : []));
    const r = await listMembers(t.db, scope, { status: "active", limit: 1, q: "50%_" });
    expect(r.items).toHaveLength(1);
    expect(r.nextCursor).not.toBeNull();
    const [sql, values] = t.calls[0]!;
    expect(sql).toContain("ilike $3");
    expect(values).toEqual([scope.orgId, "active", "%50\\%\\_%", 2]);
    expect(sql).not.toContain("50%");
  });
});
