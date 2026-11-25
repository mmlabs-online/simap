import { beforeEach, describe, expect, it, vi } from "vitest";
import { DriveError, type DriveCode } from "@/server/drive/client";
import { DriveConfigError } from "@/server/drive/config";
import type { OrgDrive } from "@/server/drive/drive";
import type { OrgScope } from "@/server/http/org-scope";

vi.mock("server-only", () => ({}));

import {
  discardImageFile,
  etagMatches,
  getDeviceTypeImage,
  removeDeviceTypeImage,
  setDeviceTypeImage,
} from "./image";

const ID = "33333333-3333-4333-8333-333333333333";
const SUB = "44444444-4444-4444-8444-444444444444";
const scope = { orgId: "org-1" } as unknown as OrgScope;
const OLD = "oldfileid_12345";
const NEW = "newfileid_12345";
const bytes = new Uint8Array([1, 2, 3]);

const ALL_CODES: DriveCode[] = [
  "drive_not_configured",
  "drive_auth",
  "drive_not_found",
  "drive_forbidden",
  "drive_rate_limited",
  "drive_unavailable",
  "drive_too_large",
  "drive_bad_response",
  "drive_invalid_id",
];

type Opts = {
  row?: { image_drive_file_id: string | null; image_version: number } | null;
  casRows?: number; // 0 = lost
  rowAfter?: boolean; // does the row still exist on the re-select
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
  const row = o.row === undefined ? { image_drive_file_id: OLD, image_version: 2 } : o.row;
  const query = async (text: string, values: unknown[] = []) => {
    sql.push({ text, values });
    const t = text.replace(/\s+/g, " ").trim();
    if (/^(begin|commit|rollback)$/.test(t)) {
      calls.push(t);
      if (t === "commit" && o.commitThrows) throw new Error("commit failed");
      return { rows: [] };
    }
    if (t.startsWith("select image_drive_file_id, image_version")) {
      selects++;
      calls.push("select");
      const exists = selects > 1 && o.rowAfter !== undefined ? o.rowAfter : row !== null;
      return { rows: exists && row ? [row] : [] };
    }
    if (t.includes("for update")) {
      calls.push("select-for-update");
      return { rows: row ? [{ image_drive_file_id: row.image_drive_file_id }] : [] };
    }
    if (t.startsWith("update device_types set image_drive_file_id = $3")) {
      calls.push("update-cas");
      if (o.updateThrows) throw new Error("update failed");
      if (o.casRows === 0) return { rows: [] };
      return {
        rows: [
          {
            id: ID,
            name: "PC",
            slot: "pc",
            has_image: true,
            image_version: (row?.image_version ?? 0) + 1,
          },
        ],
      };
    }
    if (t.startsWith("update device_types set image_drive_file_id = null")) {
      calls.push("update-null");
      return { rows: [{ image_version: (row?.image_version ?? 0) + 1 }] };
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
  return { db: db as any, calls, uploads, sql, getDrive };
}

// a structurally valid 24x24 PNG is built lazily so the unit test keeps one source of fixtures
import { deflateSync } from "node:zlib";
function makePng(): Uint8Array {
  const crcOf = (b: Uint8Array) => {
    let c = 0xffffffff;
    for (const x of b) {
      c ^= x;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length);
    const v = new DataView(out.buffer);
    v.setUint32(0, data.length);
    out.set(
      [...type].map((c) => c.charCodeAt(0)),
      4,
    );
    out.set(data, 8);
    v.setUint32(8 + data.length, crcOf(out.subarray(4, 8 + data.length)));
    return out;
  };
  const h = new Uint8Array(13);
  new DataView(h.buffer).setUint32(0, 24);
  new DataView(h.buffer).setUint32(4, 24);
  h.set([8, 6, 0, 0, 0], 8);
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", h),
    chunk("IDAT", new Uint8Array(deflateSync(Buffer.alloc(97 * 24)))),
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
const PNG = makePng();

let errLog: { mockClear(): void; mock: { calls: unknown[][] } };
const logged = () => errLog.mock.calls.map((c) => String(c[0]));
beforeEach(() => {
  errLog = vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("setDeviceTypeImage", () => {
  it("order is select, upload, tx(update CAS, audit), commit, delete old", async () => {
    const h = harness();
    const r = await setDeviceTypeImage(h.db, h.getDrive, scope, SUB, ID, bytes);
    expect(r).toEqual({
      ok: true,
      value: { id: ID, name: "PC", slot: "pc", hasImage: true, imageVersion: 3 },
    });
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
    const cas = h.sql.find((s) => s.text.includes("is not distinct from"))!;
    expect(cas.values).toEqual(["org-1", ID, NEW, OLD]);
  });

  it("upload name, mimeType and org come from the server, not the client", async () => {
    const h = harness();
    await setDeviceTypeImage(h.db, h.getDrive, scope, SUB, ID, bytes);
    expect(h.uploads).toHaveLength(1);
    expect(h.uploads[0].name).toMatch(new RegExp(`^devtype-${ID}-[0-9a-f-]{36}\\.png$`));
    expect(h.uploads[0].mimeType).toBe("image/png");
    expect(h.uploads[0].orgId).toBe("org-1");
  });

  it("no row gives 404 and getDrive is never called", async () => {
    const h = harness({ row: null });
    expect(await setDeviceTypeImage(h.db, h.getDrive, scope, SUB, ID, bytes)).toEqual({
      ok: false,
      status: 404,
      code: "not_found",
    });
    expect(h.getDrive).not.toHaveBeenCalled();
  });

  it("getDrive null or DriveConfigError gives 503 images_unavailable, nothing uploaded", async () => {
    const h = harness();
    const nul = await setDeviceTypeImage(h.db, () => null, scope, SUB, ID, bytes);
    expect(nul).toEqual({ ok: false, status: 503, code: "images_unavailable" });
    const thrown = await setDeviceTypeImage(
      h.db,
      () => {
        throw new DriveConfigError("partial");
      },
      scope,
      SUB,
      ID,
      bytes,
    );
    expect(thrown).toEqual({ ok: false, status: 503, code: "images_unavailable" });
    expect(h.uploads).toHaveLength(0);
  });

  it("CAS lost: row gone gives 404, row changed gives 409; the new file is deleted", async () => {
    const gone = harness({ casRows: 0, rowAfter: false });
    expect(await setDeviceTypeImage(gone.db, gone.getDrive, scope, SUB, ID, bytes)).toEqual({
      ok: false,
      status: 404,
      code: "not_found",
    });
    expect(gone.calls).toContain(`delete:${NEW}`);
    const changed = harness({ casRows: 0, rowAfter: true });
    expect(await setDeviceTypeImage(changed.db, changed.getDrive, scope, SUB, ID, bytes)).toEqual({
      ok: false,
      status: 409,
      code: "image_changed",
    });
    expect(changed.calls).toContain(`delete:${NEW}`);
    expect(changed.calls).not.toContain(`delete:${OLD}`);
    expect(changed.calls).not.toContain("audit");
  });

  it("an error before the update returns: rethrown and the new file deleted", async () => {
    const h = harness({ updateThrows: true });
    await expect(setDeviceTypeImage(h.db, h.getDrive, scope, SUB, ID, bytes)).rejects.toThrow(
      "update failed",
    );
    expect(h.calls).toContain(`delete:${NEW}`);
    expect(h.calls).toContain("rollback");
  });

  it("an error after the update ran (audit or COMMIT): the new file is kept and drive_orphan logged", async () => {
    for (const o of [{ auditThrows: true }, { commitThrows: true }]) {
      errLog.mockClear();
      const h = harness(o);
      await expect(setDeviceTypeImage(h.db, h.getDrive, scope, SUB, ID, bytes)).rejects.toThrow();
      expect(h.calls.some((c) => c.startsWith("delete:"))).toBe(false);
      expect(logged().some((l) => l.includes("drive_orphan"))).toBe(true);
    }
  });

  it("deleting the old file fails: still ok, drive_orphan logged with the type id only", async () => {
    const h = harness({ deleteThrows: new DriveError("drive_unavailable") });
    const r = await setDeviceTypeImage(h.db, h.getDrive, scope, SUB, ID, bytes);
    expect(r.ok).toBe(true);
    const line = logged().find((l) => l.includes("drive_orphan"))!;
    expect(JSON.parse(line)).toEqual({ event: "drive_orphan", typeId: ID });
    expect(line).not.toContain(OLD);
  });

  it("no old image: no delete call", async () => {
    const h = harness({ row: { image_drive_file_id: null, image_version: 0 } });
    const r = await setDeviceTypeImage(h.db, h.getDrive, scope, SUB, ID, bytes);
    expect(r.ok).toBe(true);
    expect(h.calls.some((c) => c.startsWith("delete:"))).toBe(false);
  });

  it("every DriveCode and DriveConfigError maps to 502/503, never 401/403; the code never leaks", async () => {
    const errs: unknown[] = [
      ...ALL_CODES.map((c) => new DriveError(c, 401)),
      new DriveConfigError("x"),
    ];
    for (const err of errs) {
      const up = harness({ uploadThrows: err });
      const a = await setDeviceTypeImage(up.db, up.getDrive, scope, SUB, ID, bytes);
      const g = harness({ getThrows: err });
      const b = await getDeviceTypeImage(g.db, g.getDrive, scope, ID, null);
      for (const r of [a, b]) {
        expect(r.ok).toBe(false);
        if (r.ok) continue;
        expect([502, 503]).toContain(r.status);
        expect(["drive_error", "images_unavailable"]).toContain(r.code);
        expect(JSON.stringify(r)).not.toMatch(
          /drive_(auth|forbidden|not_found|bad|too|invalid|rate|unav|not_conf)/,
        );
      }
    }
    const auth = harness({ uploadThrows: new DriveError("drive_auth", 401) });
    expect(await setDeviceTypeImage(auth.db, auth.getDrive, scope, SUB, ID, bytes)).toEqual({
      ok: false,
      status: 502,
      code: "drive_error",
    });
  });

  it("a non-Drive error from upload is rethrown", async () => {
    const h = harness({ uploadThrows: new TypeError("bug") });
    await expect(setDeviceTypeImage(h.db, h.getDrive, scope, SUB, ID, bytes)).rejects.toThrow(
      "bug",
    );
  });
});

describe("removeDeviceTypeImage", () => {
  it("commits (null, version+1, audit) and only then calls deleteFile(old)", async () => {
    const h = harness();
    expect(await removeDeviceTypeImage(h.db, h.getDrive, scope, SUB, ID)).toEqual({
      ok: true,
      value: null,
    });
    expect(h.calls.filter((c) => c !== "release")).toEqual([
      "begin",
      "select-for-update",
      "update-null",
      "audit",
      "commit",
      "getDrive",
      `delete:${OLD}`,
    ]);
  });

  it("Drive off, throwing or misconfigured: still ok and drive_orphan logged", async () => {
    const make = (g: () => OrgDrive | null) =>
      removeDeviceTypeImage(harness().db, g, scope, SUB, ID);
    const throwing: OrgDrive = {
      uploadOrgFile: async () => {
        throw new Error("x");
      },
      getFile: async () => {
        throw new Error("x");
      },
      deleteFile: async () => {
        throw new DriveError("drive_auth", 401);
      },
    };
    for (const g of [
      () => null,
      () => throwing,
      () => {
        throw new DriveConfigError("partial");
      },
    ]) {
      errLog.mockClear();
      expect(await make(g)).toEqual({ ok: true, value: null });
      expect(logged().some((l) => l.includes("drive_orphan"))).toBe(true);
    }
  });

  it("no image: ok with no update, no audit, no Drive call; no row gives 404", async () => {
    const h = harness({ row: { image_drive_file_id: null, image_version: 0 } });
    expect(await removeDeviceTypeImage(h.db, h.getDrive, scope, SUB, ID)).toEqual({
      ok: true,
      value: null,
    });
    expect(h.calls).not.toContain("update-null");
    expect(h.calls).not.toContain("audit");
    expect(h.getDrive).not.toHaveBeenCalled();
    const none = harness({ row: null });
    expect(await removeDeviceTypeImage(none.db, none.getDrive, scope, SUB, ID)).toEqual({
      ok: false,
      status: 404,
      code: "not_found",
    });
    expect(none.getDrive).not.toHaveBeenCalled();
  });
});

describe("etagMatches", () => {
  const e = `"${ID}-2"`;
  it("matches exact, weak, list and *; not null or other", () => {
    expect(etagMatches(e, e)).toBe(true);
    expect(etagMatches(`W/${e}`, e)).toBe(true);
    expect(etagMatches(`"x", ${e}`, e)).toBe(true);
    expect(etagMatches("*", e)).toBe(true);
    expect(etagMatches(null, e)).toBe(false);
    expect(etagMatches(`"${ID}-1"`, e)).toBe(false);
  });
});

describe("getDeviceTypeImage", () => {
  it("no row or null id gives 404 with no Drive call", async () => {
    for (const row of [null, { image_drive_file_id: null, image_version: 0 }]) {
      const h = harness({ row });
      expect(await getDeviceTypeImage(h.db, h.getDrive, scope, ID, null)).toEqual({
        ok: false,
        status: 404,
        code: "not_found",
      });
      expect(h.getDrive).not.toHaveBeenCalled();
    }
  });

  it("If-None-Match match gives not_modified with no getDrive call; non-match fetches", async () => {
    const etag = `"${ID}-2"`;
    for (const header of [etag, `W/${etag}`, `"a", ${etag}`, "*"]) {
      const h = harness();
      expect(await getDeviceTypeImage(h.db, h.getDrive, scope, ID, header)).toEqual({
        ok: true,
        value: { kind: "not_modified", etag },
      });
      expect(h.getDrive).not.toHaveBeenCalled();
    }
    const h = harness();
    const r = await getDeviceTypeImage(h.db, h.getDrive, scope, ID, `"${ID}-1"`);
    expect(r).toEqual({ ok: true, value: { kind: "bytes", bytes: PNG, etag } });
    expect(h.calls).toContain(`getFile:${OLD}`);
  });

  it("invalid PNG bytes or a missing file give 502 drive_error", async () => {
    const bad = harness({ getBytes: new Uint8Array([1, 2, 3]) });
    expect(await getDeviceTypeImage(bad.db, bad.getDrive, scope, ID, null)).toEqual({
      ok: false,
      status: 502,
      code: "drive_error",
    });
    const gone = harness({ getThrows: new DriveError("drive_not_found", 404) });
    expect(await getDeviceTypeImage(gone.db, gone.getDrive, scope, ID, null)).toEqual({
      ok: false,
      status: 502,
      code: "drive_error",
    });
  });

  it("makes no write query: one select only", async () => {
    const h = harness();
    await getDeviceTypeImage(h.db, h.getDrive, scope, ID, null);
    expect(h.sql).toHaveLength(1);
    expect(h.sql[0]!.text).toMatch(/^\s*select/);
    expect(h.sql[0]!.values[0]).toBe("org-1");
  });
});

describe("discardImageFile", () => {
  it("null id is a no-op; a throwing getDrive or deleteFile never throws and logs drive_orphan", async () => {
    const h = harness();
    await discardImageFile(h.getDrive, null, ID);
    expect(h.getDrive).not.toHaveBeenCalled();
    await discardImageFile(
      () => {
        throw new Error("boom");
      },
      OLD,
      ID,
    );
    const t = harness({ deleteThrows: new Error("x") });
    await discardImageFile(t.getDrive, OLD, ID);
    expect(logged().filter((l) => l.includes("drive_orphan"))).toHaveLength(2);
  });
});
