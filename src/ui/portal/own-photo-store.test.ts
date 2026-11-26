import { describe, expect, it, vi } from "vitest";
import { jpegOf } from "@/test/photo-fixtures";
import { createOwnPhotoStore } from "./own-photo-store";
import type { PhotoApi } from "./photo-api";
import type { PhotoCheck } from "./profile-photo";

const blob = new Blob([new Uint8Array(2)], { type: "image/png" });
const goodFile = () => new Blob([new Uint8Array(2)]);
const prepared = new Uint8Array(jpegOf(64, 64));

function setup(
  over: Partial<Record<"get" | "put" | "remove", unknown>> = {},
  prepare: (f: Blob) => Promise<PhotoCheck> = async () => ({
    ok: true,
    bytes: prepared,
    type: "jpeg",
  }),
) {
  let n = 0;
  const api = {
    get: vi.fn(async () => ({ ok: true as const, value: null as Blob | null })),
    put: vi.fn(async () => ({ ok: true as const, value: { hasPhoto: true, photoVersion: 1 } })),
    remove: vi.fn(async () => ({ ok: true as const, value: null })),
    ...over,
  } as unknown as PhotoApi;
  const create = vi.fn(() => `blob:${++n}`);
  const revoke = vi.fn();
  const onChange = vi.fn();
  return {
    api,
    create,
    revoke,
    onChange,
    store: createOwnPhotoStore({ api, create, revoke, onChange, prepare }),
  };
}

describe("own photo store", () => {
  it("load 404: status ready, url null, create not called", async () => {
    const s = setup();
    await s.store.load();
    expect(s.store.snapshot()).toEqual({ status: "ready", url: null });
    expect(s.create).not.toHaveBeenCalled();
  });

  it("load 200: status ready, url from create, onChange called", async () => {
    const s = setup({ get: vi.fn(async () => ({ ok: true, value: blob })) });
    await s.store.load();
    expect(s.store.snapshot()).toEqual({ status: "ready", url: "blob:1" });
    expect(s.onChange).toHaveBeenCalled();
  });

  it("load error: status failed, url null", async () => {
    const s = setup({ get: vi.fn(async () => ({ ok: false, code: "unavailable" })) });
    await s.store.load();
    expect(s.store.snapshot()).toEqual({ status: "failed", url: null });
  });

  it("upload success: put gets the stripped bytes and type; the URL swaps in place with no second get; the old URL is revoked", async () => {
    const s = setup({ get: vi.fn(async () => ({ ok: true, value: blob })) });
    await s.store.load();
    expect(await s.store.upload(goodFile())).toEqual({ ok: true });
    expect(s.api.put).toHaveBeenCalledTimes(1);
    expect((s.api.put as ReturnType<typeof vi.fn>).mock.calls[0][1]).toBe("jpeg");
    expect(s.api.get).toHaveBeenCalledTimes(1);
    expect(s.store.snapshot().url).toBe("blob:2");
    expect(s.revoke).toHaveBeenCalledWith("blob:1");
  });

  it("upload order is prepare, onUploading, put; put receives the prepared bytes", async () => {
    const order: string[] = [];
    const s = setup(
      {
        put: vi.fn(async () => {
          order.push("put");
          return { ok: true, value: { hasPhoto: true, photoVersion: 1 } };
        }),
      },
      async () => {
        order.push("prepare");
        return { ok: true, bytes: prepared, type: "jpeg" };
      },
    );
    await s.store.upload(goodFile(), () => order.push("uploading"));
    expect(order).toEqual(["prepare", "uploading", "put"]);
    expect((s.api.put as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(prepared);
  });

  it("upload refused by prepare: put and onUploading not called, code returned, URL unchanged", async () => {
    const s = setup({}, async () => ({ ok: false, code: "read_failed" }));
    const onUploading = vi.fn();
    const r = await s.store.upload(goodFile(), onUploading);
    expect(r).toEqual({ ok: false, code: "read_failed" });
    expect(s.api.put).not.toHaveBeenCalled();
    expect(onUploading).not.toHaveBeenCalled();
    expect(s.store.snapshot().url).toBeNull();
  });

  it("upload refused by the server (422): code returned, URL unchanged, nothing revoked", async () => {
    const s = setup({
      get: vi.fn(async () => ({ ok: true, value: blob })),
      put: vi.fn(async () => ({ ok: false, code: "image_bad_size" })),
    });
    await s.store.load();
    expect(await s.store.upload(goodFile())).toEqual({ ok: false, code: "image_bad_size" });
    expect(s.store.snapshot().url).toBe("blob:1");
    expect(s.revoke).not.toHaveBeenCalled();
  });

  it("remove success: url null, old URL revoked; remove 409: URL kept, code returned", async () => {
    const s = setup({ get: vi.fn(async () => ({ ok: true, value: blob })) });
    await s.store.load();
    expect(await s.store.remove()).toEqual({ ok: true });
    expect(s.store.snapshot().url).toBeNull();
    expect(s.revoke).toHaveBeenCalledWith("blob:1");

    const f = setup({
      get: vi.fn(async () => ({ ok: true, value: blob })),
      remove: vi.fn(async () => ({ ok: false, code: "not_allowed" })),
    });
    await f.store.load();
    expect(await f.store.remove()).toEqual({ ok: false, code: "not_allowed" });
    expect(f.store.snapshot().url).toBe("blob:1");
  });

  it("a get that resolves after an upload does not overwrite it (create called once for the upload only)", async () => {
    let release: (v: unknown) => void = () => {};
    const s = setup({
      get: vi.fn(
        () =>
          new Promise((r) => {
            release = r;
          }),
      ),
    });
    const loading = s.store.load();
    await s.store.upload(goodFile());
    release({ ok: true, value: blob });
    await loading;
    expect(s.create).toHaveBeenCalledTimes(1);
    expect(s.store.snapshot().url).toBe("blob:1");
  });

  it("dispose revokes the current URL; a get that resolves after dispose creates no URL and calls no onChange", async () => {
    const s = setup({ get: vi.fn(async () => ({ ok: true, value: blob })) });
    await s.store.load();
    s.store.dispose();
    expect(s.revoke).toHaveBeenCalledWith("blob:1");

    let release: (v: unknown) => void = () => {};
    const late = setup({
      get: vi.fn(
        () =>
          new Promise((r) => {
            release = r;
          }),
      ),
    });
    const loading = late.store.load();
    late.store.dispose();
    release({ ok: true, value: blob });
    await loading;
    expect(late.create).not.toHaveBeenCalled();
    expect(late.onChange).not.toHaveBeenCalled();
  });
});
