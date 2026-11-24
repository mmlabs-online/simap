import { describe, expect, it } from "vitest";
import { ApiAccessError, type ApiFetch } from "@/lib/api/fetch";
import { createRequestsApi } from "./requests-api";

function fake(respond: () => Response | Promise<Response>) {
  const calls: string[] = [];
  const fetcher = (async (path: string) => {
    calls.push(path);
    return respond();
  }) as unknown as ApiFetch;
  return { api: createRequestsApi(fetcher), calls };
}
const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const empty = { items: [], nextCursor: null };

describe("requests-api", () => {
  it("list: GET /api/requests?status=pending&limit=50; cursor appended and encoded", async () => {
    const a = fake(() => jsonRes(empty));
    await a.api.list("pending");
    expect(a.calls[0]).toBe("/api/requests?status=pending&limit=50");
    await a.api.list("approved", "a b/c");
    expect(a.calls[1]).toBe("/api/requests?status=approved&limit=50&cursor=a+b%2Fc");
  });
  it("list: valid body -> ok; items not array or nextCursor wrong type -> internal", async () => {
    expect(
      await fake(() => jsonRes({ items: [{ id: "1" }], nextCursor: "n" })).api.list("pending"),
    ).toEqual({
      ok: true,
      value: { items: [{ id: "1" }], nextCursor: "n" },
    });
    expect(await fake(() => jsonRes({ items: {}, nextCursor: null })).api.list("pending")).toEqual({
      ok: false,
      code: "internal",
    });
    expect(await fake(() => jsonRes({ items: [], nextCursor: 3 })).api.list("pending")).toEqual({
      ok: false,
      code: "internal",
    });
  });
  it("list: 403 forbidden -> forbidden; non-JSON error -> internal; fetch throws -> unavailable; signed_out -> unauthenticated", async () => {
    expect(
      await fake(() => jsonRes({ error: { code: "forbidden" } }, 403)).api.list("pending"),
    ).toEqual({ ok: false, code: "forbidden" });
    expect(await fake(() => new Response("oops", { status: 500 })).api.list("pending")).toEqual({
      ok: false,
      code: "internal",
    });
    expect(
      await fake(() => {
        throw new Error("network");
      }).api.list("pending"),
    ).toEqual({ ok: false, code: "unavailable" });
    expect(
      await fake(() => {
        throw new ApiAccessError("signed_out");
      }).api.list("pending"),
    ).toEqual({ ok: false, code: "unauthenticated" });
  });
});
