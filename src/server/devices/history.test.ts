import { describe, expect, it } from "vitest";
import type { OrgScope } from "@/server/http/org-scope";
import { listDeviceHistory } from "./history";

const scope = { orgId: "11111111-1111-4111-8111-111111111111" } as OrgScope;
const SUB = "22222222-2222-4222-8222-222222222222";
const DEV = "33333333-3333-4333-8333-333333333333";

function fakeDb(probe: { owner_id: string | null; holder_since: string | null; held: boolean }[]) {
  const calls: [string, unknown[]][] = [];
  const db = {
    query: async (text: string, values: unknown[] = []) => {
      const sql = text.replace(/\s+/g, " ").trim();
      calls.push([sql, values]);
      return { rows: sql.includes("from devices d") ? probe : [] };
    },
  };
  return { db, calls, audit: () => calls.some(([s]) => s.includes("from audit_log a left join")) };
}
const q = { limit: 10 };
const row = (held: boolean) => [{ owner_id: "x", holder_since: null, held }];

describe("listDeviceHistory visibility", () => {
  it("user not holding: notFound and the audit query never runs", async () => {
    const t = fakeDb(row(false));
    const r = await listDeviceHistory(t.db, scope, SUB, "user", DEV, q);
    expect(r).toEqual({ ok: false, status: 404, code: "not_found" });
    expect(t.audit()).toBe(false);
  });

  it("probe binds the caller's sub as $3", async () => {
    const t = fakeDb(row(true));
    await listDeviceHistory(t.db, scope, SUB, "user", DEV, q);
    expect(t.calls[0]![1]).toEqual([scope.orgId, DEV, SUB]);
  });

  it("user holding, manager and admin proceed to the audit query", async () => {
    for (const [tier, held] of [
      ["user", true],
      ["manager", false],
      ["admin", false],
    ] as const) {
      const t = fakeDb(row(held));
      const r = await listDeviceHistory(t.db, scope, SUB, tier, DEV, q);
      expect(r.ok).toBe(true);
      expect(t.audit()).toBe(true);
    }
  });

  it("unknown id is 404 for every tier", async () => {
    for (const tier of ["user", "manager", "admin"] as const) {
      const t = fakeDb([]);
      expect(await listDeviceHistory(t.db, scope, SUB, tier, DEV, q)).toEqual({
        ok: false,
        status: 404,
        code: "not_found",
      });
      expect(t.audit()).toBe(false);
    }
  });
});
