import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getPool = vi.fn<() => unknown>(() => ({}));
const exportRows = vi.fn();
vi.mock("@/server/db/pool", () => ({ getPool: () => getPool() }));
vi.mock("@/server/export/export", () => ({
  exportRows: (...a: unknown[]) => exportRows(...a),
}));

const route = await import("./route");

const ISSUER = "https://api.mmlabs.online";

const fakeAuth = (orgRoles: string[]) => {
  vi.stubEnv("MM_IDENTITY_ISSUER", ISSUER);
  globalThis.__simapAuth = {
    issuer: ISSUER,
    deps: {
      verifier: {
        verify: async () => ({
          ok: true,
          identity: { sub: "s1", email: "a@example.com", org: "o1", orgRoles },
        }),
      },
      memberGate: async () => "active",
      log: () => {},
    },
  };
};

const get = (kind: string) =>
  route.GET(
    new Request(`http://x/api/export/${kind}`, { headers: { authorization: "Bearer t" } }),
    { params: Promise.resolve({ kind }) },
  );

beforeEach(() => {
  getPool.mockImplementation(() => ({}));
  exportRows.mockReset();
  exportRows.mockResolvedValue({
    columns: ["Display name", "Email"],
    rows: [["Nguyễn Thị Ánh", "a@example.com"]],
    truncated: false,
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.__simapAuth = undefined;
});

describe("GET /api/export/[kind]", () => {
  it("user tier gets 403 and nothing is queried", async () => {
    fakeAuth(["simap:user"]);
    for (const kind of ["seats", "devices", "members"]) {
      const r = await get(kind);
      expect(r.status, kind).toBe(403);
      expect((await r.json()).error.code).toBe("forbidden");
    }
    expect(exportRows).not.toHaveBeenCalled();
  });

  it("manager and admin get 200 with BOM body, text/csv, no-store, attachment filename, nosniff", async () => {
    for (const role of ["simap:manager", "simap:admin"]) {
      fakeAuth([role]);
      const r = await get("members");
      expect(r.status, role).toBe(200);
      expect(r.headers.get("content-type")).toBe("text/csv; charset=utf-8");
      expect(r.headers.get("cache-control")).toBe("no-store");
      expect(r.headers.get("x-content-type-options")).toBe("nosniff");
      expect(r.headers.get("content-disposition")).toMatch(
        /^attachment; filename="simap-members-\d{8}\.csv"$/,
      );
      const bytes = new Uint8Array(await r.arrayBuffer());
      expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
      expect(new TextDecoder().decode(bytes)).toContain("Nguyễn Thị Ánh,a@example.com\r\n");
    }
  });

  it("unknown kind gets 404 not_found", async () => {
    fakeAuth(["simap:manager"]);
    for (const kind of ["rooms", "Seats", "constructor"]) {
      const r = await get(kind);
      expect(r.status, kind).toBe(404);
      expect((await r.json()).error.code).toBe("not_found");
    }
    expect(exportRows).not.toHaveBeenCalled();
  });

  it("X-Export-Truncated only when truncated", async () => {
    fakeAuth(["simap:manager"]);
    expect((await get("seats")).headers.get("x-export-truncated")).toBeNull();
    exportRows.mockResolvedValue({ columns: ["A"], rows: [], truncated: true });
    expect((await get("seats")).headers.get("x-export-truncated")).toBe("true");
  });

  it("no pool gives 503", async () => {
    fakeAuth(["simap:manager"]);
    getPool.mockImplementation(() => null);
    const r = await get("seats");
    expect(r.status).toBe(503);
    expect((await r.json()).error.code).toBe("unavailable");
  });
});
