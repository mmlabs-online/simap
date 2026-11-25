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
});
