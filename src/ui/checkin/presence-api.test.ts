import { describe, expect, it } from "vitest";
import { ApiAccessError, type ApiFetch } from "@/lib/api/fetch";
import { createPresenceApi } from "./presence-api";

type Call = [string, RequestInit | undefined];

function fake(respond: () => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetcher = (async (path: string, init?: RequestInit) => {
    calls.push([path, init]);
    return respond();
  }) as unknown as ApiFetch;
  return { api: createPresenceApi(fetcher), calls };
}
const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const throwing = (e: unknown) =>
  createPresenceApi((async () => Promise.reject(e)) as unknown as ApiFetch);

describe("presence-api", () => {
  it("mine GETs /api/me/presence and returns the body; a body without workDate/recent array -> internal", async () => {
    const body = { workDate: "2026-03-06", presence: null, recent: [] };
    const a = fake(() => jsonRes(body));
    expect(await a.api.mine()).toEqual({ ok: true, value: body });
    expect(a.calls[0][0]).toBe("/api/me/presence");
    expect(a.calls[0][1]?.method).toBe("GET");
    expect(await fake(() => jsonRes({ presence: null })).api.mine()).toEqual({
      ok: false,
      code: "internal",
    });
  });
  it("checkIn sends PUT with content-type application/json and exactly {roomId}", async () => {
    const a = fake(() => jsonRes({ presence: null }));
    await a.api.checkIn("r1");
    const init = a.calls[0][1];
    expect(init?.method).toBe("PUT");
    expect(init?.headers).toEqual({ "content-type": "application/json" });
    expect(JSON.parse(init?.body as string)).toEqual({ roomId: "r1" });
  });
  it("checkIn 409 returns {code:already_checked_in, room}; 422 returns {code:no_seat_in_room}", async () => {
    const a = fake(() => jsonRes({ error: { code: "already_checked_in", room: "A1" } }, 409));
    expect(await a.api.checkIn("r1")).toEqual({
      ok: false,
      code: "already_checked_in",
      room: "A1",
    });
    const b = fake(() => jsonRes({ error: { code: "no_seat_in_room" } }, 422));
    expect(await b.api.checkIn("r1")).toEqual({ ok: false, code: "no_seat_in_room" });
  });
  it("checkOut sends DELETE; move sends PATCH {seatId}; room GETs /api/rooms/<encoded id>/presence and checks members is an array", async () => {
    const a = fake(() => jsonRes({ presence: null }));
    expect(await a.api.checkOut()).toEqual({ ok: true, value: null });
    expect(a.calls[0][1]?.method).toBe("DELETE");
    await a.api.move("s1");
    expect(a.calls[1][1]?.method).toBe("PATCH");
    expect(JSON.parse(a.calls[1][1]?.body as string)).toEqual({ seatId: "s1" });
    const r = fake(() => jsonRes({ roomId: "a/b", workDate: "d", members: [] }));
    expect((await r.api.room("a/b")).ok).toBe(true);
    expect(r.calls[0][0]).toBe("/api/rooms/a%2Fb/presence");
    expect(await fake(() => jsonRes({ members: 1 })).api.room("x")).toEqual({
      ok: false,
      code: "internal",
    });
  });
  it("ApiAccessError signed_out -> unauthenticated; a thrown fetch -> unavailable", async () => {
    expect(await throwing(new ApiAccessError("signed_out")).mine()).toEqual({
      ok: false,
      code: "unauthenticated",
    });
    expect(await throwing(new ApiAccessError("forbidden")).mine()).toEqual({
      ok: false,
      code: "forbidden",
    });
    expect(await throwing(new Error("net")).mine()).toEqual({ ok: false, code: "unavailable" });
  });
});
