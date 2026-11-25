import { randomUUID } from "node:crypto";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { deflateSync, crc32 } from "node:zlib";
import { sizeFor } from "@/lib/map-items/art";
import type { Direction } from "@/lib/sprites/types";
import type { OrgDrive } from "@/server/drive/drive";
import { addMember, assertTestDb, newOrg, testPool } from "@/test/db/fixtures";
import { resetMapItem, setMapItemArt, updateMapItem } from "./edit";
import { getMapItemImage, mapItemEtag, removeMapItemImage, setMapItemImage } from "./image";

vi.mock("server-only", () => ({}));

let pool: pg.Pool;
type Org = ReturnType<typeof newOrg>;
const SUB = randomUUID();
const bytes = new Uint8Array([1, 2, 3]);

function makePng(w: number, h: number): Uint8Array {
  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length);
    const v = new DataView(out.buffer);
    v.setUint32(0, data.length);
    out.set(
      [...type].map((c) => c.charCodeAt(0)),
      4,
    );
    out.set(data, 8);
    v.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
    return out;
  };
  const hd = new Uint8Array(13);
  new DataView(hd.buffer).setUint32(0, w);
  new DataView(hd.buffer).setUint32(4, h);
  hd.set([8, 6, 0, 0, 0], 8);
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", hd),
    chunk("IDAT", new Uint8Array(deflateSync(Buffer.alloc((w * 4 + 1) * h)))),
    chunk("IEND", new Uint8Array(0)),
  ];
  const all = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    all.set(p, at);
    at += p.length;
  }
  return all;
}

/** A fake OrgDrive that records calls; `onUpload` runs before the upload returns. */
function fakeDrive(onUpload?: (n: number) => Promise<void>, served: Uint8Array = bytes) {
  const calls: string[] = [];
  let n = 0;
  const drive: OrgDrive = {
    async uploadOrgFile(_org, f) {
      const mine = ++n;
      await onUpload?.(mine);
      calls.push(`upload:file_${mine}_abcdefghij`);
      return { id: `file_${mine}_abcdefghij`, size: f.bytes.length, mimeType: f.mimeType };
    },
    async getFile(id) {
      calls.push(`get:${id}`);
      return { bytes: served, contentType: "image/png" };
    },
    async deleteFile(id) {
      calls.push(`delete:${id}`);
    },
  };
  return { calls, getDrive: () => drive };
}

const rowOf = async (o: Org, key: string) =>
  (
    await pool.query("select * from map_items where org_id = $1 and builtin_key = $2", [
      o.orgId,
      key,
    ])
  ).rows[0];
const fileOf = async (o: Org, key: string, d: Direction) =>
  (await rowOf(o, key))[`art_${d}_drive_file_id`] as string | null;
const versionOf = async (o: Org, key: string, d: Direction) =>
  (await rowOf(o, key))[`art_${d}_image_version`] as number;
const audits = async (o: Org, action: string) =>
  (
    await pool.query(
      "select entity_id, meta from audit_log where org_id = $1 and action = $2 order by created_at, id",
      [o.orgId, action],
    )
  ).rows;

/** The smallest image that fits the item's current size for that direction. */
async function fit(o: Org, key: string, d: Direction) {
  const r = await rowOf(o, key);
  const [tw, th] = sizeFor(d, r.w, r.h);
  return { width: 32 * tw, height: 32 * th };
}
async function put(o: Org, drive: ReturnType<typeof fakeDrive>, key: string, d: Direction) {
  return setMapItemImage(pool, drive.getDrive, o.scope, SUB, key, d, bytes, await fit(o, key, d));
}
async function seeded(): Promise<Org> {
  const o = newOrg();
  await addMember(pool, o.orgId);
  return o;
}
const notFound = { ok: false, status: 404, code: "not_found" };
const changed = { ok: false, status: 409, code: "image_changed" };

beforeAll(async () => {
  pool = testPool();
  await assertTestDb(pool);
});
afterAll(async () => {
  await pool.end();
});

