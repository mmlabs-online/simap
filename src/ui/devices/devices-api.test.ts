import { describe, expect, it } from "vitest";
import { ApiAccessError, type ApiFetch } from "@/lib/api/fetch";
import { createDevicesApi } from "./devices-api";

type Call = [string, RequestInit | undefined];

function fake(respond: () => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetcher = (async (path: string, init?: RequestInit) => {
    calls.push([path, init]);
    return respond();
  }) as unknown as ApiFetch;
  return { api: createDevicesApi(fetcher), calls };
}
const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const throwing = (e: unknown) =>
  createDevicesApi((async () => Promise.reject(e)) as unknown as ApiFetch);

describe("devices-api list", () => {
  it("list(filter) sends GET /api/devices?placement=all / placed / inventory", async () => {
    const { api, calls } = fake(() => jsonRes({ items: [], truncated: false }));
    await api.list("all");
    await api.list("placed");
    await api.list("inventory");
    expect(calls.map((c) => c[0])).toEqual([
      "/api/devices?placement=all",
      "/api/devices?placement=placed",
      "/api/devices?placement=inventory",
    ]);
    expect(calls[0][1]?.method).toBe("GET");
  });

  it("returns { items, truncated } on 200; a malformed body is internal", async () => {
    const ok = fake(() => jsonRes({ items: [], truncated: true }));
    expect(await ok.api.list("all")).toEqual({ ok: true, value: { items: [], truncated: true } });
    const noItems = fake(() => jsonRes({ truncated: false }));
    expect(await noItems.api.list("all")).toEqual({ ok: false, code: "internal" });
    const badFlag = fake(() => jsonRes({ items: [], truncated: "yes" }));
    expect(await badFlag.api.list("all")).toEqual({ ok: false, code: "internal" });
  });

  it("reads the error code of a failed response; a non-JSON body is internal", async () => {
    const bad = fake(() => jsonRes({ error: { code: "invalid_request" } }, 400));
    expect(await bad.api.list("all")).toEqual({ ok: false, code: "invalid_request" });
    const text = fake(() => new Response("oops", { status: 500 }));
    expect(await text.api.list("all")).toEqual({ ok: false, code: "internal" });
  });

  it("maps access errors and network failures", async () => {
    expect(await throwing(new ApiAccessError("signed_out")).list("all")).toEqual({
      ok: false,
      code: "unauthenticated",
    });
    expect(await throwing(new ApiAccessError("forbidden")).list("all")).toEqual({
      ok: false,
      code: "forbidden",
    });
    expect(await throwing(new TypeError("network")).list("all")).toEqual({
      ok: false,
      code: "unavailable",
    });
  });
});
