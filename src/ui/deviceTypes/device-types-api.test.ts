import { describe, expect, it } from "vitest";
import { ApiAccessError, type ApiFetch } from "@/lib/api/fetch";
import { createDeviceTypesApi } from "./device-types-api";

type Call = [string, RequestInit | undefined];

function fake(respond: () => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetcher = (async (path: string, init?: RequestInit) => {
    calls.push([path, init]);
    return respond();
  }) as unknown as ApiFetch;
  return { api: createDeviceTypesApi(fetcher), calls };
}
const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const throwing = (e: unknown) =>
  createDeviceTypesApi((async () => Promise.reject(e)) as unknown as ApiFetch);

const dto = { id: "a/b", name: "Máy in", slot: "other", hasImage: false, imageVersion: 0 };

describe("device-types-api", () => {
  it("list reads `items`; a missing key is internal", async () => {
    const a = fake(() => jsonRes({ items: [dto] }));
    expect(await a.api.list()).toEqual({ ok: true, value: [dto] });
    expect(a.calls[0][0]).toBe("/api/device-types");
    expect(a.calls[0][1]?.method).toBe("GET");
    expect(await fake(() => jsonRes({ groups: [] })).api.list()).toEqual({
      ok: false,
      code: "internal",
    });
  });
  it("create and update send JSON to the right path", async () => {
    const a = fake(() => jsonRes(dto, 201));
    expect(await a.api.create({ name: "Máy in", slot: "other" })).toEqual({ ok: true, value: dto });
    const [path, init] = a.calls[0];
    expect(path).toBe("/api/device-types");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("content-type")).toBe("application/json");
    expect(JSON.parse(init?.body as string)).toEqual({ name: "Máy in", slot: "other" });

    await a.api.update("a/b", { slot: "pc" });
    const [p2, i2] = a.calls[1];
    expect(p2).toBe("/api/device-types/a%2Fb");
    expect(i2?.method).toBe("PATCH");
    expect(new Headers(i2?.headers).get("content-type")).toBe("application/json");
    expect(JSON.parse(i2?.body as string)).toEqual({ slot: "pc" });
  });
  it("remove: 204 is ok, an error body gives its code", async () => {
    const a = fake(() => new Response(null, { status: 204 }));
    expect(await a.api.remove("a/b")).toEqual({ ok: true, value: null });
    expect(a.calls[0][0]).toBe("/api/device-types/a%2Fb");
    expect(a.calls[0][1]?.method).toBe("DELETE");
    const b = fake(() => jsonRes({ error: { code: "not_found" } }, 404));
    expect(await b.api.remove("x")).toEqual({ ok: false, code: "not_found" });
    const c = fake(() => jsonRes({ error: { code: "name_taken" } }, 409));
    expect(await c.api.create({ name: "x", slot: "pc" })).toEqual({
      ok: false,
      code: "name_taken",
    });
  });
  it("never throws: access errors map to their code, other throws to unavailable", async () => {
    expect(await throwing(new ApiAccessError("forbidden")).remove("x")).toEqual({
      ok: false,
      code: "forbidden",
    });
    expect(await throwing(new ApiAccessError("signed_out")).list()).toEqual({
      ok: false,
      code: "unauthenticated",
    });
    expect(await throwing(new Error("net")).remove("x")).toEqual({
      ok: false,
      code: "unavailable",
    });
  });
  it("getImage reads a blob through the fetcher; a non-PNG content type is internal", async () => {
    const a = fake(
      () => new Response(new Uint8Array([1, 2]), { headers: { "content-type": "image/png" } }),
    );
    const r = await a.api.getImage("a/b");
    expect(r.ok && r.value.size).toBe(2);
    expect(a.calls[0][0]).toBe("/api/device-types/a%2Fb/image");
    const b = fake(() => new Response("x", { headers: { "content-type": "text/html" } }));
    expect(await b.api.getImage("a")).toEqual({ ok: false, code: "internal" });
  });
  it("putImage sends PUT with content-type image/png and a Blob body, reads the DTO", async () => {
    const a = fake(() => jsonRes(dto));
    expect(await a.api.putImage("a/b", new Uint8Array([1, 2, 3]))).toEqual({
      ok: true,
      value: dto,
    });
    const [path, init] = a.calls[0];
    expect(path).toBe("/api/device-types/a%2Fb/image");
    expect(init?.method).toBe("PUT");
    expect(new Headers(init?.headers).get("content-type")).toBe("image/png");
    expect(init?.body).toBeInstanceOf(Blob);
    expect((init?.body as Blob).size).toBe(3);
  });
  it("putImage 422 image_too_large gives {ok:false, code}", async () => {
    const a = fake(() => jsonRes({ error: { code: "image_too_large" } }, 422));
    expect(await a.api.putImage("x", new Uint8Array(1))).toEqual({
      ok: false,
      code: "image_too_large",
    });
  });
  it("removeImage: 204 is ok", async () => {
    const a = fake(() => new Response(null, { status: 204 }));
    expect(await a.api.removeImage("a/b")).toEqual({ ok: true, value: null });
    expect(a.calls[0][0]).toBe("/api/device-types/a%2Fb/image");
    expect(a.calls[0][1]?.method).toBe("DELETE");
  });
});
