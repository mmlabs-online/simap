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

describe("seats-api writes", () => {
  const item = { id: "s/1", code: "C1-01", devices: [] };
  it("add: POST the count, reads items", async () => {
    const a = fake(() => jsonRes({ items: [item] }, 201));
    expect(await a.api.add("a/b", 3)).toEqual({ ok: true, value: [item] });
    expect(a.calls[0][0]).toBe("/api/rooms/a%2Fb/seats");
    expect(a.calls[0][1]?.method).toBe("POST");
    expect(a.calls[0][1]?.body).toBe(JSON.stringify({ count: 3 }));
    expect(await fake(() => jsonRes({})).api.add("r", 1)).toEqual({ ok: false, code: "internal" });
  });
  it("remove: DELETE, 204 is null", async () => {
    const a = fake(() => new Response(null, { status: 204 }));
    expect(await a.api.remove("s/1")).toEqual({ ok: true, value: null });
    expect(a.calls[0][0]).toBe("/api/seats/s%2F1");
    expect(a.calls[0][1]?.method).toBe("DELETE");
  });
  it("release: POST, returns the seat", async () => {
    const a = fake(() => jsonRes(item));
    expect(await a.api.release("s/1")).toEqual({ ok: true, value: item });
    expect(a.calls[0][0]).toBe("/api/seats/s%2F1/release");
    expect(a.calls[0][1]?.method).toBe("POST");
    expect(await fake(() => jsonRes({})).api.release("s")).toEqual({
      ok: false,
      code: "internal",
    });
  });
  it("each write never throws and reads the error code", async () => {
    const body = () => jsonRes({ error: { code: "seat_not_empty" } }, 409);
    const expected = { ok: false, code: "seat_not_empty" };
    expect(await fake(body).api.remove("s")).toEqual(expected);
    expect(await fake(body).api.add("r", 1)).toEqual(expected);
    expect(await fake(body).api.release("s")).toEqual(expected);
    const net = throwing(new TypeError("x"));
    const denied = throwing(new ApiAccessError("forbidden"));
    expect(await net.remove("s")).toEqual({ ok: false, code: "unavailable" });
    expect(await net.add("r", 1)).toEqual({ ok: false, code: "unavailable" });
    expect(await denied.release("s")).toEqual({ ok: false, code: "forbidden" });
    expect(await denied.remove("s")).toEqual({ ok: false, code: "forbidden" });
  });
});
