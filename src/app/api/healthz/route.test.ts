import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/healthz", () => {
  it('GET returns 200 {status:"ok"}', async () => {
    const res = GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("GET is not cached", () => {
    expect(GET().headers.get("Cache-Control")).toBe("no-store");
  });
});
