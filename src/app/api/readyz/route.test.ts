import { afterEach, describe, expect, it, vi } from "vitest";

const getPool = vi.fn();
const ping = vi.fn();
vi.mock("@/server/db/pool", () => ({ getPool, ping }));

const { GET } = await import("./route");

afterEach(() => {
  getPool.mockReset();
  ping.mockReset();
});

describe("GET /api/readyz", () => {
  it('503 {status:"unavailable"} when DATABASE_URL is unset (getPool null), ping not called', async () => {
    getPool.mockReturnValue(null);
    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: "unavailable" });
    expect(ping).not.toHaveBeenCalled();
  });

  it('200 {status:"ok"} when ping resolves', async () => {
    getPool.mockReturnValue({});
    ping.mockResolvedValue(undefined);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it('503 body exactly {status:"unavailable"} when ping rejects; no message or code in body', async () => {
    getPool.mockReturnValue({});
    ping.mockRejectedValue(
      Object.assign(new Error('password authentication failed for user "simap"'), {
        code: "28P01",
      }),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.text()).toBe('{"status":"unavailable"}');
  });

  it("logs only the error code", async () => {
    getPool.mockReturnValue({});
    ping.mockRejectedValue(
      Object.assign(new Error('password authentication failed for user "simap"'), {
        code: "28P01",
      }),
    );
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await GET();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(spy.mock.calls[0][0] as string)).toEqual({
      event: "readyz_unavailable",
      code: "28P01",
    });
    expect(String(spy.mock.calls[0][0])).not.toContain("password");
  });

  it("responses are not cached", async () => {
    getPool.mockReturnValue({});
    ping.mockResolvedValue(undefined);
    expect((await GET()).headers.get("Cache-Control")).toBe("no-store");
    getPool.mockReturnValue(null);
    expect((await GET()).headers.get("Cache-Control")).toBe("no-store");
  });
});
