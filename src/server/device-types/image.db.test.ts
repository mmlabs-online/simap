import { randomUUID } from "node:crypto";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { addMember, assertTestDb, newOrg, testPool } from "@/test/db/fixtures";
import type { OrgDrive } from "@/server/drive/drive";
import { deleteDeviceType, listDeviceTypes } from "./device-types";
import { getDeviceTypeImage, removeDeviceTypeImage, setDeviceTypeImage } from "./image";

vi.mock("server-only", () => ({}));

let pool: pg.Pool;
const SUB = randomUUID();
const bytes = new Uint8Array([1, 2, 3]);

/** A fake OrgDrive that records calls; `onUpload` runs before the upload returns. */
function fakeDrive(onUpload?: (n: number) => Promise<void>) {
  const calls: string[] = [];
  let n = 0;
  const drive: OrgDrive = {
    async uploadOrgFile(_org, f) {
      n++;
      await onUpload?.(n);
      calls.push(`upload:file_${n}_abcdefghij`);
      return { id: `file_${n}_abcdefghij`, size: f.bytes.length, mimeType: f.mimeType };
    },
    async getFile(id) {
      calls.push(`get:${id}`);
      return { bytes, contentType: "image/png" };
    },
    async deleteFile(id) {
      calls.push(`delete:${id}`);
    },
  };
  return { calls, getDrive: () => drive };
}

async function typeOf(): Promise<{ org: ReturnType<typeof newOrg>; id: string }> {
  const org = newOrg();
  await addMember(pool, org.orgId);
  const r = await listDeviceTypes(pool, org.scope);
  if (!r.ok) throw new Error("list failed");
  return { org, id: r.value.items[0]!.id };
}
const row = async (id: string) =>
  (
    await pool.query(
      "select image_drive_file_id as f, image_version as v from device_types where id = $1",
      [id],
    )
  ).rows[0] as { f: string | null; v: number };
const audits = async (orgId: string, action: string) =>
  (
    await pool.query(
      "select meta from audit_log where org_id = $1 and action = $2 order by created_at, id",
      [orgId, action],
    )
  ).rows.map((r) => r.meta);

beforeAll(async () => {
  pool = testPool();
  await assertTestDb(pool);
});
afterAll(async () => {
  await pool.end();
});

describe("device type image (db)", () => {
  it("set: version 0 to 1, hasImage, audit; set again gives 2 and deletes the old file", async () => {
    const { org, id } = await typeOf();
    const d = fakeDrive();
    const a = await setDeviceTypeImage(pool, d.getDrive, org.scope, SUB, id, bytes);
    expect(a).toMatchObject({ ok: true, value: { id, hasImage: true, imageVersion: 1 } });
    expect(await row(id)).toEqual({ f: "file_1_abcdefghij", v: 1 });
    const b = await setDeviceTypeImage(pool, d.getDrive, org.scope, SUB, id, bytes);
    expect(b).toMatchObject({ ok: true, value: { imageVersion: 2 } });
    expect(await row(id)).toEqual({ f: "file_2_abcdefghij", v: 2 });
    expect(d.calls).toContain("delete:file_1_abcdefghij");
    expect(await audits(org.orgId, "device_type.image_set")).toEqual([
      { version: 1 },
      { version: 2 },
    ]);
    const g = await getDeviceTypeImage(pool, d.getDrive, org.scope, id, `"${id}-2"`);
    expect(g).toEqual({ ok: true, value: { kind: "not_modified", etag: `"${id}-2"` } });
  });

  it("remove: null, version bump, audit; removing again changes nothing", async () => {
    const { org, id } = await typeOf();
    const d = fakeDrive();
    await setDeviceTypeImage(pool, d.getDrive, org.scope, SUB, id, bytes);
    expect(await removeDeviceTypeImage(pool, d.getDrive, org.scope, SUB, id)).toEqual({
      ok: true,
      value: null,
    });
    expect(await row(id)).toEqual({ f: null, v: 2 });
    expect(d.calls).toContain("delete:file_1_abcdefghij");
    expect(await audits(org.orgId, "device_type.image_remove")).toEqual([{ version: 2 }]);
    expect(await removeDeviceTypeImage(pool, d.getDrive, org.scope, SUB, id)).toEqual({
      ok: true,
      value: null,
    });
    expect(await row(id)).toEqual({ f: null, v: 2 });
    expect(await audits(org.orgId, "device_type.image_remove")).toHaveLength(1);
  });

  it("cross-org: set, remove and get give 404 and make no Drive call", async () => {
    const { id } = await typeOf();
    const other = newOrg();
    await addMember(pool, other.orgId);
    const d = fakeDrive();
    const getDrive = vi.fn(d.getDrive);
    const nf = { ok: false, status: 404, code: "not_found" };
    expect(await setDeviceTypeImage(pool, getDrive, other.scope, SUB, id, bytes)).toEqual(nf);
    expect(await removeDeviceTypeImage(pool, getDrive, other.scope, SUB, id)).toEqual(nf);
    expect(await getDeviceTypeImage(pool, getDrive, other.scope, id, null)).toEqual(nf);
    expect(getDrive).not.toHaveBeenCalled();
    expect(await row(id)).toEqual({ f: null, v: 0 });
  });

  it("CAS loses: another writer changes the file id during the upload; 409 and the new file is deleted", async () => {
    const { org, id } = await typeOf();
    const d = fakeDrive(async () => {
      await pool.query(
        "update device_types set image_drive_file_id = 'other_file_12345', image_version = 1 where id = $1",
        [id],
      );
    });
    const r = await setDeviceTypeImage(pool, d.getDrive, org.scope, SUB, id, bytes);
    expect(r).toEqual({ ok: false, status: 409, code: "image_changed" });
    expect(await row(id)).toEqual({ f: "other_file_12345", v: 1 });
    expect(d.calls).toContain("delete:file_1_abcdefghij");
    expect(await audits(org.orgId, "device_type.image_set")).toEqual([]);
  });

  it("deleteDeviceType returns the image file id of the deleted row", async () => {
    const { org, id } = await typeOf();
    const d = fakeDrive();
    await setDeviceTypeImage(pool, d.getDrive, org.scope, SUB, id, bytes);
    expect(await deleteDeviceType(pool, org.scope, SUB, id)).toEqual({
      ok: true,
      value: { imageFileId: "file_1_abcdefghij" },
    });
  });
});
