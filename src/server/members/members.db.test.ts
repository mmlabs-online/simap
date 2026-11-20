import { randomUUID } from "node:crypto";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assertTestDb, newOrg, testPool } from "@/test/db/fixtures";
import { getOrCreateMember, setOwnDisplayName } from "./members";

let pool: pg.Pool;

beforeAll(async () => {
  pool = testPool();
  await assertTestDb(pool);
});
afterAll(async () => {
  await pool.end();
});

const who = (email: string | null = "nguyen.van.a@simap.example") => ({
  sub: randomUUID(),
  email,
});
const count = async (sql: string, values: unknown[]) =>
  (await pool.query(sql, values)).rows[0].n as number;
const members = (orgId: string) =>
  count("select count(*)::int as n from members where org_id = $1", [orgId]);
const audits = (orgId: string, action: string) =>
  count("select count(*)::int as n from audit_log where org_id = $1 and action = $2", [
    orgId,
    action,
  ]);
const ok = <T>(r: { ok: true; value: T } | { ok: false }): T => {
  if (!r.ok) throw new Error("expected ok");
  return r.value;
};

describe("members (db)", () => {
  it("first call creates one active member with the default name, needsProfile true, one member.create audit row", async () => {
    const { orgId, scope } = newOrg();
    const w = who();
    const m = ok(await getOrCreateMember(pool, scope, w));
    expect(m).toMatchObject({
      displayName: "nguyen.van.a",
      status: "active",
      needsProfile: true,
    });
    expect(await members(orgId)).toBe(1);
    const a = await pool.query(
      "select actor_sub, entity_id from audit_log where org_id = $1 and action = 'member.create'",
      [orgId],
    );
    expect(a.rows).toEqual([{ actor_sub: w.sub, entity_id: m.id }]);
  });

  it("10 concurrent first calls create one row with one id and one member.create audit row", async () => {
    const { orgId, scope } = newOrg();
    const w = who();
    const rs = await Promise.all(
      Array.from({ length: 10 }, () => getOrCreateMember(pool, scope, w)),
    );
    expect(new Set(rs.map((r) => ok(r).id)).size).toBe(1);
    expect(await members(orgId)).toBe(1);
    expect(await audits(orgId, "member.create")).toBe(1);
  });

  it("same sub in two orgs gives two members; each org sees only its own", async () => {
    const a = newOrg();
    const b = newOrg();
    const w = who();
    const ma = ok(await getOrCreateMember(pool, a.scope, w));
    const mb = ok(await getOrCreateMember(pool, b.scope, w));
    expect(ma.id).not.toBe(mb.id);
    expect(await members(a.orgId)).toBe(1);
    expect(await members(b.orgId)).toBe(1);
  });

  it("second GET returns the same row, needsProfile still true, no new audit row, display name and email unchanged", async () => {
    const { orgId, scope } = newOrg();
    const w = who();
    const first = ok(await getOrCreateMember(pool, scope, w));
    const second = ok(await getOrCreateMember(pool, scope, { ...w, email: "other@simap.example" }));
    expect(second).toEqual(first);
    expect(second.needsProfile).toBe(true);
    expect(await audits(orgId, "member.create")).toBe(1);
    const row = await pool.query("select email from members where org_id = $1", [orgId]);
    expect(row.rows[0].email).toBe(w.email);
  });

  it("setDisplayName stores NFC and clears needsProfile; one member.update audit row with meta {fields:['displayName']}", async () => {
    const { orgId, scope } = newOrg();
    const w = who();
    await getOrCreateMember(pool, scope, w);
    const nfd = "Nguyễn Văn A".normalize("NFD");
    const m = ok(await setOwnDisplayName(pool, scope, w, nfd.normalize("NFC")));
    expect(m.displayName).toBe(nfd.normalize("NFC"));
    expect(m.needsProfile).toBe(false);
    expect(ok(await getOrCreateMember(pool, scope, w)).needsProfile).toBe(false);
    const a = await pool.query(
      "select meta from audit_log where org_id = $1 and action = 'member.update'",
      [orgId],
    );
    expect(a.rows).toHaveLength(1);
    expect(a.rows[0].meta.fields).toEqual(["displayName"]);
  });

  it("same name again is a no-op: no update, no audit row, needsProfile stays false", async () => {
    const { orgId, scope } = newOrg();
    const w = who();
    ok(await setOwnDisplayName(pool, scope, w, "An"));
    const again = ok(await setOwnDisplayName(pool, scope, w, "An"));
    expect(again.needsProfile).toBe(false);
    expect(await audits(orgId, "member.update")).toBe(1);
  });

  it("PATCH before any GET creates then updates (one row, member.create + member.update)", async () => {
    const { orgId, scope } = newOrg();
    const m = ok(await setOwnDisplayName(pool, scope, who(), "An"));
    expect(m.displayName).toBe("An");
    expect(await members(orgId)).toBe(1);
    expect(await audits(orgId, "member.create")).toBe(1);
    expect(await audits(orgId, "member.update")).toBe(1);
  });

  it("deactivated member: GET returns status deactivated (not reactivated); setDisplayName refuses 403 member_deactivated", async () => {
    const { orgId, scope } = newOrg();
    const w = who();
    await getOrCreateMember(pool, scope, w);
    await pool.query("update members set status = 'deactivated' where org_id = $1", [orgId]);
    expect(ok(await getOrCreateMember(pool, scope, w)).status).toBe("deactivated");
    expect(await setOwnDisplayName(pool, scope, w, "An")).toEqual({
      ok: false,
      status: 403,
      code: "member_deactivated",
    });
  });

  it("no email and no row: refusal 403 forbidden, nothing inserted; no email with an existing row returns it", async () => {
    const { orgId, scope } = newOrg();
    const w = who(null);
    expect(await getOrCreateMember(pool, scope, w)).toEqual({
      ok: false,
      status: 403,
      code: "forbidden",
    });
    expect(await setOwnDisplayName(pool, scope, w, "An")).toMatchObject({ ok: false });
    expect(await members(orgId)).toBe(0);
    const w2 = who();
    const m = ok(await getOrCreateMember(pool, scope, w2));
    expect(ok(await getOrCreateMember(pool, scope, { ...w2, email: null })).id).toBe(m.id);
  });
});
