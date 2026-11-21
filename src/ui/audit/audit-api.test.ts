import { describe, expect, it } from "vitest";
import { ApiAccessError, type ApiFetch } from "@/lib/api/fetch";
import { createAuditApi } from "./audit-api";

function fake(respond: () => Response | Promise<Response>) {
  const calls: string[] = [];
  const fetcher = (async (path: string) => {
    calls.push(path);
    return respond();
  }) as unknown as ApiFetch;
  return { api: createAuditApi(fetcher), calls };
}
const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const empty = { items: [], nextCursor: null };

describe("audit-api", () => {
  it("list sends actor, entity, from, to, limit, cursor as query params, omits blanks", async () => {
    const a = fake(() => jsonRes(empty));
    await a.api.list(
      {
        actor: "u1",
        entity: "room",
        from: "2026-03-04T17:00:00.000Z",
        to: "2026-03-05T17:00:00.000Z",
        limit: 50,
      },
      "cur",
    );
    const url = new URL(a.calls[0], "http://x");
    expect(url.pathname).toBe("/api/audit");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      actor: "u1",
      entity: "room",
      from: "2026-03-04T17:00:00.000Z",
      to: "2026-03-05T17:00:00.000Z",
      limit: "50",
      cursor: "cur",
    });
    await a.api.list({ limit: 50 });
    expect(a.calls[1]).toBe("/api/audit?limit=50");
  });
  it("list returns items and nextCursor on 200", async () => {
    const a = fake(() => jsonRes({ items: [{ id: "1" }], nextCursor: "n" }));
    expect(await a.api.list({ limit: 50 })).toEqual({
      ok: true,
      value: { items: [{ id: "1" }], nextCursor: "n" },
    });
  });
  it("403 / 401 / 400 error bodies map to the error code; malformed body -> internal", async () => {
    for (const [status, code] of [
      [403, "forbidden"],
      [401, "unauthenticated"],
      [400, "invalid_request"],
    ] as const) {
      const a = fake(() => jsonRes({ error: { code } }, status));
      expect(await a.api.list({ limit: 50 })).toEqual({ ok: false, code });
    }
    const bad = await fake(() => jsonRes({ items: "x" })).api.list({ limit: 50 });
    expect(bad).toEqual({ ok: false, code: "internal" });
    const text = await fake(() => new Response("nope", { status: 500 })).api.list({ limit: 50 });
    expect(text).toEqual({ ok: false, code: "internal" });
  });
  it("ApiAccessError signed_out -> unauthenticated; other thrown error -> unavailable", async () => {
    const mk = (e: unknown) =>
      createAuditApi((async () => Promise.reject(e)) as unknown as ApiFetch);
    const signedOut = new ApiAccessError("signed_out");
    expect(await mk(signedOut).facets()).toEqual({ ok: false, code: "unauthenticated" });
    expect(await mk(new Error("boom")).facets()).toEqual({ ok: false, code: "unavailable" });
  });
  it("facets returns actors and entities; wrong shape -> internal", async () => {
    const body = { actors: [{ sub: "u", displayName: null }], entities: ["room"] };
    const a = fake(() => jsonRes(body));
    expect(await a.api.facets()).toEqual({ ok: true, value: body });
    expect(a.calls[0]).toBe("/api/audit/facets");
    expect(await fake(() => jsonRes({ actors: [] })).api.facets()).toEqual({
      ok: false,
      code: "internal",
    });
  });
  it("actor value with special characters is URL-encoded", async () => {
    const a = fake(() => jsonRes(empty));
    await a.api.list({ actor: "a&b=c d", limit: 50 });
    expect(a.calls[0]).not.toContain("a&b");
    expect(new URL(a.calls[0], "http://x").searchParams.get("actor")).toBe("a&b=c d");
  });
});
