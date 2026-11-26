import { randomUUID } from "node:crypto";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assertTestDb, newOrg, testPool } from "@/test/db/fixtures";
import { getOrCreateMember } from "./members";
import { getOwnPixelLook, setOwnPixelLook } from "./pixel-look";

let pool: pg.Pool;

beforeAll(async () => {
  pool = testPool();
  await assertTestDb(pool);
});
afterAll(async () => {
  await pool.end();
});

const LOOK = { skin: 3, hair: 4, style: 2, shirt: 5 } as const;
const OTHER = { skin: 0, hair: 0, style: 1, shirt: 0 } as const;

async function member() {
  const o = newOrg();
  const sub = randomUUID();
  await getOrCreateMember(pool, o.scope, { sub, email: "an.nguyen@simap.example" });
  return { ...o, sub };
}
const updates = async (orgId: string) =>
  (
    await pool.query(
      "select actor_sub, entity_id, meta from audit_log where org_id = $1 and action = 'member.update' order by created_at, id",
      [orgId],
    )
  ).rows;
const stored = async (orgId: string, sub: string) =>
  (await pool.query("select pixel_look from members where org_id = $1 and sub = $2", [orgId, sub]))
    .rows[0].pixel_look;

describe("own pixel look (db)", () => {
  it("get returns null for a new member and the stored look after set", async () => {
    const m = await member();
    expect(await getOwnPixelLook(pool, m.scope, m.sub)).toEqual({ ok: true, value: null });
    expect(await setOwnPixelLook(pool, m.scope, m.sub, LOOK)).toEqual({ ok: true, value: LOOK });
    expect(await getOwnPixelLook(pool, m.scope, m.sub)).toEqual({ ok: true, value: LOOK });
    expect(await stored(m.orgId, m.sub)).toEqual(LOOK);
  });

  it("set writes one member.update audit row with meta {fields, self, look}", async () => {
    const m = await member();
    await setOwnPixelLook(pool, m.scope, m.sub, LOOK);
    const rows = await updates(m.orgId);
    expect(rows).toHaveLength(1);
    expect(rows[0].actor_sub).toBe(m.sub);
    expect(rows[0].meta).toEqual({ fields: ["pixelLook"], self: true, look: LOOK });
  });

  it("same look again writes no audit row; reset writes one with look null; reset again writes none", async () => {
    const m = await member();
    await setOwnPixelLook(pool, m.scope, m.sub, LOOK);
    await setOwnPixelLook(pool, m.scope, m.sub, { ...LOOK });
    expect(await updates(m.orgId)).toHaveLength(1);
    expect(await setOwnPixelLook(pool, m.scope, m.sub, null)).toEqual({ ok: true, value: null });
    const rows = await updates(m.orgId);
    expect(rows).toHaveLength(2);
    expect(rows[1].meta).toEqual({ fields: ["pixelLook"], self: true, look: null });
    expect(await stored(m.orgId, m.sub)).toBeNull();
    await setOwnPixelLook(pool, m.scope, m.sub, null);
    expect(await updates(m.orgId)).toHaveLength(2);
  });

  it("deactivated member: 403 member_deactivated, column unchanged, no audit row", async () => {
    const m = await member();
    await setOwnPixelLook(pool, m.scope, m.sub, LOOK);
    await pool.query("update members set status = 'deactivated' where org_id = $1", [m.orgId]);
    expect(await setOwnPixelLook(pool, m.scope, m.sub, OTHER)).toEqual({
      ok: false,
      status: 403,
      code: "member_deactivated",
    });
    expect(await setOwnPixelLook(pool, m.scope, m.sub, null)).toMatchObject({ ok: false });
    expect(await stored(m.orgId, m.sub)).toEqual(LOOK);
    expect(await updates(m.orgId)).toHaveLength(1);
  });

  it("org isolation: another org's member with the same sub is untouched; unknown sub is 404 with no audit row", async () => {
    const a = await member();
    const b = newOrg();
    await getOrCreateMember(pool, b.scope, { sub: a.sub, email: "an.nguyen@simap.example" });
    await setOwnPixelLook(pool, a.scope, a.sub, LOOK);
    expect(await stored(b.orgId, a.sub)).toBeNull();
    expect(await getOwnPixelLook(pool, b.scope, a.sub)).toEqual({ ok: true, value: null });
    const none = newOrg();
    const gone = { ok: false, status: 404, code: "not_found" };
    expect(await getOwnPixelLook(pool, none.scope, a.sub)).toEqual(gone);
    expect(await setOwnPixelLook(pool, none.scope, a.sub, LOOK)).toEqual(gone);
    expect(await updates(none.orgId)).toHaveLength(0);
    expect(await updates(b.orgId)).toHaveLength(0);
  });
});
