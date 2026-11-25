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

describe("devices-api remove", () => {
  it("remove sends DELETE /api/devices/<id>; 204 → ok; 409, 404 and network failures map", async () => {
    const ok = fake(() => new Response(null, { status: 204 }));
    expect(await ok.api.remove("a/b")).toEqual({ ok: true, value: undefined });
    expect(ok.calls[0][0]).toBe("/api/devices/a%2Fb");
    expect(ok.calls[0][1]?.method).toBe("DELETE");
    const placed = fake(() => jsonRes({ error: { code: "device_placed" } }, 409));
    expect(await placed.api.remove("d1")).toEqual({ ok: false, code: "device_placed" });
    const gone = fake(() => jsonRes({ error: { code: "not_found" } }, 404));
    expect(await gone.api.remove("d1")).toEqual({ ok: false, code: "not_found" });
    expect(await throwing(new TypeError("network")).remove("d1")).toEqual({
      ok: false,
      code: "unavailable",
    });
  });
});

describe("devices-api create and update", () => {
  const dev = { id: "d1", name: "x" };
  it("create sends POST /api/devices with JSON", async () => {
    const { api, calls } = fake(() => jsonRes(dev, 201));
    const body = {
      name: "x",
      type: "PC",
      inventoryNumber: "I",
      mac: null,
      serial: null,
      manufacturer: null,
      brand: null,
    };
    expect(await api.create(body)).toEqual({ ok: true, value: dev });
    expect(calls[0][0]).toBe("/api/devices");
    expect(calls[0][1]?.method).toBe("POST");
    expect(calls[0][1]?.body).toBe(JSON.stringify(body));
    const bad = fake(() => jsonRes({}, 201));
    expect(await bad.api.create(body)).toEqual({ ok: false, code: "internal" });
    const taken = fake(() => jsonRes({ error: { code: "mac_taken" } }, 409));
    expect(await taken.api.create(body)).toEqual({ ok: false, code: "mac_taken" });
  });
  it("update sends PATCH /api/devices/<id>", async () => {
    const { api, calls } = fake(() => jsonRes(dev));
    expect(await api.update("a/b", { type: "PC" })).toEqual({ ok: true, value: dev });
    expect(calls[0][0]).toBe("/api/devices/a%2Fb");
    expect(calls[0][1]?.method).toBe("PATCH");
    expect(calls[0][1]?.body).toBe('{"type":"PC"}');
    const gone = fake(() => jsonRes({ error: { code: "not_found" } }, 404));
    expect(await gone.api.update("d1", { type: "PC" })).toEqual({ ok: false, code: "not_found" });
  });
});

describe("devices-api assign and holding", () => {
  it("assign sends POST /api/devices/<id>/assignment with the JSON body", async () => {
    const { api, calls } = fake(() => jsonRes({ id: "d 1" }));
    const body = { memberId: "m1", note: "n", expiresOn: "2026-12-31" };
    expect(await api.assign("d 1", body)).toEqual({ ok: true, value: { id: "d 1" } });
    expect(calls[0][0]).toBe("/api/devices/d%201/assignment");
    expect(calls[0][1]?.method).toBe("POST");
    expect(JSON.parse(String(calls[0][1]?.body))).toEqual(body);
  });
  it("updateHolding sends PATCH /api/devices/<id>/holding with the JSON body", async () => {
    const { api, calls } = fake(() => jsonRes({ id: "d1" }));
    await api.updateHolding("d1", { note: null });
    expect(calls[0][0]).toBe("/api/devices/d1/holding");
    expect(calls[0][1]?.method).toBe("PATCH");
    expect(JSON.parse(String(calls[0][1]?.body))).toEqual({ note: null });
  });
  it("a 409 code passes through; a body without an id is internal", async () => {
    const owned = fake(() => jsonRes({ error: { code: "device_owned" } }, 409));
    expect(await owned.api.assign("d1", { memberId: "m", note: null, expiresOn: null })).toEqual({
      ok: false,
      code: "device_owned",
    });
    const bad = fake(() => jsonRes({}));
    expect(await bad.api.updateHolding("d1", { note: "x" })).toEqual({
      ok: false,
      code: "internal",
    });
  });
});

