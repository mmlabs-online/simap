import { describe, expect, it } from "vitest";
import { ApiAccessError, type ApiFetch } from "@/lib/api/fetch";
import { validateCannotSeat, validateOccupantPut } from "@/lib/validate/seat";
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

describe("seats-api layout", () => {
  const layoutBody = {
    room: { id: "a/b", code: "C1", name: "N" },
    version: 1,
    saved: false,
    layout: { w: 4, h: 3, floors: [], seats: [], fixtures: [] },
    seatViews: {},
    unplaced: [],
    truncated: false,
  };
  it("layout calls GET /api/rooms/{id}/layout with an encoded id", async () => {
    const a = fake(() => jsonRes(layoutBody));
    const r = await a.api.layout("a/b");
    expect(r.ok && r.value.empty).toBe(true);
    expect(a.calls[0][0]).toBe("/api/rooms/a%2Fb/layout");
    expect(a.calls[0][1]?.method).toBe("GET");
  });
  it("layout returns internal for a bad shape, and the server error code for a non-2xx", async () => {
    expect(await fake(() => jsonRes({})).api.layout("r")).toEqual({ ok: false, code: "internal" });
    const a = fake(() => jsonRes({ error: { code: "not_found" } }, 404));
    expect(await a.api.layout("r")).toEqual({ ok: false, code: "not_found" });
  });
  const save = { baseVersion: 1, w: 4, h: 3, floors: [], seats: [], fixtures: [] };
  it("saveLayout PUTs the JSON body to /api/rooms/{id}/layout and maps the response with its version", async () => {
    const a = fake(() => jsonRes({ ...layoutBody, version: 2 }));
    const r = await a.api.saveLayout("a/b", save);
    expect(r.ok && r.value.version).toBe(2);
    expect(a.calls[0][0]).toBe("/api/rooms/a%2Fb/layout");
    expect(a.calls[0][1]?.method).toBe("PUT");
    expect(a.calls[0][1]?.body).toBe(JSON.stringify(save));
    expect(new Headers(a.calls[0][1]?.headers).get("content-type")).toBe("application/json");
  });
  it("saveLayout returns the error code for 409 layout_stale and fail('internal') for a bad body", async () => {
    const stale = fake(() => jsonRes({ error: { code: "layout_stale" } }, 409));
    expect(await stale.api.saveLayout("r", save)).toEqual({ ok: false, code: "layout_stale" });
    expect(await fake(() => jsonRes({})).api.saveLayout("r", save)).toEqual({
      ok: false,
      code: "internal",
    });
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

describe("seats-api activeMembers", () => {
  const dto = {
    id: "m1",
    displayName: "Nguyễn Ân",
    email: "x@example.com",
    employeeCode: "E1",
    seats: [],
    devices: [],
  };
  it("status and limit always; no q when blank; cursor verbatim; no duplicate keys", async () => {
    const a = fake(() => jsonRes({ items: [], nextCursor: null, groups: [] }));
    await a.api.activeMembers("   ", null);
    await a.api.activeMembers("  Ân  Nguyễn ", "cur+/=");
    const first = new URLSearchParams(a.calls[0][0].split("?")[1]);
    expect(a.calls[0][0].startsWith("/api/members?")).toBe(true);
    expect(first.get("status")).toBe("active");
    expect(first.get("limit")).toBe("20");
    expect(first.has("q")).toBe(false);
    expect(first.has("cursor")).toBe(false);
    const second = new URLSearchParams(a.calls[1][0].split("?")[1]);
    expect(second.getAll("q")).toEqual(["Ân Nguyễn"]);
    expect(second.getAll("cursor")).toEqual(["cur+/="]);
    expect([...second.keys()].sort()).toEqual(["cursor", "limit", "q", "status"]);
  });
  it("keeps only id, displayName, employeeCode (no email); wrong shape is internal", async () => {
    const a = fake(() => jsonRes({ items: [dto], nextCursor: "n", groups: [] }));
    expect(await a.api.activeMembers("", null)).toEqual({
      ok: true,
      value: {
        items: [{ id: "m1", displayName: "Nguyễn Ân", employeeCode: "E1" }],
        nextCursor: "n",
      },
    });
    expect(await fake(() => jsonRes({})).api.activeMembers("", null)).toEqual({
      ok: false,
      code: "internal",
    });
    expect(
      await fake(() => jsonRes({ items: [{ id: 1 }], nextCursor: null })).api.activeMembers(
        "",
        null,
      ),
    ).toEqual({ ok: false, code: "internal" });
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
  it("setOccupant: PUT body has exactly both keys, null expected kept, passes the validator", async () => {
    const a = fake(() => jsonRes(item));
    const memberId = "11111111-1111-4111-8111-111111111111";
    expect(await a.api.setOccupant("s/1", memberId, null)).toEqual({ ok: true, value: item });
    expect(a.calls[0][0]).toBe("/api/seats/s%2F1/occupant");
    expect(a.calls[0][1]?.method).toBe("PUT");
    const body = JSON.parse(String(a.calls[0][1]?.body));
    expect(Object.keys(body).sort()).toEqual(["expectedOccupantId", "memberId"]);
    expect(body.expectedOccupantId).toBeNull();
    expect(validateOccupantPut(body)).toEqual({
      ok: true,
      value: { memberId, expectedOccupantId: null },
    });
    const err = fake(() => jsonRes({ error: { code: "occupant_changed" } }, 409));
    expect(await err.api.setOccupant("s", memberId, null)).toEqual({
      ok: false,
      code: "occupant_changed",
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

describe("seats-api occupant removal and cannot-seat", () => {
  it("setOccupant clears with null and the shown occupant id", async () => {
    const a = fake(() => jsonRes(seatBody));
    await a.api.setOccupant("s/1", null, "11111111-1111-4111-8111-111111111111");
    expect(a.calls[0][0]).toBe("/api/seats/s%2F1/occupant");
    expect(a.calls[0][1]?.method).toBe("PUT");
    const body = JSON.parse(a.calls[0][1]?.body as string);
    expect(body).toEqual({
      memberId: null,
      expectedOccupantId: "11111111-1111-4111-8111-111111111111",
    });
    expect(Object.keys(body)).toHaveLength(2);
    expect(validateOccupantPut(body).ok).toBe(true);
  });
  it("setCannotSeat: PATCH with the reason", async () => {
    const a = fake(() => jsonRes(seatBody));
    expect(await a.api.setCannotSeat("s/1", "Broken")).toEqual({ ok: true, value: seatBody });
    expect(a.calls[0][0]).toBe("/api/seats/s%2F1/cannot-seat");
    expect(a.calls[0][1]?.method).toBe("PATCH");
    expect(new Headers(a.calls[0][1]?.headers).get("content-type")).toBe("application/json");
    const body = JSON.parse(a.calls[0][1]?.body as string);
    expect(body).toEqual({ cannotSeat: true, reason: "Broken" });
    expect(validateCannotSeat(body).ok).toBe(true);
    const err = fake(() => jsonRes({ error: { code: "not_found" } }, 404));
    expect(await err.api.setCannotSeat("s", "x")).toEqual({ ok: false, code: "not_found" });
  });
  it("setTags: PATCH with the given body", async () => {
    const a = fake(() => jsonRes(seatBody));
    expect(await a.api.setTags("s/1", { groupId: "g", projectId: null })).toEqual({
      ok: true,
      value: seatBody,
    });
    expect(a.calls[0][0]).toBe("/api/seats/s%2F1/tags");
    expect(a.calls[0][1]?.method).toBe("PATCH");
    expect(JSON.parse(a.calls[0][1]?.body as string)).toEqual({ groupId: "g", projectId: null });
    const err = fake(() => jsonRes({ error: { code: "invalid_group" } }, 422));
    expect(await err.api.setTags("s", { groupId: "x" })).toEqual({
      ok: false,
      code: "invalid_group",
    });
    const denied = throwing(new ApiAccessError("forbidden"));
    expect(await denied.setTags("s", {})).toEqual({ ok: false, code: "forbidden" });
  });
  it("clearCannotSeat: body is exactly cannotSeat false", async () => {
    const a = fake(() => jsonRes(seatBody));
    await a.api.clearCannotSeat("s/1");
    expect(a.calls[0][0]).toBe("/api/seats/s%2F1/cannot-seat");
    expect(a.calls[0][1]?.method).toBe("PATCH");
    const body = JSON.parse(a.calls[0][1]?.body as string);
    expect(body).toEqual({ cannotSeat: false });
    expect(Object.keys(body)).toHaveLength(1);
    expect(validateCannotSeat(body).ok).toBe(true);
    const denied = throwing(new ApiAccessError("forbidden"));
    expect(await denied.clearCannotSeat("s")).toEqual({ ok: false, code: "forbidden" });
  });
});
