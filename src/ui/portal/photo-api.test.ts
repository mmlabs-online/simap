import { describe, expect, it, vi } from "vitest";
import { ApiAccessError, type ApiFetch } from "@/lib/api/fetch";
import { createPhotoApi } from "./photo-api";

const api = (fn: (path: string, init?: RequestInit) => Promise<Response>) =>
  createPhotoApi(fn as unknown as ApiFetch);
const err = (status: number, code: string) =>
  new Response(JSON.stringify({ error: { code } }), { status });

describe("photo api", () => {
  it("get 200 image/png and image/jpeg return the blob", async () => {
    for (const type of ["image/png", "image/jpeg"]) {
      const r = await api(
        async () =>
          new Response(new Blob([new Uint8Array(3)], { type }), {
            status: 200,
            headers: { "content-type": type },
          }),
      ).get();
      expect(r.ok && r.value?.type).toBe(type);
    }
  });

  it("get 200 with another content type returns internal", async () => {
    const r = await api(
      async () => new Response("x", { status: 200, headers: { "content-type": "text/html" } }),
    ).get();
    expect(r).toEqual({ ok: false, code: "internal" });
  });

  it("get 404 returns ok with null (no photo is not an error)", async () => {
    expect(await api(async () => err(404, "not_found")).get()).toEqual({ ok: true, value: null });
  });

  it("get 503 returns images_unavailable; a throwing fetcher returns unavailable; ApiAccessError signed_out returns unauthenticated", async () => {
    expect(await api(async () => err(503, "images_unavailable")).get()).toEqual({
      ok: false,
      code: "images_unavailable",
    });
    expect(
      await api(async () => {
        throw new Error("net");
      }).get(),
    ).toEqual({ ok: false, code: "unavailable" });
    expect(
      await api(async () => {
        throw new ApiAccessError("signed_out");
      }).get(),
    ).toEqual({ ok: false, code: "unauthenticated" });
  });

  it("put sends PUT /api/me/photo with content-type image/jpeg and a Blob body, not multipart", async () => {
    const fn = vi.fn(
      async (_p: string, _i?: RequestInit) =>
        new Response(JSON.stringify({ hasPhoto: true, photoVersion: 2 }), { status: 200 }),
    );
    const r = await api(fn).put(new Uint8Array([1, 2, 3]), "jpeg");
    expect(r).toEqual({ ok: true, value: { hasPhoto: true, photoVersion: 2 } });
    const [path, init] = fn.mock.calls[0];
    expect(path).toBe("/api/me/photo");
    expect(init?.method).toBe("PUT");
    expect((init?.headers as Record<string, string>)["content-type"]).toBe("image/jpeg");
    expect(init?.body).toBeInstanceOf(Blob);
    expect(init?.body).not.toBeInstanceOf(FormData);
  });

  it("put 422 image_bad_size returns that code; put 409 image_changed returns that code", async () => {
    expect(await api(async () => err(422, "image_bad_size")).put(new Uint8Array(1), "png")).toEqual(
      { ok: false, code: "image_bad_size" },
    );
    expect(await api(async () => err(409, "image_changed")).put(new Uint8Array(1), "png")).toEqual({
      ok: false,
      code: "image_changed",
    });
  });

  it("remove sends DELETE and 204 returns ok; 409 not_allowed returns that code", async () => {
    const fn = vi.fn(async (_p: string, _i?: RequestInit) => new Response(null, { status: 204 }));
    expect(await api(fn).remove()).toEqual({ ok: true, value: null });
    expect(fn.mock.calls[0][1]?.method).toBe("DELETE");
    expect(await api(async () => err(409, "not_allowed")).remove()).toEqual({
      ok: false,
      code: "not_allowed",
    });
  });
});
