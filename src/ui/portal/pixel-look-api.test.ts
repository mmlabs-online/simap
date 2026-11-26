import { describe, expect, it, vi } from "vitest";
import { ApiAccessError, type ApiFetch } from "@/lib/api/fetch";
import { createPixelLookApi } from "./pixel-look-api";

const api = (fn: (path: string, init?: RequestInit) => Promise<Response>) =>
  createPixelLookApi(fn as unknown as ApiFetch);
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const err = (status: number, code: string) =>
  new Response(JSON.stringify({ error: { code } }), { status });
const look = { skin: 1, hair: 2, style: 3 as const, shirt: 0 };

describe("pixel look api", () => {
  it("get 200 {look} returns the parsed look; {look:null} returns null; a non-preset look returns internal", async () => {
    expect(await api(async () => ok({ look })).get()).toEqual({ ok: true, value: look });
    expect(await api(async () => ok({ look: null })).get()).toEqual({ ok: true, value: null });
    expect(await api(async () => ok({ look: { ...look, skin: 99 } })).get()).toEqual({
      ok: false,
      code: "internal",
    });
  });

  it("save sends PUT with content-type application/json and exactly the draft as JSON (extra keys on the input are not sent)", async () => {
    const fn = vi.fn(async (_p: string, _i?: RequestInit) => ok({ look }));
    await api(fn).save({ ...look, extra: 1 } as typeof look);
    const [path, init] = fn.mock.calls[0]!;
    expect(path).toBe("/api/me/pixel-look");
    expect(init?.method).toBe("PUT");
    expect(init?.headers).toEqual({ "content-type": "application/json" });
    expect(JSON.parse(init?.body as string)).toEqual(look);
    expect(Object.keys(JSON.parse(init?.body as string))).toHaveLength(4);
  });

  it("save 200 returns the parsed look; 422 invalid_look and 404 not_found return their codes", async () => {
    expect(await api(async () => ok({ look })).save(look)).toEqual({ ok: true, value: look });
    expect(await api(async () => err(422, "invalid_look")).save(look)).toEqual({
      ok: false,
      code: "invalid_look",
    });
    expect(await api(async () => err(404, "not_found")).save(look)).toEqual({
      ok: false,
      code: "not_found",
    });
  });

  it("reset sends DELETE with no body; 200 returns ok null", async () => {
    const fn = vi.fn(async (_p: string, _i?: RequestInit) => ok({ look: null }));
    expect(await api(fn).reset()).toEqual({ ok: true, value: null });
    const [path, init] = fn.mock.calls[0]!;
    expect(path).toBe("/api/me/pixel-look");
    expect(init).toEqual({ method: "DELETE" });
  });

  it("ApiAccessError member_deactivated returns that code; signed_out returns unauthenticated; a throwing fetcher returns unavailable", async () => {
    const thrower = (e: unknown) =>
      api(async () => {
        throw e;
      });
    expect(await thrower(new ApiAccessError("member_deactivated")).get()).toEqual({
      ok: false,
      code: "member_deactivated",
    });
    expect(await thrower(new ApiAccessError("signed_out")).get()).toEqual({
      ok: false,
      code: "unauthenticated",
    });
    expect(await thrower(new Error("offline")).get()).toEqual({ ok: false, code: "unavailable" });
  });
});
