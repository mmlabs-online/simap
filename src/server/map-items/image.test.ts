import { deflateSync } from "node:zlib";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DriveError } from "@/server/drive/client";
import type { OrgDrive } from "@/server/drive/drive";
import type { OrgScope } from "@/server/http/org-scope";

vi.mock("server-only", () => ({}));

import { getMapItemImage, removeMapItemImage, setMapItemImage } from "./image";

const SUB = "44444444-4444-4444-8444-444444444444";
const scope = { orgId: "org-1" } as unknown as OrgScope;
const OLD = "oldfileid_12345";
const NEW = "newfileid_12345";
const bytes = new Uint8Array([1, 2, 3]);
// door is directional, 1 x 1: an e image is 32 wide and 32..64 high
const FIT = { width: 32, height: 64 };

type Opts = {
  row?: { w: number; h: number; file: string | null; version: number } | null;
  casRows?: number;
  rowAfter?: boolean;
  updateThrows?: boolean;
  auditThrows?: boolean;
  commitThrows?: boolean;
  uploadThrows?: unknown;
  getThrows?: unknown;
  deleteThrows?: unknown;
  getBytes?: Uint8Array;
};

function harness(o: Opts = {}) {
  const calls: string[] = [];
  const uploads: any[] = [];
  const sql: { text: string; values: unknown[] }[] = [];
  let selects = 0;
  const row = o.row === undefined ? { w: 1, h: 1, file: OLD, version: 2 } : o.row;
  const query = async (text: string, values: unknown[] = []) => {
    sql.push({ text, values });
    const t = text.replace(/\s+/g, " ").trim();
    if (/^(begin|commit|rollback)$/.test(t)) {
      calls.push(t);
      if (t === "commit" && o.commitThrows) throw new Error("commit failed");
      return { rows: [] };
    }
    if (t.includes("for no key update")) {
      calls.push("select-lock");
      return { rows: row ? [{ file: row.file }] : [] };
    }
    if (t.startsWith("select w, h,")) {
      selects++;
      calls.push("select");
      const exists = selects > 1 && o.rowAfter !== undefined ? o.rowAfter : row !== null;
      return { rows: exists && row ? [row] : [] };
    }
    if (t.startsWith("update map_items set") && t.includes("= null")) {
      calls.push("update-null");
      return { rows: [{ version: (row?.version ?? 0) + 1 }] };
    }
    if (t.startsWith("update map_items set")) {
      calls.push("update-cas");
      if (o.updateThrows) throw new Error("update failed");
      if (o.casRows === 0) return { rows: [] };
      return {
        rows: [
          {
            builtin_key: "door",
            name: "door",
            group_name: "Doors",
            w: 1,
            h: 1,
            hidden: false,
            art_n_sprite: null,
            art_n_has_image: false,
            art_n_image_version: 0,
            art_e_sprite: null,
            art_e_has_image: true,
            art_e_image_version: (row?.version ?? 0) + 1,
            art_s_sprite: null,
            art_s_has_image: false,
            art_s_image_version: 0,
            art_w_sprite: null,
            art_w_has_image: false,
            art_w_image_version: 0,
          },
        ],
      };
    }
    if (t.startsWith("insert into audit_log")) {
      calls.push("audit");
      if (o.auditThrows) throw new Error("audit failed");
      return { rows: [] };
    }
    throw new Error(`unexpected sql: ${t}`);
  };
  const db = {
    query,
    connect: async () => ({ query, release: () => calls.push("release") }),
  };
  const drive: OrgDrive = {
    async uploadOrgFile(orgId, f) {
      calls.push("upload");
      uploads.push({ orgId, ...f });
      if (o.uploadThrows) throw o.uploadThrows;
      return { id: NEW, size: f.bytes.length, mimeType: f.mimeType };
    },
    async getFile(id) {
      calls.push(`getFile:${id}`);
      if (o.getThrows) throw o.getThrows;
      return { bytes: o.getBytes ?? PNG, contentType: "text/html" };
    },
    async deleteFile(id) {
      calls.push(`delete:${id}`);
      if (o.deleteThrows) throw o.deleteThrows;
    },
  };
  const getDrive = vi.fn(() => {
    calls.push("getDrive");
    return drive;
  });
  const noDrive = vi.fn(() => null);
  return { db: db as any, calls, uploads, sql, getDrive, noDrive };
}

