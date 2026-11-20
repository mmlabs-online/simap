import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const call = () => GET(new Request("http://x/api/me"), { params: Promise.resolve({}) });

afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.__simapAuth = undefined;
});

describe("GET /api/me wiring", () => {
  it("no MM_IDENTITY_ISSUER -> 503 unavailable (fails closed, lazy config)", async () => {
    vi.stubEnv("MM_IDENTITY_ISSUER", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await call();
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ error: { code: "unavailable" } });
  });

  it("valid issuer, no Authorization -> 401 unauthenticated, no network call", async () => {
    vi.stubEnv("MM_IDENTITY_ISSUER", "https://api.mmlabs.online");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const r = await call();
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ error: { code: "unauthenticated" } });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
