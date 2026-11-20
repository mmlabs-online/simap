import { describe, expect, it } from "vitest";
import { apiError } from "./respond";

describe("apiError", () => {
  it("401 has WWW-Authenticate: Bearer and no-store; body is exactly {error:{code}}", async () => {
    const r = apiError(401, "unauthenticated");
    expect(r.status).toBe(401);
    expect(r.headers.get("www-authenticate")).toBe("Bearer");
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.headers.get("retry-after")).toBeNull();
    expect(await r.json()).toEqual({ error: { code: "unauthenticated" } });
  });

  it("503 has Retry-After: 5", async () => {
    const r = apiError(503, "unavailable");
    expect(r.headers.get("retry-after")).toBe("5");
    expect(r.headers.get("www-authenticate")).toBeNull();
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(await r.json()).toEqual({ error: { code: "unavailable" } });
  });

  it("403 and 500 carry only no-store", async () => {
    for (const [s, c] of [
      [403, "forbidden"],
      [500, "internal"],
    ] as const) {
      const r = apiError(s, c);
      expect(r.status).toBe(s);
      expect(r.headers.get("www-authenticate")).toBeNull();
      expect(r.headers.get("retry-after")).toBeNull();
      expect(r.headers.get("cache-control")).toBe("no-store");
      expect(await r.json()).toEqual({ error: { code: c } });
    }
  });
});