describe("devices-api transfer", () => {
  const body = { kind: "transfer" as const, toMemberId: "m1", note: "Chuyển máy" };
  it("startTransfer sends POST /api/devices/<id>/handoffs with the JSON body", async () => {
    const { api, calls } = fake(() => jsonRes({ id: "h1" }, 201));
    expect(await api.startTransfer("d/1", body)).toEqual({ ok: true, value: { id: "h1" } });
    expect(calls[0][0]).toBe("/api/devices/d%2F1/handoffs");
    expect(calls[0][1]?.method).toBe("POST");
    expect(new Headers(calls[0][1]?.headers).get("content-type")).toBe("application/json");
    expect(JSON.parse(String(calls[0][1]?.body))).toEqual(body);
  });
  it("cancelHandoff sends POST /api/handoffs/<id>/cancel with no body", async () => {
    const { api, calls } = fake(() => jsonRes({ id: "h 1" }));
    expect(await api.cancelHandoff("h 1")).toEqual({ ok: true, value: { id: "h 1" } });
    expect(calls[0][0]).toBe("/api/handoffs/h%201/cancel");
    expect(calls[0][1]?.method).toBe("POST");
    expect(calls[0][1]?.body).toBeUndefined();
  });
  it("incomingHandoffs sends GET /api/handoffs?box=incoming; { items, truncated } on 200; a malformed body is internal", async () => {
    const { api, calls } = fake(() => jsonRes({ items: [{ id: "h1" }], truncated: true }));
    expect(await api.incomingHandoffs()).toEqual({
      ok: true,
      value: { items: [{ id: "h1" }], truncated: true },
    });
    expect(calls[0][0]).toBe("/api/handoffs?box=incoming");
    expect(calls[0][1]?.method).toBe("GET");
    for (const b of [{}, { items: [] }, { items: {}, truncated: false }]) {
      expect(await fake(() => jsonRes(b)).api.incomingHandoffs()).toEqual({
        ok: false,
        code: "internal",
      });
    }
  });
  it("handoffCount sends GET /api/handoffs/count; returns { incoming }; a non-number is internal", async () => {
    const { api, calls } = fake(() => jsonRes({ incoming: 3 }));
    expect(await api.handoffCount()).toEqual({ ok: true, value: { incoming: 3 } });
    expect(calls[0][0]).toBe("/api/handoffs/count");
    expect(calls[0][1]?.method).toBe("GET");
    expect(await fake(() => jsonRes({ incoming: "3" })).api.handoffCount()).toEqual({
      ok: false,
      code: "internal",
    });
  });
  it("confirmHandoff / declineHandoff send POST /api/handoffs/<encoded id>/confirm and /decline with no body; codes pass through", async () => {
    const { api, calls } = fake(() => jsonRes({ id: "h 1" }));
    expect(await api.confirmHandoff("h 1")).toEqual({ ok: true, value: { id: "h 1" } });
    expect(await api.declineHandoff("h 1")).toEqual({ ok: true, value: { id: "h 1" } });
    expect(calls.map((c) => c[0])).toEqual([
      "/api/handoffs/h%201/confirm",
      "/api/handoffs/h%201/decline",
    ]);
    for (const c of calls) {
      expect(c[1]?.method).toBe("POST");
      expect(c[1]?.body).toBeUndefined();
    }
    const stale = fake(() => jsonRes({ error: { code: "handoff_stale" } }, 409));
    expect(await stale.api.confirmHandoff("h1")).toEqual({ ok: false, code: "handoff_stale" });
    expect(await stale.api.declineHandoff("h1")).toEqual({ ok: false, code: "handoff_stale" });
  });
  it("error codes pass through; a body without an id is internal", async () => {
    const pending = fake(() => jsonRes({ error: { code: "handoff_pending" } }, 409));
    expect(await pending.api.startTransfer("d1", body)).toEqual({
      ok: false,
      code: "handoff_pending",
    });
    const gone = fake(() => jsonRes({ error: { code: "handoff_not_pending" } }, 409));
    expect(await gone.api.cancelHandoff("h1")).toEqual({ ok: false, code: "handoff_not_pending" });
    const bad = fake(() => jsonRes({}));
    expect(await bad.api.cancelHandoff("h1")).toEqual({ ok: false, code: "internal" });
    expect(await bad.api.startTransfer("d1", body)).toEqual({ ok: false, code: "internal" });
  });
});
