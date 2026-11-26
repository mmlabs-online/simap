import { randomUUID } from "node:crypto";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { assertTestDb, newOrg, testPool } from "@/test/db/fixtures";
import { jpegOf, pngOf } from "@/test/photo-fixtures";
import type { OrgDrive } from "@/server/drive/drive";
import {
  getMemberPhoto,
  getOwnPhoto,
  removeMemberPhoto,
  removeOwnPhoto,
  setOwnPhoto,
} from "./photo";

vi.mock("server-only", () => ({}));

let pool: pg.Pool;
const JPEG = jpegOf(64, 64);
const PNG = pngOf(64, 64);
const jpeg = { bytes: JPEG, type: "jpeg" } as const;

/** A fake OrgDrive that records calls; `onUpload` runs before the upload returns. */
function fakeDrive(opts: { onUpload?: (n: number) => Promise<void>; failDelete?: boolean } = {}) {
  const calls: string[] = [];
  const uploads: { orgId: string; name: string; mimeType: string }[] = [];
  let n = 0;
  const drive: OrgDrive = {
    async uploadOrgFile(orgId, f) {
      n++;
      await opts.onUpload?.(n);
      uploads.push({ orgId, name: f.name, mimeType: f.mimeType });
      calls.push(`upload:file_${n}_abcdefghij`);
      return { id: `file_${n}_abcdefghij`, size: f.bytes.length, mimeType: f.mimeType };
    },
    async getFile(id) {
      calls.push(`get:${id}`);
      return { bytes: JPEG, contentType: "image/jpeg" };
    },
    async deleteFile(id) {
      calls.push(`delete:${id}`);
      if (opts.failDelete) throw new Error("delete failed");
    },
  };
  return { calls, uploads, getDrive: () => drive };
}

async function member(orgId: string, status = "active", name = "Test Member") {
  const sub = randomUUID();
  const { rows } = await pool.query(
    `insert into members (org_id, sub, email, display_name, status) values ($1, $2, $3, $4, $5) returning id`,
    [orgId, sub, `${sub}@simap.example`, name, status],
  );
  return { sub, id: rows[0].id as string };
}
const row = async (id: string) =>
  (
    await pool.query(
      `select photo_drive_file_id as f, photo_version as v, display_name as n, updated_at as u from members where id = $1`,
      [id],
    )
  ).rows[0] as { f: string | null; v: number; n: string; u: Date };
const audits = async (orgId: string, action: string) =>
  (
    await pool.query(
      "select actor_sub, entity, entity_id, meta from audit_log where org_id = $1 and action = $2 order by created_at, id",
      [orgId, action],
    )
  ).rows;

beforeAll(async () => {
  pool = testPool();
  await assertTestDb(pool);
});
afterAll(async () => {
  await pool.end();
});

