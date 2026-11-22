import { describe, expect, it } from "vitest";
import { ApiAccessError, type ApiFetch } from "@/lib/api/fetch";
import { createSeatsApi } from "./seats-api";

type Call = [string, RequestInit | undefined];

function fake(respond: () => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetcher = (async (path: string, init?: RequestInit) => {
    calls.push([path, init]);
    return respond();
  }) as unknown as ApiFetch;
  return { api: createSeatsApi(fetcher), calls };
}
const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const throwing = (e: unknown) =>
  createSeatsApi((async () => Promise.reject(e)) as unknown as ApiFetch);

const listBody = { room: { id: "a/b", code: "C1", name: "N" }, items: [], truncated: false };
const seatBody = { id: "s/1", code: "C1-01", devices: [] };

describe("seats-api requests", () => {
  it("list: GET with the encoded room id", async () => {
    const a = fake(() => jsonRes(listBody));
    expect(await a.api.list("a/b")).toEqual({ ok: true, value: listBody });
    expect(a.calls[0][0]).toBe("/api/rooms/a%2Fb/seats");
    expect(a.calls[0][1]?.method).toBe("GET");
  });
  it("get: GET with the encoded seat id", async () => {
    const a = fake(() => jsonRes(seatBody));
    expect(await a.api.get("s/1")).toEqual({ ok: true, value: seatBody });
    expect(a.calls[0][0]).toBe("/api/seats/s%2F1");
  });
  it("a body of the wrong shape is internal", async () => {
    expect(await fake(() => jsonRes({})).api.list("r")).toEqual({ ok: false, code: "internal" });
    expect(await fake(() => jsonRes({})).api.get("s")).toEqual({ ok: false, code: "internal" });
  });
});

describe("seats-api errors", () => {
  it("reads the error code from the body", async () => {
    const a = fake(() => jsonRes({ error: { code: "not_found" } }, 404));
    expect(await a.api.get("s")).toEqual({ ok: false, code: "not_found" });
  });
  it("bad JSON is internal", async () => {
    const a = fake(() => new Response("oops", { status: 500 }));
    expect(await a.api.list("r")).toEqual({ ok: false, code: "internal" });
    expect(await fake(() => new Response("oops")).api.get("s")).toEqual({
      ok: false,
      code: "internal",
    });
  });
  it("maps ApiAccessError and network errors", async () => {
    expect(await throwing(new ApiAccessError("forbidden")).get("s")).toEqual({
      ok: false,
      code: "forbidden",
    });
    expect(await throwing(new ApiAccessError("signed_out")).get("s")).toEqual({
      ok: false,
      code: "unauthenticated",
    });
    expect(await throwing(new TypeError("fetch failed")).list("r")).toEqual({
      ok: false,
      code: "unavailable",
    });
  });
});
