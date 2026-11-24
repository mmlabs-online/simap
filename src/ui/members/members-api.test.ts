import { describe, expect, it } from "vitest";
import { ApiAccessError, type ApiFetch } from "@/lib/api/fetch";
import { createMembersApi } from "./members-api";
import { listQuery } from "./members-state";

type Call = { path: string; init: RequestInit };
function fake(respond: () => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetcher = (async (path: string, init: RequestInit) => {
    calls.push({ path, init });
    return respond();
  }) as unknown as ApiFetch;
  return { api: createMembersApi(fetcher), calls };
}
const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const page = { items: [], nextCursor: null, groups: [] };

describe("members-api", () => {
  it("list builds status and limit, adds q only when non-blank, encodes the cursor", async () => {
    const a = fake(() => jsonRes(page));
    await a.api.list(listQuery("  ", "active"));
    expect(a.calls[0].path).toBe("/api/members?status=active&limit=50");
    await a.api.list(listQuery(" Ánh ", "all"), "a b/c");
    const url = new URL(a.calls[1].path, "http://x");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      status: "all",
      limit: "50",
      q: "Ánh",
      cursor: "a b/c",
    });
    expect(a.calls[1].path).toContain("cursor=a+b%2Fc");
  });

  it("list rejects a malformed body", async () => {
    for (const body of [{ items: [] }, { ...page, groups: null }, { ...page, nextCursor: 3 }]) {
      const a = fake(() => jsonRes(body));
      expect(await a.api.list(listQuery("", "active"))).toEqual({ ok: false, code: "internal" });
    }
  });

  it("update PATCHes the encoded id with a JSON body incl. a null code", async () => {
    const a = fake(() => jsonRes({ id: "m/1" }));
    const r = await a.api.update("m/1", { employeeCode: null, displayName: "Nguyễn" });
    expect(r.ok).toBe(true);
    expect(a.calls[0].path).toBe("/api/members/m%2F1");
    expect(a.calls[0].init.method).toBe("PATCH");
    expect(JSON.parse(a.calls[0].init.body as string)).toEqual({
      employeeCode: null,
      displayName: "Nguyễn",
    });
  });

  it("impact, deactivate and reactivate hit their endpoints", async () => {
    const a = fake(() => jsonRes({}));
    await a.api.impact("m1");
    expect(a.calls[0].path).toBe("/api/members/m1/deactivation-impact");
    expect(a.calls[0].init.method).toBe("GET");
    await a.api.deactivate("m1", true);
    await a.api.deactivate("m1", false);
    expect(a.calls[1].path).toBe("/api/members/m1/deactivate");
    expect(a.calls[1].init.method).toBe("POST");
    expect(JSON.parse(a.calls[1].init.body as string)).toEqual({ release: true });
    expect(JSON.parse(a.calls[2].init.body as string)).toEqual({ release: false });
    await a.api.reactivate("m1");
    expect(a.calls[3].path).toBe("/api/members/m1/reactivate");
    expect(a.calls[3].init.method).toBe("POST");
  });

  it("maps errors to codes", async () => {
    const coded = fake(() => jsonRes({ error: { code: "member_not_empty" } }, 409));
    expect(await coded.api.deactivate("m1", false)).toEqual({
      ok: false,
      code: "member_not_empty",
    });
    const plain = fake(() => new Response("oops", { status: 500 }));
    expect(await plain.api.reactivate("m1")).toEqual({ ok: false, code: "internal" });
    const signedOut = createMembersApi((async () => {
      throw new ApiAccessError("signed_out");
    }) as unknown as ApiFetch);
    expect(await signedOut.reactivate("m1")).toEqual({ ok: false, code: "unauthenticated" });
    const down = createMembersApi((async () => {
      throw new TypeError("network");
    }) as unknown as ApiFetch);
    expect(await down.reactivate("m1")).toEqual({ ok: false, code: "unavailable" });
  });

  it("invitations returns items and rejects a non-array", async () => {
    const ok = fake(() => jsonRes({ items: [{ id: "i1" }] }));
    expect(await ok.api.invitations()).toEqual({ ok: true, value: [{ id: "i1" }] });
    expect(ok.calls[0].path).toBe("/api/members/invitations");
    const bad = fake(() => jsonRes({ items: "x" }));
    expect(await bad.api.invitations()).toEqual({ ok: false, code: "internal" });
  });
});