describe("member photo (db)", () => {
  it("first set: version 1, org-scoped server-chosen name, mime from the type", async () => {
    const org = newOrg();
    const m = await member(org.orgId);
    const d = fakeDrive();
    const r = await setOwnPhoto(pool, d.getDrive, org.scope, m.sub, jpeg);
    expect(r).toEqual({ ok: true, value: { hasPhoto: true, photoVersion: 1 } });
    expect(await row(m.id)).toMatchObject({ f: "file_1_abcdefghij", v: 1 });
    expect(d.uploads[0]!.orgId).toBe(org.orgId);
    expect(d.uploads[0]!.name).toMatch(new RegExp(`^photo-${m.id}-[0-9a-f-]{36}\\.jpg$`));
    expect(d.uploads[0]!.mimeType).toBe("image/jpeg");
    const p = fakeDrive();
    await setOwnPhoto(pool, p.getDrive, org.scope, m.sub, { bytes: PNG, type: "png" });
    expect(p.uploads[0]!.name).toMatch(/\.png$/);
    expect(p.uploads[0]!.mimeType).toBe("image/png");
  });

  it("replace: old file deleted after commit, version 2; a Drive delete failure only logs an orphan", async () => {
    const org = newOrg();
    const m = await member(org.orgId);
    const d = fakeDrive();
    await setOwnPhoto(pool, d.getDrive, org.scope, m.sub, jpeg);
    const r = await setOwnPhoto(pool, d.getDrive, org.scope, m.sub, jpeg);
    expect(r).toMatchObject({ ok: true, value: { photoVersion: 2 } });
    expect(d.calls).toContain("delete:file_1_abcdefghij");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const f = fakeDrive({ failDelete: true });
    const r3 = await setOwnPhoto(pool, f.getDrive, org.scope, m.sub, jpeg);
    expect(r3).toMatchObject({ ok: true, value: { photoVersion: 3 } });
    const logged = log.mock.calls.map((c) => String(c[0]));
    log.mockRestore();
    expect(logged).toContain(JSON.stringify({ event: "drive_orphan", memberId: m.id }));
  });

  it("CAS race: a concurrent set during the upload gives 409 image_changed and deletes the new file", async () => {
    const org = newOrg();
    const m = await member(org.orgId);
    const d = fakeDrive({
      onUpload: async () => {
        await pool.query(
          "update members set photo_drive_file_id = 'other_file_abc', photo_version = 5 where id = $1",
          [m.id],
        );
      },
    });
    const r = await setOwnPhoto(pool, d.getDrive, org.scope, m.sub, jpeg);
    expect(r).toEqual({ ok: false, status: 409, code: "image_changed" });
    expect(d.calls).toContain("delete:file_1_abcdefghij");
    expect(await row(m.id)).toMatchObject({ f: "other_file_abc", v: 5 });
  });

  it("deactivated after the gate: 409 not_allowed, new file deleted, no audit, row unchanged", async () => {
    const org = newOrg();
    const m = await member(org.orgId);
    const d = fakeDrive({
      onUpload: async () => {
        await pool.query("update members set status = 'deactivated' where id = $1", [m.id]);
      },
    });
    const r = await setOwnPhoto(pool, d.getDrive, org.scope, m.sub, jpeg);
    expect(r).toEqual({ ok: false, status: 409, code: "not_allowed" });
    expect(d.calls).toContain("delete:file_1_abcdefghij");
    expect(await audits(org.orgId, "member.photo_set")).toHaveLength(0);
    expect(await row(m.id)).toMatchObject({ f: null, v: 0 });
    // already deactivated before the call: refused with no Drive call
    const d2 = fakeDrive();
    expect(await setOwnPhoto(pool, d2.getDrive, org.scope, m.sub, jpeg)).toMatchObject({
      status: 409,
      code: "not_allowed",
    });
    expect(d2.calls).toEqual([]);
  });

  it("no member row for the sub: 404 with no Drive call", async () => {
    const org = newOrg();
    const d = fakeDrive();
    expect(await setOwnPhoto(pool, d.getDrive, org.scope, randomUUID(), jpeg)).toEqual({
      ok: false,
      status: 404,
      code: "not_found",
    });
    expect(d.calls).toEqual([]);
  });

  it("remove own: idempotent (second call 204 equivalent, one audit row), works with Drive off", async () => {
    const org = newOrg();
    const m = await member(org.orgId);
    const d = fakeDrive();
    await setOwnPhoto(pool, d.getDrive, org.scope, m.sub, jpeg);
    expect(await removeOwnPhoto(pool, () => null, org.scope, m.sub)).toEqual({
      ok: true,
      value: null,
    });
    expect(await row(m.id)).toMatchObject({ f: null, v: 2 });
    expect(await removeOwnPhoto(pool, () => null, org.scope, m.sub)).toEqual({
      ok: true,
      value: null,
    });
    expect(await row(m.id)).toMatchObject({ v: 2 });
    expect(await audits(org.orgId, "member.photo_remove")).toHaveLength(1);
  });

  it("manager removes another member's photo: audited with the manager as actor and self false", async () => {
    const org = newOrg();
    const b = await member(org.orgId);
    const mgr = await member(org.orgId);
    const d = fakeDrive();
    await setOwnPhoto(pool, d.getDrive, org.scope, b.sub, jpeg);
    expect(await removeMemberPhoto(pool, d.getDrive, org.scope, mgr.sub, b.id)).toEqual({
      ok: true,
      value: null,
    });
    expect(await row(b.id)).toMatchObject({ f: null, v: 2 });
    expect(d.calls).toContain("delete:file_1_abcdefghij");
    const a = await audits(org.orgId, "member.photo_remove");
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({
      actor_sub: mgr.sub,
      entity: "member",
      entity_id: b.id,
      meta: { version: 2, self: false },
    });
    // a deactivated member's photo may also be removed by a manager; their own removal is refused
    const c = await member(org.orgId);
    await setOwnPhoto(pool, d.getDrive, org.scope, c.sub, jpeg);
    await pool.query("update members set status = 'deactivated' where id = $1", [c.id]);
    expect(await removeOwnPhoto(pool, d.getDrive, org.scope, c.sub)).toMatchObject({
      status: 409,
      code: "not_allowed",
    });
    expect(await removeMemberPhoto(pool, d.getDrive, org.scope, mgr.sub, c.id)).toMatchObject({
      ok: true,
    });
  });

  it("audit meta: set is exactly version, self, type, bytes; remove is version and self; no ids or bytes", async () => {
    const org = newOrg();
    const m = await member(org.orgId);
    const d = fakeDrive();
    await setOwnPhoto(pool, d.getDrive, org.scope, m.sub, jpeg);
    await removeOwnPhoto(pool, d.getDrive, org.scope, m.sub);
    const set = await audits(org.orgId, "member.photo_set");
    const rem = await audits(org.orgId, "member.photo_remove");
    expect(set[0].meta).toEqual({ version: 1, self: true, type: "jpeg", bytes: JPEG.length });
    expect(rem[0].meta).toEqual({ version: 2, self: true });
    for (const meta of [set[0].meta, rem[0].meta]) {
      expect(JSON.stringify(meta)).not.toContain("file_1_abcdefghij");
      for (const v of Object.values(meta)) expect(String(v).length).toBeLessThanOrEqual(10);
    }
  });

  it("get: cross-org id 404 with no Drive call; no photo 404; matching ETag skips Drive; invalid bytes give 502", async () => {
    const org = newOrg();
    const other = newOrg();
    const m = await member(org.orgId);
    const d = fakeDrive();
    expect(await getMemberPhoto(pool, d.getDrive, org.scope, m.id, null)).toMatchObject({
      status: 404,
    });
    await setOwnPhoto(pool, d.getDrive, org.scope, m.sub, jpeg);
    d.calls.length = 0;
    expect(await getMemberPhoto(pool, d.getDrive, other.scope, m.id, null)).toMatchObject({
      status: 404,
    });
    expect(d.calls).toEqual([]);
    const etag = `"${m.id}-1"`;
    expect(await getMemberPhoto(pool, d.getDrive, org.scope, m.id, etag)).toEqual({
      ok: true,
      value: { kind: "not_modified", etag },
    });
    expect(await getOwnPhoto(pool, d.getDrive, org.scope, m.sub, etag)).toMatchObject({
      ok: true,
    });
    expect(d.calls).toEqual([]);
    const g = await getMemberPhoto(pool, d.getDrive, org.scope, m.id, null);
    expect(g).toMatchObject({ ok: true, value: { kind: "bytes", contentType: "image/jpeg" } });
    const bad: OrgDrive = {
      ...d.getDrive(),
      getFile: async () => ({ bytes: new Uint8Array([1, 2, 3]), contentType: "image/jpeg" }),
    };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await getMemberPhoto(pool, () => bad, org.scope, m.id, null)).toEqual({
      ok: false,
      status: 502,
      code: "drive_error",
    });
    log.mockRestore();
  });

  it("the display name with diacritics is unaffected by set and remove", async () => {
    const org = newOrg();
    const name = "Nguyễn Văn Ân";
    const m = await member(org.orgId, "active", name);
    const before = await row(m.id);
    const d = fakeDrive();
    await setOwnPhoto(pool, d.getDrive, org.scope, m.sub, jpeg);
    const mid = await row(m.id);
    expect(mid.n).toBe(name);
    expect(mid.u.getTime()).toBeGreaterThan(before.u.getTime());
    await removeOwnPhoto(pool, d.getDrive, org.scope, m.sub);
    expect((await row(m.id)).n).toBe(name);
  });
});
