import { describe, expect, it, vi } from "vitest";
import type { OrgScope } from "@/server/http/org-scope";
import { createMemberGate } from "./gate";

const scope = { orgId: "11111111-1111-4111-8111-111111111111" } as OrgScope;
const SUB = "22222222-2222-4222-8222-222222222222";

const gateWith = (rows: unknown[] | Error) => {
  const query = vi.fn(async (_t: string, _v: unknown[]) => {
    if (rows instanceof Error) throw rows;
    return { rows };
  });
  return { query, gate: createMemberGate(() => ({ query })) };
};

describe("member gate", () => {
  it("active row -> active; deactivated row -> deactivated; no row -> active", async () => {
    expect(await gateWith([{ status: "active" }]).gate(scope, SUB)).toBe("active");
    expect(await gateWith([{ status: "deactivated" }]).gate(scope, SUB)).toBe("deactivated");
    expect(await gateWith([]).gate(scope, SUB)).toBe("active");
  });

  it("getPool() null -> throws; query error -> throws", async () => {
    await expect(createMemberGate(() => null)(scope, SUB)).rejects.toThrow();
    await expect(gateWith(new Error("down")).gate(scope, SUB)).rejects.toThrow();
  });

  it("SQL is org-scoped by sub; no caching between calls", async () => {
    const t = gateWith([{ status: "active" }]);
    await t.gate(scope, SUB);
    await t.gate(scope, SUB);
    expect(t.query).toHaveBeenCalledTimes(2);
    const [sql, values] = t.query.mock.calls[0]!;
    expect(sql).toMatch(/org_id\s*=\s*\$1 and sub = \$2/);
    expect(values).toEqual([scope.orgId, SUB]);
  });

  it("reads getPool on every call", async () => {
    const getPoolFn = vi.fn(() => null);
    const gate = createMemberGate(getPoolFn);
    await gate(scope, SUB).catch(() => {});
    await gate(scope, SUB).catch(() => {});
    expect(getPoolFn).toHaveBeenCalledTimes(2);
  });
});
