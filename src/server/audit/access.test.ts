import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OrgScope } from "@/server/http/org-scope";

const getPool = vi.fn<() => unknown>();
vi.mock("@/server/db/pool", () => ({ getPool: () => getPool() }));

const { writeAccessAudit } = await import("./access");

const ORG = "22222222-2222-4222-8222-222222222222";
const SUB = "11111111-1111-4111-8111-111111111111";
const scope = Object.freeze({ orgId: ORG }) as OrgScope;

beforeEach(() => getPool.mockReset());

describe("writeAccessAudit", () => {
  it("writes action access.super_admin, entity org, entityId org, meta {method, route}", async () => {
    const query = vi.fn(async () => ({ rows: [] }));
    getPool.mockReturnValue({ query });
    await writeAccessAudit(scope, SUB, { method: "POST", route: "/api/rooms/:id" });
    expect(query).toHaveBeenCalledTimes(1);
    const [text, values] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(text).toContain("insert into audit_log");
    expect(values).toEqual([
      ORG,
      SUB,
      "access.super_admin",
      "org",
      ORG,
      JSON.stringify({ method: "POST", route: "/api/rooms/:id" }),
    ]);
  });

  it("pool null -> throws", async () => {
    getPool.mockReturnValue(null);
    await expect(writeAccessAudit(scope, SUB, { method: "POST", route: "/x" })).rejects.toThrow();
  });
});
