import { describe, expect, it } from "vitest";
import type { OrgScope } from "@/server/http/org-scope";
import { recordInvitation } from "./record";

const scope = { orgId: "11111111-1111-4111-8111-111111111111" } as OrgScope;
const ACTOR = "22222222-2222-4222-8222-222222222222";
const IID = "33333333-3333-4333-8333-333333333333";
const v = {
  email: "nguyễn@x.vn",
  role: "simap:user" as const,
  identityInvitationId: IID,
  expiresAt: "2026-11-29T00:00:00.000Z",
};

function fakeDb(failOn?: RegExp) {
  const calls: [string, unknown[]][] = [];
  const query = async (text: string, values: unknown[] = []) => {
    const sql = text.replace(/\s+/g, " ").trim();
    calls.push([sql, values]);
    if (failOn?.test(sql)) throw new Error("boom");
    if (sql.startsWith("insert into invitations")) {
      return {
        rows: [
          {
            id: IID,
            email: v.email,
            role: v.role,
            created_at: new Date("2026-11-22T01:00:00Z"),
            expires_at: new Date(v.expiresAt),
          },
        ],
      };
    }
    return { rows: [] };
  };
  return { db: { connect: async () => ({ query, release: () => {} }) }, calls };
}

describe("recordInvitation", () => {
  it("upserts and audits in one transaction, org-scoped, without a token or email in the audit", async () => {
    const { db, calls } = fakeDb();
    const dto = await recordInvitation(db, scope, ACTOR, v);
    const sqls = calls.map(([s]) => s);
    expect(sqls[0]).toBe("begin");
    expect(sqls[1]).toMatch(
      /^insert into invitations .* on conflict \(org_id, lower\(email\)\) where status = 'pending' do update/,
    );
    expect(sqls[2]).toMatch(/^insert into audit_log/);
    expect(sqls[3]).toBe("commit");
    expect(sqls[1]).not.toMatch(/token/i);
    expect(calls[1]![1]).toEqual([scope.orgId, v.email, v.role, ACTOR, IID, v.expiresAt]);
    const audit = calls[2]![1];
    expect(audit[0]).toBe(scope.orgId);
    expect(audit.slice(1, 5)).toEqual([ACTOR, "invitation.create", "invitation", IID]);
    expect(audit[5]).toBe(JSON.stringify({ role: "simap:user" }));
    expect(dto).toEqual({
      id: IID,
      email: v.email,
      role: v.role,
      createdAt: "2026-11-22T01:00:00.000Z",
      expiresAt: v.expiresAt,
    });
  });

  it("rolls back and rethrows on an insert error", async () => {
    const { db, calls } = fakeDb(/^insert into invitations/);
    await expect(recordInvitation(db, scope, ACTOR, v)).rejects.toThrow("boom");
    expect(calls.map(([s]) => s)).toEqual(["begin", expect.any(String), "rollback"]);
  });
});
