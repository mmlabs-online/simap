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

describe("map-items-api writes", () => {
  const dto = { builtinKey: "plant.large", name: "Cây" };

  it("patch sends PATCH with a JSON body and returns the DTO; the key is URL-encoded", async () => {
    const a = api(() => jsonRes(dto));
    expect(await a.api.patch("plant.large", { name: "Cây", w: 2 })).toEqual({
      ok: true,
      value: dto,
    });
    expect(a.calls[0][0]).toBe("/api/map-items/plant.large");
    expect(a.calls[0][1]?.method).toBe("PATCH");
    expect(new Headers(a.calls[0][1]?.headers).get("content-type")).toBe("application/json");
    expect(JSON.parse(a.calls[0][1]?.body as string)).toEqual({ name: "Cây", w: 2 });
    await a.api.patch("a/b", { name: "x" });
    expect(a.calls[1][0]).toBe("/api/map-items/a%2Fb");
  });

  it("reset sends POST /reset without a body and encodes the key", async () => {
    const a = api(() => jsonRes(dto));
    expect(await a.api.reset("door")).toEqual({ ok: true, value: dto });
    expect(a.calls[0][0]).toBe("/api/map-items/door/reset");
    expect(a.calls[0][1]?.method).toBe("POST");
    expect(a.calls[0][1]?.body).toBeUndefined();
    await a.api.reset("a/b");
    expect(a.calls[1][0]).toBe("/api/map-items/a%2Fb/reset");
  });

  it("409 item_in_use keeps a valid rooms count; other values are dropped", async () => {
    const t = (rooms: unknown) =>
      api(() => jsonRes({ error: { code: "item_in_use", rooms } }, 409)).api.patch("k", {
        w: 2,
      });
    expect(await t(2)).toEqual({ ok: false, code: "item_in_use", rooms: 2 });
    for (const bad of ["2", -1, 1.5]) {
      expect(await t(bad)).toEqual({ ok: false, code: "item_in_use" });
    }
    const other = api(() => jsonRes({ error: { code: "item_name_taken" } }, 409));
    expect(await other.api.reset("k")).toEqual({ ok: false, code: "item_name_taken" });
  });

  it("never throws: signed_out, fetch failure and a non-JSON 200", async () => {
    const t = (e: unknown) =>
      createMapItemsApi((async () => Promise.reject(e)) as unknown as ApiFetch);
    expect(await t(new ApiAccessError("signed_out")).patch("k", { w: 1 })).toEqual({
      ok: false,
      code: "unauthenticated",
    });
    expect(await t(new Error("x")).reset("k")).toEqual({ ok: false, code: "unavailable" });
    const bad = api(() => new Response("nope", { status: 200 }));
    expect(await bad.api.patch("k", { w: 1 })).toEqual({ ok: false, code: "internal" });
  });
});

describe("map-items-api getArtImage", () => {
  const png = () => new Response(new Blob(["x"], { type: "image/png" }), { status: 200 });

  it("GETs the encoded key and direction and returns the blob", async () => {
    const a = api(png);
    const r = await a.api.getArtImage("plant large/x", "e");
    expect(r.ok).toBe(true);
    expect(a.calls[0][0]).toBe("/api/map-items/plant%20large%2Fx/art/e/image");
    expect(a.calls[0][1]?.method).toBe("GET");
  });

  it("a non-png body is not ok; a 404 code is returned", async () => {
    expect(await api(() => new Response("x", { status: 200 })).api.getArtImage("k", "s")).toEqual({
      ok: false,
      code: "internal",
    });
    expect(
      await api(() => jsonRes({ error: { code: "not_found" } }, 404)).api.getArtImage("k", "s"),
    ).toEqual({ ok: false, code: "not_found" });
  });

  it("never throws: signed_out and a fetch failure", async () => {
    const t = (e: unknown) =>
      createMapItemsApi((async () => Promise.reject(e)) as unknown as ApiFetch);
    expect(await t(new ApiAccessError("signed_out")).getArtImage("k", "s")).toEqual({
      ok: false,
      code: "unauthenticated",
    });
    expect(await t(new Error("net")).getArtImage("k", "s")).toEqual({
      ok: false,
      code: "unavailable",
    });
  });
});