import { crc32 } from "node:zlib";
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
const PNG = makePng(32, 64);

let errLog: { mock: { calls: unknown[][] } };
const logged = () => errLog.mock.calls.map((c) => String(c[0]));
beforeEach(() => {
  errLog = vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("setMapItemImage", () => {
  it("unknown key gives 404 and n/e/w of a non-directional item gives 422 not_allowed, with zero db calls", async () => {
    const h = harness();
    expect(await setMapItemImage(h.db, h.getDrive, scope, SUB, "nope", "s", bytes, FIT)).toEqual({
      ok: false,
      status: 404,
      code: "not_found",
    });
    for (const d of ["n", "e", "w"] as const) {
      expect(
        await setMapItemImage(h.db, h.getDrive, scope, SUB, "plant.large", d, bytes, FIT),
      ).toEqual({ ok: false, status: 422, code: "not_allowed" });
    }
    expect(h.sql).toEqual([]);
    expect(h.getDrive).not.toHaveBeenCalled();
    for (const d of ["n", "e", "w"] as const) {
      expect(await removeMapItemImage(h.db, h.getDrive, scope, SUB, "plant.large", d)).toEqual({
        ok: false,
        status: 422,
        code: "not_allowed",
      });
    }
    expect(h.sql).toEqual([]);
  });

  it("bad size: exactly one select (org_id = $1), no Drive call, no update, no audit, 422 image_bad_size", async () => {
    const h = harness();
    const r = await setMapItemImage(h.db, h.getDrive, scope, SUB, "door", "e", bytes, {
      width: 64,
      height: 64,
    });
    expect(r).toEqual({ ok: false, status: 422, code: "image_bad_size" });
    expect(h.sql).toHaveLength(1);
    expect(h.sql[0]!.text).toContain("org_id = $1");
    expect(h.sql[0]!.values).toEqual(["org-1", "door"]);
    expect(h.calls).toEqual(["select"]);
  });

  it("no row gives 404 before any Drive call", async () => {
    const h = harness({ row: null });
    const r = await setMapItemImage(h.db, h.getDrive, scope, SUB, "door", "e", bytes, FIT);
    expect(r).toEqual({ ok: false, status: 404, code: "not_found" });
    expect(h.getDrive).not.toHaveBeenCalled();
  });

  it("order is select, upload (name, image/png, orgId), CAS update, audit, commit, delete old", async () => {
    const h = harness();
    const r = await setMapItemImage(h.db, h.getDrive, scope, SUB, "door", "e", bytes, FIT);
    expect(r.ok && r.value.art.e).toEqual({ sprite: null, hasImage: true, imageVersion: 3 });
    expect(h.calls.filter((c) => c !== "release")).toEqual([
      "select",
      "getDrive",
      "upload",
      "begin",
      "update-cas",
      "audit",
      "commit",
      "getDrive",
      `delete:${OLD}`,
    ]);
    expect(h.uploads[0]).toMatchObject({ orgId: "org-1", mimeType: "image/png", bytes });
    expect(h.uploads[0].name).toMatch(/^mapitem-door-e-[0-9a-f-]{36}\.png$/);
    const audit = h.sql.find((s) => s.text.includes("insert into audit_log"))!;
    expect(JSON.stringify(audit.values)).toContain('\\"key\\":\\"door\\"');
    expect(JSON.stringify(audit.values)).not.toContain(NEW);
    expect(JSON.stringify(audit.values)).not.toContain(OLD);
  });

  it("CAS SQL touches only art_e_* and compares file id, version, w and h", async () => {
    const h = harness();
    await setMapItemImage(h.db, h.getDrive, scope, SUB, "door", "e", bytes, FIT);
    const cas = h.sql.find((s) => /^\s*update map_items/.test(s.text))!;
    const t = cas.text.replace(/\s+/g, " ");
    expect(t).toContain("art_e_drive_file_id = $3::text");
    expect(t).toContain("art_e_image_version = art_e_image_version + 1");
    expect(t).toContain("art_e_drive_file_id is not distinct from $4::text");
    expect(t).toContain("art_e_image_version = $5 and w = $6 and h = $7");
    expect(t).not.toMatch(/art_[nsw]_(drive_file_id|image_version) =/);
    expect(cas.values).toEqual(["org-1", "door", NEW, OLD, 2, 1, 1]);
  });

  it("CAS 0 rows and the row still exists gives 409 image_changed with the new file deleted; row gone gives 404", async () => {
    const a = harness({ casRows: 0 });
    expect(await setMapItemImage(a.db, a.getDrive, scope, SUB, "door", "e", bytes, FIT)).toEqual({
      ok: false,
      status: 409,
      code: "image_changed",
    });
    expect(a.calls).toContain(`delete:${NEW}`);
    expect(a.calls).not.toContain(`delete:${OLD}`);
    expect(a.calls).not.toContain("audit");
    const b = harness({ casRows: 0, rowAfter: false });
    expect(await setMapItemImage(b.db, b.getDrive, scope, SUB, "door", "e", bytes, FIT)).toEqual({
      ok: false,
      status: 404,
      code: "not_found",
    });
    expect(b.calls).toContain(`delete:${NEW}`);
  });

  it("error after the update ran keeps the new file and logs map_item_drive_orphan {key}; before it ran the new file is deleted", async () => {
    for (const o of [{ auditThrows: true }, { commitThrows: true }] as Opts[]) {
      const h = harness(o);
      await expect(
        setMapItemImage(h.db, h.getDrive, scope, SUB, "door", "e", bytes, FIT),
      ).rejects.toThrow();
      expect(h.calls).not.toContain(`delete:${NEW}`);
      expect(logged()).toContain(JSON.stringify({ event: "map_item_drive_orphan", key: "door" }));
    }
    const h = harness({ updateThrows: true });
    await expect(
      setMapItemImage(h.db, h.getDrive, scope, SUB, "door", "e", bytes, FIT),
    ).rejects.toThrow("update failed");
    expect(h.calls).toContain(`delete:${NEW}`);
  });

  it("upload DriveError gives 502, Drive off gives 503, event map_item_image_drive, no update", async () => {
    const a = harness({ uploadThrows: new DriveError("drive_auth") });
    expect(await setMapItemImage(a.db, a.getDrive, scope, SUB, "door", "e", bytes, FIT)).toEqual({
      ok: false,
      status: 502,
      code: "drive_error",
    });
    expect(a.calls).not.toContain("begin");
    const b = harness();
    expect(await setMapItemImage(b.db, b.noDrive, scope, SUB, "door", "e", bytes, FIT)).toEqual({
      ok: false,
      status: 503,
      code: "images_unavailable",
    });
    expect(b.calls).not.toContain("begin");
    const events = logged().map((l) => JSON.parse(l).event);
    expect(events).toEqual(["map_item_image_drive", "map_item_image_drive"]);
  });

  it("deleting the old file fails: still ok, map_item_drive_orphan {key} only (no file id)", async () => {
    const h = harness({ deleteThrows: new Error("nope") });
    const r = await setMapItemImage(h.db, h.getDrive, scope, SUB, "door", "e", bytes, FIT);
    expect(r.ok).toBe(true);
    expect(logged()).toEqual([JSON.stringify({ event: "map_item_drive_orphan", key: "door" })]);
  });
});

describe("removeMapItemImage", () => {
  it("locks for no key update, nulls the file and bumps the version, audits, commits, then deletes the old file", async () => {
    const h = harness();
    expect(await removeMapItemImage(h.db, h.getDrive, scope, SUB, "door", "e")).toEqual({
      ok: true,
      value: null,
    });
    expect(h.calls.filter((c) => c !== "release")).toEqual([
      "begin",
      "select-lock",
      "update-null",
      "audit",
      "commit",
      "getDrive",
      `delete:${OLD}`,
    ]);
  });

  it("no image gives ok with no update, no audit and no Drive call; no row gives 404", async () => {
    const a = harness({ row: { w: 1, h: 1, file: null, version: 0 } });
    expect((await removeMapItemImage(a.db, a.getDrive, scope, SUB, "door", "e")).ok).toBe(true);
    expect(a.calls).not.toContain("update-null");
    expect(a.calls).not.toContain("audit");
    expect(a.getDrive).not.toHaveBeenCalled();
    const b = harness({ row: null });
    expect(await removeMapItemImage(b.db, b.getDrive, scope, SUB, "door", "e")).toEqual({
      ok: false,
      status: 404,
      code: "not_found",
    });
  });

  it("Drive off: still ok and the orphan is logged", async () => {
    const h = harness();
    expect((await removeMapItemImage(h.db, h.noDrive, scope, SUB, "door", "e")).ok).toBe(true);
    expect(logged()).toEqual([JSON.stringify({ event: "map_item_drive_orphan", key: "door" })]);
  });
});

describe("getMapItemImage", () => {
  it("no file gives 404 without Drive; unknown key gives 404 without a query", async () => {
    const h = harness({ row: { w: 1, h: 1, file: null, version: 0 } });
    expect(await getMapItemImage(h.db, h.getDrive, scope, "door", "e", null)).toEqual({
      ok: false,
      status: 404,
      code: "not_found",
    });
    expect(h.getDrive).not.toHaveBeenCalled();
    const g = harness();
    expect((await getMapItemImage(g.db, g.getDrive, scope, "nope", "e", null)).ok).toBe(false);
    expect(g.sql).toEqual([]);
  });

  it('If-None-Match match gives not_modified without Drive; the ETag is "<key>-<dir>-<version>"', async () => {
    const h = harness();
    expect(await getMapItemImage(h.db, h.getDrive, scope, "door", "e", '"door-e-2"')).toEqual({
      ok: true,
      value: { kind: "not_modified", etag: '"door-e-2"' },
    });
    expect(h.getDrive).not.toHaveBeenCalled();
  });

  it("a 32x64 PNG is served (the device-type size rule is not applied)", async () => {
    const h = harness();
    const r = await getMapItemImage(h.db, h.getDrive, scope, "door", "e", null);
    expect(r).toEqual({ ok: true, value: { kind: "bytes", bytes: PNG, etag: '"door-e-2"' } });
    expect(h.calls).toContain(`getFile:${OLD}`);
  });

  it("bytes that are not a PNG give 502 drive_error, logged op get code invalid_png", async () => {
    const h = harness({ getBytes: new Uint8Array([1, 2, 3]) });
    expect(await getMapItemImage(h.db, h.getDrive, scope, "door", "e", null)).toEqual({
      ok: false,
      status: 502,
      code: "drive_error",
    });
    expect(logged()).toEqual([
      JSON.stringify({ event: "map_item_image_drive", op: "get", code: "invalid_png" }),
    ]);
  });

  it("a Drive error maps through mapDriveFailure", async () => {
    const h = harness({ getThrows: new DriveError("drive_unavailable") });
    expect(await getMapItemImage(h.db, h.getDrive, scope, "door", "e", null)).toEqual({
      ok: false,
      status: 503,
      code: "images_unavailable",
    });
  });
});
