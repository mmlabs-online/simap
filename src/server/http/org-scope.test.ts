import { describe, expect, it, vi } from "vitest";
import { orgQuery, orgScopeOf } from "./org-scope";

const ORG = "22222222-2222-4222-8222-222222222222";
const ctx = { sub: "s", email: null, org: ORG, tier: "user" as const };

describe("orgScopeOf", () => {
  it("takes orgId only from the verified context", () => {
    expect(orgScopeOf(ctx).orgId).toBe(ORG);
  });
});

describe("orgQuery", () => {
  it("prepends scope.orgId as $1 and passes the remaining values shifted", async () => {
    const query = vi.fn(async (_t: string, _v: unknown[]) => ({ rows: [{ id: 1 }] }));
    const r = await orgQuery(
      { query },
      orgScopeOf(ctx),
      "select id from room where org_id = $1 and name = $2",
      ["A1"],
    );
    expect(query).toHaveBeenCalledWith("select id from room where org_id = $1 and name = $2", [
      ORG,
      "A1",
    ]);
    expect(r.rows).toEqual([{ id: 1 }]);
  });

  it("works without extra values", async () => {
    const query = vi.fn(async (_t: string, _v: unknown[]) => ({ rows: [] }));
    await orgQuery({ query }, orgScopeOf(ctx), "select 1 from seat where org_id=$1");
    expect(query).toHaveBeenCalledWith("select 1 from seat where org_id=$1", [ORG]);
  });

  it("throws before querying when SQL lacks org_id = $1 (case/whitespace tolerant)", () => {
    const query = vi.fn(async (_t: string, _v: unknown[]) => ({ rows: [] }));
    const scope = orgScopeOf(ctx);
    for (const sql of [
      "select * from room",
      "select * from room where org_id = $2",
      "select * from room where id = $1",
      "select * from room where org_id = $10",
    ]) {
      expect(() => orgQuery({ query }, scope, sql)).toThrow(/org_id = \$1/);
    }
    expect(query).not.toHaveBeenCalled();
    expect(() =>
      orgQuery({ query }, scope, "SELECT * FROM room WHERE ORG_ID\n  =  $1"),
    ).not.toThrow();
  });
});
