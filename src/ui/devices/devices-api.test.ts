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

describe("devices-api get and place", () => {
  it("get sends GET /api/devices/<id>; a body without id is internal; 404 passes through", async () => {
    const ok = fake(() => jsonRes({ id: "d 1" }));
    expect(await ok.api.get("d 1")).toEqual({ ok: true, value: { id: "d 1" } });
    expect(ok.calls[0][0]).toBe("/api/devices/d%201");
    expect(ok.calls[0][1]?.method).toBe("GET");
    expect(await fake(() => jsonRes({ name: "x" })).api.get("d1")).toEqual({
      ok: false,
      code: "internal",
    });
    const gone = fake(() => jsonRes({ error: { code: "not_found" } }, 404));
    expect(await gone.api.get("d1")).toEqual({ ok: false, code: "not_found" });
  });

  it("place sends PUT with a JSON body; ok, internal and 409 codes", async () => {
    const body = { seatId: "s1", role: "secondary" as const, expectedSeatId: null };
    const ok = fake(() => jsonRes({ id: "d1" }));
    expect(await ok.api.place("d1", body)).toEqual({ ok: true, value: { id: "d1" } });
    const [path, init] = ok.calls[0];
    expect(path).toBe("/api/devices/d1/placement");
    expect(init?.method).toBe("PUT");
    expect(new Headers(init?.headers).get("content-type")).toBe("application/json");
    expect(JSON.parse(init?.body as string)).toEqual(body);
    expect(await fake(() => jsonRes({})).api.place("d1", body)).toEqual({
      ok: false,
      code: "internal",
    });
    const conflict = fake(() => jsonRes({ error: { code: "seat_has_primary" } }, 409));
    expect(await conflict.api.place("d1", body)).toEqual({ ok: false, code: "seat_has_primary" });
  });
});
