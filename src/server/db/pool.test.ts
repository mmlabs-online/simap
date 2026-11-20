import { afterEach, describe, expect, it, vi } from "vitest";
import { createPool, getPool, ping } from "./pool";

afterEach(async () => {
  const p = globalThis.__simapPool;
  globalThis.__simapPool = undefined;
  await p?.end();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("getPool", () => {
  it("returns null when DATABASE_URL is unset", () => {
    vi.stubEnv("DATABASE_URL", "");
    expect(getPool()).toBeNull();
  });

  it("returns the same pool on repeated calls", () => {
    vi.stubEnv("DATABASE_URL", "postgres://simap@127.0.0.1:1/simap");
    const a = getPool();
    expect(a).not.toBeNull();
    expect(getPool()).toBe(a);
  });
});

describe("createPool", () => {
  it("sets max 5, connection 3 s, idle 30 s, statement 5 s, application_name simap-api", async () => {
    const pool = createPool("postgres://simap@127.0.0.1:1/simap");
    const o = pool.options;
    expect(o).toMatchObject({
      max: 5,
      connectionTimeoutMillis: 3000,
      idleTimeoutMillis: 30000,
      statement_timeout: 5000,
      application_name: "simap-api",
    });
    await pool.end();
  });

  it("date (oid 1082) stays a YYYY-MM-DD string", async () => {
    const pool = createPool("postgres://simap@127.0.0.1:1/simap");
    const types = (
      pool.options as { types: { getTypeParser(oid: number): (v: string) => unknown } }
    ).types;
    expect(types.getTypeParser(1082)("2026-11-20")).toBe("2026-11-20");
    await pool.end();
  });

  it("pool error event logs only the code", async () => {
    const log = vi.fn();
    const pool = createPool("postgres://simap@127.0.0.1:1/simap", log);
    pool.emit(
      "error",
      Object.assign(new Error("password authentication failed: hunter2"), { code: "28P01" }),
    );
    expect(log).toHaveBeenCalledWith({ event: "pool_error", code: "28P01" });
    expect(JSON.stringify(log.mock.calls)).not.toContain("hunter2");
    await pool.end();
  });
});

describe("ping", () => {
  it("resolves on select 1, rejects after the timeout", async () => {
    const query = vi.fn().mockResolvedValue({});
    await expect(ping({ query })).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledWith("select 1");

    vi.useFakeTimers();
    const hung = { query: () => new Promise<never>(() => {}) };
    const result = expect(ping(hung, 2000)).rejects.toThrow("timeout");
    await vi.advanceTimersByTimeAsync(2000);
    await result;
  });
});
