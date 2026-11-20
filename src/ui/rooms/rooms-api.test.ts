import { describe, expect, it } from "vitest";
import { ApiAccessError, type ApiFetch } from "@/lib/api/fetch";
import { createRoomsApi } from "./rooms-api";

type Call = [string, RequestInit | undefined];

function fake(respond: () => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetcher = (async (path: string, init?: RequestInit) => {
    calls.push([path, init]);
    return respond();
  }) as unknown as ApiFetch;
  return { api: createRoomsApi(fetcher), calls };
}
const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const throwing = (e: unknown) =>
  createRoomsApi((async () => Promise.reject(e)) as unknown as ApiFetch);

const room = {
  id: "a/b",
  code: "C1",
  name: "N",
  description: null,
  floor: null,
  seatCount: 0,
  occupiedCount: 0,
};

describe("rooms-api requests", () => {
  it("list: GET /api/rooms returns rooms; a body without an array is internal", async () => {
    const a = fake(() => jsonRes({ rooms: [room] }));
    expect(await a.api.list()).toEqual({ ok: true, value: [room] });
    expect(a.calls[0][0]).toBe("/api/rooms");
    expect(a.calls[0][1]?.method).toBe("GET");
    expect(await fake(() => jsonRes({})).api.list()).toEqual({ ok: false, code: "internal" });
  });
  it("create: POST with JSON body and content-type", async () => {
    const a = fake(() => jsonRes(room, 201));
    const body = { code: "C1", name: "N", description: null, floor: null };
    expect(await a.api.create(body)).toEqual({ ok: true, value: room });
    const [path, init] = a.calls[0];
    expect(path).toBe("/api/rooms");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({ "content-type": "application/json" });
    expect(JSON.parse(init?.body as string)).toEqual(body);
  });
  it("update: PATCH sends only the given fields", async () => {
    const a = fake(() => jsonRes(room));
    await a.api.update("a/b", { name: "X" });
    expect(a.calls[0][0]).toBe("/api/rooms/a%2Fb");
    expect(a.calls[0][1]?.method).toBe("PATCH");
    expect(JSON.parse(a.calls[0][1]?.body as string)).toEqual({ name: "X" });
  });
  it("impact: GET delete-impact", async () => {
    const impact = { seats: 1, occupiedSeats: 0, placedDevices: 0, pendingRequests: 0 };
    const a = fake(() => jsonRes(impact));
    expect(await a.api.impact("r1")).toEqual({ ok: true, value: impact });
    expect(a.calls[0][0]).toBe("/api/rooms/r1/delete-impact");
  });
  it("remove: force adds ?force=true; 204 is ok", async () => {
    const a = fake(() => new Response(null, { status: 204 }));
    expect(await a.api.remove("r1", false)).toEqual({ ok: true, value: null });
    await a.api.remove("r1", true);
    expect(a.calls.map((c) => c[0])).toEqual(["/api/rooms/r1", "/api/rooms/r1?force=true"]);
    expect(a.calls[0][1]?.method).toBe("DELETE");
  });
});

describe("rooms-api errors", () => {
  it.each([
    [409, "room_code_taken"],
    [409, "room_not_empty"],
    [503, "unavailable"],
  ])("%i body code %s is returned", async (status, code) => {
    const a = fake(() => jsonRes({ error: { code } }, status));
    expect(await a.api.create({ code: "C1", name: "N", description: null, floor: null })).toEqual({
      ok: false,
      code,
    });
  });
  it("a non-JSON error body is internal", async () => {
    const a = fake(() => new Response("oops", { status: 500 }));
    expect(await a.api.list()).toEqual({ ok: false, code: "internal" });
  });
  it("maps ApiAccessError and network errors", async () => {
    expect(await throwing(new ApiAccessError("forbidden")).list()).toEqual({
      ok: false,
      code: "forbidden",
    });
    expect(await throwing(new ApiAccessError("member_deactivated")).list()).toEqual({
      ok: false,
      code: "member_deactivated",
    });
    expect(await throwing(new ApiAccessError("signed_out")).list()).toEqual({
      ok: false,
      code: "unauthenticated",
    });
    expect(await throwing(new ApiAccessError("unauthenticated")).list()).toEqual({
      ok: false,
      code: "unauthenticated",
    });
    expect(await throwing(new TypeError("fetch failed")).list()).toEqual({
      ok: false,
      code: "unavailable",
    });
  });
});
