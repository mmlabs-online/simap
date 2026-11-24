import { describe, expect, it } from "vitest";
import { ApiAccessError, type ApiFetch } from "@/lib/api/fetch";
import { createSearchApi } from "./search-api";

function fake(respond: () => Response | Promise<Response>) {
  const calls: string[] = [];
  const fetcher = (async (path: string) => {
    calls.push(path);
    return respond();
  }) as unknown as ApiFetch;
  return { api: createSearchApi(fetcher), calls };
}
const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const empty = { items: [], nextCursor: null };
const three = { seats: empty, devices: empty, members: empty };

describe("search-api", () => {
  it("searchAll sends q and kind=all only", async () => {
    const a = fake(() => jsonRes(three));
    await a.api.searchAll("Nguyễn Văn");
    const url = new URL(a.calls[0], "http://x");
    expect(url.pathname).toBe("/api/search");
    expect(Object.fromEntries(url.searchParams)).toEqual({ q: "Nguyễn Văn", kind: "all" });
  });

  it("searchAll: ok body with three groups -> value; a null or malformed group -> internal", async () => {
    const ok = await fake(() => jsonRes(three)).api.searchAll("a");
    expect(ok).toEqual({ ok: true, value: three });
    for (const bad of [
      { ...three, members: null },
      { ...three, seats: { items: "x", nextCursor: null } },
      { ...three, devices: { items: [], nextCursor: 5 } },
    ]) {
      expect(await fake(() => jsonRes(bad)).api.searchAll("a")).toEqual({
        ok: false,
        code: "internal",
      });
    }
  });

  it("searchMore sends kind=<x> and cursor, reads one group", async () => {
    const kinds = { seats: "seat", devices: "device", members: "member" } as const;
    for (const group of ["seats", "devices", "members"] as const) {
      const page = { items: [{ id: "1" }], nextCursor: "n" };
      const a = fake(() => jsonRes({ seats: null, devices: null, members: null, [group]: page }));
      const r = await a.api.searchMore(group, "an", "cur");
      const url = new URL(a.calls[0], "http://x");
      expect(Object.fromEntries(url.searchParams)).toEqual({
        q: "an",
        kind: kinds[group],
        cursor: "cur",
      });
      expect(r).toEqual({ ok: true, value: page });
    }
  });

  it("non-ok -> error code; no code -> internal; signed_out -> unauthenticated; fetch throws -> unavailable", async () => {
    expect(
      await fake(() => jsonRes({ error: { code: "forbidden" } }, 403)).api.searchAll("a"),
    ).toEqual({ ok: false, code: "forbidden" });
    expect(await fake(() => jsonRes({}, 500)).api.searchAll("a")).toEqual({
      ok: false,
      code: "internal",
    });
    expect(
      await fake(() => {
        throw new ApiAccessError("signed_out");
      }).api.searchAll("a"),
    ).toEqual({ ok: false, code: "unauthenticated" });
    expect(
      await fake(() => {
        throw new Error("net");
      }).api.searchAll("a"),
    ).toEqual({ ok: false, code: "unavailable" });
  });
});
