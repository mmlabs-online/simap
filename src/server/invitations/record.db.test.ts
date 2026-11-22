import { randomUUID } from "node:crypto";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listPendingInvitations } from "@/server/members/manage";
import { assertTestDb, newOrg, testPool } from "@/test/db/fixtures";
import { recordInvitation } from "./record";

let pool: pg.Pool;

beforeAll(async () => {
  pool = testPool();
  await assertTestDb(pool);
});
afterAll(async () => {
  await pool.end();
});

const value = (over: Partial<Parameters<typeof recordInvitation>[3]> = {}) => ({
  email: "new@x.vn",
  role: "simap:user" as const,
  identityInvitationId: randomUUID(),
  expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
  ...over,
});

describe("recordInvitation (db)", () => {
  it("records a pending row and lists it", async () => {
    const a = newOrg();
    const sub = randomUUID();
    const v = value();
    const dto = await recordInvitation(pool, a.scope, sub, v);
    const row = (await pool.query("select * from invitations where org_id = $1", [a.orgId]))
      .rows[0];
    expect(row).toMatchObject({
      invited_by_sub: sub,
      identity_invitation_id: v.identityInvitationId,
      status: "pending",
    });
    expect(new Date(row.expires_at).toISOString()).toBe(v.expiresAt);
    expect((await listPendingInvitations(pool, a.scope)).map((i) => i.id)).toEqual([dto.id]);
  });

  it("a re-invite in another case keeps one pending row with refreshed fields", async () => {
    const a = newOrg();
    await recordInvitation(pool, a.scope, randomUUID(), value({ email: "re@x.vn" }));
    const v2 = value({ email: "re@x.vn", role: "simap:manager" });
    const sub2 = randomUUID();
    await recordInvitation(pool, a.scope, sub2, v2);
    const rows = (await pool.query("select * from invitations where org_id = $1", [a.orgId])).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      role: "simap:manager",
      invited_by_sub: sub2,
      identity_invitation_id: v2.identityInvitationId,
    });
    expect(new Date(rows[0].expires_at).toISOString()).toBe(v2.expiresAt);
  });

  it("an accepted row for the same address does not conflict", async () => {
    const a = newOrg();
    await pool.query(
      `insert into invitations (org_id, email, role, invited_by_sub, status)
       values ($1, 'acc@x.vn', 'simap:user', $2, 'accepted')`,
      [a.orgId, randomUUID()],
    );
    await recordInvitation(pool, a.scope, randomUUID(), value({ email: "acc@x.vn" }));
    const n = await pool.query("select count(*)::int as n from invitations where org_id = $1", [
      a.orgId,
    ]);
    expect(n.rows[0].n).toBe(2);
  });

  it("another org does not see the row", async () => {
    const a = newOrg();
    const b = newOrg();
    await recordInvitation(pool, a.scope, randomUUID(), value());
    expect(await listPendingInvitations(pool, b.scope)).toEqual([]);
  });
});