describe("map item image (db)", () => {
  it("upload sets the file id and bumps the version; DTO hasImage true; audit map_item.image_set {key, dir, version}, entity_id null", async () => {
    const o = await seeded();
    const d = fakeDrive();
    const r = await put(o, d, "door", "e");
    expect(r).toMatchObject({
      ok: true,
      value: { builtinKey: "door", art: { e: { hasImage: true, imageVersion: 1 } } },
    });
    expect(await fileOf(o, "door", "e")).toBe("file_1_abcdefghij");
    expect(await versionOf(o, "door", "e")).toBe(1);
    expect(await versionOf(o, "door", "n")).toBe(0);
    const a = await audits(o, "map_item.image_set");
    expect(a).toEqual([{ entity_id: null, meta: { key: "door", dir: "e", version: 1 } }]);
    expect(JSON.stringify(a)).not.toContain("file_1");
  });

  it("replace deletes the old file; remove nulls the id, bumps the version and deletes the file; a second remove writes no audit", async () => {
    const o = await seeded();
    const d = fakeDrive();
    await put(o, d, "door", "e");
    await put(o, d, "door", "e");
    expect(await fileOf(o, "door", "e")).toBe("file_2_abcdefghij");
    expect(d.calls).toContain("delete:file_1_abcdefghij");
    expect(await removeMapItemImage(pool, d.getDrive, o.scope, SUB, "door", "e")).toEqual({
      ok: true,
      value: null,
    });
    expect(await fileOf(o, "door", "e")).toBeNull();
    expect(await versionOf(o, "door", "e")).toBe(3);
    expect(d.calls).toContain("delete:file_2_abcdefghij");
    expect(await audits(o, "map_item.image_remove")).toEqual([
      { entity_id: null, meta: { key: "door", dir: "e", version: 3 } },
    ]);
    expect(await removeMapItemImage(pool, d.getDrive, o.scope, SUB, "door", "e")).toEqual({
      ok: true,
      value: null,
    });
    expect(await audits(o, "map_item.image_remove")).toHaveLength(1);
    expect(await versionOf(o, "door", "e")).toBe(3);
  });

  it("org B gets 404 on PUT, DELETE and GET for org A's key/dir with a file, and org A's row is unchanged", async () => {
    const a = await seeded();
    const d = fakeDrive();
    await put(a, d, "door", "e");
    const b = await seeded();
    // org B has its own row for the key; make B's row lack the file but never touch A's
    const getDrive = vi.fn(d.getDrive);
    expect(await getMapItemImage(pool, getDrive, b.scope, "door", "e", null)).toEqual(notFound);
    expect(await removeMapItemImage(pool, getDrive, b.scope, SUB, "door", "e")).toEqual({
      ok: true,
      value: null,
    });
    expect(getDrive).not.toHaveBeenCalled();
    expect(await fileOf(a, "door", "e")).toBe("file_1_abcdefghij");
    expect(await versionOf(a, "door", "e")).toBe(1);
    const nobody = newOrg(); // an org with no catalog rows at all
    const g = vi.fn(d.getDrive);
    expect(await getMapItemImage(pool, g, nobody.scope, "door", "e", null)).toEqual(notFound);
    expect(await removeMapItemImage(pool, g, nobody.scope, SUB, "door", "e")).toEqual(notFound);
    expect(
      await setMapItemImage(pool, g, nobody.scope, SUB, "door", "e", bytes, {
        width: 32,
        height: 32,
      }),
    ).toEqual(notFound);
    expect(g).not.toHaveBeenCalled();
    expect(await fileOf(a, "door", "e")).toBe("file_1_abcdefghij");
  });

  it("two concurrent uploads to one dir: one ok, one 409 image_changed, the loser's file deleted", async () => {
    const o = await seeded();
    let arrived = 0;
    let release!: () => void;
    const both = new Promise<void>((r) => (release = r));
    const d = fakeDrive(async () => {
      if (++arrived === 2) release();
      await both;
    });
    const px = await fit(o, "door", "e");
    const run = () => setMapItemImage(pool, d.getDrive, o.scope, SUB, "door", "e", bytes, px);
    const rs = await Promise.all([run(), run()]);
    expect(rs.filter((r) => r.ok)).toHaveLength(1);
    expect(rs.filter((r) => !r.ok)).toEqual([changed]);
    const kept = await fileOf(o, "door", "e");
    const lost = ["file_1_abcdefghij", "file_2_abcdefghij"].find((f) => f !== kept)!;
    expect(d.calls).toContain(`delete:${lost}`);
    expect(await versionOf(o, "door", "e")).toBe(1);
  });

  it("uploads to two dirs of one item at once both succeed and both file ids remain", async () => {
    const o = await seeded();
    let arrived = 0;
    let release!: () => void;
    const both = new Promise<void>((r) => (release = r));
    const d = fakeDrive(async () => {
      if (++arrived === 2) release();
      await both;
    });
    const rs = await Promise.all([put(o, d, "door", "n"), put(o, d, "door", "e")]);
    expect(rs.map((r) => r.ok)).toEqual([true, true]);
    expect(await fileOf(o, "door", "n")).toMatch(/^file_\d_abcdefghij$/);
    expect(await fileOf(o, "door", "e")).toMatch(/^file_\d_abcdefghij$/);
    expect(await fileOf(o, "door", "n")).not.toBe(await fileOf(o, "door", "e"));
  });

  it("a resize during the upload gives 409 image_changed and no file stored; same for a reset", async () => {
    const o = await seeded();
    const px = await fit(o, "shelf.books", "s");
    const d = fakeDrive(async () => {
      await updateMapItem(pool, o.scope, SUB, "shelf.books", { w: 3 });
    });
    expect(
      await setMapItemImage(pool, d.getDrive, o.scope, SUB, "shelf.books", "s", bytes, px),
    ).toEqual(changed);
    expect(await fileOf(o, "shelf.books", "s")).toBeNull();
    expect(d.calls).toContain("delete:file_1_abcdefghij");

    // the item is now 3 x 1; a reset back to the default during the upload also loses
    const px3 = await fit(o, "shelf.books", "s");
    const e = fakeDrive(async () => {
      await resetMapItem(pool, o.scope, SUB, "shelf.books");
    });
    expect(
      await setMapItemImage(pool, e.getDrive, o.scope, SUB, "shelf.books", "s", bytes, px3),
    ).toEqual(changed);
    expect(await fileOf(o, "shelf.books", "s")).toBeNull();
    expect(e.calls).toContain("delete:file_1_abcdefghij");
  });

  it("a rename or a package sprite pick during the upload does not lose the image (setMapItemArt keeps the file id)", async () => {
    const o = await seeded();
    const d = fakeDrive(async () => {
      await updateMapItem(pool, o.scope, SUB, "plant.large", { name: "Big plant" });
      await setMapItemArt(pool, o.scope, SUB, "plant.large", "s", "plant.small");
    });
    const r = await put(o, d, "plant.large", "s");
    expect(r).toMatchObject({
      ok: true,
      value: { name: "Big plant", art: { s: { sprite: "plant.small", hasImage: true } } },
    });
    // a later sprite pick leaves the file and its version alone
    await setMapItemArt(pool, o.scope, SUB, "plant.large", "s", null);
    expect(await fileOf(o, "plant.large", "s")).toBe("file_1_abcdefghij");
    expect(await versionOf(o, "plant.large", "s")).toBe(1);
  });

  it('get returns the bytes with ETag "<key>-<dir>-<version>"; a hidden item\'s image is served', async () => {
    const o = await seeded();
    const png = makePng(32, 32);
    const d = fakeDrive(undefined, png);
    await put(o, d, "plant.large", "s");
    await updateMapItem(pool, o.scope, SUB, "plant.large", { hidden: true });
    const g = await getMapItemImage(pool, d.getDrive, o.scope, "plant.large", "s", null);
    expect(g).toEqual({
      ok: true,
      value: { kind: "bytes", bytes: png, etag: mapItemEtag(o.scope, "plant.large", "s", 1) },
    });
    const m = await getMapItemImage(
      pool,
      d.getDrive,
      o.scope,
      "plant.large",
      "s",
      mapItemEtag(o.scope, "plant.large", "s", 1),
    );
    expect(m).toEqual({
      ok: true,
      value: { kind: "not_modified", etag: mapItemEtag(o.scope, "plant.large", "s", 1) },
    });
    expect(
      await getMapItemImage(pool, d.getDrive, o.scope, "plant.large", "s", null),
    ).toMatchObject({ ok: true });
    expect(await getMapItemImage(pool, d.getDrive, o.scope, "door", "e", null)).toEqual(notFound);
  });

  it("another org sending this org's ETag never gets 304", async () => {
    const a = await seeded();
    const b = await seeded();
    const png = makePng(32, 32);
    const d = fakeDrive(undefined, png);
    await put(a, d, "plant.large", "s");
    await put(b, d, "plant.large", "s");
    const etagA = mapItemEtag(a.scope, "plant.large", "s", 1);
    const r = await getMapItemImage(pool, d.getDrive, b.scope, "plant.large", "s", etagA);
    expect(r).toMatchObject({ ok: true, value: { kind: "bytes" } });
    expect(etagA).not.toContain(a.orgId);
  });

  it("a refused upload (wrong size) writes nothing and makes no Drive call", async () => {
    const o = await seeded();
    const d = fakeDrive();
    const r = await setMapItemImage(pool, d.getDrive, o.scope, SUB, "door", "e", bytes, {
      width: 999,
      height: 999,
    });
    expect(r).toEqual({ ok: false, status: 422, code: "image_bad_size" });
    expect(d.calls).toEqual([]);
    expect(await audits(o, "map_item.image_set")).toEqual([]);
    expect(await versionOf(o, "door", "e")).toBe(0);
  });
});
