import { describe, expect, it } from "vitest";
import { ApiAccessError, type ApiFetch } from "@/lib/api/fetch";
import { createMapItemsApi } from "./map-items-api";

const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const api = (respond: () => Response | Promise<Response>) => {
  const calls: [string, RequestInit | undefined][] = [];
  const fetcher = (async (path: string, init?: RequestInit) => {
    calls.push([path, init]);
    return respond();
  }) as unknown as ApiFetch;
  return { api: createMapItemsApi(fetcher), calls };
};

describe("map-items-api", () => {
  it("list reads items from GET /api/map-items", async () => {
    const a = api(() => jsonRes({ items: [{ builtinKey: "k" }] }));
    expect(await a.api.list()).toEqual({ ok: true, value: [{ builtinKey: "k" }] });
    expect(a.calls[0][0]).toBe("/api/map-items");
    expect(a.calls[0][1]?.method).toBe("GET");
  });

  it("a non-array body gives internal", async () => {
    expect(await api(() => jsonRes({ items: 1 })).api.list()).toEqual({
      ok: false,
      code: "internal",
    });
  });

  it("the error body code is returned", async () => {
    const r = api(() => jsonRes({ error: { code: "forbidden" } }, 403));
    expect(await r.api.list()).toEqual({ ok: false, code: "forbidden" });
  });

  it("ApiAccessError signed_out maps to unauthenticated; a fetch throw to unavailable", async () => {
    const t = (e: unknown) =>
      createMapItemsApi((async () => Promise.reject(e)) as unknown as ApiFetch);
    expect(await t(new ApiAccessError("signed_out")).list()).toEqual({
      ok: false,
      code: "unauthenticated",
    });
    expect(await t(new Error("net")).list()).toEqual({ ok: false, code: "unavailable" });
  });
});
