import { describe, expect, it } from "vitest";
import { ApiAccessError, type ApiFetch } from "@/lib/api/fetch";
import { createRequestsApi } from "./requests-api";

function fake(respond: () => Response | Promise<Response>) {
  const calls: string[] = [];
  const inits: (RequestInit | undefined)[] = [];
  const fetcher = (async (path: string, init?: RequestInit) => {
    calls.push(path);
    inits.push(init);
    return respond();
  }) as unknown as ApiFetch;
  return { api: createRequestsApi(fetcher), calls, inits };
}
const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const empty = { items: [], nextCursor: null };

describe("requests-api", () => {
  it("list: GET /api/requests?status=pending&limit=50; cursor appended and encoded", async () => {
    const a = fake(() => jsonRes(empty));
    await a.api.list("pending");
    expect(a.calls[0]).toBe("/api/requests?status=pending&limit=50");
    await a.api.list("approved", "a b/c");
    expect(a.calls[1]).toBe("/api/requests?status=approved&limit=50&cursor=a+b%2Fc");
  });
  it("list: valid body -> ok; items not array or nextCursor wrong type -> internal", async () => {
    expect(
      await fake(() => jsonRes({ items: [{ id: "1" }], nextCursor: "n" })).api.list("pending"),
    ).toEqual({
      ok: true,
      value: { items: [{ id: "1" }], nextCursor: "n" },
    });
    expect(await fake(() => jsonRes({ items: {}, nextCursor: null })).api.list("pending")).toEqual({
      ok: false,
      code: "internal",
    });
    expect(await fake(() => jsonRes({ items: [], nextCursor: 3 })).api.list("pending")).toEqual({
      ok: false,
      code: "internal",
    });
  });
  it("list: 403 forbidden -> forbidden; non-JSON error -> internal; fetch throws -> unavailable; signed_out -> unauthenticated", async () => {
    expect(
      await fake(() => jsonRes({ error: { code: "forbidden" } }, 403)).api.list("pending"),
    ).toEqual({ ok: false, code: "forbidden" });
    expect(await fake(() => new Response("oops", { status: 500 })).api.list("pending")).toEqual({
      ok: false,
      code: "internal",
    });
    expect(
      await fake(() => {
        throw new Error("network");
      }).api.list("pending"),
    ).toEqual({ ok: false, code: "unavailable" });
    expect(
      await fake(() => {
        throw new ApiAccessError("signed_out");
      }).api.list("pending"),
    ).toEqual({ ok: false, code: "unauthenticated" });
  });
  const dto = { id: "r1", status: "pending" };
  const thrown = (e: unknown) =>
    fake(() => {
      throw e;
    });

  it("create: POST /api/requests with JSON {seatId}; 201 -> created true; 200 -> created false", async () => {
    const a = fake(() => jsonRes(dto, 201));
    expect(await a.api.create("s1")).toEqual({ ok: true, value: { created: true, request: dto } });
    expect(a.calls[0]).toBe("/api/requests");
    expect(a.inits[0]?.method).toBe("POST");
    expect(a.inits[0]?.body).toBe(JSON.stringify({ seatId: "s1" }));
    expect(new Headers(a.inits[0]?.headers).get("content-type")).toBe("application/json");
    expect(await fake(() => jsonRes(dto, 200)).api.create("s1")).toEqual({
      ok: true,
      value: { created: false, request: dto },
    });
  });
  it("create: 409 seat_taken -> code; 422 no_linked_member -> code; body without id -> internal; fetch throws -> unavailable; signed_out -> unauthenticated", async () => {
    expect(
      await fake(() => jsonRes({ error: { code: "seat_taken" } }, 409)).api.create("s1"),
    ).toEqual({ ok: false, code: "seat_taken" });
    expect(
      await fake(() => jsonRes({ error: { code: "no_linked_member" } }, 422)).api.create("s1"),
    ).toEqual({ ok: false, code: "no_linked_member" });
    expect(await fake(() => jsonRes({ status: "pending" }, 201)).api.create("s1")).toEqual({
      ok: false,
      code: "internal",
    });
    expect(await thrown(new Error("network")).api.create("s1")).toEqual({
      ok: false,
      code: "unavailable",
    });
    expect(await thrown(new ApiAccessError("signed_out")).api.create("s1")).toEqual({
      ok: false,
      code: "unauthenticated",
    });
  });
  it("cancel: POST /api/requests/<encoded id>/cancel with no body; 200 -> DTO; 404 -> not_found", async () => {
    const a = fake(() => jsonRes({ ...dto, status: "cancelled" }));
    expect(await a.api.cancel("a b/c")).toEqual({
      ok: true,
      value: { ...dto, status: "cancelled" },
    });
    expect(a.calls[0]).toBe("/api/requests/a%20b%2Fc/cancel");
    expect(a.inits[0]?.method).toBe("POST");
    expect(a.inits[0]?.body).toBeUndefined();
    expect(
      await fake(() => jsonRes({ error: { code: "not_found" } }, 404)).api.cancel("x"),
    ).toEqual({ ok: false, code: "not_found" });
  });
  it("mine: GET /api/requests/mine?limit=50, cursor appended and encoded; limit=1 when given; missing unseen or items not an array -> internal", async () => {
    const page = { items: [], unseen: 2, nextCursor: null };
    const a = fake(() => jsonRes(page));
    expect(await a.api.mine()).toEqual({ ok: true, value: page });
    expect(a.calls[0]).toBe("/api/requests/mine?limit=50");
    expect(a.inits[0]?.method).toBe("GET");
    await a.api.mine("a b/c");
    expect(a.calls[1]).toBe("/api/requests/mine?limit=50&cursor=a+b%2Fc");
    await a.api.mine(undefined, 1);
    expect(a.calls[2]).toBe("/api/requests/mine?limit=1");
    const bad = { ok: false, code: "internal" };
    expect(await fake(() => jsonRes({ items: [], nextCursor: null })).api.mine()).toEqual(bad);
    expect(
      await fake(() => jsonRes({ items: {}, unseen: 0, nextCursor: null })).api.mine(),
    ).toEqual(bad);
    expect(await fake(() => jsonRes({ items: [], unseen: 0, nextCursor: 3 })).api.mine()).toEqual(
      bad,
    );
  });
  it("markSeen: POST /api/requests/mine/seen with JSON {seenUpTo} exactly as given; 200 -> {unseen, requestsSeenAt}; unseen not a number -> internal; 400 -> invalid_request", async () => {
    const at = "2026-03-05T10:00:00.123457Z";
    const a = fake(() => jsonRes({ unseen: 1, requestsSeenAt: at }));
    expect(await a.api.markSeen(at)).toEqual({
      ok: true,
      value: { unseen: 1, requestsSeenAt: at },
    });
    expect(a.calls[0]).toBe("/api/requests/mine/seen");
    expect(a.inits[0]?.method).toBe("POST");
    expect(a.inits[0]?.body).toBe(JSON.stringify({ seenUpTo: at }));
    expect(
      await fake(() => jsonRes({ unseen: "1", requestsSeenAt: null })).api.markSeen(at),
    ).toEqual({ ok: false, code: "internal" });
    expect(
      await fake(() => jsonRes({ error: { code: "invalid_request" } }, 400)).api.markSeen(at),
    ).toEqual({ ok: false, code: "invalid_request" });
  });
});
